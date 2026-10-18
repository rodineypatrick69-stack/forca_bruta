const previousLogin=showLogin;
showLogin=function(selected=loginRole){
 previousLogin(selected);
 const card=$('.login-card'),tabs=card?.querySelector('.login-tabs');
 if(tabs)tabs.insertAdjacentHTML('afterend',selected==='aluno'?'<section class="signup-entry"><b>Seu acesso é criado pelo personal.</b><p>Peça seu código de acesso e sua senha inicial. Para recuperar a senha, solicite uma redefinição ao personal.</p></section>':'');
};
window.showLogin=showLogin;
window.hpeStudentSignup=()=>modal('<h2>Peça seu acesso ao personal</h2><p>O personal cria sua conta e entrega seu código de acesso e uma senha temporária. Não é necessário e-mail.</p><button class="primary" onclick="$(\'#modal\').close()">Entendi</button>');
window.hpeInviteStudents=()=>hpeAccountForm('aluno');
window.addStudent=()=>hpeAccountForm('aluno');
const signupRender=render;
render=function(){signupRender();if(hpeProfile?.role==='personal')document.querySelectorAll('button[onclick="addStudent()"]').forEach(button=>button.textContent='+ Cadastrar aluno')};
if(document.body.classList.contains('signed-out'))showLogin(loginRole);
