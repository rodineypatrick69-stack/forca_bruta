let hpeDirectory=[],hpeRequests=[],hpeDirectoryError='',hpeDirectoryWarning='',hpeDirectoryLoaded=false,hpeDirectoryLoading=false;
async function hpeAccountsCall(body){ if(window.hpeNetworkAllowed?.()===false)throw Error('Desative o modo offline e conecte à internet para gerenciar contas.');
  if(!hpeAuth||!hpeProfile)throw Error('Entre novamente para gerenciar contas.');
  const {data:result,error}=await hpeAuth.functions.invoke('hpe-accounts',{body});
  if(error){let message='Cadastro indisponível. Atualize a função hpe-accounts e aplique student-signup.sql no Supabase.';try{const response=await error.context?.json();if(response?.error)message=response.error==='Operação desconhecida.'&&['update_personal','reset_personal_password'].includes(body.action)?'Esta função precisa ser ativada no servidor do HPE. Solicite a atualização ao responsável pelo aplicativo.':response.error}catch{}throw Error(message)}
  if(result?.error)throw Error(result.error);return result;
}
async function hpeAccountsRefresh(){
  if(!hpeProfile||hpeProfile.role==='aluno')return;
  if(window.hpeNetworkAllowed?.()===false){hpeDirectoryError='Conecte à internet para atualizar a lista de personais.';return}
  hpeDirectoryLoading=true;hpeDirectoryError='';hpeDirectoryWarning='';
  try{
    const result=await hpeAccountsCall({action:'list'});
    if(!Array.isArray(result?.profiles)||!Array.isArray(result?.requests))throw Error('O servidor retornou uma lista de contas inválida. Atualize novamente.');
    hpeDirectory=result.profiles;hpeRequests=result.requests;hpeDirectoryLoaded=true;
    window.hpeConsultationAccountIds=new Set();
    if(hpeProfile.role==='personal'){
      const {data:consultRows,error:consultError}=await hpeAuth.from('hpe_consultation_students').select('student_id').eq('personal_id',hpeProfile.id);
      if(consultError)hpeDirectoryWarning='A lista foi atualizada, mas os vínculos de consultoria não puderam ser atualizados.';
      else window.hpeConsultationAccountIds=new Set((consultRows||[]).map(row=>row.student_id));
    }
    data.personalAccounts=hpeDirectory.filter(p=>p.role==='personal').map(p=>({id:p.id,name:p.name,email:p.email||'',limit:p.license_limit,lifetime:p.lifetime}));
    for(const p of hpeDirectory.filter(p=>p.role==='aluno')){
      if(window.hpeConsultationAccountIds.has(p.id))continue;
      let s=data.students.find(s=>s.supabaseId===p.id);
      if(!s){let id=Date.now();while(data.students.some(s=>s.id===id))id++;s={id,supabaseId:p.id};data.students.push(s)}
      Object.assign(s,{name:p.name,personalId:p.personal_id,accessCode:p.access_code||'',goal:p.goal,level:p.level,whatsapp:p.whatsapp??''});
      data.studentGoals[s.id]={...(data.studentGoals[s.id]||{}),water:data.studentGoals[s.id]?.water||2000,weekly:p.training_days?.length??0,days:Array.isArray(p.training_days)?p.training_days:[],since:data.studentGoals[s.id]?.since||todayKey()};
      let a=data.studentAccounts.find(a=>a.student===s.id);if(!a){a={student:s.id};data.studentAccounts.push(a)}a.accessCode=p.access_code||'';delete a.email;
    }
    data.licenseRequests=hpeRequests.map(r=>({id:r.id,personalId:r.personal_id,status:r.status,quantity:20,created:r.created_at}));save();
  }catch(error){hpeDirectoryError=error?.message||'Não foi possível carregar as contas.'}
  finally{hpeDirectoryLoading=false}
}
window.hpeReloadAccounts=async()=>{if(hpeDirectoryLoading)return;hpeDirectoryError='';hpeDirectoryLoading=true;render();await hpeAccountsRefresh();render();toast(hpeDirectoryLoaded?'Contas atualizadas do Supabase.':hpeDirectoryError)};
window.hpeEditStudentProfile=id=>{
  if(hpeProfile?.role!=='personal')return;
  const s=data.students.find(item=>item.id===Number(id));if(!s||!ownsStudent(s.id))return toast('Aluno não encontrado na sua lista.');
  const profile=s.supabaseId?hpeDirectory.find(p=>p.id===s.supabaseId&&p.role==='aluno'):null;
  const savedDays=profile?.training_days??data.studentGoals?.[s.id]?.days??[];
  const days=Array.isArray(savedDays)?savedDays:[];
  const phone=hpeNormalizeWhatsApp(s.whatsapp)||'';
  modal(`<h2>Editar perfil do aluno</h2><p>Atualize os dados usados no acompanhamento. O plano e o histórico de treino serão mantidos.</p><form id="hpeStudentEditForm"><label>Nome completo<input name="name" value="${esc(s.name)}" maxlength="80" required></label><label>WhatsApp (opcional)<input name="whatsapp" type="tel" value="${phone?'+'+phone:''}" placeholder="(11) 99999-9999" maxlength="24"></label><label>Objetivo<select name="goal"><option ${s.goal==='Hipertrofia'?'selected':''}>Hipertrofia</option><option ${s.goal==='Condicionamento'?'selected':''}>Condicionamento</option><option ${s.goal==='Força'?'selected':''}>Força</option></select></label><label>Nível<select name="level"><option ${s.level==='Iniciante'?'selected':''}>Iniciante</option><option ${s.level==='Intermediário'?'selected':''}>Intermediário</option><option ${s.level==='Avançado'?'selected':''}>Avançado</option></select></label><fieldset><legend>Dias de treino</legend>${weekdaysFull.map((day,i)=>`<label><input type="checkbox" name="days" value="${i}" ${days.includes(i)?'checked':''}>${day}</label>`).join('')}</fieldset><p id="hpeStudentEditStatus" role="alert"></p><button class="primary">Salvar alterações</button><button type="button" onclick="$('#modal').close()">Cancelar</button></form>`);
  $('#hpeStudentEditForm').onsubmit=async event=>{
    event.preventDefault();const f=new FormData(event.target),status=$('#hpeStudentEditStatus'),button=event.target.querySelector('.primary');
    const whatsapp=hpeNormalizeWhatsApp(f.get('whatsapp'));
    if(whatsapp===null){status.textContent='Informe um WhatsApp válido com DDD ou deixe em branco.';return}
    const values={name:String(f.get('name')||'').trim(),whatsapp,goal:f.get('goal'),level:f.get('level'),days:[...new Set(f.getAll('days').map(Number))]};
    if(!values.name){status.textContent='Informe o nome do aluno.';return}
    button.disabled=true;
    try{
      if(s.supabaseId){await hpeAccountsCall({action:'update_student',target:s.supabaseId,...values});await hpeAccountsRefresh()}
      else{Object.assign(s,{name:values.name,whatsapp:values.whatsapp,goal:values.goal,level:values.level});data.studentGoals[s.id]={...(data.studentGoals[s.id]||{}),days:values.days,weekly:values.days.length};save()}
      $('#modal').close();render();toast('Perfil do aluno atualizado.');
    }catch(error){status.textContent=error.message}finally{button.disabled=false}
  };
};
function hpeRemoveStudentLocal(s){
  const id=s.id;data.students=data.students.filter(item=>item.id!==id);data.logs=data.logs.filter(item=>item.student!==id);data.measurements=data.measurements.filter(item=>item.student!==id);data.messages=data.messages.filter(item=>item.student!==id);data.studentAccounts=data.studentAccounts.filter(item=>item.student!==id);
  for(const key of ['plans','alternatePlans','blockNames','studentGoals','excusedDays','dailyWater'])if(data[key])delete data[key][id];
  if(s.supabaseId&&typeof hpeSharedCache!=='undefined'){delete hpeSharedCache[s.supabaseId+':program'];delete hpeSharedCache[s.supabaseId+':progress'];hpeSharedMeta?.()}
  if(student===id)student=visibleStudents()[0]?.id||0;
  if(s.supabaseId)hpeDirectory=hpeDirectory.filter(p=>p.id!==s.supabaseId);
  save();
}
window.hpeConfirmStudentDelete=id=>{
  if(hpeProfile?.role!=='personal')return;
  const s=data.students.find(item=>item.id===Number(id));if(!s||!ownsStudent(s.id))return toast('Aluno não encontrado na sua lista.');
  modal(`<h2>Excluir ${esc(s.name)}?</h2><p>Esta ação é permanente. A conta do aluno será removida, junto com o plano, o histórico de evolução e as mensagens vinculadas.</p><p>O código de acesso deixará de funcionar e a vaga de aluno será liberada.</p><button class="danger" onclick="hpeDeleteStudent(${s.id})">Excluir aluno permanentemente</button><button onclick="$('#modal').close()">Cancelar</button>`);
};
window.hpeDeleteStudent=async id=>{
  if(hpeProfile?.role!=='personal')return;
  const s=data.students.find(item=>item.id===Number(id));if(!s||!ownsStudent(s.id))return toast('Aluno não encontrado na sua lista.');
  const button=$('#modalbody .danger');if(button)button.disabled=true;
  try{if(s.supabaseId)await hpeAccountsCall({action:'delete_student',target:s.supabaseId});hpeRemoveStudentLocal(s);$('#modal').close();render();toast('Aluno excluído e dados vinculados removidos.')}catch(error){if(button)button.disabled=false;toast(error.message)}
};
function hpeAccountForm(kind){
  if(!hpeProfile||hpeProfile.role!==(kind==='personal'?'adm':'personal'))return;
  const studentForm=kind==='aluno';
  modal(`<h2>${studentForm?'Cadastrar aluno':'Cadastrar personal'}</h2><p>${studentForm?'A conta será criada sem e-mail. O sistema gera um código de 6 números e uma senha temporária. No primeiro acesso, o aluno escolherá a senha pessoal.':'A conta do personal será criada no Supabase.'}</p><form id="hpeAccountForm"><label>Nome completo<input name="name" maxlength="80" required></label>${studentForm?'': '<label>E-mail<input name="email" type="email" required autocomplete="off"></label><label>Senha inicial<input name="password" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label>'}${studentForm?`<label>WhatsApp (opcional)<input name="whatsapp" type="tel" autocomplete="tel" placeholder="(11) 99999-9999" maxlength="24"></label><label>Objetivo<select name="goal"><option>Hipertrofia</option><option>Condicionamento</option><option>Força</option></select></label><label>Nível<select name="level"><option>Iniciante</option><option>Intermediário</option><option>Avançado</option></select></label><fieldset><legend>Dias de treino</legend>${weekdaysFull.map((day,i)=>`<label><input type="checkbox" name="days" value="${i}">${day}</label>`).join('')}</fieldset><p class="note">O código tem 6 números. Entregue também a senha temporária; no primeiro acesso, o aluno escolherá a senha pessoal. Não é necessário e-mail.</p>`:'<p>O personal começa com 20 licenças.</p>'}<p id="hpeAccountStatus" role="alert"></p><button class="primary">${studentForm?'Criar conta e gerar acesso':'Criar conta no Supabase'}</button></form>`);
  $('#hpeAccountForm').onsubmit=async event=>{
    event.preventDefault();const f=new FormData(event.target),button=event.target.querySelector('button'),status=$('#hpeAccountStatus');
    const whatsapp=studentForm?hpeNormalizeWhatsApp(f.get('whatsapp')):'';
    if(whatsapp===null){status.textContent='Informe um WhatsApp válido com DDD ou código internacional.';return}
    button.disabled=true;
    try{
      const created=await hpeAccountsCall({action:'create',name:f.get('name'),email:studentForm?'':f.get('email'),password:studentForm?'':f.get('password'),whatsapp:studentForm?whatsapp:'',goal:f.get('goal'),level:f.get('level'),days:f.getAll('days').map(Number)});
      event.target.reset();$('#modal').close();await hpeAccountsRefresh();render();
      if(studentForm){
        hpeShowStudentCredentials(created.access_code,created.temporary_password,'Conta criada. Entregue estes dados ao aluno agora.',whatsapp);
      }else toast(hpeDirectoryLoaded?'Conta criada no Supabase.':'Conta criada; não foi possível atualizar a lista. Toque em Atualizar contas.');
    }catch(error){status.textContent=error.message}finally{button.disabled=false}
  };
}
let hpeCreatedStudentCredentials='';
function hpeShowStudentCredentials(code,password,title,phone=''){
  hpeCreatedStudentCredentials=`Código de acesso: ${code}\nSenha temporária: ${password}`;
  const normalizedPhone=hpeNormalizeWhatsApp(phone)||'';
  const studentUrl=new URL(location.pathname,location.origin);studentUrl.searchParams.set('perfil','aluno');
  const message=`Olá! Seu acesso ao HPE Força Bruta foi criado.\n\nAcesse: ${studentUrl.href}\nEscolha “Sou aluno”.\nCódigo de acesso (6 números): ${code}\nSenha temporária: ${password}\n\nNo primeiro acesso, entre com esses dados e crie sua senha pessoal. Nas próximas vezes, use o mesmo código e sua nova senha. Bons treinos!`;
  modal(`<h2>${esc(title)}</h2><p>Compartilhe o link do app e os dados abaixo. No primeiro acesso, o aluno cria a senha pessoal.</p><label>Link direto para aluno<input id="hpeCredentialAppLink" readonly value="${esc(studentUrl.href)}" onclick="this.select()"></label><button type="button" onclick="hpeCopyStudentAppLink()">Copiar link do app</button><label>Código de acesso<input readonly value="${esc(code)}" onclick="this.select()"></label><label>Senha temporária<input readonly value="${esc(password)}" onclick="this.select()"></label><button class="primary" onclick="hpeCopyStudentCredentials()">Copiar código e senha</button><label>Mensagem pronta para o WhatsApp<textarea id="hpeCredentialWhatsAppMessage" rows="8">${esc(message)}</textarea></label><a id="hpeCredentialWhatsAppLink" class="whatsapp-link" target="_blank" rel="noopener noreferrer">📲 Enviar convite pelo WhatsApp</a><p id="hpeCredentialStatus" role="status"></p><p class="note">${normalizedPhone?'O WhatsApp abrirá a conversa com o número informado.':'Escolha a conversa do aluno no WhatsApp.'} Confira o destinatário e toque em Enviar.</p>`);
  const link=$('#hpeCredentialWhatsAppLink'),messageField=$('#hpeCredentialWhatsAppMessage');
  const updateLink=()=>{const destination=normalizedPhone?'https://wa.me/'+normalizedPhone+'?text=':'https://wa.me/?text=';link.href=destination+encodeURIComponent(messageField.value)};
  messageField.oninput=updateLink;updateLink();
}
window.hpeCopyStudentCredentials=async()=>{try{await navigator.clipboard.writeText(hpeCreatedStudentCredentials);$('#hpeCredentialStatus').textContent='Dados copiados.'}catch{$('#hpeCredentialStatus').textContent='Selecione e copie os dois campos.'}};
window.hpeCopyStudentAppLink=async()=>{try{await navigator.clipboard.writeText($('#hpeCredentialAppLink').value);$('#hpeCredentialStatus').textContent='Link copiado.'}catch{$('#hpeCredentialAppLink').select();$('#hpeCredentialStatus').textContent='Selecione e copie o link.'}};
window.hpeConfirmStudentReset=id=>{
  if(hpeProfile?.role!=='personal')return;const profile=hpeDirectory.find(p=>p.id===id&&p.role==='aluno'&&p.personal_id===hpeProfile.id);
  if(!profile)return toast('Aluno não encontrado na sua lista.');
  modal(`<h2>Redefinir senha de ${esc(profile.name)}</h2><p>A senha atual deixará de funcionar. O código de acesso permanecerá o mesmo.</p><button class="primary" onclick="hpeResetStudentPassword('${esc(id)}')">Gerar senha temporária</button>`);
};
window.hpeResetStudentPassword=async id=>{
  if(hpeProfile?.role!=='personal')return;
  try{const targetProfile=hpeDirectory.find(p=>p.id===id&&p.role==='aluno'&&p.personal_id===hpeProfile.id);if(!targetProfile)throw new Error('Aluno não encontrado na sua lista.');const result=await hpeAccountsCall({action:'reset_student_password',target:id});hpeShowStudentCredentials(result.access_code,result.temporary_password,'Nova senha temporária gerada.',targetProfile.whatsapp);}
  catch(error){modal(`<h2>Não foi possível redefinir</h2><p>${esc(error.message)}</p><button onclick="$('#modal').close()">Fechar</button>`)}
};
window.addPersonal=()=>hpeAccountForm('personal');window.addStudent=()=>hpeAccountForm('aluno');
async function hpeAccountMutation(body){try{await hpeAccountsCall(body);await hpeAccountsRefresh();render();toast('Alteração salva no Supabase.')}catch(error){toast(error.message)}}
window.setLifetime=(id,enabled)=>hpeAccountMutation({action:'lifetime',target:id,enabled});
window.requestLicenses=()=>hpeAccountMutation({action:'request'});
window.resolveLicenses=(id,approve)=>hpeAccountMutation({action:approve?'approve':'reject',target:id});
window.hpeFilterAdminPersonals=value=>{
 const term=String(value||'').trim().toLocaleLowerCase('pt-BR');
 document.querySelectorAll('.hpe-admin-personal-card').forEach(card=>{card.hidden=!card.dataset.search.includes(term)});
};
window.hpeSavePersonalLicenseLimit=async id=>{
 if(hpeProfile?.role!=='adm')return;
 const input=$(`#hpe-license-limit-${id}`),status=$(`#hpe-license-status-${id}`),button=$(`#hpe-license-save-${id}`);
 if(!input||!status||!button)return;
 const limit=Number(input.value);
 if(!Number.isSafeInteger(limit)||limit<0||limit>100000){status.textContent='Informe um número inteiro entre 0 e 100.000.';return}
 button.disabled=true;status.textContent='Salvando limite…';
 try{
  await hpeAccountsCall({action:'set_license_limit',target:id,limit});
  await hpeAccountsRefresh();render();toast('Limite de licenças atualizado.');
 }catch(error){status.textContent=error?.message||'Não foi possível salvar o limite.'}
 finally{const current=$(`#hpe-license-save-${id}`);if(current)current.disabled=false}
};
adminScreen=function(){
 const personals=hpeDirectory.filter(p=>p.role==='personal');
 const students=hpeDirectory.filter(p=>p.role==='aluno');
 const pending=hpeRequests.filter(r=>r.status==='pendente').length;
 const available=personals.reduce((sum,p)=>sum+(p.lifetime?0:Math.max(0,(Number(p.license_limit)||0)-students.filter(s=>s.personal_id===p.id).length)),0);
 const cards=personals.map(p=>{
  const used=students.filter(s=>s.personal_id===p.id).length;
  const limit=Number.isSafeInteger(Number(p.license_limit))&&Number(p.license_limit)>=0?Number(p.license_limit):20;
  const search=esc(`${p.name||''} ${p.email||''}`.toLocaleLowerCase('pt-BR'));
  return `<section class="card hpe-admin-personal-card" data-search="${search}"><div class="hpe-admin-personal-heading"><div class="hpe-admin-avatar" aria-hidden="true">${esc(String(p.name||'P').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase())}</div><div><h2>${esc(p.name||'Personal sem nome')}</h2><p>${esc(p.email||'E-mail não informado')}</p></div></div><div class="hpe-admin-license-usage"><span>Alunos cadastrados</span><strong>${used} <small>/ ${p.lifetime?'∞':limit}</small></strong><span>${p.lifetime?'Uso vitalício ativo':`${Math.max(0,limit-used)} licença(s) disponível(is)`}</span></div><form class="hpe-admin-license-form" onsubmit="event.preventDefault();hpeSavePersonalLicenseLimit('${esc(p.id)}')"><label for="hpe-license-limit-${esc(p.id)}">Limite de licenças</label><div class="hpe-admin-license-controls"><input id="hpe-license-limit-${esc(p.id)}" type="number" min="0" max="100000" step="1" inputmode="numeric" value="${limit}" required aria-label="Limite de licenças de ${esc(p.name||'personal')}"><button class="primary" id="hpe-license-save-${esc(p.id)}">Salvar limite</button></div><small>Se o limite ficar abaixo do uso atual, os alunos existentes continuam ativos; novos cadastros ficam bloqueados até haver vagas.</small><p id="hpe-license-status-${esc(p.id)}" class="hpe-admin-license-status" role="status" aria-live="polite"></p></form><div class="personal-admin-actions"><button onclick="hpeEditPersonalProfile('${esc(p.id)}')">Editar perfil</button><button onclick="hpeConfirmPersonalReset('${esc(p.id)}')">Gerar nova senha</button></div><button class="hpe-admin-lifetime-button" aria-pressed="${Boolean(p.lifetime)}" onclick="setLifetime('${esc(p.id)}',${!p.lifetime})">${p.lifetime?'Desativar':'Ativar'} uso vitalício</button></section>`;
 }).join('');
 const cardsContent=cards||`<section class="card hpe-admin-empty"><h2>${hpeDirectoryLoading?'Carregando personais…':hpeDirectoryError?'Não foi possível atualizar a lista':'Nenhum personal cadastrado'}</h2><p>${hpeDirectoryLoading?'Buscando as contas registradas no Supabase.':hpeDirectoryError?'Toque em “Atualizar personais” para tentar novamente.':'Quando uma conta de personal for criada, ela aparecerá nesta área.'}</p></section>`;
 const errorBanner=hpeDirectoryError?`<section class="card hpe-admin-alert" role="status"><b>Lista possivelmente desatualizada</b><p>${esc(hpeDirectoryError)}</p></section>`:'';
 const warningBanner=hpeDirectoryWarning?`<p class="note">${esc(hpeDirectoryWarning)}</p>`:'';
 const requestRows=hpeRequests.map(r=>`<div class="hpe-admin-request-row"><div><b>${esc(personals.find(p=>p.id===r.personal_id)?.name||'Personal')}</b><p>${esc(r.status)} · ${r.created_at?new Date(r.created_at).toLocaleDateString('pt-BR'):''}</p></div><span class="tag">${esc(String(r.status||'').toUpperCase())}</span>${r.status==='pendente'?`<button class="primary" onclick="resolveLicenses('${esc(r.id)}',true)">Aprovar +20</button><button onclick="resolveLicenses('${esc(r.id)}',false)">Recusar</button>`:''}</div>`).join('')||'<p>Nenhuma solicitação de licença pendente.</p>';
 return heading('ADMINISTRAÇÃO · HPE','Personais e licenças.','Consulte as contas cadastradas e defina o limite individual de alunos.',`<button onclick="hpeReloadAccounts()" ${hpeDirectoryLoading?'disabled':''}>${hpeDirectoryLoading?'Atualizando…':'↻ Atualizar personais'}</button><button class="primary" onclick="addPersonal()">+ Cadastrar personal</button>`)+`<div class="hpe-admin-summary"><section><span>Personais cadastrados</span><strong>${personals.length}</strong></section><section><span>Alunos vinculados</span><strong>${students.length}</strong></section><section><span>Licenças disponíveis</span><strong>${available}</strong></section><section><span>Solicitações pendentes</span><strong>${pending}</strong></section></div>${errorBanner}${warningBanner}<section class="hpe-admin-directory"><div class="hpe-admin-directory-head"><div><h2>Personais cadastrados</h2><p>${personals.length} conta(s) carregada(s) do servidor.</p></div><label class="hpe-admin-search"><span>Buscar</span><input type="search" placeholder="Nome ou e-mail" oninput="hpeFilterAdminPersonals(this.value)" aria-label="Buscar personal por nome ou e-mail"></label></div><div class="hpe-admin-personal-grid">${cardsContent}</div></section><section class="card hpe-admin-requests"><div class="hpe-admin-directory-head"><div><h2>Solicitações de licenças</h2><p>Autorize lotes adicionais de 20 licenças.</p></div><span class="tag">${pending} PENDENTE(S)</span></div>${requestRows}</section><p class="note">Os limites são aplicados no servidor. Alterar o limite não remove alunos já cadastrados.</p>`;
};
const accountRender=render;render=function(){accountRender();if(hpeProfile?.role==='personal')$('#content').insertAdjacentHTML('afterbegin',`<section class="card"><div class="row"><b>Contas e licenças · Supabase</b><button onclick="hpeReloadAccounts()">Atualizar contas</button></div><p>${esc(hpeDirectoryError||'Cadastre o aluno pelo nome. O sistema gera o código de acesso e a senha temporária.')}</p></section>`)};




window.hpeEditPersonalProfile=id=>{
 if(hpeProfile?.role!=='adm')return;
 const personal=hpeDirectory.find(p=>p.id===id&&p.role==='personal');if(!personal)return toast('Personal não encontrado. Atualize a lista.');
 modal(`<h2>Editar perfil do personal</h2><form id="hpePersonalEditForm"><label>Nome completo<input name="name" value="${esc(personal.name)}" minlength="2" maxlength="80" required></label><label>WhatsApp (opcional)<input name="whatsapp" type="tel" value="${esc(personal.whatsapp||'')}" maxlength="24" placeholder="(11) 99999-9999"></label><label>E-mail de acesso<input type="email" value="${esc(personal.email||'')}" readonly></label><p id="hpePersonalEditStatus" role="alert"></p><button class="primary">Salvar perfil</button><button type="button" onclick="$('#modal').close()">Cancelar</button></form>`);
 $('#hpePersonalEditForm').onsubmit=async event=>{
  event.preventDefault();const form=event.target,button=form.querySelector('.primary'),status=$('#hpePersonalEditStatus');if(button.disabled)return;
  const f=new FormData(form),whatsapp=hpeNormalizeWhatsApp(f.get('whatsapp'));
  if(whatsapp===null){status.textContent='Informe um WhatsApp válido com DDD ou deixe em branco.';return}
  button.disabled=true;status.textContent='Salvando…';
  try{await hpeAccountsCall({action:'update_personal',target:id,name:String(f.get('name')||'').trim(),whatsapp});await hpeAccountsRefresh();$('#modal').close();render();toast(hpeDirectoryLoaded?'Perfil do personal atualizado.':'Perfil salvo. Atualize a lista para conferir.')}catch(error){status.textContent=error.message}finally{button.disabled=false}
 };
};
window.hpeConfirmPersonalReset=id=>{
 if(hpeProfile?.role!=='adm')return;
 const personal=hpeDirectory.find(p=>p.id===id&&p.role==='personal');if(!personal)return toast('Personal não encontrado. Atualize a lista.');
 modal(`<h2>Nova senha para ${esc(personal.name)}</h2><p>A senha anterior deixará de funcionar. O e-mail de acesso continuará sendo <strong>${esc(personal.email||'')}</strong>.</p><p>A nova senha aparecerá nesta janela para você copiar e entregar ao personal.</p><button class="primary" id="hpePersonalResetButton" onclick="hpeResetPersonalPassword('${personal.id}')">Gerar nova senha agora</button><button onclick="$('#modal').close()">Cancelar</button><p id="hpePersonalResetStatus" role="alert"></p>`);
};
window.hpeResetPersonalPassword=async id=>{
 if(hpeProfile?.role!=='adm')return;
 const button=$('#hpePersonalResetButton'),status=$('#hpePersonalResetStatus');if(!button||button.disabled)return;
 if(!hpeDirectory.some(p=>p.id===id&&p.role==='personal'))return;
 button.disabled=true;status.textContent='Gerando nova senha…';
 try{
  const result=await hpeAccountsCall({action:'reset_personal_password',target:id});
  modal(`<h2>Nova senha gerada</h2><p>Copie e entregue os dados ao personal. A senha não fica salva nesta tela após fechar.</p><label>E-mail de acesso<input id="hpePersonalCredentialEmail" readonly value="${esc(result.email||'')}"></label><label>Nova senha<input id="hpePersonalCredentialPassword" readonly value="${esc(result.new_password)}" autocomplete="off" onclick="this.select()"></label><button class="primary" onclick="hpeCopyPersonalCredentials()">Copiar e-mail e senha</button><button onclick="$('#modal').close()">Fechar</button><p id="hpePersonalCredentialStatus" role="status"></p>`);
 }catch(error){status.textContent=error.message;button.disabled=false}
};
window.hpeCopyPersonalCredentials=async()=>{
 if(hpeProfile?.role!=='adm')return;const email=$('#hpePersonalCredentialEmail'),password=$('#hpePersonalCredentialPassword'),status=$('#hpePersonalCredentialStatus');if(!email||!password)return;
 try{await navigator.clipboard.writeText(`E-mail: ${email.value}\nSenha: ${password.value}`);status.textContent='Dados copiados.'}catch{password.select();status.textContent='Selecione e copie os campos acima.'}
};
$('#modal').addEventListener('close',()=>{const field=$('#hpePersonalCredentialPassword');if(field)field.value=''});
