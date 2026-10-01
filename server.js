const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = __dirname;
const DATA = process.env.REVIEW_DATA_DIR || path.join(ROOT, 'data');
fs.mkdirSync(DATA, {recursive:true});
const DB = path.join(DATA,'records.json');
const PROJECTS = path.join(DATA,'projects.json');
function projects(){return fs.existsSync(PROJECTS)?JSON.parse(fs.readFileSync(PROJECTS,'utf8')):[];}
function projectIdentity(folder){
 if(typeof folder!=='string'||!path.isAbsolute(folder))throw Error('請提供專案資料夾完整路徑');
 const resolved=fs.realpathSync(folder);if(!fs.statSync(resolved).isDirectory())throw Error('專案路徑必須是資料夾');
 return {folder:resolved,key:process.platform==='win32'?resolved.toLowerCase():resolved};
}
function upsertProject(input){return locked(()=>{
 const identity=projectIdentity(input.folder),list=projects();let row=list.find(p=>p.key===identity.key);
 if(!row){row={id:crypto.randomUUID(),...identity,name:input.name||path.basename(identity.folder),git:'',shortcut:'',createdAt:new Date().toISOString()};list.push(row);}
 for(const field of ['name','git','shortcut'])if(typeof input[field]==='string'&&input[field].trim())row[field]=input[field].trim();
 fs.writeFileSync(PROJECTS+'.tmp',JSON.stringify(list,null,2));fs.renameSync(PROJECTS+'.tmp',PROJECTS);return row;
});}
const token = crypto.randomBytes(32).toString('hex');
function read(){return fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,'utf8')):[];}
function save(rows){fs.writeFileSync(DB+'.tmp',JSON.stringify(rows,null,2));fs.renameSync(DB+'.tmp',DB);}
function locked(action){let fd;try{fd=fs.openSync(DB+'.lock','wx');return action();}finally{if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(DB+'.lock');}}}
function register(input){
 return locked(()=>{
  for(const key of ['project','ticket','reason','result']) if(typeof input[key]!=='string'||!input[key].trim()) throw Error('請填寫 '+key);
  if(!['maintenance','confirmation'].includes(input.category)) throw Error('分類須為 maintenance 或 confirmation');
  for(const key of ['items','untested','retries']) if(!Array.isArray(input[key])) throw Error('請提供陣列 '+key);
  for(const item of input.items) if(!item||typeof item.feature!=='string'||typeof item.time!=='string'||typeof item.result!=='string') throw Error('測試項目須包含 feature、time、result');
  let video=null;
  if(input.video){const source=path.resolve(input.video);if(!['.mp4','.webm','.mkv','.mov'].includes(path.extname(source).toLowerCase())||!fs.statSync(source).isFile())throw Error('影片檔案無效');video=source;}
  const project=input.projectId?projects().find(p=>p.id===input.projectId):null;if(input.projectId&&!project)throw Error('找不到專案，請先加入中心');
  const row={id:crypto.randomUUID(),project:project?project.name:input.project,projectId:project?project.id:null,ticket:input.ticket,reason:input.reason,category:input.category,version:String(input.version||''),result:input.result,items:input.items,untested:input.untested,retries:input.retries,video,createdAt:new Date().toISOString(),status:'pending',comments:'',history:[],videoDeletedAt:null};
  const rows=read();rows.push(row);save(rows);return row;
 });
}
function json(res,code,value){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
const server=http.createServer(async(req,res)=>{
 try{
  const expected=`127.0.0.1:${server.address().port}`;
  if(req.headers.host!==expected){json(res,403,{error:'僅允許本機網址'});return;}
  const url=new URL(req.url,`http://${expected}`);
  if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; media-src 'self'; frame-ancestors 'none'"});res.end(fs.readFileSync(path.join(ROOT,'index.html'),'utf8').replace('__TOKEN__',token));return;}
  if(req.method==='GET'&&url.pathname==='/api/records'){json(res,200,read().map(r=>({...r,video:r.video?true:false,videoAvailable:!!r.video&&fs.existsSync(r.video)})));return;}
  if(req.method==='GET'&&url.pathname==='/api/projects'){json(res,200,projects());return;}
  if(req.method==='POST'&&url.pathname==='/api/projects'){
   if(req.headers['x-review-token']!==token||req.headers.origin!==`http://${expected}`){json(res,403,{error:'請由本機中心操作'});return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>65536)throw Error('資料太長');}
   json(res,200,upsertProject(JSON.parse(body)));return;
  }
  const match=url.pathname.match(/^\/api\/records\/([a-f0-9-]+)\/(review|delete-video|video)$/);
  if(!match){json(res,404,{error:'找不到項目'});return;}
  const rows=read(),row=rows.find(r=>r.id===match[1]);if(!row){json(res,404,{error:'找不到紀錄'});return;}
  if(req.method==='GET'&&match[2]==='video'){
   if(!row.video||!fs.existsSync(row.video)){json(res,404,{error:'影片已刪除或移動'});return;}
   const size=fs.statSync(row.video).size;let start=0,end=size-1;
   if(req.headers.range){const m=req.headers.range.match(/^bytes=(\d+)-(\d*)$/);if(!m){res.writeHead(416);res.end();return;}start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),end):end;if(start>end){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}}
   const types={'.mp4':'video/mp4','.webm':'video/webm','.mkv':'video/x-matroska','.mov':'video/quicktime'};
   res.writeHead(req.headers.range?206:200,{'Content-Type':types[path.extname(row.video).toLowerCase()],'Content-Length':end-start+1,'Accept-Ranges':'bytes',...(req.headers.range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});fs.createReadStream(row.video,{start,end}).on('error',()=>res.destroy()).pipe(res);return;
  }
  if(req.method!=='POST'||req.headers['x-review-token']!==token||req.headers.origin!==`http://${expected}`){json(res,403,{error:'請由本機中心操作'});return;}
  let body='';for await(const chunk of req){body+=chunk;if(body.length>65536)throw Error('意見太長');}const input=JSON.parse(body);
  locked(()=>{
  const rows=read(),row=rows.find(r=>r.id===match[1]);if(!row)throw Error('找不到紀錄');
  if(match[2]==='review'){
   if(!['pending','approved','changes'].includes(input.status)||!['maintenance','confirmation'].includes(input.category)||typeof input.comments!=='string')throw Error('審查資料無效');
   row.history.push({at:new Date().toISOString(),status:input.status,category:input.category,comments:input.comments});row.status=input.status;row.category=input.category;row.comments=input.comments;
  }else if(match[2]==='delete-video'){
   if(input.confirm!==row.ticket)throw Error('刪除確認不符');
   if(row.video){if(rows.some(r=>r.id!==row.id&&r.video===row.video))throw Error('其他紀錄仍使用此影片，請先處理共用紀錄');if(fs.existsSync(row.video))fs.unlinkSync(row.video);row.video=null;row.videoDeletedAt=new Date().toISOString();}
  }else throw Error('不支援的操作');
  save(rows);
  });json(res,200,{ok:true});
 }catch(error){json(res,400,{error:error.message});}
});
if(require.main===module)server.listen(Number(process.env.REVIEW_PORT||43127),'127.0.0.1',()=>console.log(`驗收影片中心 http://127.0.0.1:${server.address().port}`));
module.exports={server,register,read,projects,upsertProject};
