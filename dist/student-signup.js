const previousLogin=showLogin;
showLogin=function(selected=loginRole){
 previousLogin(selected);
 const card=$('.login-card'),tabs=card?.querySelector('.login-tabs');
 if(tabs)tabs.insertAdjacentHTML('afterend',selected==='aluno'?'<section class="signup-entry"><b>Seu acesso é criado pelo personal.</b><p>Use o código de 6 números e a senha temporária enviados pelo personal. No primeiro acesso, escolha sua senha pessoal.</p></section>':'');
};
window.showLogin=showLogin;
window.hpeStudentSignup=()=>modal('<h2>Peça seu acesso ao personal</h2><p>O personal cria sua conta e compartilha um código de 6 números e uma senha temporária. No primeiro acesso, você escolhe sua senha pessoal. Não é necessário e-mail.</p><button class="primary" onclick="$(\'#modal\').close()">Entendi</button>');
window.hpeInviteStudents=()=>hpeAccountForm('aluno');
window.addStudent=()=>hpeAccountForm('aluno');
const signupRender=render;
render=function(){signupRender();if(hpeProfile?.role==='personal')document.querySelectorAll('button[onclick="addStudent()"]').forEach(button=>button.textContent='+ Cadastrar aluno')};
if(document.body.classList.contains('signed-out'))showLogin(loginRole);
