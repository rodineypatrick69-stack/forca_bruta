let hpeSignupPersonals=[];
window.hpeStudentSignup=()=>{
 modal(`<section class="student-signup"><span class="eyebrow">SEU PRIMEIRO PASSO</span><h2>Crie sua conta de aluno.</h2><p>Seu e-mail, sua senha. Seu treino com o personal.</p><form id="hpeStudentSignup"><label>Nome completo<input name="name" autocomplete="name" minlength="2" maxlength="80" required></label><label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label>WhatsApp (opcional)<input name="whatsapp" type="tel" autocomplete="tel" maxlength="24" placeholder="(11) 99999-9999"></label><fieldset class="signup-personal"><legend>Escolha seu personal</legend><label>Personal cadastrado<select name="personal" id="hpeSignupPersonal" required disabled><option value="">Carregando personais…</option></select></label><p id="hpePersonalStatus" class="note" role="status"></p><button type="button" class="signup-retry" onclick="hpeLoadSignupPersonals()">Atualizar lista</button></fieldset><label>Crie sua senha<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><label>Confirme sua senha<input name="confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><p class="note">Use pelo menos 8 caracteres. O personal não terá acesso à sua senha.</p><p id="hpeSignupStatus" role="status" aria-live="polite"></p><button class="primary">Criar minha conta</button></form><button class="signup-back" onclick="$('#modal').close();showLogin('aluno')">Já tenho conta · Entrar</button></section>`);
 $('#hpeStudentSignup').onsubmit=async event=>{
  event.preventDefault();const form=event.target,f=new FormData(form),status=$('#hpeSignupStatus'),button=form.querySelector('button');
  if(!navigator.onLine){status.textContent='Conecte à internet para criar sua conta.';return}
  if(f.get('password')!==f.get('confirm')){status.textContent='As senhas precisam ser iguais.';return}
  const phone=hpeNormalizeWhatsApp(f.get('whatsapp'));if(phone===null){status.textContent='Confira o WhatsApp e inclua o DDD.';return}
  button.disabled=true;status.textContent='Conferindo seu personal…';
  try{
   const personalId=String(f.get('personal')||'');
   const {data:personals,error:listError}=await hpeAuth.rpc('hpe_public_personals');
   if(listError||!Array.isArray(personals)){status.textContent='Não foi possível conferir os personais. Atualize a lista e tente novamente.';return}
   const selected=personals.find(p=>p.id===personalId);
   if(!selected?.available){status.textContent='Escolha um personal com vagas disponíveis.';await hpeLoadSignupPersonals();return}
   status.textContent='Criando sua conta…';
   const {data:result,error}=await hpeAuth.auth.signUp({email:f.get('email').trim().toLowerCase(),password:f.get('password'),options:{emailRedirectTo:location.origin+'/',data:{hpe_signup:'student',name:f.get('name').trim(),whatsapp:phone,personal_id:personalId}}});
   if(error){status.textContent=error.code==='email_address_invalid'?'Confira o endereço de e-mail.':error.code==='weak_password'?'Escolha uma senha mais forte.':/email.*(rate|send|smtp)|over_email_send_rate_limit/i.test(error.code||error.message||'')?'O envio de confirmação está indisponível. O administrador precisa conferir o serviço de e-mail.':'Não foi possível criar a conta. Confira os dados e o personal escolhido. Se já tem conta, use Entrar ou Esqueci minha senha.';return}
   form.reset();
   if(result.session){$('#modal').close();await hpeOpenSession(result.session,'aluno')}
   else modal('<h2>Confira seu e-mail.</h2><p>Se o cadastro foi aceito, você receberá um link para confirmar sua conta. Confira também o spam.</p><p>Se não receber, fale com o personal para verificar o envio. Se já tem conta, entre ou recupere sua senha.</p><button class="primary" onclick="$(\'#modal\').close();showLogin(\'aluno\')">Voltar para entrar</button>');
  }catch{status.textContent='Não foi possível conectar. Confira sua internet e tente novamente.'}finally{hpeSignupMode()}
 };
 hpeSignupMode();hpeLoadSignupPersonals();
};
window.hpeSignupMode=()=>{
 const form=$('#hpeStudentSignup');if(!form)return;
 const select=form.elements.personal;
 select.disabled=!hpeSignupPersonals.some(p=>p.available);select.required=true;
 form.querySelector('button.primary').disabled=!hpeSignupPersonals.some(p=>p.available);
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
  status.textContent=error.message==='offline'?'Conecte à internet para carregar os personais.':'Não foi possível carregar os personais. Tente atualizar a lista.';
 }finally{if($('#hpeStudentSignup')===form)hpeSignupMode()}
};
const signupLogin=showLogin;showLogin=function(selected=loginRole){signupLogin(selected);$('.login-card .login-tabs')?.insertAdjacentHTML('afterend','<section class="signup-entry"><b>É aluno e ainda não tem conta?</b><p>Crie seu acesso e escolha seu personal.</p><button type="button" class="primary" onclick="hpeStudentSignup()">Criar conta de aluno ↗</button></section>')};window.showLogin=showLogin;
if(document.body.classList.contains('signed-out'))showLogin(loginRole);
