let hpeOfflineMode=false,hpeOfflineReconnecting=false,hpeDraftReady=false;
const offlineBar=document.createElement('section');offlineBar.className='hpe-offline-bar';offlineBar.hidden=true;offlineBar.innerHTML='<span id="hpeOfflineStatus" role="status"></span><button onclick="hpePrepareOffline()">Preparar uso offline</button>';document.body.append(offlineBar);
function hpeOfflineStatus(text){$('#hpeOfflineStatus').textContent=text;offlineBar.hidden=!hpeProfile}
function hpeRememberOffline(profile){if(!['aluno','personal'].includes(profile.role))return;localStorage.setItem('hpe-offline-profile',JSON.stringify({id:profile.id,name:profile.name,role:profile.role,personal_id:profile.personal_id,license_limit:profile.license_limit,lifetime:profile.lifetime,verifiedAt:Date.now()}))}
function hpeOfflineProfile(){try{const p=JSON.parse(localStorage.getItem('hpe-offline-profile'));return p&&['aluno','personal'].includes(p.role)&&localStorage.getItem('hpe-user-'+p.id)?p:null}catch{return null}}
window.hpeOfflineResume=()=>{
 const p=hpeOfflineProfile();if(!p){hpeError('Entre uma vez com internet e baixe seus treinos antes de usar offline.');return}
 hpeOfflineMode=true;++hpeAuthVersion;hpeProfile=p;window.hpeDataKey='hpe-user-'+p.id;
 try{data=JSON.parse(localStorage.getItem(window.hpeDataKey))}catch{hpeError('Os treinos baixados não estão disponíveis.');return}
 window.activePersonalId=p.role==='personal'?p.id:p.personal_id;student=p.role==='aluno'?1:visibleStudents()[0]?.id||0;
 sessionStorage.setItem('forja-identity',JSON.stringify({role:p.role,personalId:window.activePersonalId,studentId:p.role==='aluno'?1:null}));
 enterApp(p.role);hpeOfflineSessionReady(p);hpeOfflineStatus('Sem internet · alterações salvas neste aparelho');
 hpeSyncOwner=p.id;let meta;try{meta=JSON.parse(localStorage.getItem('hpe-sync-meta-'+p.id))}catch{}hpeSyncRevision=meta?.revision||0;hpeSyncDirty=!!meta?.dirty;hpeSyncReady=false;
 hpeSharedOwner=p.id;try{hpeSharedCache=JSON.parse(localStorage.getItem('hpe-shared-meta-'+p.id))||{}}catch{}hpeSharedReady=false;
};
const offlineLogin=showLogin;showLogin=function(selected=loginRole){offlineLogin(selected);const p=hpeOfflineProfile();if(p)$('.demo-access').insertAdjacentHTML('beforeend',`<button type="button" onclick="hpeOfflineResume()">Continuar com dados baixados · ${esc(p.name)}</button><p class="note">Acesso local neste aparelho. Novos cadastros e recuperação de senha precisam de internet.</p>`)};window.showLogin=showLogin;
window.hpePrepareOffline=async()=>{
 if(!hpeProfile)return;hpeRememberOffline(hpeProfile);save();
 try{if(!('serviceWorker' in navigator))throw Error();const registration=await navigator.serviceWorker.ready;const worker=registration.installing||registration.waiting;if(worker&&worker.state!=='activated')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error()),30000);worker.addEventListener('statechange',()=>{if(worker.state==='activated'){clearTimeout(timer);resolve()}else if(worker.state==='redundant'){clearTimeout(timer);reject(Error())}})});const controller=registration.active||navigator.serviceWorker.controller;if(!controller)throw Error();const channel=new MessageChannel();const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error()),30000);channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data)};controller.postMessage({type:'HPE_OFFLINE_CHECK'},[channel.port2])});if(!result.ready)throw Error();hpeOfflineStatus('App baixado · treinos disponíveis sem internet');navigator.storage?.persist?.().catch(()=>{});toast('App e treinos baixados. GIFs e vídeos externos podem precisar de internet.')}catch{hpeOfflineStatus('Download incompleto. Abra o app com internet e tente novamente.')}
};
function hpeSaveDraft(){if(!hpeDraftReady||hpeProfile?.role!=='aluno')return;const key='hpe-workout-draft-'+hpeProfile.id;if(!workoutStarted){localStorage.removeItem(key);return}localStorage.setItem(key,JSON.stringify({started:workoutStarted,block:window.currentTrainingBlock,activeExercise,seriesEntries,done:[...done],rest:restTimer}))}
function hpeOfflineSessionReady(profile){
 hpeRememberOffline(profile);hpeDraftReady=false;
 if(profile.role==='aluno'){let draft;try{draft=JSON.parse(localStorage.getItem('hpe-workout-draft-'+profile.id))}catch{}if(draft&&Date.now()-draft.started<86400000&&['A','B','C'].includes(draft.block)){
  workoutStarted=draft.started;window.currentTrainingBlock=draft.block;activeExercise=draft.activeExercise||0;seriesEntries=draft.seriesEntries||[];done=new Set(draft.done||[]);restTimer=null;
  const left=draft.rest?Math.ceil((draft.rest.end-Date.now())/1000):0;if(left>0){const exercise=plan()[activeExercise];if(exercise){const original=exercise.rest;exercise.rest=left;window.startRest(activeExercise);exercise.rest=original}}
  page='treinos';render();toast('Treino em andamento recuperado neste aparelho.');
 }}
 hpeDraftReady=true;hpeSaveDraft();hpeOfflineStatus(navigator.onLine?'Dados locais prontos · prepare o app offline':'Sem internet · registros salvos neste aparelho');
}
async function hpeReconnectOffline(){
 if(window.hpeNetworkAllowed?.()===false)return;
 if(!navigator.onLine||hpeOfflineReconnecting||!hpeProfile)return;
 hpeOfflineReconnecting=true;const profile=hpeProfile;
 try{
  const {data:session,error}=await hpeAuth.auth.getSession();if(error||!session.session){hpeOfflineStatus('Internet voltou · entre novamente para enviar os registros');return}
  const {data:user,error:userError}=await hpeAuth.auth.getUser();if(userError||user.user?.id!==profile.id){hpeOfflineStatus('Entre novamente para sincronizar os dados guardados');return}
  const {data:verified,error:profileError}=await hpeAuth.from('hpe_profiles').select('id,name,role,personal_id,license_limit,lifetime').eq('id',profile.id).single();if(profileError||verified.role!==profile.role){hpeOfflineStatus('Seu acesso precisa ser confirmado pelo administrador');return}
  hpeOfflineMode=false;hpeProfile=verified;hpeRememberOffline(verified);
  if(window.isWorkoutActive?.()){hpeSyncReady=true;hpeSharedReady=true;await hpeSyncFlush();await hpeSharedFlush()}
  else {await hpeSyncStart(verified);await hpeSyncFlush();if(!hpeSharedReady)await hpeSharedStart(verified);else await hpeSharedFlush()}
  await hpeFlushChatOutbox();hpeOfflineStatus('Conexão restaurada · confira os indicadores de sincronização');
 }catch{hpeOfflineStatus('Conexão instável · registros continuam guardados')}finally{hpeOfflineReconnecting=false}
}
let hpeChatSending=false;
window.message=event=>{
 event.preventDefault();if(!hpeProfile||hpeProfile.role==='adm')return;const s=data.students.find(s=>s.id===student),text=new FormData(event.target).get('text').trim();if(!s?.supabaseId||!text||text.length>2000)return;
 const id=crypto.randomUUID();data.chatOutbox??=[];data.chatOutbox.push({id,student_id:s.supabaseId,author_id:hpeProfile.id,body:text,localStudent:student,role});data.messages.push({id,student,role,text,pending:true});event.target.reset();save();render();toast(navigator.onLine?'Mensagem guardada para envio.':'Mensagem guardada; será enviada quando houver conexão.');hpeFlushChatOutbox();
};
async function hpeFlushChatOutbox(){if(!navigator.onLine||hpeOfflineMode||hpeChatSending||!hpeProfile)return;hpeChatSending=true;try{for(const item of [...(data.chatOutbox||[])]){if(item.author_id!==hpeProfile.id)continue;const {error}=await hpeAuth.from('hpe_student_messages').insert({id:item.id,student_id:item.student_id,author_id:item.author_id,body:item.body});if(error&&error.code!=='23505')break;data.chatOutbox=data.chatOutbox.filter(m=>m.id!==item.id);const local=data.messages.find(m=>m.id===item.id);if(local)local.pending=false;save()}}finally{hpeChatSending=false}}
const offlineRender=render;render=function(){offlineRender();offlineBar.hidden=!hpeProfile;hpeSaveDraft()};
const offlineEndRest=window.endRest;window.endRest=()=>{offlineEndRest();hpeSaveDraft()};
window.addEventListener('offline',()=>{if(hpeProfile){hpeOfflineMode=true;hpeOfflineStatus('Sem internet · registros salvos neste aparelho')}});
window.addEventListener('online',hpeReconnectOffline);
setInterval(()=>{hpeSaveDraft();if(navigator.onLine&&hpeProfile){if(hpeOfflineMode)hpeReconnectOffline();else{hpeSyncFlush();hpeSharedFlush();hpeFlushChatOutbox()}}},15000);
const offlineLogout=logoutButton.onclick;logoutButton.onclick=async()=>{await offlineLogout();if(!hpeProfile){localStorage.removeItem('hpe-offline-profile');hpeDraftReady=false;offlineBar.hidden=true}};
if(document.body.classList.contains('signed-out'))showLogin(loginRole);

