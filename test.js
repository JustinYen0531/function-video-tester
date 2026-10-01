const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
test('登記、審查保護、播放範圍、刪除保留紀錄',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'review-test-'));process.env.REVIEW_DATA_DIR=temp;const {server,register,read}=require('./server');
 try{
  const video=path.join(temp,'sample.mp4');fs.writeFileSync(video,'0123456789');const input={project:'測試',ticket:'測試項目',reason:'新流程',result:'合成檔僅測資料傳送',category:'confirmation',video,items:[{feature:'測試',time:'00:00',result:'尚未畫面測試'}],untested:['畫面'],retries:[],status:'approved'};
  const row=register(input);assert.equal(row.status,'pending');assert.throws(()=>register({...input,category:'unknown'}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
  const html=await(await fetch(url)).text(),token=html.match(/const token='([^']+)'/)[1];
  let response=await fetch(url+`/api/records/${row.id}/video`,{headers:{Range:'bytes=2-5'}});assert.equal(response.status,206);assert.equal(await response.text(),'2345');
  response=await fetch(url+`/api/records/${row.id}/review`,{method:'POST',body:'{}'});assert.equal(response.status,403);
  const send=(route,data)=>fetch(url+`/api/records/${row.id}/${route}`,{method:'POST',headers:{Origin:url,'X-Review-Token':token},body:JSON.stringify(data)});
  response=await send('review',{status:'changes',category:'confirmation',comments:'請重錄'});assert.equal(response.status,200);assert.equal(read()[0].comments,'請重錄');
  response=await send('delete-video',{confirm:'錯誤'});assert.equal(response.status,400);assert.ok(fs.existsSync(video));
  response=await send('delete-video',{confirm:row.ticket});assert.equal(response.status,200);assert.ok(!fs.existsSync(video));assert.equal(read()[0].ticket,row.ticket);assert.equal(read()[0].history.length,1);
 }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});}
});
