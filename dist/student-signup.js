let hpeInviteCode=new URLSearchParams(location.search).get('convite')||'';
window.hpeStudentSignup=()=>{
 modal(`<section class="student-signup"><span class="eyebrow">SEU PRIMEIRO PASSO</span><h2>Crie sua conta de aluno.</h2><p>Seu e-mail, sua senha. Seu treino com o personal.</p><form id="hpeStudentSignup"><label>Nome completo<input name="name" autocomplete="name" minlength="2" maxlength="80" required></label><label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label>WhatsApp (opcional)<input name="whatsapp" type="tel" autocomplete="tel" maxlength="24" placeholder="(11) 99999-9999"></label><label>Código do personal<input name="invite" value="${esc(hpeInviteCode)}" autocomplete="off" required pattern="[a-fA-F0-9]{32}" maxlength="32" placeholder="Código recebido do seu personal"></label><p class="note">Pelo link do personal, este código já vem preenchido.</p><label>Crie sua senha<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><label>Confirme sua senha<input name="confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><p class="note">Use pelo menos 8 caracteres. O personal não terá acesso à sua senha.</p><p id="hpeSignupStatus" role="status" aria-live="polite"></p><button class="primary">Criar minha conta</button></form><button class="signup-back" onclick="$('#modal').close();showLogin('aluno')">Já tenho conta · Entrar</button></section>`);
 $('#hpeStudentSignup').onsubmit=async event=>{
  event.preventDefault();const form=event.target,f=new FormData(form),status=$('#hpeSignupStatus'),button=form.querySelector('button');
  if(!navigator.onLine){status.textContent='Conecte à internet para criar sua conta.';return}
  if(f.get('password')!==f.get('confirm')){status.textContent='As senhas precisam ser iguais.';return}
  const phone=hpeNormalizeWhatsApp(f.get('whatsapp'));if(phone===null){status.textContent='Confira o WhatsApp e inclua o DDD.';return}
  button.disabled=true;status.textContent='Conferindo o convite…';
  try{
   const code=f.get('invite').trim().toLowerCase();const {data:invite,error:inviteError}=await hpeAuth.rpc('hpe_student_invite_status',{invite_code:code});
   if(inviteError){status.textContent='O autocadastro ainda precisa ser ativado pelo administrador. Peça ao seu personal para conferir a configuração.';return}
   if(!invite?.valid){status.textContent='Convite inválido ou personal sem vagas. Solicite um link atualizado ao seu personal.';return}
   status.textContent='Criando sua conta…';
   const {data:result,error}=await hpeAuth.auth.signUp({email:f.get('email').trim().toLowerCase(),password:f.get('password'),options:{emailRedirectTo:'https://forja-treino-academia.younggoby6.chatgpt.site/',data:{hpe_signup:'student',name:f.get('name').trim(),whatsapp:phone,invite_code:code}}});
   if(error){status.textContent=error.code==='email_address_invalid'?'Confira o endereço de e-mail.':error.code==='weak_password'?'Escolha uma senha mais forte.':/email.*(rate|send|smtp)|over_email_send_rate_limit/i.test(error.code||error.message||'')?'O envio de confirmação está indisponível. O administrador precisa conferir o serviço de e-mail.':'Não foi possível criar a conta. Confira os dados e o convite. Se já tem conta, use Entrar ou Esqueci minha senha.';return}
   form.reset();
   if(result.session){$('#modal').close();await hpeOpenSession(result.session,'aluno')}
   else modal('<h2>Confira seu e-mail.</h2><p>Se o cadastro foi aceito, você receberá um link para confirmar sua conta. Confira também o spam.</p><p>Se não receber, fale com o personal para verificar o envio. Se já tem conta, entre ou recupere sua senha.</p><button class="primary" onclick="$(\'#modal\').close();showLogin(\'aluno\')">Voltar para entrar</button>');
  }catch{status.textContent='Não foi possível conectar. Confira sua internet e tente novamente.'}finally{button.disabled=false}
 };
};
window.hpeInviteStudents=async()=>{
 if(hpeProfile?.role!=='personal')return;
 modal('<h2>Convide seus alunos</h2><p id="hpeInviteStatus" role="status">Preparando seu link…</p>');
 if(window.hpeNetworkAllowed?.()===false){$('#hpeInviteStatus').textContent='Volte ao modo online para gerar seu link.';return}
 try{const {data:code,error}=await hpeAuth.rpc('hpe_my_student_invite');if(error||!code){$('#hpeInviteStatus').textContent='O administrador precisa ativar o autocadastro no Supabase para liberar seu link.';return}
  const url='https://forja-treino-academia.younggoby6.chatgpt.site/?convite='+encodeURIComponent(code);
  modal(`<h2>O aluno cria a própria conta.</h2><p>Compartilhe este link com seus alunos. Cada um escolhe seu e-mail e senha e fica vinculado a você.</p><label>Link de cadastro<input id="hpeStudentInviteLink" value="${esc(url)}" readonly onclick="this.select()"></label><button class="primary" onclick="hpeCopyStudentInvite()">Copiar link</button><p class="note">Os cadastros usam suas licenças disponíveis. Compartilhe apenas com seus alunos.</p><p id="hpeInviteStatus" role="status"></p>`);
 }catch{$('#hpeInviteStatus').textContent='Falha de conexão. Tente novamente.'}
};
window.hpeCopyStudentInvite=async()=>{try{await navigator.clipboard.writeText($('#hpeStudentInviteLink').value);$('#hpeInviteStatus').textContent='Link copiado. Envie ao aluno.'}catch{$('#hpeStudentInviteLink').select();$('#hpeInviteStatus').textContent='Selecione e copie o link acima.'}};
window.addStudent=window.hpeInviteStudents;
const signupAccountForm=hpeAccountForm;hpeAccountForm=function(kind){if(kind==='aluno')return hpeInviteStudents();return signupAccountForm(kind)};
const signupLogin=showLogin;showLogin=function(selected=loginRole){signupLogin(selected);if(selected==='aluno')$('.login-card').insertAdjacentHTML('beforeend','<section class="signup-entry"><b>Ainda não tem conta?</b><p>Cadastre seu e-mail e escolha sua senha.</p><button class="primary" onclick="hpeStudentSignup()">Criar minha conta de aluno ↗</button></section>')};window.showLogin=showLogin;
const signupRender=render;render=function(){signupRender();if(hpeProfile?.role==='personal')document.querySelectorAll('button[onclick="addStudent()"]').forEach(button=>button.textContent='↗ Convidar aluno')};
if(document.body.classList.contains('signed-out'))showLogin(loginRole);
if(hpeInviteCode&&document.body.classList.contains('signed-out'))hpeStudentSignup();
