const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('node:crypto').webcrypto;
let handler,caller={id:'11111111-1111-1111-1111-111111111111',role:'personal',lifetime:false,license_limit:20},count=19,profiles=[],createdUsers=[],updated=[],insertError=null;
function query(table){
  const filters={};
  const q={
    select(){return q},eq(k,v){filters[k]=v;return q},or(){return q},order(){return q},
    single:async()=>({data:caller,error:null}),
    maybeSingle:async()=>({data:profiles.find(p=>Object.entries(filters).every(([k,v])=>p[k]===v))||null,error:null}),
    then(resolve,reject){return Promise.resolve({data:table==='hpe_profiles'?profiles:[],requests:[],count}).then(resolve,reject)},
    insert:async p=>{if(insertError)return {error:insertError};profiles.push(p);return {error:null}}
  };return q;
}
const admin={from:query,auth:{getUser:async()=>({data:{user:{id:caller.id}}}),admin:{
 createUser:async p=>{const user={id:'22222222-2222-2222-2222-222222222222',email:p.email,password:p.password};createdUsers.push(user);return {data:{user}}},
 deleteUser:async id=>({error:null}),
 updateUserById:async(id,p)=>{updated.push({id,...p});return {error:null}}
}}};
const anon={auth:{signInWithPassword:async({email,password})=>{const user=createdUsers.find(x=>x.email===email&&x.password===password);return user?{data:{session:{access_token:'access',refresh_token:'refresh',user:{id:user.id}}},error:null}:{data:{session:null},error:{message:'invalid'}}}}};
const c={createClient:(url,key)=>key==='anon-key'?anon:admin,Deno:{env:{get:k=>k==='SUPABASE_ANON_KEY'?'anon-key':'configured'},serve:f=>handler=f},Response,Request,Set,Number,JSON,crypto};vm.createContext(c);vm.runInContext(fs.readFileSync('supabase/functions/hpe-accounts/index.ts','utf8').replace(/^import .*;\s*/,''),c);
const origin='https://forja-treino-academia.younggoby6.chatgpt.site';
const request=(body,token='valid')=>new Request(origin,{method:'POST',headers:{origin,...token?{authorization:'Bearer '+token}:{},'content-type':'application/json'},body:JSON.stringify(body)});
(async()=>{
 const create={action:'create',name:'Aluno teste',email:'',password:'',goal:'Força',level:'Iniciante',days:[1,3]};
 assert.equal((await handler(request(create,''))).status,401);
 let response=await handler(request(create));assert.equal(response.status,201);
 const result=await response.json(),profile=profiles[0];
 assert.equal(profile.role,'aluno');assert.equal(profile.personal_id,caller.id);assert.match(profile.access_code,/^[A-F0-9]{16}$/);
 assert.match(profile.email,/^aluno\.[a-f0-9]{16}@hpe\.invalid$/);assert.equal(result.profile.email,undefined);
 assert.ok(result.temporary_password.length>=16);
 response=await handler(request({action:'student_login',access_code:profile.access_code,password:result.temporary_password},''));assert.equal(response.status,200);
 assert.equal((await response.json()).session.access_token,'access');
 const priorCode=profile.access_code;
 response=await handler(request({action:'reset_student_password',target:profile.id}));assert.equal(response.status,200);
 const reset=await response.json();assert.equal(reset.access_code,priorCode);assert.notEqual(reset.temporary_password,result.temporary_password);assert.equal(updated.length,1);
 caller={id:'33333333-3333-3333-3333-333333333333',role:'personal',lifetime:true,license_limit:20};
 response=await handler(request({action:'reset_student_password',target:profile.id}));assert.equal(response.status,404);assert.equal(updated.length,1);
 caller={id:'11111111-1111-1111-1111-111111111111',role:'personal',lifetime:false,license_limit:20};count=20;
 response=await handler(request(create));assert.equal(response.status,409);
 insertError={message:'LICENSE_LIMIT'};count=19;
 response=await handler(request(create));assert.equal(response.status,409);
 console.log('OK: criação sem e-mail, código único, login por código, redefinição vinculada ao personal e limite de licenças.');
})().catch(e=>{console.error(e);process.exitCode=1});
