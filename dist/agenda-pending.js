function hpePendingLessons(id,now=Date.now()){
 if(role!=='personal'||!ownsStudent(id))return [];
 const today=dayKey(new Date(now)),pending=[];
 for(const a of data.appointments||[]){
  if(a.archived||a.student!==Number(id)||!/^\d{4}-\d{2}-\d{2}$/.test(a.since||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time||'')||!Number.isInteger(a.day)||a.day<0||a.day>6||!Number.isFinite(a.duration)||a.duration<=0)continue;
  const date=new Date(`${a.since}T12:00:00Z`);if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==a.since)continue;
  for(let key=shiftDay(a.since,(a.day-weekDay(a.since)+7)%7);key<=today;key=shiftDay(key,7)){
   const end=new Date(`${key}T${a.time}:00-03:00`).getTime()+a.duration*60000;
   if(end<=now&&!appointmentCompleted(a,key))pending.push({a,key,end});
  }
 }
 return pending.sort((a,b)=>a.end-b.end);
}
function hpePendingBadge(id,count){return `<button class="pending-lesson-badge ${count?'has-pending':''}" onclick="hpeOpenPending(${Number(id)})" aria-label="Ver aulas pendentes de ${esc(appointmentName(id))}">${count} ${count===1?'aula pendente':'aulas pendentes'}</button>`}
window.hpeOpenPending=id=>{
 if(role!=='personal'||!ownsStudent(id))return;
 const entries=hpePendingLessons(id);
 modal(`<h2>Aulas pendentes · ${esc(appointmentName(id))}</h2><p>Horários já encerrados, sem confirmação de conclusão, desde o início das programações ativas. Esta lista não confirma faltas nem gera cobranças.</p>${entries.map(({a,key})=>`<div class="pending-lesson-row"><div><b>${key.split('-').reverse().join('/')} · ${a.time}</b><p>${a.duration} min · ${esc(a.location||'Local não informado')}</p></div><button class="primary" onclick="hpeFinishPending(${esc(JSON.stringify(a.id))},${esc(JSON.stringify(key))},${Number(id)})">✓ Atendimento concluído</button></div>`).join('')||'<p class="empty">Nenhuma aula pendente na programação atual.</p>'}`);
};
window.hpeFinishPending=(appointment,key,id)=>{if(role!=='personal'||!ownsStudent(id))return;window.setAppointmentCompleted(appointment,key,true);window.hpeOpenPending(id)};
const pendingAgendaPanel=agendaPanel;
agendaPanel=function(){
 const counts=new Map(visibleStudents().map(s=>[s.id,hpePendingLessons(s.id).length]));
 const html=pendingAgendaPanel();
 const summary=[...counts].filter(([,count])=>count>0);
 return (summary.length?`<section class="card pending-lesson-summary"><h2>Aulas pendentes por aluno</h2><p>Horários encerrados sem conclusão nas programações ativas. Toque para revisar as datas.</p><div>${summary.map(([id,count])=>`<div><b>${esc(appointmentName(id))}</b>${hpePendingBadge(id,count)}</div>`).join('')}</div></section>`:'')+html;
};
