function hpeNormalizeWhatsApp(value){
  const raw=String(value||'').trim();if(!raw)return '';
  if(!/^[+\d\s().-]+$/.test(raw))return null;
  let digits=raw.replace(/\D/g,'');
  if(!raw.startsWith('+')&&![10,11].includes(digits.length)&&!(digits.startsWith('55')&&[12,13].includes(digits.length)))return null;
  if(!raw.startsWith('+')&&(digits.length===10||digits.length===11))digits='55'+digits;
  if(!/^[1-9]\d{7,14}$/.test(digits))return null;
  if(digits.startsWith('55')&&![12,13].includes(digits.length))return null;
  return digits;
}
function hpeWelcomeText(student){return `Olá, ${student.name}!\n\nAcesse o HPE Força Bruta: https://forcabruta.vercel.app/\nPerfil: Sou aluno\nCódigo de acesso (6 números): ${student.accessCode||'Atualize a lista de alunos para carregar o código.'}\n\nUse a senha temporária enviada pelo personal. No primeiro acesso, escolha sua senha pessoal. Se ainda não recebeu a senha temporária, peça ao personal para redefini-la e compartilhar os novos dados.\n\nBons treinos!`}
function hpeStudentWelcome(student){
  const phone=hpeNormalizeWhatsApp(student.whatsapp);
  modal(`<h2>Acesso do aluno</h2><p>${esc(student.name)}</p><p><b>Código de acesso:</b> ${esc(student.accessCode||'Atualize a lista para carregar o código')}</p><p><b>WhatsApp:</b> ${phone?'+'+phone:'Não cadastrado'}</p><label>Mensagem para o aluno<textarea id="hpeWhatsAppMessage" rows="9">${esc(hpeWelcomeText(student,email||data.studentAccounts.find(a=>a.student===student.id)?.email))}</textarea></label>${phone?'<a id="hpeWhatsAppLink" class="whatsapp-link" target="_blank" rel="noopener noreferrer">Abrir mensagem no WhatsApp</a>':`<button onclick="hpeEditWhatsApp(${student.id})">Cadastrar WhatsApp</button>`}<p class="note">A mensagem inclui o código de acesso, mas não a senha. Para enviar código e senha juntos, use a tela de criação ou redefina a senha e compartilhe os novos dados. Confira o destinatário antes de enviar.</p>`);
  if(phone){const update=()=>{$('#hpeWhatsAppLink').href='https://wa.me/'+phone+'?text='+encodeURIComponent($('#hpeWhatsAppMessage').value)};$('#hpeWhatsAppMessage').oninput=update;update()}
}
window.hpeOpenStudentWhatsApp=id=>{const student=data.students.find(s=>s.id===Number(id));if(hpeProfile?.role!=='personal'||!student||!ownsStudent(id))return;hpeStudentWelcome(student)};
window.hpeEditWhatsApp=id=>{
  const student=data.students.find(s=>s.id===Number(id));if(hpeProfile?.role!=='personal'||!student||!ownsStudent(id))return;
  modal(`<h2>WhatsApp de ${esc(student.name)}</h2><form id="hpeWhatsAppForm"><label>Número com DDD<input name="whatsapp" type="tel" value="${esc(student.whatsapp?'+'+student.whatsapp:'')}" placeholder="(11) 99999-9999" maxlength="24" required></label><p id="hpeWhatsAppError" role="alert"></p><button class="primary">Salvar WhatsApp</button></form><p class="note">O número acompanha a sincronização desta conta.</p>`);
  $('#hpeWhatsAppForm').onsubmit=event=>{event.preventDefault();const phone=hpeNormalizeWhatsApp(new FormData(event.target).get('whatsapp'));if(!phone){$('#hpeWhatsAppError').textContent='Informe um número válido com DDD.';return}student.whatsapp=phone;save();render();hpeStudentWelcome(student)};
};
const whatsappRender=render;render=function(){whatsappRender();if(hpeProfile?.role==='personal'&&page==='alunos')$('#content').insertAdjacentHTML('beforeend',`<section class="card"><h2>Enviar acesso pelo WhatsApp</h2>${visibleStudents().map(s=>`<div class="listrow"><div><b>${esc(s.name)}</b><p>${s.whatsapp?'+'+esc(s.whatsapp):'WhatsApp não cadastrado'}</p></div><button onclick="hpeOpenStudentWhatsApp(${s.id})">Mensagem de acesso</button><button onclick="hpeEditWhatsApp(${s.id})">${s.whatsapp?'Editar':'Cadastrar'} WhatsApp</button></div>`).join('')||'<p>Cadastre um aluno para preparar a mensagem.</p>'}</section>`)};


