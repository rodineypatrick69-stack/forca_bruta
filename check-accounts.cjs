const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('node:crypto').webcrypto;
let handler,caller={id:'11111111-1111-1111-1111-111111111111',role:'personal',lifetime:false,license_limit:20},count=19,profiles=[],createdUsers=[],updated=[],deletedUsers=[],insertError=null;
function query(table){
  const filters={};
  const q={
    select(){return q},update(values){q.updateValues=values;return q},eq(k,v){filters[k]=v;return q},or(){return q},order(){return q},
    single:async()=>({data:caller,error:null}),
    maybeSingle:async()=>{const profile=profiles.find(p=>Object.entries(filters).every(([k,v])=>p[k]===v))||null;if(profile&&q.updateValues)Object.assign(profile,q.updateValues);return {data:profile,error:null}},
    then(resolve,reject){if(q.updateValues){for(const p of profiles)if(Object.entries(filters).every(([k,v])=>p[k]===v))Object.assign(p,q.updateValues);return Promise.resolve({data:null,error:null}).then(resolve,reject)}return Promise.resolve({data:table==='hpe_profiles'?profiles:[],requests:[],count}).then(resolve,reject)},
    insert:async p=>{if(insertError)return {error:insertError};profiles.push(p);return {error:null}}
  };return q;
}
const admin={from:query,auth:{getUser:async()=>({data:{user:{id:caller.id}}}),admin:{
 createUser:async p=>{const user={id:'22222222-2222-2222-2222-222222222222',email:p.email,password:p.password};createdUsers.push(user);return {data:{user}}},
 deleteUser:async id=>{deletedUsers.push(id);profiles=profiles.filter(p=>p.id!==id);return {error:null}},
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
 assert.equal(profile.role,'aluno');assert.equal(profile.personal_id,caller.id);assert.match(profile.access_code,/^[0-9]{6}$/);assert.equal(profile.password_setup_required,true);
 assert.match(profile.email,/^aluno\.[0-9a-f-]+@hpe\.invalid$/);assert.equal(result.profile.email,undefined);
 assert.ok(result.temporary_password.length>=16);
 response=await handler(request({action:'student_login',access_code:profile.access_code,password:result.temporary_password},''));assert.equal(response.status,200);
 const loginResult=await response.json();assert.equal(loginResult.session.access_token,'access');assert.equal(loginResult.must_set_password,true);
 caller={id:profile.id,role:'aluno',password_setup_required:true};
 response=await handler(request({action:'complete_student_password_setup'}));assert.equal(response.status,200);assert.equal(profile.password_setup_required,false);
 caller={id:'11111111-1111-1111-1111-111111111111',role:'personal',lifetime:false,license_limit:20};
 const priorCode=profile.access_code;
 response=await handler(request({action:'reset_student_password',target:profile.id}));assert.equal(response.status,200);
 const reset=await response.json();assert.equal(reset.access_code,priorCode);assert.notEqual(reset.temporary_password,result.temporary_password);assert.equal(updated.length,1);assert.equal(profile.password_setup_required,true);
 caller={id:'33333333-3333-3333-3333-333333333333',role:'personal',lifetime:true,license_limit:20};
 response=await handler(request({action:'reset_student_password',target:profile.id}));assert.equal(response.status,404);assert.equal(updated.length,1);
 response=await handler(request({action:'update_student',target:profile.id,name:'Nome atualizado',whatsapp:'+5511999999999',goal:'Condicionamento',level:'Avançado',days:[0,2,4]}));assert.equal(response.status,404);
 response=await handler(request({action:'delete_student',target:profile.id}));assert.equal(response.status,404);assert.deepEqual(deletedUsers,[]);
 caller={id:'11111111-1111-1111-1111-111111111111',role:'personal',lifetime:false,license_limit:20};count=20;
 response=await handler(request({action:'update_student',target:profile.id,name:'Nome atualizado',whatsapp:'+5511999999999',goal:'Condicionamento',level:'Avançado',days:[0,2,4]}));assert.equal(response.status,200);assert.equal(profile.name,'Nome atualizado');assert.equal(profile.whatsapp,'+5511999999999');assert.equal(profile.goal,'Condicionamento');assert.equal(profile.level,'Avançado');assert.deepEqual(Array.from(profile.training_days),[0,2,4]);
 response=await handler(request({action:'update_student',target:profile.id,name:'',whatsapp:'',goal:'Condicionamento',level:'Avançado',days:[]}));assert.equal(response.status,400);
 response=await handler(request({action:'delete_student',target:profile.id}));assert.equal(response.status,200);assert.deepEqual(deletedUsers,[profile.id]);assert.equal(profiles.includes(profile),false);
 response=await handler(request(create));assert.equal(response.status,409);
 insertError={message:'LICENSE_LIMIT'};count=19;
 response=await handler(request(create));assert.equal(response.status,409);
 console.log('OK: criação/login/reset, edição de perfil, exclusão com verificação do personal e limite de licenças.');
})().catch(e=>{console.error(e);process.exitCode=1});
