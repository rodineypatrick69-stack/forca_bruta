let hpeSharedOwner=null,hpeSharedReady=false,hpeSharedBusy=false,hpeSharedTimer,hpeSharedCache={},hpeSharedConflict=false;
const sharedBar=document.createElement('section');sharedBar.className='hpe-shared-bar';sharedBar.hidden=true;sharedBar.innerHTML='<span id="hpeSharedStatus" role="status"></span><button onclick="hpeSharedRefresh()">Atualizar acompanhamento</button>';document.body.append(sharedBar);
function hpeSharedStatus(text){$('#hpeSharedStatus').textContent=text;sharedBar.hidden=!hpeProfile||hpeProfile.role==='adm'}
function hpeSharedStudents(){return hpeProfile?.role==='aluno'?data.students.filter(s=>s.id===1):visibleStudents().filter(s=>s.supabaseId)}
function hpeCoachAttendance(s){if(hpeProfile?.role!=='personal')return data.appointmentAttendance?.[s.id]||{};const attendance={};for(const dates of Object.values(data.appointmentCompletions||{}))for(const [key,entry] of Object.entries(dates||{}))if(Number(entry?.student)===Number(s.id))attendance[key]={completedAt:entry.completedAt||null};return attendance}
function hpeStudentPayload(s,kind){const id=s.id;return kind==='program'?{plan:data.plans[id]||[],alternate:data.alternatePlans?.[id]||{},names:data.blockNames?.[id]||{},goals:data.studentGoals[id]||{},excused:data.excusedDays[id]||{},attendance:hpeCoachAttendance(s)}:{logs:data.logs.filter(l=>l.student===id),measurements:data.measurements.filter(m=>m.student===id),water:data.dailyWater[id]||{},reminderTime:data.trainingReminderTimes?.[id]||'',intake:data.consultationIntakes?.[id]||null,checkins:data.consultationCheckins?.[id]||[]}}
function hpeApplyStudent(s,kind,p){const id=s.id;if(kind==='program'){data.plans[id]=p.plan||[];data.alternatePlans??={};data.alternatePlans[id]=p.alternate||{};data.blockNames[id]=p.names||{};data.studentGoals[id]=p.goals||{};data.excusedDays[id]=p.excused||{};data.appointmentAttendance??={};data.appointmentAttendance[id]=p.attendance||{}}else{data.logs=data.logs.filter(l=>l.student!==id).concat((p.logs||[]).map(l=>({...l,student:id})));data.measurements=data.measurements.filter(m=>m.student!==id).concat((p.measurements||[]).map(m=>({...m,student:id})));data.dailyWater[id]=p.water||{};data.trainingReminderTimes??={};if(p.reminderTime)data.trainingReminderTimes[id]=p.reminderTime;else delete data.trainingReminderTimes[id];data.consultationIntakes??={};data.consultationCheckins??={};if(p.intake)data.consultationIntakes[id]=p.intake;else delete data.consultationIntakes[id];data.consultationCheckins[id]=Array.isArray(p.checkins)?p.checkins:[]}}
const hpeStudentNotificationKey='hpe-student-training-notifications';
window.hpeTrainingNotificationsEnabled=()=>localStorage.getItem(hpeStudentNotificationKey)==='true';
window.enableStudentTrainingNotifications=async()=>{if(window.hpeTrainingNotificationsEnabled()){localStorage.setItem(hpeStudentNotificationKey,'false');render();toast('Lembretes desativados neste aparelho.');return}if(!('serviceWorker'in navigator)||typeof Notification==='undefined'){toast('Este navegador não oferece notificações para o app.');return}try{const permission=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;if(permission==='granted'){localStorage.setItem(hpeStudentNotificationKey,'true');render();toast('Notificações de treino ativadas neste aparelho.')}else toast('Permita notificações do HPE nas configurações do navegador.')}catch{toast('Não foi possível ativar as notificações neste navegador.')}};
function hpeNotifyStudent(title,body,tag){if(!window.hpeTrainingNotificationsEnabled()||typeof Notification==='undefined'||Notification.permission!=='granted'||!('serviceWorker'in navigator))return;navigator.serviceWorker.ready.then(registration=>registration.showNotification(title,{body,icon:new URL('icon-192.png',location.href).href,badge:new URL('icon-192.png',location.href).href,tag,renotify:false,data:{url:location.href}})).catch(()=>{})}
function hpeProgramSignature(payload){return JSON.stringify({plan:payload?.plan||[],alternate:payload?.alternate||{},names:payload?.names||{}})}
function hpeStudentProgramChanged(old,row){if(!old?.revision||!row||old.revision===row.revision)return false;try{return hpeProgramSignature(JSON.parse(old.snapshot||'{}'))!==hpeProgramSignature(row.payload)}catch{return false}}
function hpeNotifyStudentPlanUpdated(){const message='Seu personal acabou de atualizar sua planilha! Dá uma olhada no seu novo desafio.';toast(message);hpeNotifyStudent('Seu personal atualizou sua planilha!',message,'hpe-plan-update-'+Date.now())}
function hpeSaoPauloTime(date){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);return {hour:Number(parts.find(x=>x.type==='hour')?.value),minute:Number(parts.find(x=>x.type==='minute')?.value)}}
function hpeTrainingReminderTick(){if(hpeProfile?.role!=='aluno'||document.visibilityState!=='visible'||!window.hpeTrainingNotificationsEnabled()||workoutStarted||document.body.classList.contains('signed-out'))return;const today=todayKey();if(typeof trainedOn==='function'&&trainedOn(student,today))return;const scheduled=typeof goalsFor==='function'?goalsFor(student).days||[]:[];if(scheduled.length&&!scheduled.includes(weekDay(today)))return;let target=data.trainingReminderTimes?.[student];if(!target){const cutoff=Date.now()-30*86400000,counts=new Map();for(const log of (data.logs||[]).filter(x=>Number(x.student)===Number(student)&&new Date(x.date).getTime()>=cutoff)){const hour=hpeSaoPauloTime(new Date(log.date)).hour;counts.set(hour,(counts.get(hour)||0)+1)}const common=[...counts].sort((a,b)=>b[1]-a[1])[0];if(!common||common[1]<2)return;target=String(common[0]).padStart(2,'0')+':00'}if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(target))return;const [hour,minute]=target.split(':').map(Number),now=hpeSaoPauloTime(new Date()),elapsed=now.hour*60+now.minute-(hour*60+minute+15);if(elapsed<0||elapsed>90)return;const key='hpe-last-habit-reminder-'+student;if(localStorage.getItem(key)===today)return;localStorage.setItem(key,today);hpeNotifyStudent('A barra já está com saudades de você.','Bora liberar a endorfina de hoje?','hpe-habit-'+student+'-'+today);toast('A barra já está com saudades de você. Bora liberar a endorfina de hoje?')}
function hpeSharedMeta(){localStorage.setItem('hpe-shared-meta-'+hpeSharedOwner,JSON.stringify(hpeSharedCache))}
async function hpeSharedStart(profile){
 if(window.hpeNetworkAllowed?.()===false)return;
 hpeSharedOwner=profile.id;hpeSharedReady=false;hpeSharedConflict=false;hpeSharedCache={};if(profile.role==='adm'){sharedBar.hidden=true;return}
 if(profile.role==='aluno'){data.students[0].supabaseId=profile.id;data.students[0].personalId=profile.personal_id}
 try{hpeSharedCache=JSON.parse(localStorage.getItem('hpe-shared-meta-'+profile.id))||{}}catch{}
 await hpeSharedRefresh(true);
}
window.hpeSharedRefresh=async(initial=false)=>{
 if(window.hpeNetworkAllowed?.()===false)return;
 if(!hpeProfile||hpeProfile.role==='adm'||hpeSharedBusy)return;
 if(window.isWorkoutActive?.()||(!initial&&$('#modal').open)){hpeSharedStatus('Finalize o treino ou feche o formulário antes de atualizar.');return}
 if(hpeSharedConflict){modal('<h2>Alterações no acompanhamento</h2><p>Há versões diferentes dos mesmos registros. Baixe uma cópia deste aparelho antes de carregar a versão do servidor.</p><button onclick="hpeSyncBackup()">Baixar cópia</button><button onclick="hpeSharedUseCloud()">Carregar acompanhamento do servidor</button>');return}
 const owner=hpeProfile.id,students=hpeSharedStudents();hpeSharedBusy=true;
 hpeSharedStatus('Carregando acompanhamento…');
 try{
  const ids=students.map(s=>s.supabaseId);if(!ids.length){hpeSharedReady=true;hpeSharedStatus('Cadastre um aluno para compartilhar o treino.');return}
  const {data:rows,error}=await hpeAuth.from('hpe_student_shared').select('*').in('student_id',ids);if(error)throw error;if(hpeProfile?.id!==owner)return;
  for(const s of students)for(const kind of ['program','progress']){
   const key=s.supabaseId+':'+kind,row=rows.find(r=>r.student_id===s.supabaseId&&r.channel===kind),old=hpeSharedCache[key];
   const current=JSON.stringify(hpeStudentPayload(s,kind)),writable=profileCanWrite(kind),programUpdated=hpeProfile.role==='aluno'&&kind==='program'&&hpeStudentProgramChanged(old,row);
   const pending=writable&&old&&current!==old.snapshot;
   if(pending&&row&&row.revision!==old.revision){hpeSharedConflict=true;continue}
   if(row&&!pending){hpeApplyStudent(s,kind,row.payload);if(programUpdated)hpeNotifyStudentPlanUpdated();}
   hpeSharedCache[key]={revision:row?.revision||0,snapshot:pending?old.snapshot:JSON.stringify(row? hpeStudentPayload(s,kind):hpeEmptyStudentPayload(kind))};
  }
  const {data:messages,error:messageError}=await hpeAuth.from('hpe_student_messages').select('*').in('student_id',ids).order('created_at',{ascending:false}).limit(1000);if(messageError)throw messageError;
  if(hpeProfile?.id!==owner)return;
  data.messages=data.messages.filter(m=>m.pending||!students.some(s=>s.id===m.student));
  for(const m of messages.reverse()){if(data.messages.some(local=>local.id===m.id))continue;const s=students.find(s=>s.supabaseId===m.student_id);data.messages.push({id:m.id,student:s.id,role:m.author_id===m.student_id?'aluno':'personal',text:m.body,date:m.created_at})}
  hpeSharedReady=true;hpeSharedMeta();localStorage.setItem(window.hpeDataKey,JSON.stringify(data));
  hpeSharedStatus(hpeSharedConflict?'Conflito no acompanhamento. Toque em Atualizar acompanhamento.':'Acompanhamento atualizado');render();
 }catch{hpeSharedStatus('Falha ao carregar acompanhamento. Dados deste aparelho preservados.')}finally{hpeSharedBusy=false}
 if(hpeSharedReady&&!hpeSharedConflict)await hpeSharedFlush();
};
function profileCanWrite(kind){return hpeProfile?.role==='personal'||(hpeProfile?.role==='aluno'&&kind==='progress')}
function hpeEmptyStudentPayload(kind){return kind==='program'?{plan:[],alternate:{},names:{},goals:{},excused:{},attendance:{}}:{logs:[],measurements:[],water:{},reminderTime:'',intake:null,checkins:[]}}
async function hpeSharedFlush(){
 if(window.hpeNetworkAllowed?.()===false)return;
 if(!hpeSharedReady||hpeSharedBusy||hpeSharedConflict||hpeProfile?.id!==hpeSharedOwner)return;
 hpeSharedBusy=true;const owner=hpeSharedOwner;
 try{for(const s of hpeSharedStudents())for(const kind of ['program','progress']){
  if(!profileCanWrite(kind))continue;const key=s.supabaseId+':'+kind,payload=hpeStudentPayload(s,kind),snapshot=JSON.stringify(payload),state=hpeSharedCache[key];if(!state||snapshot===state.snapshot)continue;
  const {data:revision,error}=await hpeAuth.rpc('hpe_save_student',{target:s.supabaseId,kind,expected_revision:state.revision,student_payload:payload});
  if(hpeProfile?.id!==owner)return;
  if(error){if(error.message?.includes('SHARED_CONFLICT'))hpeSharedConflict=true;throw error}
  hpeSharedCache[key]={revision,snapshot};hpeSharedMeta();
 }hpeSharedStatus('Treinos e resultados compartilhados');
 }catch{hpeSharedStatus(hpeSharedConflict?'Conflito no acompanhamento. Toque em Atualizar acompanhamento.':'Alterações aguardando envio. Atualize com internet.')}finally{hpeSharedBusy=false}
}
const sharedSaveHook=window.hpeSyncChanged;window.hpeSyncChanged=()=>{sharedSaveHook?.();clearTimeout(hpeSharedTimer);hpeSharedTimer=setTimeout(hpeSharedFlush,900)};
window.hpeSharedUseCloud=async()=>{localStorage.setItem('hpe-shared-backup-'+hpeProfile.id,JSON.stringify(hpeSyncPayload(data)));hpeSharedCache={};hpeSharedMeta();hpeSharedConflict=false;$('#modal').close();await hpeSharedRefresh(true)};
window.message=async event=>{
 event.preventDefault();if(!hpeProfile||hpeProfile.role==='adm')return;const s=data.students.find(s=>s.id===student),text=new FormData(event.target).get('text').trim();if(!s?.supabaseId||!text||text.length>2000)return;
 const button=event.target.querySelector('button');button.disabled=true;
 try{const id=crypto.randomUUID();const {error}=await hpeAuth.from('hpe_student_messages').insert({id,student_id:s.supabaseId,author_id:hpeProfile.id,body:text});if(error)throw error;data.messages.push({id,student,role,text});event.target.reset();save();render();toast('Mensagem enviada ao acompanhamento.')}catch{toast('Não foi possível enviar a mensagem. Tente com internet.')}finally{button.disabled=false}
};
const sharedRender=render;render=function(){sharedRender();sharedBar.hidden=!hpeProfile||hpeProfile.role==='adm';if(page==='interacao')document.querySelectorAll('.muted').forEach(e=>{if(e.textContent.includes('Conversa demonstrativa'))e.textContent='Conversa compartilhada com seu aluno ou personal'})};
window.addEventListener('online',()=>hpeSharedRefresh());
const sharedGoals=window.editGoals;window.editGoals=coach=>{if(hpeProfile?.role==='aluno'){toast('Peça ao personal para ajustar suas metas compartilhadas.');return}sharedGoals(coach)};
const sharedSyncNow=window.hpeSyncNow;window.hpeSyncNow=async()=>{await sharedSyncNow();if(hpeSyncReady&&!hpeSyncConflict)await hpeSharedRefresh()};
setInterval(()=>{if(hpeProfile&&document.visibilityState==='visible'){if(hpeProfile.role==='aluno')hpeTrainingReminderTick();if(!window.isWorkoutActive?.()&&!$('#modal').open&&!hpeSharedConflict)hpeSharedRefresh()}},30000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')hpeTrainingReminderTick()});

