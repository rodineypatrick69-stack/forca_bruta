let hpeDirectory=[],hpeRequests=[],hpeDirectoryError='',hpeDirectoryLoaded=false;
async function hpeAccountsCall(body){ if(window.hpeNetworkAllowed?.()===false)throw Error('Desative o modo offline e conecte à internet para gerenciar contas.');
  if(!hpeAuth||!hpeProfile)throw Error('Entre novamente para gerenciar contas.');
  const {data:result,error}=await hpeAuth.functions.invoke('hpe-accounts',{body});
  if(error){let message='Cadastro indisponível. Atualize a função hpe-accounts e aplique student-signup.sql no Supabase.';try{const response=await error.context?.json();if(response?.error)message=response.error}catch{}throw Error(message)}
  if(result?.error)throw Error(result.error);return result;
}
async function hpeAccountsRefresh(){ if(window.hpeNetworkAllowed?.()===false)return;
  hpeDirectoryLoaded=false;hpeDirectory=[];hpeRequests=[];
  if(!hpeProfile||hpeProfile.role==='aluno')return;
  try{
    const result=await hpeAccountsCall({action:'list'});hpeDirectory=result.profiles;hpeRequests=result.requests;hpeDirectoryError='';hpeDirectoryLoaded=true;
    data.personalAccounts=hpeDirectory.filter(p=>p.role==='personal').map(p=>({id:p.id,name:p.name,email:p.email||'',limit:p.license_limit,lifetime:p.lifetime}));
    for(const p of hpeDirectory.filter(p=>p.role==='aluno')){
      let s=data.students.find(s=>s.supabaseId===p.id);
      if(!s){let id=Date.now();while(data.students.some(s=>s.id===id))id++;s={id,supabaseId:p.id};data.students.push(s)}
      Object.assign(s,{name:p.name,personalId:p.personal_id,accessCode:p.access_code||'',goal:p.goal,level:p.level,whatsapp:p.whatsapp??''});
      data.studentGoals[s.id]={...(data.studentGoals[s.id]||{}),water:data.studentGoals[s.id]?.water||2000,weekly:p.training_days?.length??0,days:Array.isArray(p.training_days)?p.training_days:[],since:data.studentGoals[s.id]?.since||todayKey()};
      let a=data.studentAccounts.find(a=>a.student===s.id);if(!a){a={student:s.id};data.studentAccounts.push(a)}a.accessCode=p.access_code||'';delete a.email;
    }
    data.licenseRequests=hpeRequests.map(r=>({id:r.id,personalId:r.personal_id,status:r.status,quantity:20,created:r.created_at}));save();
  }catch(error){hpeDirectoryError=error.message}
}
window.hpeReloadAccounts=async()=>{await hpeAccountsRefresh();render();toast(hpeDirectoryLoaded?'Contas atualizadas do Supabase.':hpeDirectoryError)};
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
adminScreen=function(){return heading('ADMINISTRAÇÃO · SUPABASE','Professores e licenças.','Contas, limites e uso vitalício controlados no servidor.',`<button onclick="hpeReloadAccounts()">Atualizar contas</button><button class="primary" onclick="addPersonal()">+ Cadastrar personal</button>`)+`${hpeDirectoryError?`<section class="card"><h2>Ativação do cadastro pendente</h2><p>${esc(hpeDirectoryError)}</p></section>`:''}<div class="grid">${hpeDirectory.filter(p=>p.role==='personal').map(p=>`<section class="card"><h2>${esc(p.name)}</h2><p>${esc(p.email||'')}</p><span class="tag">${hpeDirectory.filter(s=>s.role==='aluno'&&s.personal_id===p.id).length} / ${p.lifetime?'∞':p.license_limit} LICENÇAS</span><p>${p.lifetime?'Uso vitalício · alunos ilimitados':'Limite de alunos ativo'}</p><button aria-pressed="${p.lifetime}" onclick="setLifetime('${p.id}',${!p.lifetime})">${p.lifetime?'Desativar':'Ativar'} uso vitalício</button></section>`).join('')||'<section class="card"><p>Nenhum personal carregado do Supabase.</p></section>'}</div><section class="card"><h2>Solicitações de +20 licenças</h2>${hpeRequests.map(r=>`<div class="listrow"><div><b>${esc(hpeDirectory.find(p=>p.id===r.personal_id)?.name||'Personal')}</b><p>${esc(r.status)}</p></div>${r.status==='pendente'?`<button onclick="resolveLicenses('${r.id}',true)">Aprovar +20</button><button onclick="resolveLicenses('${r.id}',false)">Recusar</button>`:''}</div>`).join('')||'<p>Nenhuma solicitação carregada.</p>'}</section><p class="note">Contas e licenças no servidor. Confira o indicador para sincronizar os registros entre aparelhos da mesma conta. Treinos, resultados e conversa são compartilhados com os alunos vinculados.</p>`};
const accountRender=render;render=function(){accountRender();if(hpeProfile?.role==='personal')$('#content').insertAdjacentHTML('afterbegin',`<section class="card"><div class="row"><b>Contas e licenças · Supabase</b><button onclick="hpeReloadAccounts()">Atualizar contas</button></div><p>${esc(hpeDirectoryError||'Cadastre o aluno pelo nome. O sistema gera o código de acesso e a senha temporária.')}</p></section>`)};



