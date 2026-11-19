const previousLogin=showLogin;
showLogin=function(selected=loginRole){
 previousLogin(selected);
 const card=$('.login-card'),tabs=card?.querySelector('.login-tabs');
 card?.querySelector('.signup-entry')?.remove();
 if(tabs&&selected==='aluno')tabs.insertAdjacentHTML('afterend','<section class="signup-entry"><b>Não tem personal cadastrado?</b><p>Crie uma conta gratuita para montar seu treino com a IA e usar as demonstrações e o descanso cronometrado.</p><button type="button" class="primary" onclick="hpeStudentSignup()">Criar conta gratuita</button></section>');
};
window.showLogin=showLogin;
window.hpeStudentSignup=()=>{
 if(typeof hpeAuth==='undefined'||!hpeAuth){hpeError('O serviço de cadastro não carregou. Atualize a página.');return}
 modal(`<h2>Crie sua conta gratuita</h2><p>Comece como aluno independente. Você poderá criar um treino inicial com a IA e acessar as demonstrações de exercícios e o cronômetro de descanso.</p><form id="hpeIndependentSignup"><label>Nome completo<input name="name" minlength="2" maxlength="80" autocomplete="name" required></label><label>E-mail<input name="email" type="email" maxlength="254" autocomplete="email" required></label><label>WhatsApp (opcional)<input name="whatsapp" type="tel" autocomplete="tel" placeholder="(31) 99999-9999" maxlength="24"></label><label>Objetivo inicial<select name="goal"><option>Hipertrofia</option><option>Condicionamento</option><option>Força</option></select></label><label>Nível de experiência<select name="level"><option>Iniciante</option><option>Intermediário</option><option>Avançado</option></select></label><label>Crie uma senha<input name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label><label>Confirme a senha<input name="confirm" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label><p class="note">O WhatsApp só será mostrado a personais se você ativar a opção para aparecer na busca próxima. O plano da IA é uma sugestão geral e pode ser revisado antes de entrar no seu treino.</p><p id="hpeIndependentSignupStatus" role="status" aria-live="polite"></p><button class="primary">Criar conta e começar</button></form>`);
 const form=$('#hpeIndependentSignup');
 form.onsubmit=async event=>{
  event.preventDefault();const fields=new FormData(form),button=form.querySelector('button'),status=$('#hpeIndependentSignupStatus');
  const name=String(fields.get('name')||'').trim(),email=String(fields.get('email')||'').trim().toLowerCase(),password=String(fields.get('password')||''),confirm=String(fields.get('confirm')||''),rawPhone=String(fields.get('whatsapp')||'').trim();
  const whatsapp=rawPhone?(typeof hpeNormalizeWhatsApp==='function'?hpeNormalizeWhatsApp(rawPhone):rawPhone):'';
  if(name.length<2||name.length>80){status.textContent='Informe seu nome completo.';return}
  if(password.length<8||password.length>128){status.textContent='A senha precisa ter entre 8 e 128 caracteres.';return}
  if(password!==confirm){status.textContent='As senhas não conferem.';return}
  if(whatsapp===null){status.textContent='Confira o WhatsApp ou deixe o campo em branco.';return}
  button.disabled=true;status.textContent='Criando sua conta…';
  try{
   const {data:created,error:createError}=await hpeAuth.functions.invoke('hpe-accounts',{body:{action:'create_independent_student',name,email,password,whatsapp,goal:fields.get('goal'),level:fields.get('level')}});
   if(createError||created?.error){let detail;try{detail=await createError?.context?.json()}catch{};status.textContent=detail?.error==='Operação desconhecida.'?'O cadastro gratuito está aguardando a ativação do servidor. Tente novamente mais tarde.':(detail?.error||'Não foi possível criar a conta. Confira os dados e tente novamente.');return}
   const {data:login,error:loginError}=await hpeAuth.auth.signInWithPassword({email,password});
   if(loginError||!login?.session){status.textContent='A conta foi criada. Entre com seu e-mail e senha na tela de acesso.';return}
   $('#modal').close();await hpeOpenSession(login.session,'aluno');window.go?.('independent-plan');
  }catch{status.textContent='Falha de conexão. Tente novamente.'}finally{button.disabled=false}
 };
};
if(new URLSearchParams(location.search).get('perfil')==='aluno')loginRole='aluno';
window.hpeInviteStudents=()=>hpeAccountForm('aluno');
window.addStudent=()=>hpeAccountForm('aluno');
const signupRender=render;
render=function(){signupRender();if(hpeProfile?.role==='personal')document.querySelectorAll('button[onclick="addStudent()"]')?.forEach(button=>button.textContent='+ Cadastrar aluno')};
if(document.body.classList.contains('signed-out'))showLogin(loginRole);
