const previousLogin=showLogin;
showLogin=function(selected=loginRole){
 previousLogin(selected);
 const card=$('.login-card'),tabs=card?.querySelector('.login-tabs');
 if(tabs)tabs.insertAdjacentHTML('afterend',selected==='aluno'?'<section class="signup-entry"><b>Seu acesso é criado pelo personal.</b><ol class="hpe-first-steps"><li>Informe o código de 6 números e a senha temporária.</li><li>No primeiro acesso, crie sua senha pessoal.</li><li>Nas próximas vezes, entre com o mesmo código e sua senha.</li></ol><button type="button" onclick="hpeStudentSignup()">Ver instruções de acesso</button></section>':'');
};
window.showLogin=showLogin;
window.hpeStudentSignup=()=>modal('<h2>Peça seu acesso ao personal</h2><ol class="hpe-first-steps"><li>Peça ao seu personal o código de 6 números e a senha temporária.</li><li>Escolha “Sou aluno” e informe os dois dados.</li><li>Crie sua senha pessoal quando o app solicitar.</li></ol><p>Depois, use o mesmo código e sua senha pessoal para entrar. Não é necessário e-mail.</p><button class="primary" onclick="$(\'#modal\').close()">Entendi</button>');
if(new URLSearchParams(location.search).get('perfil')==='aluno')loginRole='aluno';
window.hpeInviteStudents=()=>hpeAccountForm('aluno');
window.addStudent=()=>hpeAccountForm('aluno');
const signupRender=render;
render=function(){signupRender();if(hpeProfile?.role==='personal')document.querySelectorAll('button[onclick="addStudent()"]').forEach(button=>button.textContent='+ Cadastrar aluno')};
if(document.body.classList.contains('signed-out'))showLogin(loginRole);
