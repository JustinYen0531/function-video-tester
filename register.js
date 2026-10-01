const fs=require('node:fs');
const {register}=require('./server');
try{if(!process.argv[2])throw Error('用法：node register.js 紀錄.json');const row=register(JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,'')));console.log(JSON.stringify({id:row.id,status:row.status,waiting:row.category==='confirmation'},null,2));}catch(e){console.error(e.message);process.exitCode=1;}
