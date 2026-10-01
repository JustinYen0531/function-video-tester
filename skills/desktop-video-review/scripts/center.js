const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const home=process.env.LOCALAPPDATA||path.join(os.homedir(),'.local','share');
const configDir=path.join(home,'function-video-tester');
const configFile=process.env.REVIEW_CENTER_CONFIG||path.join(configDir,'center.local.json');
function locate(){
 let config={};if(fs.existsSync(configFile))config=JSON.parse(fs.readFileSync(configFile,'utf8').replace(/^\uFEFF/,''));
 const root=process.env.REVIEW_CENTER_HOME||config.root;
 if(!root)throw Error('尚未設定中心位置；請執行 center.js configure 中心資料夾');
 const real=fs.realpathSync(root);const manifest=JSON.parse(fs.readFileSync(path.join(real,'package.json'),'utf8'));
 if(manifest.name!=='desktop-video-review-center')throw Error('指定位置不是驗收影片中心');
 if(config.dataDir&&!process.env.REVIEW_DATA_DIR)process.env.REVIEW_DATA_DIR=config.dataDir;
 return {root:real,api:require(path.join(real,'server.js'))};
}
function run(){
 const [command,arg,extra]=process.argv.slice(2);
 if(command==='configure'){
  if(!arg||!path.isAbsolute(arg))throw Error('請提供中心資料夾完整路徑');
  const root=fs.realpathSync(arg),manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  if(manifest.name!=='desktop-video-review-center')throw Error('指定位置不是驗收影片中心');
  const dataDir=process.env.REVIEW_DATA_DIR||path.join(root,'data');fs.mkdirSync(path.dirname(configFile),{recursive:true});
  fs.writeFileSync(configFile,JSON.stringify({root,dataDir},null,2));return {configured:true,configFile};
 }
 const {root,api}=locate();
 if(command==='projects')return {root,projects:api.projects()};
 if(command==='join'){const metadata=extra?JSON.parse(fs.readFileSync(extra,'utf8').replace(/^\uFEFF/,'')): {};return api.upsertProject({folder:arg,name:metadata.name,git:metadata.git,shortcut:metadata.shortcut});}
 if(command==='record'){
  const input=JSON.parse(fs.readFileSync(extra,'utf8').replace(/^\uFEFF/,''));
  const project=api.upsertProject({folder:arg});return api.register({...input,project:project.name,projectId:project.id});
 }
 throw Error('用法：center.js configure 中心資料夾 | projects | join 當前專案資料夾 [可選資料.json] | record 當前專案資料夾 結果.json');
}
try{console.log(JSON.stringify(run(),null,2));}catch(error){
 const [command,folder,file]=process.argv.slice(2);let pending=null;
 if(command==='record'&&file){try{const input=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));const dir=path.join(configDir,'pending');fs.mkdirSync(dir,{recursive:true});pending=path.join(dir,crypto.randomUUID()+'.local.json');fs.writeFileSync(pending,JSON.stringify({folder,input,error:error.message,savedAt:new Date().toISOString()},null,2));}catch(e){console.error('待登記副本未保存；請保留原始結果檔與影片：'+e.message);}}
 console.error(JSON.stringify({complete:false,error:error.message,pending,notice:'中心接入或登記尚未完成；保留原始結果檔與影片，修復後重試。'},null,2));process.exitCode=1;
}
