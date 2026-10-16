const vm=require('vm'),fs=require('fs'),assert=require('assert/strict');let remote=null,fail=null;const store=new Map(),nodes=new Map();const node=s=>nodes.get(s)||nodes.set(s,{hidden:false,textContent:'',open:false,innerHTML:''}).get(s);
const c={window:{addEventListener(){},isWorkoutActive:()=>false},document:{createElement:()=>node('bar'),body:{append(){}}},$:node,hpeProfile:{id:'a'},hpeAuth:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:remote,error:fail})})})}),rpc:async()=>({data:2,error:fail})},data:{students:[],password:'secret',ceoAccount:{password:'secret'},logs:[{count:2}]},hpeEmptyData:()=>({students:[],logs:[]}),localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},logoutButton:{onclick(){}},setTimeout:()=>0,clearTimeout(){},modal(){},render(){},Blob,URL};c.window.hpeDataKey='user-a';vm.createContext(c);vm.runInContext(fs.readFileSync('dist/cloud-sync.js','utf8'),c);
(async()=>{
 await vm.runInContext('hpeSyncStart(hpeProfile)',c);assert.equal(vm.runInContext('hpeSyncDirty',c),false);assert.equal(vm.runInContext('hpeSyncRevision',c),2);
 assert.equal(vm.runInContext('hpeSyncPayload(data).password',c),undefined);assert.equal(vm.runInContext('hpeSyncPayload(data).ceoAccount',c),undefined);
 c.window.hpeSyncChanged();fail={message:'network'};await vm.runInContext('hpeSyncFlush()',c);assert.equal(vm.runInContext('hpeSyncDirty',c),true);
 fail={message:'SYNC_CONFLICT'};await vm.runInContext('hpeSyncFlush()',c);assert.equal(vm.runInContext('hpeSyncConflict',c),true);
 fail=null;store.delete('hpe-sync-meta-a');store.delete('user-a');remote={revision:4,payload:{students:[],logs:[{count:9}]}};await vm.runInContext('hpeSyncStart(hpeProfile)',c);assert.equal(c.data.logs[0].count,9);
 console.log('OK: envio, carregamento da nuvem, senha excluída, falha preservada e conflito bloqueado.');
})().catch(e=>{console.error(e);process.exitCode=1});

