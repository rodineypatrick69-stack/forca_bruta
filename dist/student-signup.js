let hpeInviteCode=new URLSearchParams(location.search).get('convite')||'';
let hpeSignupPersonals=[];
window.hpeStudentSignup=()=>{
 modal(`<section class="student-signup"><span class="eyebrow">SEU PRIMEIRO PASSO</span><h2>Crie sua conta de aluno.</h2><p>Seu e-mail, sua senha. Seu treino com o personal.</p><form id="hpeStudentSignup"><label>Nome completo<input name="name" autocomplete="name" minlength="2" maxlength="80" required></label><label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label>WhatsApp (opcional)<input name="whatsapp" type="tel" autocomplete="tel" maxlength="24" placeholder="(11) 99999-9999"></label><fieldset class="signup-personal"><legend>Escolha seu personal</legend><label>Personal cadastrado<select name="personal" id="hpeSignupPersonal" required disabled><option value="">Carregando personais…</option></select></label><p id="hpePersonalStatus" class="note" role="status"></p><button type="button" class="signup-retry" onclick="hpeLoadSignupPersonals()">Atualizar lista</button><label class="signup-invite-choice"><input type="checkbox" name="useInvite" ${hpeInviteCode?'checked':''} onchange="hpeSignupMode()">Tenho um código de convite</label><label id="hpeInviteField" ${hpeInviteCode?'':'hidden'}>Código do personal<input name="invite" value="${esc(hpeInviteCode)}" autocomplete="off" pattern="[a-fA-F0-9]{32}" maxlength="32" placeholder="Código recebido do personal"></label></fieldset><label>Crie sua senha<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><label>Confirme sua senha<input name="confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><p class="note">Use pelo menos 8 caracteres. O personal não terá acesso à sua senha.</p><p id="hpeSignupStatus" role="status" aria-live="polite"></p><button class="primary">Criar minha conta</button></form><button class="signup-back" onclick="$('#modal').close();showLogin('aluno')">Já tenho conta · Entrar</button></section>`);
 $('#hpeStudentSignup').onsubmit=async event=>{
  event.preventDefault();const form=event.target,f=new FormData(form),status=$('#hpeSignupStatus'),button=form.querySelector('button');
  if(!navigator.onLine){status.textContent='Conecte à internet para criar sua conta.';return}
  if(f.get('password')!==f.get('confirm')){status.textContent='As senhas precisam ser iguais.';return}
  const phone=hpeNormalizeWhatsApp(f.get('whatsapp'));if(phone===null){status.textContent='Confira o WhatsApp e inclua o DDD.';return}
  button.disabled=true;status.textContent='Conferindo seu personal…';
  try{
   const useInvite=f.get('useInvite')==='on',code=useInvite?f.get('invite').trim().toLowerCase():'';
   const personalId=useInvite?'':String(f.get('personal')||'');
   if(useInvite){
    const {data:invite,error:inviteError}=await hpeAuth.rpc('hpe_student_invite_status',{invite_code:code});
    if(inviteError){status.textContent='O cadastro por convite está temporariamente indisponível. Tente novamente mais tarde.';return}
    if(!invite?.valid){status.textContent='Convite inválido ou personal sem vagas. Solicite outro convite.';return}
   }else{
    const {data:personals,error:listError}=await hpeAuth.rpc('hpe_public_personals');
    if(listError||!Array.isArray(personals)){status.textContent='Não foi possível conferir os personais. Atualize a lista e tente novamente.';return}
    const selected=personals.find(p=>p.id===personalId);
    if(!selected?.available){status.textContent='Escolha um personal com vagas disponíveis.';await hpeLoadSignupPersonals();return}
   }
   status.textContent='Criando sua conta…';
   const {data:result,error}=await hpeAuth.auth.signUp({email:f.get('email').trim().toLowerCase(),password:f.get('password'),options:{emailRedirectTo:location.origin+'/',data:{hpe_signup:'student',name:f.get('name').trim(),whatsapp:phone,invite_code:code,personal_id:personalId}}});
   if(error){status.textContent=error.code==='email_address_invalid'?'Confira o endereço de e-mail.':error.code==='weak_password'?'Escolha uma senha mais forte.':/email.*(rate|send|smtp)|over_email_send_rate_limit/i.test(error.code||error.message||'')?'O envio de confirmação está indisponível. O administrador precisa conferir o serviço de e-mail.':'Não foi possível criar a conta. Confira os dados e o personal escolhido. Se já tem conta, use Entrar ou Esqueci minha senha.';return}
   form.reset();
   if(result.session){$('#modal').close();await hpeOpenSession(result.session,'aluno')}
   else modal('<h2>Confira seu e-mail.</h2><p>Se o cadastro foi aceito, você receberá um link para confirmar sua conta. Confira também o spam.</p><p>Se não receber, fale com o personal para verificar o envio. Se já tem conta, entre ou recupere sua senha.</p><button class="primary" onclick="$(\'#modal\').close();showLogin(\'aluno\')">Voltar para entrar</button>');
  }catch{status.textContent='Não foi possível conectar. Confira sua internet e tente novamente.'}finally{hpeSignupMode()}
 };
 hpeSignupMode();hpeLoadSignupPersonals();
};
window.hpeInviteStudents=async()=>{
 if(hpeProfile?.role!=='personal')return;
 modal('<h2>Convide seus alunos</h2><p id="hpeInviteStatus" role="status">Preparando seu link…</p>');
 if(window.hpeNetworkAllowed?.()===false){$('#hpeInviteStatus').textContent='Volte ao modo online para gerar seu link.';return}
 try{const {data:code,error}=await hpeAuth.rpc('hpe_my_student_invite');if(error||!code){$('#hpeInviteStatus').textContent='O administrador precisa ativar o autocadastro no Supabase para liberar seu link.';return}
  const url=location.origin+'/?convite='+encodeURIComponent(code);
  modal(`<h2>O aluno cria a própria conta.</h2><p>Compartilhe este link com seus alunos. Cada um escolhe seu e-mail e senha e fica vinculado a você.</p><label>Link de cadastro<input id="hpeStudentInviteLink" value="${esc(url)}" readonly onclick="this.select()"></label><button class="primary" onclick="hpeCopyStudentInvite()">Copiar link</button><p class="note">Os cadastros usam suas licenças disponíveis. Compartilhe apenas com seus alunos.</p><p id="hpeInviteStatus" role="status"></p>`);
 }catch{$('#hpeInviteStatus').textContent='Falha de conexão. Tente novamente.'}
};
window.hpeCopyStudentInvite=async()=>{try{await navigator.clipboard.writeText($('#hpeStudentInviteLink').value);$('#hpeInviteStatus').textContent='Link copiado. Envie ao aluno.'}catch{$('#hpeStudentInviteLink').select();$('#hpeInviteStatus').textContent='Selecione e copie o link acima.'}};
window.addStudent=window.hpeInviteStudents;
const signupAccountForm=hpeAccountForm;hpeAccountForm=function(kind){if(kind==='aluno')return hpeInviteStudents();return signupAccountForm(kind)};
window.hpeSignupMode=()=>{
 const form=$('#hpeStudentSignup');if(!form)return;
 const invited=form.elements.useInvite.checked,select=form.elements.personal;
 select.disabled=invited||!hpeSignupPersonals.some(p=>p.available);select.required=!invited;
 form.elements.invite.required=invited;form.elements.invite.disabled=!invited;
 $('#hpeInviteField').hidden=!invited;
 form.querySelector('button.primary').disabled=!invited&&!hpeSignupPersonals.some(p=>p.available);
};
window.hpeLoadSignupPersonals=async()=>{
 const form=$('#hpeStudentSignup');if(!form)return;
 const select=form.elements.personal,status=$('#hpePersonalStatus'),prior=select.value;
 hpeSignupPersonals=[];select.innerHTML='<option value="">Carregando personais…</option>';hpeSignupMode();status.textContent='Buscando personais cadastrados…';
 try{
  if(!navigator.onLine)throw Error('offline');
  const {data:personals,error}=await hpeAuth.rpc('hpe_public_personals');
  if($('#hpeStudentSignup')!==form)return;
  if(error||!Array.isArray(personals))throw Error('unavailable');
  hpeSignupPersonals=personals.filter(p=>typeof p.id==='string'&&typeof p.name==='string');
  select.innerHTML='<option value="">Selecione seu personal</option>'+hpeSignupPersonals.map(p=>`<option value="${esc(p.id)}" ${p.available?'':'disabled'}>${esc(p.name)}${p.available?'':' · Sem vagas no momento'}</option>`).join('');
  if(hpeSignupPersonals.some(p=>p.id===prior&&p.available))select.value=prior;
  status.textContent=hpeSignupPersonals.some(p=>p.available)?'Sua conta ficará vinculada ao personal escolhido.':hpeSignupPersonals.length?'Os personais estão sem vagas no momento. Entre em contato com seu personal.':'Nenhum personal disponível para cadastro no momento.';
 }catch(error){
  if($('#hpeStudentSignup')!==form)return;
  select.innerHTML='<option value="">Lista indisponível</option>';
  status.textContent=error.message==='offline'?'Conecte à internet para carregar os personais.':'Não foi possível carregar os personais. Tente atualizar a lista ou use um convite recebido do seu personal.';
 }finally{if($('#hpeStudentSignup')===form)hpeSignupMode()}
};
const signupLogin=showLogin;showLogin=function(selected=loginRole){signupLogin(selected);$('.login-card .login-tabs')?.insertAdjacentHTML('afterend','<section class="signup-entry"><b>É aluno e ainda não tem conta?</b><p>Crie seu acesso e escolha seu personal.</p><button type="button" class="primary" onclick="hpeStudentSignup()">Criar conta de aluno ↗</button></section>')};window.showLogin=showLogin;
const signupRender=render;render=function(){signupRender();if(hpeProfile?.role==='personal')document.querySelectorAll('button[onclick="addStudent()"]').forEach(button=>button.textContent='↗ Convidar aluno')};
if(document.body.classList.contains('signed-out'))showLogin(loginRole);
if(hpeInviteCode&&document.body.classList.contains('signed-out'))hpeStudentSignup();
