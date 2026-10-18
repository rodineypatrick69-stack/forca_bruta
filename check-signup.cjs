const fs=require('fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map();const node=s=>nodes.get(s)||nodes.set(s,{textContent:'',innerHTML:'',open:false,querySelector:()=>({insertAdjacentHTML(html){node('.login-tabs-html').textContent=html}}),insertAdjacentHTML(html){this.textContent=html},close(){}}).get(s);
let modalHtml='',accountKinds=[],role='aluno';const c={window:null,location:{search:''},URLSearchParams,navigator:{onLine:true},document:{body:{classList:{contains:()=>true}},querySelectorAll:()=>[]},loginRole:'aluno',showLogin(){},render(){},hpeAccountForm:kind=>accountKinds.push(kind),hpeProfile:null,$:node,modal:html=>modalHtml=html,esc:String,console};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('dist/student-signup.js','utf8'),c);
c.hpeStudentSignup();assert.match(modalHtml,/Peça seu acesso ao personal/);assert.match(modalHtml,/6 números/);assert.doesNotMatch(modalHtml,/crie sua conta|escolha seu personal/i);
c.hpeInviteStudents();assert.deepEqual(accountKinds,['aluno']);c.addStudent();assert.deepEqual(accountKinds,['aluno','aluno']);
assert.doesNotMatch(fs.readFileSync('dist/student-signup.js','utf8'),/hpe_public_personals|invite_code|useInvite/);
console.log('OK: login do aluno usa acesso do personal, senha inicial e código curto; personal cria acesso.');
