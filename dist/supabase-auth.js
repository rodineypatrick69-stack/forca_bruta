const hpeAuth=window.supabase?.createClient('https://jzvzlcdaywqjhserndyf.supabase.co','sb_publishable_w5vkV0NzLVdm9G8zaIWMLw_SAyEcFq1',{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit',storageKey:'hpe-supabase-auth'}
});
let hpeProfile=null,hpeRecovery=false,hpeAuthVersion=0,hpePasswordSetupActive=false;
const localLogin=showLogin,localEnter=enterApp;
function hpeError(message){const error=$('#loginError');if(error){error.hidden=false;error.textContent=message}}
function hpeSignedOut(){hpeProfile=null;hpePasswordSetupActive=false;window.hpeDataKey='hpe-pending-v1';sessionStorage.removeItem('forja-session');sessionStorage.removeItem('forja-identity');done.clear();$('#modal').close();showLogin(loginRole)}
showLogin=function(selected=loginRole){
  localLogin(selected);
  const loginInput=$('#loginForm input[name=email]');
  loginInput.type=selected==='aluno'?'text':'email';
  loginInput.name=selected==='aluno'?'access_code':'email';
  loginInput.placeholder=selected==='aluno'?'Código de 6 números fornecido pelo personal':'Seu e-mail cadastrado';
  loginInput.autocomplete='username';
  loginInput.maxLength=selected==='aluno'?16:254;
  loginInput.inputMode=selected==='aluno'?'numeric':'email';
  const loginLabel=loginInput.closest('label');if(loginLabel)loginLabel.firstChild.textContent=selected==='aluno'?'Código de acesso':'E-mail';
  $('.demo-access').innerHTML=selected==='aluno'?'<b>Acesso do aluno</b><p>Digite os 6 números e a senha temporária recebidos do personal. No primeiro acesso, escolha uma nova senha.</p><button type="button" onclick="hpeForgotPassword()">Preciso redefinir minha senha</button>':'<b>Login conectado ao Supabase</b><p>Use o e-mail cadastrado para entrar.</p><button type="button" onclick="hpeForgotPassword()">Esqueci minha senha</button>';
  const note=$('.login-card > .note');if(note)note.textContent=selected==='aluno'?'No primeiro acesso, escolha sua senha pessoal. Se esquecer, peça ao personal uma nova senha temporária.':'Acesso autenticado pelo Supabase.';
  $('#loginForm').onsubmit=async event=>{
    event.preventDefault();if(!hpeAuth){hpeError('O serviço de login não carregou. Atualize a página.');return}
    const form=new FormData(event.target),button=event.target.querySelector('button.primary');button.disabled=true;
    try{
      if(selected==='aluno'){
        const code=String(form.get('access_code')||'').trim().toUpperCase();
        if(!/^(?:[0-9]{6}|[A-F0-9]{16})$/.test(code)){hpeError('Informe os 6 números do código recebido do personal.');return}
        const {data:result,error}=await hpeAuth.functions.invoke('hpe-accounts',{body:{action:'student_login',access_code:code,password:form.get('password')}});
        if(error||!result?.session){hpeError('Código ou senha inválidos. Confira os dados recebidos do personal.');return}
        const {data:sessionResult,error:setError}=await hpeAuth.auth.setSession({access_token:result.session.access_token,refresh_token:result.session.refresh_token});
        if(setError||!sessionResult?.session){hpeError('Não foi possível iniciar sua sessão. Tente novamente.');return}
        await hpeOpenSession(sessionResult.session,'aluno');
      }else{
        const {data:result,error}=await hpeAuth.auth.signInWithPassword({email:String(form.get('email')||'').trim().toLowerCase(),password:form.get('password')});
        if(error){hpeError('Não foi possível entrar. Confira o e-mail, a senha e a confirmação da conta.');return}
        await hpeOpenSession(result.session,selected);
      }
    }catch{hpeError('Não foi possível conectar. Confira sua internet e tente novamente.')}finally{button.disabled=false}
  }
};window.showLogin=showLogin;
enterApp=function(selected){if(!hpeProfile||selected!==hpeProfile.role){showLogin();return}localEnter(selected)};
function hpeEmptyData(profile){return {students:profile.role==='aluno'?[{id:1,name:profile.name,personalId:profile.personal_id,goal:'Definir objetivo',level:'Iniciante'}]:[],plans:{},logs:[],measurements:[],messages:[],personalAccounts:profile.role==='personal'?[{id:profile.id,name:profile.name,email:'Conta Supabase',limit:profile.license_limit,lifetime:profile.lifetime}]:[],studentAccounts:[],licenseRequests:[],dailyWater:{},studentGoals:{},excusedDays:{},appointments:[],monthlyFees:{},blockNames:{},alternatePlans:{}}}
function hpePromptStudentPasswordSetup(){
  if(hpePasswordSetupActive&&$('#modal')?.open)return;
  hpePasswordSetupActive=true;
  if($('#modal')?.open)$('#modal').close();
  modal('<h2>Crie sua senha pessoal</h2><p>Este é seu primeiro acesso. Crie uma senha para usar daqui em diante.</p><form id="hpeStudentFirstPassword"><label>Nova senha<input name="password" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><label>Confirme a nova senha<input name="confirm" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><p id="hpeStudentFirstPasswordStatus" role="status"></p><button class="primary">Salvar e entrar</button></form><p class="note">Use pelo menos 8 caracteres. Sua senha pessoal não é enviada ao personal.</p>');
  const close=$('#modal .close');if(close)close.hidden=true;
  $('#modal').addEventListener?.('cancel',event=>{if(hpePasswordSetupActive)event.preventDefault()});
  $('#hpeStudentFirstPassword').onsubmit=async event=>{
    event.preventDefault();const fields=new FormData(event.target),password=String(fields.get('password')||''),status=$('#hpeStudentFirstPasswordStatus'),button=event.target.querySelector('button');
    if(password.length<8||password.length>128){status.textContent='A senha precisa ter entre 8 e 128 caracteres.';return}
    if(password!==fields.get('confirm')){status.textContent='As senhas não conferem.';return}
    button.disabled=true;
    try{
      const {error:passwordError}=await hpeAuth.auth.updateUser({password});
      if(passwordError){status.textContent='Não foi possível salvar a senha. Confira se ela atende às regras e tente novamente.';return}
      const {data:result,error}=await hpeAuth.functions.invoke('hpe-accounts',{body:{action:'complete_student_password_setup'}});
      if(error||result?.error){status.textContent='A senha foi salva, mas não conseguimos finalizar o acesso. Tente salvar novamente.';return}
      const {data:sessionResult,error:sessionError}=await hpeAuth.auth.getSession();
      if(sessionError||!sessionResult.session){status.textContent='Sua senha foi salva. Entre novamente com o código e a nova senha.';return}
      hpePasswordSetupActive=false;$('#modal').close();await hpeOpenSession(sessionResult.session,'aluno');
    }catch{status.textContent='Falha de conexão. Tente novamente.'}finally{button.disabled=false}
  };
}
async function hpeOpenSession(session,selected){
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  const version=++hpeAuthVersion;if(!session||hpeRecovery)return;if(typeof navigator!=='undefined'&&!navigator.onLine&&typeof hpeOfflineResume==='function'){hpeOfflineResume();return}
  const {data:userResult,error:userError}=await hpeAuth.auth.getUser();
  if(version!==hpeAuthVersion||hpeRecovery)return;
  if(userError||!userResult.user){hpeSignedOut();hpeError('Sua sessão expirou. Entre novamente.');return}
  const {data:profile,error}=await hpeAuth.from('hpe_profiles').select('id,name,role,personal_id,license_limit,lifetime,password_setup_required').eq('id',userResult.user.id).maybeSingle();
  if(version!==hpeAuthVersion||hpeRecovery)return;
  if(error||!profile||!['adm','personal','aluno'].includes(profile.role)){
    await hpeAuth.auth.signOut();hpeSignedOut();hpeError(error?'Não foi possível consultar seu perfil. Confira a configuração de hpe_profiles no Supabase.':'Sua conta ainda não tem um perfil autorizado. Solicite o cadastro ao administrador.');return;
  }
  if(selected&&selected!==profile.role){await hpeAuth.auth.signOut();hpeSignedOut();hpeError('Esta conta pertence a outro perfil. Selecione Administrador, Sou personal ou Sou aluno conforme seu cadastro.');return}
  if(profile.role==='aluno'&&profile.password_setup_required){hpeProfile=profile;window.hpeDataKey='hpe-user-'+profile.id;hpePromptStudentPasswordSetup();return}
  hpePasswordSetupActive=false;hpeProfile=profile;window.hpeDataKey='hpe-user-'+profile.id;
  let stored;try{stored=JSON.parse(localStorage.getItem(window.hpeDataKey))}catch{}
  if(!stored&&profile.role==='adm'){try{stored=JSON.parse(localStorage.getItem('forja-v1'))}catch{}}
  data=stored||hpeEmptyData(profile);if(typeof hpeSyncStart==='function')await hpeSyncStart(profile);save();if(typeof hpeAccountsRefresh==='function')await hpeAccountsRefresh();
  sessionStorage.setItem('forja-identity',JSON.stringify({role:profile.role,personalId:profile.role==='personal'?profile.id:profile.personal_id,studentId:profile.role==='aluno'?1:null}));
  sessionStorage.setItem('forja-session',profile.role);enterApp(profile.role);if(typeof hpeSharedStart==='function')await hpeSharedStart(profile);
  if(typeof hpeOfflineSessionReady==='function'){hpeOfflineMode=false;hpeOfflineSessionReady(profile)}
  $('header .avatar').textContent=profile.role==='adm'?'CEO':profile.name.split(' ').map(x=>x[0]).slice(0,2).join('');
}
logoutButton.onclick=async()=>{++hpeAuthVersion;hpeRecovery=false;hpeSignedOut();if(hpeAuth)await hpeAuth.auth.signOut()};
window.hpeForgotPassword=()=>{
  if(loginRole==='aluno'){const code=$('#loginForm')?.elements.access_code?.value?.trim().toUpperCase()||'';modal(`<h2>Redefinir senha</h2><p>Peça ao seu personal para redefinir sua senha. Ele pode gerar uma senha temporária na lista de alunos.</p>${code?`<p>Seu código de acesso continua o mesmo: <strong>${esc(code)}</strong></p>`:''}<button class="primary" onclick="$('#modal').close()">Entendi</button>`);return}
  modal('<h2>Recuperar senha</h2><p>Informe o e-mail cadastrado no Supabase.</p><form id="hpeRecoveryRequest"><label>E-mail<input name="email" type="email" required autocomplete="email"></label><p id="hpeRecoveryStatus" role="status"></p><button class="primary">Solicitar link de recuperação</button></form><p class="note">O envio para alunos e professores depende do SMTP configurado no Supabase. O serviço padrão permite apenas testes com integrantes do projeto.</p>');
  $('#hpeRecoveryRequest').onsubmit=async event=>{event.preventDefault();const status=$('#hpeRecoveryStatus'),button=event.target.querySelector('button');button.disabled=true;try{if(!hpeAuth)throw Error();const {error}=await hpeAuth.auth.resetPasswordForEmail(new FormData(event.target).get('email').trim().toLowerCase(),{redirectTo:'https://forja-treino-academia.younggoby6.chatgpt.site/'});status.textContent=error?'Não foi possível solicitar o envio. O administrador deve conferir SMTP, destinatários autorizados e limites do Supabase.':'Solicitação recebida. Se houver uma conta elegível e o envio estiver configurado, você receberá o link. Confira também o spam.'}catch{status.textContent='Não foi possível conectar ao serviço. Tente novamente.'}finally{button.disabled=false}};
};
function hpeNewPassword(){
  hpeRecovery=true;hpeProfile=null;++hpeAuthVersion;showLogin('aluno');
  modal('<h2>Definir nova senha</h2><form id="hpeNewPassword"><label>Nova senha<input type="password" name="password" minlength="8" required autocomplete="new-password"></label><label>Confirmar nova senha<input type="password" name="confirm" minlength="8" required autocomplete="new-password"></label><p id="hpePasswordStatus" role="status"></p><button class="primary">Salvar nova senha</button></form>');
  $('#hpeNewPassword').onsubmit=async event=>{event.preventDefault();const fields=new FormData(event.target),status=$('#hpePasswordStatus'),button=event.target.querySelector('button');if(fields.get('password')!==fields.get('confirm')){status.textContent='As senhas precisam ser iguais.';return}button.disabled=true;try{const {error}=await hpeAuth.auth.updateUser({password:fields.get('password')});if(error){status.textContent='Não foi possível alterar a senha. O link pode ter expirado ou a senha não atende às regras. Solicite outro link se necessário.';return}hpeRecovery=false;await hpeAuth.auth.signOut();hpeSignedOut();toast('Senha atualizada. Entre novamente com a nova senha.')}catch{status.textContent='Falha de conexão. Tente novamente.'}finally{button.disabled=false}};
}
window.configureCEO=()=>toast('A conta de administrador é definida no Supabase.');
const supabaseAdminScreen=adminScreen;
adminScreen=function(){return `<section class="card"><span class="tag">SUPABASE · ADMINISTRADOR</span><h2>${esc(hpeProfile?.name||'Administrador')}</h2><p>Login e perfil validados pelo Supabase.</p><p class="note">Treinos, agenda, finanças e controles de licença continuam locais. Cadastros de contas reais pelo app e sincronização ainda precisam da integração no servidor.</p></section>`+supabaseAdminScreen()};
window.addPersonal=window.addStudent=()=>modal('<h2>Cadastro de contas no Supabase</h2><p>A criação de contas pelo aplicativo ainda precisa de uma função protegida no servidor. Os cadastros antigos eram locais.</p><p>Por enquanto, o administrador deve criar a conta em Authentication → Users e atribuir o perfil em hpe_profiles pelo SQL Editor.</p>');
showLogin('aluno');
if(hpeAuth){
  hpeAuth.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'){hpeNewPassword();return}if(event==='SIGNED_OUT'){hpeSignedOut();return}if(event==='INITIAL_SESSION'&&session)setTimeout(()=>hpeOpenSession(session).catch(()=>{hpeSignedOut();hpeError('Não foi possível validar sua sessão. Entre novamente.')}),0)});
}else hpeError('O serviço de login não carregou. Atualize a página.');





