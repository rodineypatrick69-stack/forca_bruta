let hpeSharedOwner=null,hpeSharedReady=false,hpeSharedBusy=false,hpeSharedTimer,hpeSharedCache={},hpeSharedConflict=false;
const sharedBar=document.createElement('section');sharedBar.className='hpe-shared-bar';sharedBar.hidden=true;sharedBar.innerHTML='<span id="hpeSharedStatus" role="status"></span><button onclick="hpeSharedRefresh()">Atualizar acompanhamento</button>';document.body.append(sharedBar);
function hpeSharedStatus(text){$('#hpeSharedStatus').textContent=text;sharedBar.hidden=!hpeProfile||hpeProfile.role==='adm'}
function hpeSharedStudents(){return hpeProfile?.role==='aluno'?data.students.filter(s=>s.id===1):visibleStudents().filter(s=>s.supabaseId)}
function hpeStudentPayload(s,kind){const id=s.id;return kind==='program'?{plan:data.plans[id]||[],alternate:data.alternatePlans?.[id]||{},names:data.blockNames?.[id]||{},goals:data.studentGoals[id]||{},excused:data.excusedDays[id]||{}}:{logs:data.logs.filter(l=>l.student===id),measurements:data.measurements.filter(m=>m.student===id),water:data.dailyWater[id]||{}}}
function hpeApplyStudent(s,kind,p){const id=s.id;if(kind==='program'){data.plans[id]=p.plan||[];data.alternatePlans??={};data.alternatePlans[id]=p.alternate||{};data.blockNames[id]=p.names||{};data.studentGoals[id]=p.goals||{};data.excusedDays[id]=p.excused||{}}else{data.logs=data.logs.filter(l=>l.student!==id).concat((p.logs||[]).map(l=>({...l,student:id})));data.measurements=data.measurements.filter(m=>m.student!==id).concat((p.measurements||[]).map(m=>({...m,student:id})));data.dailyWater[id]=p.water||{}}}
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
   const current=JSON.stringify(hpeStudentPayload(s,kind)),writable=profileCanWrite(kind);
   const pending=writable&&old&&current!==old.snapshot;
   if(pending&&row&&row.revision!==old.revision){hpeSharedConflict=true;continue}
   if(row&&!pending)hpeApplyStudent(s,kind,row.payload);
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
function hpeEmptyStudentPayload(kind){return kind==='program'?{plan:[],alternate:{},names:{},goals:{},excused:{}}:{logs:[],measurements:[],water:{}}}
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
setInterval(()=>{if(hpeProfile&&document.visibilityState==='visible'&&!window.isWorkoutActive?.()&&!$('#modal').open&&!hpeSharedConflict)hpeSharedRefresh()},30000);

