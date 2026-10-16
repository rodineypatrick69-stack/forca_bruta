const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes=new Map();const node=s=>nodes.get(s)||nodes.set(s,{innerHTML:'',textContent:'',hidden:true,close(){},querySelector(){return node('button')}}).get(s);
let profile={id:'user-a',name:'CEO',role:'adm'},signedOut=0,entered=null,handler;
const storage=new Map();const client={auth:{getUser:async()=>({data:{user:{id:'user-a'}}}),signOut:async()=>{signedOut++},onAuthStateChange:f=>{handler=f}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:profile,error:null})})})})};
const c={window:{supabase:{createClient:()=>client}},document:{},$:node,esc:String,showLogin(){},enterApp:r=>{entered=r},loginRole:'aluno',data:{},done:new Set(),save(){},toast(){},modal(){},adminScreen:()=>'',logoutButton:{},sessionStorage:{setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},localStorage:{getItem:()=>null},FormData:class{},setTimeout:f=>f(),console};
vm.createContext(c);vm.runInContext(fs.readFileSync('dist/supabase-auth.js','utf8'),c);
(async()=>{
  await vm.runInContext("hpeOpenSession({user:{id:'user-a'}},'adm')",c);assert.equal(entered,'adm');assert.equal(c.window.hpeDataKey,'hpe-user-user-a');
  entered=null;await vm.runInContext("hpeOpenSession({user:{id:'user-a'}},'personal')",c);assert.equal(entered,null);assert.equal(signedOut,1);assert.match(node('#loginError').textContent,/outro perfil/);
  profile=null;await vm.runInContext("hpeOpenSession({user:{id:'user-a'}})",c);assert.equal(signedOut,2);assert.match(node('#loginError').textContent,/perfil autorizado/);
  entered=null;vm.runInContext("enterApp('adm')",c);assert.equal(entered,null);
  handler('PASSWORD_RECOVERY',{});assert.equal(vm.runInContext('hpeRecovery',c),true);assert.equal(typeof node('#hpeNewPassword').onsubmit,'function');
  await vm.runInContext('logoutButton.onclick()',c);assert.equal(storage.has('forja-session'),false);
  console.log('OK: perfil validado, conta sem perfil bloqueada, perfil incorreto bloqueado, recuperação e saída.');
})().catch(e=>{console.error(e);process.exitCode=1});
