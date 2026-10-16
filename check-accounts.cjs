const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let handler,caller={id:'11111111-1111-1111-1111-111111111111',role:'personal',lifetime:false,license_limit:20},count=20,created=0,deleted=0,insertError=null,saved;
function query(){const q={select(){return q},eq(){return q},single:async()=>({data:caller}),then(resolve){resolve({count})},insert:async p=>{saved=p;return {error:insertError}}};return q}
const admin={from:query,auth:{getUser:async()=>({data:{user:{id:caller.id}}}),admin:{createUser:async()=>{created++;return {data:{user:{id:'22222222-2222-2222-2222-222222222222'}}}},deleteUser:async()=>{deleted++;return {error:null}}}}};
const c={createClient:()=>admin,Deno:{env:{get:()=> 'configured'},serve:f=>handler=f},Response,Set,Number,JSON};vm.createContext(c);vm.runInContext(fs.readFileSync('supabase/functions/hpe-accounts/index.ts','utf8').replace(/^import .*;\s*/,''),c);
const request=(body,token='valid')=>new Request('https://test',{method:'POST',headers:token?{authorization:'Bearer '+token}:{},body:JSON.stringify(body)});
(async()=>{
 const body={action:'create',name:'Aluno teste',email:'teste@example.com',password:'temporary123',role:'adm',days:[1,3]};
 assert.equal((await handler(request(body,''))).status,401);
 assert.equal((await handler(request(body))).status,409);assert.equal(created,0);
 count=19;assert.equal((await handler(request(body))).status,201);assert.equal(saved.role,'aluno');assert.equal(saved.personal_id,caller.id);
 caller.role='aluno';assert.equal((await handler(request(body))).status,403);
 caller.role='personal';insertError={message:'LICENSE_LIMIT'};assert.equal((await handler(request(body))).status,409);assert.equal(deleted,1);
 insertError=null;caller.role='adm';assert.equal((await handler(request(body))).status,201);assert.equal(saved.role,'personal');assert.equal(saved.license_limit,20);assert.equal(saved.lifetime,false);
 console.log('OK: autenticação, aluno bloqueado, papel forjado ignorado, licença, limpeza de falha e cadastro de personal.');
})().catch(e=>{console.error(e);process.exitCode=1});
