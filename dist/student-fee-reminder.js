// In-app reminder: the server selects only the authenticated student's own fees.
let hpeFeeOwner=null,hpeFeeRows=[],hpeFeeFetchedAt=0,hpeFeeBusyOwner=null;
function hpeOverdueFees(rows,today=todayKey()){
 return (Array.isArray(rows)?rows:[]).flatMap(f=>{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(f.month||''))return [];
  const {expected,received,due}=f;
  if(!Number.isSafeInteger(expected)||!Number.isSafeInteger(received)||expected<=0||received<0||received>=expected||!Number.isInteger(due)||due<1||due>31)return [];
  const days=new Date(Number(f.month.slice(0,4)),Number(f.month.slice(5)),0).getDate();
  const dueDate=`${f.month}-${String(Math.min(days,due)).padStart(2,'0')}`;
  return dueDate<today?[{month:f.month,dueDate,balance:expected-received}]:[];
 }).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
}
function hpeFeeStudent(){return hpeProfile?.role==='aluno'&&role==='aluno'&&!document.body.classList.contains('signed-out')?hpeProfile.id:null}
function hpePaintFeeReminder(){
 const existing=document.getElementById('hpe-fee-reminder'),owner=hpeFeeStudent();
 if(!owner||owner!==hpeFeeOwner||window.hpeNetworkAllowed?.()===false){existing?.remove();return}
 const fees=hpeOverdueFees(hpeFeeRows);
 if(!fees.length){existing?.remove();return}
 const html=`<span class="eyebrow">LEMBRETE DE PAGAMENTO</span><h2>Você tem ${fees.length===1?'uma mensalidade em atraso':`${fees.length} mensalidades em atraso`}</h2><p>Regularize o pagamento com seu personal para manter sua mensalidade em dia.</p><ul>${fees.map(f=>`<li><span>Mensalidade ${f.month.slice(5)}/${f.month.slice(0,4)}<small>Venceu em ${f.dueDate.split('-').reverse().join('/')}</small></span><strong>${money(f.balance)}</strong></li>`).join('')}</ul><p class="note">Se já pagou, peça ao personal para registrar o pagamento. Este aviso desaparece após a confirmação e atualização dos dados.</p><div class="fee-reminder-actions"><button class="primary" onclick="go('interacao')">Falar com meu personal</button><button onclick="hpeRefreshFeeReminder(true,true)">Atualizar situação</button></div>`;
 if(existing){if(existing.innerHTML!==html)existing.innerHTML=html;return}
 const content=document.getElementById('content');if(!content)return;
 const box=document.createElement('section');box.id='hpe-fee-reminder';box.className='card hpe-fee-reminder';box.setAttribute('role','status');box.setAttribute('aria-live','polite');box.innerHTML=html;content.prepend(box);
}
async function hpeRefreshFeeReminder(force=false,announce=false){
 const owner=hpeFeeStudent();
 if(owner!==hpeFeeOwner){hpeFeeOwner=owner;hpeFeeRows=[];hpeFeeFetchedAt=0;hpePaintFeeReminder()}
 if(!owner||!hpeAuth||window.hpeNetworkAllowed?.()===false){hpePaintFeeReminder();return}
 if(hpeFeeBusyOwner===owner||(!force&&Date.now()-hpeFeeFetchedAt<60000))return;
 hpeFeeBusyOwner=owner;hpeFeeFetchedAt=Date.now();
 try{
  const {data:rows,error}=await hpeAuth.rpc('hpe_my_fee_reminders');
  if(hpeFeeStudent()!==owner||hpeFeeOwner!==owner)return;
  if(error)throw error;
  hpeFeeRows=Array.isArray(rows)?rows:[];hpePaintFeeReminder();
  if(announce)toast(hpeOverdueFees(hpeFeeRows).length?'Situação atualizada com os registros do personal.':'Nenhuma mensalidade em atraso.');
 }catch{
  if(hpeFeeOwner===owner){hpeFeeRows=[];hpePaintFeeReminder();if(announce)toast('Não foi possível consultar. Tente novamente com internet.')}
 }finally{if(hpeFeeBusyOwner===owner)hpeFeeBusyOwner=null}
}
const feeReminderRender=render;
render=function(){feeReminderRender();hpePaintFeeReminder();void hpeRefreshFeeReminder()};
setInterval(()=>{if(document.visibilityState==='visible')void hpeRefreshFeeReminder()},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void hpeRefreshFeeReminder(true)});
window.addEventListener('online',()=>hpeRefreshFeeReminder(true));
window.addEventListener('offline',hpePaintFeeReminder);
