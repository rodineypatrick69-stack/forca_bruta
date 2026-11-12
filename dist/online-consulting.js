const hpeConsultDays=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const hpeConsultAngles=[['front','Frente'],['right','Lado direito'],['left','Lado esquerdo'],['back','Costas']];
const hpeConsultBucket='hpe-consultation-media';
let hpeConsultSection='roster',hpeConsultSelectedId=null,hpeConsultRenderSeq=0,hpeConsultPeriod='week';
let hpeConsultBuilderWorkoutId=null,hpeConsultBuilderTab='mapa',hpeConsultBuilderMuscle='peitoral',hpeConsultBuilderSide='frente',hpeConsultBuilderQuery='',hpeConsultBuilderPortion='',hpeConsultPendingExercises=new Map();
let hpeConsultRunner=null,hpeConsultRunnerTimer=null,hpeConsultActiveDivision='A';
let hpeConsultState={roster:[],record:null,intake:null,program:null,photos:[],messages:[],measurements:[],sessions:[],checkins:[],signedUrls:{}};
let hpeConsultRosterMetrics={};
window.hpeConsultationAccountIds=window.hpeConsultationAccountIds||new Set();
if(typeof visibleStudents==='function'){
 const hpeConsultOriginalVisibleStudents=visibleStudents;
 visibleStudents=function(){const rows=hpeConsultOriginalVisibleStudents();const hidden=window.hpeConsultationAccountIds;return hidden instanceof Set&&hidden.size?rows.filter(s=>!s.supabaseId||!hidden.has(s.supabaseId)):rows};
}
function hpeConsultToday(){return typeof todayKey==='function'?todayKey():new Date().toISOString().slice(0,10)}
function hpeConsultWeekStart(key=hpeConsultToday()){const day=new Date(String(key).slice(0,10)+'T12:00:00').getDay();const offset=(day+6)%7;return typeof shiftDay==='function'?shiftDay(String(key).slice(0,10),-offset):hpeConsultShiftDate(String(key).slice(0,10),-offset)}
function hpeConsultShiftDate(key,delta){const date=new Date(key+'T12:00:00');date.setDate(date.getDate()+delta);return date.toISOString().slice(0,10)}
function hpeConsultDate(value){if(!value)return'—';const date=new Date(String(value).length===10?value+'T12:00:00':value);return Number.isNaN(date.getTime())?'—':date.toLocaleDateString('pt-BR')}
function hpeConsultDateTime(value){if(!value)return'—';const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}
function hpeConsultAngleLabel(value){return hpeConsultAngles.find(x=>x[0]===value)?.[1]||'Foto de evolução'}
function hpeConsultRecord(){return hpeConsultState.record}
function hpeConsultProgram(){return hpeConsultState.program?.program||{title:'Ficha personalizada',workouts:[]}}
function hpeConsultWorkout(id){return hpeConsultProgram().workouts.find(w=>String(w.id)===String(id))}
function hpeConsultWorkoutDivision(workout,index=0){const value=String(workout?.division||workout?.day||'').trim(),named=value.match(/(?:treino|divis[aã]o)\s*([a-z])\b/i),single=value.match(/^([a-z])(?:\b|[\s:.-])/i);return String(named?.[1]||single?.[1]||String.fromCharCode(65+(index%26))).toUpperCase()}
function hpeConsultDivisionLetters(program=hpeConsultProgram()){return [...new Set(['A','B','C','D','E',...(program.workouts||[]).map((workout,index)=>hpeConsultWorkoutDivision(workout,index))])].sort((a,b)=>a.localeCompare(b,'pt-BR'))}
function hpeConsultDivisionOptionsHtml(program,selected,currentId=null){const used=new Set((program.workouts||[]).map((workout,index)=>({workout,index})).filter(item=>String(item.workout.id)!==String(currentId)).map(item=>hpeConsultWorkoutDivision(item.workout,item.index)));return Array.from({length:26},(_,index)=>String.fromCharCode(65+index)).map(letter=>'<option value="'+letter+'" '+(letter===selected?'selected':'')+' '+(used.has(letter)?'disabled':'')+'>Treino '+letter+(used.has(letter)?' · já criado':'')+'</option>').join('')}
function hpeConsultWeekSessions(){const start=hpeConsultWeekStart(),today=hpeConsultToday();return hpeConsultState.sessions.filter(s=>s.session_date>=start&&s.session_date<=today)}
function hpeConsultWeekCheckin(){const start=hpeConsultWeekStart();return hpeConsultState.checkins.find(x=>x.week_start===start)||null}
function hpeConsultLatestWeight(){return hpeConsultState.measurements.slice().sort((a,b)=>String(b.measurement_date).localeCompare(String(a.measurement_date)))[0]||null}
function hpeConsultStudentTarget(){const a=hpeConsultState.intake?.answers||{};return Math.max(1,Math.min(7,Number(a.weeklyFrequency)||Number(a.availableDays?.length)||3))}
function hpeConsultDelta(records,period){
 const list=records.slice().sort((a,b)=>String(a.measurement_date).localeCompare(String(b.measurement_date)));
 if(!list.length)return null;
 const now=hpeConsultToday(),start=period==='month'?now.slice(0,7)+'-01':hpeConsultWeekStart(now);
 const current=list.filter(x=>x.measurement_date>=start&&x.measurement_date<=now),before=list.filter(x=>x.measurement_date<start);
 if(!current.length)return null;
 const from=before[before.length-1]||current[0],to=current[current.length-1];
 if(from.id===to.id)return null;
 return Number(to.weight_kg)-Number(from.weight_kg);
}
function hpeConsultChangeLabel(delta){
 if(delta===null||!Number.isFinite(delta))return'Ainda sem comparação';
 if(Math.abs(delta)<0.05)return'Sem variação registrada';
 const amount=Math.abs(delta).toFixed(1).replace('.',',')+' kg';
 return delta<0?'Perdeu '+amount:'Ganhou '+amount;
}
function hpeConsultRequire(roleName){
 if(!hpeProfile||hpeProfile.role!==roleName||!hpeAuth){$('#content').innerHTML='<section class="card consult-empty"><h2>Entre com sua conta HPE</h2><p>Esta área usa a conta do personal ou do aluno da consultoria para proteger e sincronizar as informações.</p></section>';return false}
 return true;
}
function hpeConsultModuleNav(studentMode){
 const items=studentMode?[['home','Início'],['questionnaire','Questionário'],['workout','Meu treino'],['progress','Evolução'],['checkins','Check-in semanal'],['chat','Conversa'],['reports','Relatórios PDF']]:[['overview','Resumo'],['questionnaire','Questionário'],['workout','Ficha de treino'],['progress','Evolução e fotos'],['checkins','Check-ins'],['chat','Chat']];
 return '<nav class="consult-module-tabs" aria-label="Seções da consultoria">'+items.map(([key,label])=>'<button class="'+(hpeConsultSection===key?'active':'')+'" aria-current="'+(hpeConsultSection===key?'page':'false')+'" onclick="hpeConsultSetSection(\''+key+'\')">'+label+'</button>').join('')+'</nav>';
}
function hpeConsultCoachRosterHtml(){
 const rows=hpeConsultState.roster;
 const pendingCheckins=rows.filter(s=>hpeConsultRosterMetrics[s.id]?.checkinPending).length,unreadMessages=rows.reduce((sum,s)=>sum+(hpeConsultRosterMetrics[s.id]?.unreadMessages||0),0),pendingIntakes=rows.filter(s=>hpeConsultRosterMetrics[s.id]?.questionnairePending).length;
 return heading('CONSULTORIA ONLINE','Atendimento individual, em um espaço próprio.','Esta carteira é independente de “Meus alunos”. Cadastre aqui apenas alunos novos da consultoria.', '<button onclick="render()">Atualizar carteira</button> <button class="primary" onclick="hpeConsultCreateStudent()">+ Cadastrar novo aluno</button>')+
 '<section class="card consult-roster"><div class="row"><div><span class="eyebrow">CARTEIRA DA CONSULTORIA</span><h2>Alunos online</h2></div><span class="tag">'+rows.length+' ALUNOS</span></div>'+
 (rows.length?'<div class="consult-roster-summary"><span>'+pendingCheckins+' check-in(s) pendente(s)</span><span>'+pendingIntakes+' questionário(s) pendente(s)</span><span>'+unreadMessages+' mensagem(ns) nova(s)</span></div><div class="consult-roster-grid">'+rows.map(s=>{const m=hpeConsultRosterMetrics[s.id]||{};return'<article class="consult-roster-card"><div class="row"><span class="avatar">'+esc(String(s.name||'Aluno').split(' ').map(x=>x[0]).slice(0,2).join(''))+'</span><span class="tag">'+esc(s.goal||'Consultoria online')+'</span></div><h3>'+esc(s.name)+'</h3><p>'+esc(s.level||'Nível a definir')+(s.whatsapp?' · WhatsApp '+esc(s.whatsapp):'')+'</p><div class="consult-roster-metrics"><div><small>Questionário</small><b class="'+(m.questionnairePending?'pending':'complete')+'">'+(m.questionnairePending?'Pendente':'Preenchido')+'</b></div><div><small>Check-in da semana</small><b class="'+(m.checkinPending?'pending':'complete')+'">'+(m.checkinPending?'Pendente':'Recebido')+'</b></div><div><small>Treinos nesta semana</small><b>'+Number(m.weeklySessions||0)+' / '+Number(m.weeklyTarget||3)+'</b></div><div><small>Peso mais recente</small><b>'+(m.lastWeight?Number(m.lastWeight).toFixed(1).replace('.',',')+' kg':'Ainda não registrado')+'</b></div><div><small>Ficha atual</small><b>'+Number(m.exerciseCount||0)+' exercício(s)</b></div><div><small>Mensagens novas</small><b class="'+(m.unreadMessages?'pending':'')+'">'+Number(m.unreadMessages||0)+'</b></div></div><div class="consult-roster-actions"><button class="primary" onclick="hpeConsultOpenStudent(\''+s.id+'\',\'overview\')">Abrir acompanhamento</button><button onclick="hpeConsultResetStudent(\''+s.id+'\')">Redefinir senha</button><button class="danger" onclick="hpeConsultConfirmRemove(\''+s.id+'\')">Remover aluno</button></div></article>'}).join('')+'</div>':'<div class="consult-empty"><h3>Sua carteira ainda está vazia</h3><p>Os alunos cadastrados nas outras abas não são importados para cá.</p><button class="primary" onclick="hpeConsultCreateStudent()">Cadastrar o primeiro aluno</button></div>')+
 '</section><p class="note">Ao cadastrar, o app cria um novo acesso para o aluno com código e senha temporária gerados pelo personal.</p>';
}
async function hpeConsultLoadRosterMetrics(roster){
 hpeConsultRosterMetrics={};if(!roster.length)return;
 const ids=roster.map(row=>row.id),start=hpeConsultWeekStart(),today=hpeConsultToday();
 const results=await Promise.all([
  hpeAuth.from('hpe_consultation_intakes').select('consultation_id,answers').in('consultation_id',ids),
  hpeAuth.from('hpe_consultation_programs').select('consultation_id,program').in('consultation_id',ids),
  hpeAuth.from('hpe_consultation_checkins').select('consultation_id').in('consultation_id',ids).eq('week_start',start),
  hpeAuth.from('hpe_consultation_sessions').select('consultation_id').in('consultation_id',ids).gte('session_date',start).lte('session_date',today),
  hpeAuth.from('hpe_consultation_measurements').select('consultation_id,weight_kg,measurement_date').in('consultation_id',ids).order('measurement_date',{ascending:false}).limit(1000),
  hpeAuth.from('hpe_consultation_messages').select('consultation_id,author_id,created_at').in('consultation_id',ids).order('created_at',{ascending:false}).limit(1000)
 ]);
 const error=results.find(x=>x.error)?.error;if(error)throw error;
 for(const row of roster){const intake=(results[0].data||[]).find(x=>x.consultation_id===row.id),program=(results[1].data||[]).find(x=>x.consultation_id===row.id)?.program||{},answers=intake?.answers||{},workouts=Array.isArray(program.workouts)?program.workouts:[],last=(results[4].data||[]).find(x=>x.consultation_id===row.id),checkin=(results[2].data||[]).some(x=>x.consultation_id===row.id),seen=row.personal_seen_at?Date.parse(row.personal_seen_at):0,unread=(results[5].data||[]).filter(x=>x.consultation_id===row.id&&x.author_id!==row.personal_id&&Date.parse(x.created_at)>seen).length;
  hpeConsultRosterMetrics[row.id]={questionnairePending:!intake,checkinPending:!checkin,weeklySessions:(results[3].data||[]).filter(x=>x.consultation_id===row.id).length,weeklyTarget:Math.max(1,Math.min(7,Number(answers.weeklyFrequency)||Number(answers.availableDays?.length)||3)),lastWeight:last?.weight_kg||null,exerciseCount:workouts.reduce((sum,w)=>sum+(Array.isArray(w.exercises)?w.exercises.length:0),0),unreadMessages:unread};
 }
}
function hpeConsultWorkspaceHeader(studentMode){
 const s=hpeConsultRecord();
 const title=studentMode?'Minha consultoria online':'Consultoria de '+esc(s?.name||'Aluno');
 const subtitle=studentMode?'Seu treino e seu acompanhamento com '+esc(s?.personal_name||'seu personal')+'.':'Carteira da consultoria, separada dos alunos e dos registros das outras abas.';
 const action=studentMode?'':(hpeConsultSection==='workout'&&hpeConsultBuilderWorkoutId?'<button onclick="hpeConsultCloseWorkoutBuilder()">‹ Voltar à ficha de treino</button>':'<button onclick="hpeConsultOpenRoster()">‹ Voltar à carteira</button>');
 return heading('CONSULTORIA ONLINE',title,subtitle,action)+hpeConsultModuleNav(studentMode);
}
function hpeConsultStat(label,value,detail){
 return '<section class="card stat consult-stat"><p>'+label+'</p><strong>'+value+'</strong><small>'+detail+'</small></section>';
}
function hpeConsultStudentHomeHtml(){
 const sessions=hpeConsultWeekSessions(),target=hpeConsultStudentTarget(),last=hpeConsultLatestWeight(),delta=hpeConsultDelta(hpeConsultState.measurements,'week'),checkin=hpeConsultWeekCheckin();
 const plan=hpeConsultProgram(),exercises=plan.workouts.reduce((sum,w)=>sum+(w.exercises||[]).length,0);
 return hpeConsultWorkspaceHeader(true)+
 '<section class="card consult-welcome"><span class="eyebrow">ACOMPANHAMENTO INDIVIDUAL</span><h2>Olá, '+esc(hpeConsultRecord().name.split(' ')[0])+'.</h2><p>Seu acompanhamento, seu treino e sua evolução ficam reunidos nesta área.</p><div class="consult-shortcuts"><button class="primary" onclick="hpeConsultSetSection(\'workout\')">Abrir meu treino</button><button onclick="hpeConsultSetSection(\'checkins\')">Fazer check-in da semana</button><button onclick="hpeConsultSetSection(\'progress\')">Registrar meu peso</button></div></section>'+
 '<div class="grid stats consult-stats">'+hpeConsultStat('Treinos nesta semana',sessions.length+' / '+target,'Treinos registrados na consultoria')+hpeConsultStat('Peso mais recente',last?Number(last.weight_kg).toFixed(1).replace('.',',')+' kg':'—',last?'Registrado em '+hpeConsultDate(last.measurement_date):'Registre seu primeiro peso')+hpeConsultStat('Variação semanal',hpeConsultChangeLabel(delta),delta===null?'Precisamos de duas medidas para comparar':'Comparação com a última medida antes desta semana')+'</div>'+
 '<div class="consult-layout"><section class="card"><div class="row"><div><span class="eyebrow">PLANO ATUAL</span><h2>'+esc(plan.title||'Ficha personalizada')+'</h2></div><span class="tag">'+exercises+' EXERCÍCIOS</span></div><p>'+plan.workouts.length+' treino(s) montado(s) pelo personal.</p><button onclick="hpeConsultSetSection(\'workout\')">Ver treino e baixar ficha PDF</button></section><section class="card"><div class="row"><div><span class="eyebrow">CHECK-IN</span><h2>Como foi sua semana?</h2></div><span class="tag">'+(checkin?'ENVIADO':'PENDENTE')+'</span></div><p>'+(checkin?'Check-in enviado. O personal já pode acompanhar suas respostas.':'Conte ao personal como estão energia, recuperação e desconfortos.')+'</p><button class="primary" onclick="hpeConsultSetSection(\'checkins\')">'+(checkin?'Atualizar check-in':'Responder check-in')+'</button></section></div>'+
 '<section class="card"><div class="row"><div><span class="eyebrow">RELATÓRIO SEMANAL</span><h2>Resumo do seu acompanhamento</h2></div><button class="primary" onclick="hpeConsultDownloadWeeklyReport()">Baixar relatório da semana em PDF</button></div><p>Inclui treinos registrados, variação de peso, check-in e observações desta semana.</p></section>';
}
function hpeConsultCoachOverviewHtml(){
 const s=hpeConsultRecord(),sessions=hpeConsultWeekSessions(),target=hpeConsultStudentTarget(),last=hpeConsultLatestWeight(),delta=hpeConsultDelta(hpeConsultState.measurements,'week'),checkin=hpeConsultWeekCheckin(),intake=hpeConsultState.intake;
 const plan=hpeConsultProgram(),exerciseCount=plan.workouts.reduce((sum,w)=>sum+(w.exercises||[]).length,0);
 return hpeConsultWorkspaceHeader(false)+
 '<div class="grid stats consult-stats">'+hpeConsultStat('Treinos desta semana',sessions.length+' / '+target,'Registros dentro desta consultoria')+hpeConsultStat('Peso mais recente',last?Number(last.weight_kg).toFixed(1).replace('.',',')+' kg':'—',last?'Atualizado em '+hpeConsultDate(last.measurement_date):'Aguardando o primeiro registro')+hpeConsultStat('Variação semanal',hpeConsultChangeLabel(delta),delta===null?'Ainda sem duas medidas para comparar':'Comparação de peso desta semana')+'</div>'+
 '<div class="consult-layout"><section class="card"><div class="row"><div><span class="eyebrow">QUESTIONÁRIO</span><h2>Preparação do aluno</h2></div><span class="tag">'+(intake?'PREENCHIDO':'PENDENTE')+'</span></div><p>'+(intake?'Atualizado em '+hpeConsultDateTime(intake.updated_at):'Aguardando o aluno preencher com informações de saúde e adaptações.')+'</p><button onclick="hpeConsultSetSection(\'questionnaire\')">Ver questionário</button></section><section class="card"><div class="row"><div><span class="eyebrow">FICHA DE TREINO</span><h2>'+esc(plan.title||'Ficha personalizada')+'</h2></div><span class="tag">'+exerciseCount+' EXERCÍCIOS</span></div><p>'+plan.workouts.length+' treino(s) cadastrados.</p><button class="primary" onclick="hpeConsultSetSection(\'workout\')">Montar ou editar ficha</button></section></div>'+
 '<section class="card"><div class="row"><div><span class="eyebrow">CHECK-IN SEMANAL</span><h2>Retorno do aluno</h2></div><span class="tag">'+(checkin?'RECEBIDO':'AGUARDANDO')+'</span></div>'+(checkin?'<p>Energia '+checkin.energy+'/5 · Recuperação '+checkin.recovery+'/5</p>'+(checkin.discomfort?'<div class="consult-answer"><small>Desconforto informado</small><p>'+esc(checkin.discomfort)+'</p></div>':'')+(checkin.notes?'<div class="consult-answer"><small>Observação</small><p>'+esc(checkin.notes)+'</p></div>':''):'<p>O check-in da semana aparecerá aqui quando o aluno preencher.</p>')+'<button onclick="hpeConsultSetSection(\'checkins\')">Ver histórico de check-ins</button></section>'+
 '<section class="card"><div class="row"><div><span class="eyebrow">CONTATO</span><h2>'+esc(s.name)+'</h2></div><button onclick="hpeConsultSetSection(\'chat\')">Abrir conversa</button></div><p>'+esc(s.goal||'Objetivo a definir')+' · '+esc(s.level||'Nível a definir')+(s.whatsapp?' · '+esc(s.whatsapp):'')+'</p><div class="consult-shortcuts"><button onclick="hpeConsultSetSection(\'progress\')">Ver peso e fotos</button><button onclick="hpeConsultDownloadWeeklyReport()">Gerar relatório semanal PDF</button></div></section>';
}
function hpeConsultAnswer(label,value){
 return '<div class="consult-answer"><small>'+label+'</small><p>'+esc(value||'Não informado')+'</p></div>';
}
function hpeConsultQuestionnaireHtml(studentMode){
 const intake=hpeConsultState.intake,answers=intake?.answers||{};
 if(studentMode){
  return hpeConsultWorkspaceHeader(true)+'<section class="card consult-panel"><div class="row"><div><span class="eyebrow">QUESTIONÁRIO INICIAL</span><h2>Informações para personalizar seu treino</h2></div><span class="tag">'+(intake?'EDITÁVEL':'PREENCHIMENTO')+'</span></div><p>Responda com sinceridade. O personal verá essas informações para adaptar sua ficha. Este questionário não substitui avaliação ou orientação de um profissional de saúde.</p><form class="consult-form" onsubmit="hpeConsultSaveIntake(event)">'+
  '<label>Objetivo principal<select name="goal"><option value="Hipertrofia" '+((answers.goal||hpeConsultRecord().goal)==='Hipertrofia'?'selected':'')+'>Hipertrofia</option><option value="Emagrecimento" '+(answers.goal==='Emagrecimento'?'selected':'')+'>Emagrecimento</option><option value="Condicionamento" '+(answers.goal==='Condicionamento'?'selected':'')+'>Condicionamento</option><option value="Força" '+(answers.goal==='Força'?'selected':'')+'>Força</option><option value="Saúde e bem-estar" '+(answers.goal==='Saúde e bem-estar'?'selected':'')+'>Saúde e bem-estar</option><option value="Outro" '+(answers.goal==='Outro'?'selected':'')+'>Outro</option></select></label>'+
  '<div class="inline"><label>Quantos dias por semana pretende treinar?<input type="number" name="weeklyFrequency" min="1" max="7" value="'+esc(answers.weeklyFrequency||3)+'" required></label><label>Tempo por treino<select name="duration"><option value="30" '+(answers.duration==='30'?'selected':'')+'>Até 30 minutos</option><option value="45" '+(!answers.duration||answers.duration==='45'?'selected':'')+'>Cerca de 45 minutos</option><option value="60" '+(answers.duration==='60'?'selected':'')+'>Cerca de 1 hora</option><option value="90" '+(answers.duration==='90'?'selected':'')+'>Mais de 1 hora</option></select></label></div>'+
  '<fieldset class="consult-fieldset"><legend>Dias em que costuma conseguir treinar (opcional)</legend><div class="consult-days">'+hpeConsultDays.map((day,i)=>'<label><input type="checkbox" name="availableDays" value="'+i+'" '+((answers.availableDays||[]).includes(i)?'checked':'')+'>'+day+'</label>').join('')+'</div></fieldset>'+
  '<fieldset class="consult-fieldset"><legend>Você tem alguma condição de saúde ou comorbidade que o personal precisa considerar?</legend><div class="consult-radio"><label><input type="radio" name="conditions" value="no" '+(answers.conditions!=='yes'?'checked':'')+' required> Não</label><label><input type="radio" name="conditions" value="yes" '+(answers.conditions==='yes'?'checked':'')+'> Sim</label></div><label>Se sim, descreva apenas o necessário para adaptar o treino<textarea name="conditionsDetail" rows="3" maxlength="700">'+esc(answers.conditionsDetail||'')+'</textarea></label></fieldset>'+
  '<fieldset class="consult-fieldset"><legend>Você tem alguma lesão atual, dor recorrente, cirurgia recente ou limitação de movimento?</legend><div class="consult-radio"><label><input type="radio" name="injury" value="no" '+(answers.injury!=='yes'?'checked':'')+' required> Não</label><label><input type="radio" name="injury" value="yes" '+(answers.injury==='yes'?'checked':'')+'> Sim</label></div><label>Qual região ou movimento? Quando sente a dificuldade?<textarea name="injuryDetail" rows="3" maxlength="700">'+esc(answers.injuryDetail||'')+'</textarea></label></fieldset>'+
  '<label>Algum profissional de saúde orientou cuidados ou limites para o exercício?<textarea name="healthGuidance" rows="3" maxlength="700" placeholder="Opcional">'+esc(answers.healthGuidance||'')+'</textarea></label>'+
  '<label>Tem dificuldade para executar algum exercício ou movimento?<textarea name="exerciseDifficulty" rows="3" maxlength="700" placeholder="Ex.: agachamento, corrida, movimentos acima da cabeça">'+esc(answers.exerciseDifficulty||'')+'</textarea></label>'+
  '<label>Quais exercícios gostaria de adaptar ou evitar?<textarea name="exerciseAdaptation" rows="3" maxlength="700">'+esc(answers.exerciseAdaptation||'')+'</textarea></label>'+
  '<label>Observações adicionais para o personal<textarea name="notes" rows="3" maxlength="700">'+esc(answers.notes||'')+'</textarea></label>'+
  '<label class="consult-consent"><input type="checkbox" name="healthConsent" value="yes" required '+(intake?.consent_at?'checked':'')+'> Concordo que estas informações sejam usadas e compartilhadas com meu personal responsável para organizar e adaptar minha consultoria.</label>'+
  '<label class="consult-consent"><input type="checkbox" name="photosConsent" value="yes" '+(intake?.photos_consent_at?'checked':'')+'> Autorizo o envio e a visualização das minhas fotos de evolução pelo personal, somente para meu acompanhamento individual.</label>'+
  '<p class="note">As respostas ficam visíveis somente para você e o personal responsável pela sua consultoria.</p><button class="primary">'+(intake?'Atualizar questionário':'Salvar questionário')+'</button></form></section>';
 }
 return hpeConsultWorkspaceHeader(false)+'<section class="card consult-panel"><div class="row"><div><span class="eyebrow">QUESTIONÁRIO DO ALUNO</span><h2>Saúde, rotina e adaptações</h2></div><span class="tag">'+(intake?'PREENCHIDO':'AGUARDANDO')+'</span></div>'+
 (intake?'<div class="consult-facts"><div><small>Objetivo principal</small><b>'+esc(answers.goal||hpeConsultRecord().goal||'Não informado')+'</b></div><div><small>Dias por semana</small><b>'+esc(answers.weeklyFrequency||'—')+'</b></div><div><small>Tempo por treino</small><b>'+esc(answers.duration||'—')+' min</b></div><div><small>Ficha atualizada</small><b>'+hpeConsultDateTime(intake.updated_at)+'</b></div></div>'+
  hpeConsultAnswer('Condição de saúde ou comorbidade',answers.conditions==='yes'?'Sim — '+(answers.conditionsDetail||'sem detalhes adicionais'):'Não informado ou não')+
  hpeConsultAnswer('Lesão, dor ou limitação atual',answers.injury==='yes'?'Sim — '+(answers.injuryDetail||'sem detalhes adicionais'):'Não informado ou não')+
  (answers.healthGuidance?hpeConsultAnswer('Orientação de profissional de saúde',answers.healthGuidance):'')+
  (answers.exerciseDifficulty?hpeConsultAnswer('Dificuldade para executar exercícios',answers.exerciseDifficulty):'')+
  (answers.exerciseAdaptation?hpeConsultAnswer('Exercícios para adaptar ou evitar',answers.exerciseAdaptation):'')+
  (answers.notes?hpeConsultAnswer('Observações',answers.notes):'')+
  '<p class="note">Consentimento para uso das respostas: '+(intake.consent_at?'registrado':'pendente')+' · Consentimento para fotos: '+(intake.photos_consent_at?'registrado':'não autorizado')+'</p>':
  '<div class="consult-empty"><p>O aluno ainda não preencheu o questionário.</p><p>Envie os dados de acesso criados para ele entrar no app e preencher esta ficha.</p></div>')+
 '</section>';
}
function hpeConsultBuilderKey(muscle,index){return String(muscle)+':'+String(index)}
function hpeConsultBuilderNormalize(value){return String(value||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function hpeConsultBuilderSetTab(tab){if(!['mapa','exercicios','lista'].includes(tab))return;hpeConsultBuilderTab=tab;render()}
function hpeConsultBuilderChooseMuscle(key){if(!muscleLibrary[key])return;hpeConsultBuilderMuscle=key;const shapes=hpeConsultBuilderSide==='frente'?frontShapes:backShapes,other=hpeConsultBuilderSide==='frente'?backShapes:frontShapes;if(!Object.hasOwn(shapes,key)&&Object.hasOwn(other,key))hpeConsultBuilderSide=hpeConsultBuilderSide==='frente'?'costas':'frente';hpeConsultBuilderPortion='';render()}
function hpeConsultBuilderSetSide(side){if(!['frente','costas'].includes(side))return;hpeConsultBuilderSide=side;const shapes=side==='frente'?frontShapes:backShapes;if(!Object.hasOwn(shapes,hpeConsultBuilderMuscle))hpeConsultBuilderMuscle=Object.keys(shapes)[0];render()}
function hpeConsultBuilderSetPortion(value){hpeConsultBuilderPortion=String(value||'');render()}
function hpeConsultBuilderMuscleBody(){
 if(typeof muscleBody!=='function')return '';
 const previousSide=bodySide,previousMuscle=selectedMuscle;
 try{
  bodySide=hpeConsultBuilderSide;selectedMuscle=hpeConsultBuilderMuscle;
  return muscleBody().replace(/\bchooseMuscle\(/g,'hpeConsultBuilderChooseMuscle(').replace(/<p class="note">[\s\S]*?<\/p>/,'');
 }finally{bodySide=previousSide;selectedMuscle=previousMuscle}
}
function hpeConsultBuilderMapHtml(){
 const labels=Object.entries(muscleLibrary);
 return '<section class="card muscle-picker consult-builder-picker" aria-labelledby="consult-muscle-heading"><div class="row"><div><span class="eyebrow">MONTE O TREINO PELO MÚSCULO</span><h2 id="consult-muscle-heading">Onde vamos trabalhar?</h2><p>Toque no corpo ou escolha um grupo muscular.</p></div><span class="tag">'+labels.length+' GRUPOS</span></div><div class="muscle-layout"><div class="body-panel"><div class="login-tabs"><button class="'+(hpeConsultBuilderSide==='frente'?'primary':'')+'" aria-pressed="'+(hpeConsultBuilderSide==='frente')+'" data-side="frente" onclick="hpeConsultBuilderSetSide(this.dataset.side)">Frente</button><button class="'+(hpeConsultBuilderSide==='costas'?'primary':'')+'" aria-pressed="'+(hpeConsultBuilderSide==='costas')+'" data-side="costas" onclick="hpeConsultBuilderSetSide(this.dataset.side)">Costas</button></div>'+hpeConsultBuilderMuscleBody()+'<p class="note">Mapa anatômico do mesmo atlas usado na criação de treinos do app.</p></div><div class="muscle-options"><div class="muscle-chips">'+labels.map(([key,muscle])=>'<button aria-pressed="'+(hpeConsultBuilderMuscle===key)+'" class="'+(hpeConsultBuilderMuscle===key?'primary':'')+'" data-muscle="'+key+'" onclick="hpeConsultBuilderChooseMuscle(this.dataset.muscle)">'+esc(muscle.label)+'</button>').join('')+'</div><div class="selected-muscle-info"><span class="eyebrow">GRUPO SELECIONADO</span><h2>'+esc(muscleLibrary[hpeConsultBuilderMuscle]?.label||'Grupo muscular')+'</h2><p>'+(muscleLibrary[hpeConsultBuilderMuscle]?.exercises.length||0)+' exercícios disponíveis. Toque no corpo ou escolha um grupo acima.</p><button class="primary" data-tab="exercicios" onclick="hpeConsultBuilderSetTab(this.dataset.tab)">Ver exercícios ↗</button></div></div></div></section>';
}
function hpeConsultBuilderExercisesHtml(){
 const muscle=muscleLibrary[hpeConsultBuilderMuscle]||{label:'Exercícios',exercises:[],groups:[],portions:[]},groups=muscle.groups||[],query=hpeConsultBuilderNormalize(hpeConsultBuilderQuery);
 const rows=muscle.exercises.map((name,index)=>({name,index,key:hpeConsultBuilderKey(hpeConsultBuilderMuscle,index)})).filter(item=>!hpeConsultBuilderPortion||muscle.portions?.[item.index]===hpeConsultBuilderPortion),visibleRows=rows.filter(item=>!query||hpeConsultBuilderNormalize(item.name+' '+(muscle.portions?.[item.index]||'')).includes(query));
 return '<section class="card muscle-picker consult-builder-picker"><div class="row"><div><span class="eyebrow">EXERCÍCIOS DO GRUPO</span><h2>'+esc(muscle.label)+'</h2><p>Selecione os exercícios com a mesma biblioteca e demonstrações do treino do app.</p></div><button data-tab="mapa" onclick="hpeConsultBuilderSetTab(this.dataset.tab)">‹ Voltar ao mapa</button></div><div class="muscle-chips consult-builder-muscle-chips">'+Object.entries(muscleLibrary).map(([key,item])=>'<button aria-pressed="'+(hpeConsultBuilderMuscle===key)+'" class="'+(hpeConsultBuilderMuscle===key?'primary':'')+'" data-muscle="'+key+'" onclick="hpeConsultBuilderChooseMuscle(this.dataset.muscle)">'+esc(item.label)+'</button>').join('')+'</div><div class="consult-builder-filters"><label>Buscar exercício<input type="search" value="'+esc(hpeConsultBuilderQuery)+'" placeholder="Ex.: supino inclinado" oninput="hpeConsultBuilderFilter(this.value)"></label>'+(groups.length?'<label>Porção muscular<select onchange="hpeConsultBuilderSetPortion(this.value)"><option value="">Todas as porções</option>'+groups.map(group=>'<option value="'+esc(group.label)+'" '+(hpeConsultBuilderPortion===group.label?'selected':'')+'>'+esc(group.label)+'</option>').join('')+'</select></label>':'')+'</div><div class="consult-builder-exercises" id="consultBuilderExercises">'+rows.map(item=>'<div class="exercise consult-builder-exercise" '+(query&&!hpeConsultBuilderNormalize(item.name+' '+(muscle.portions?.[item.index]||'')).includes(query)?'hidden':'')+' data-consult-exercise-row data-name="'+esc(item.name)+'"><span class="num">'+String(item.index+1).padStart(2,'0')+'</span>'+((typeof hpeMotionSquare==='function')?hpeMotionSquare({name:item.name}):'')+'<div class="details"><b>'+esc(item.name)+'</b>'+(muscle.portions?.[item.index]?'<p class="consult-exercise-category">'+esc(muscle.portions[item.index])+'</p>':'')+'<p>Defina séries, repetições, carga e descanso.</p></div><button type="button" class="consult-builder-choice'+(hpeConsultPendingExercises.has(item.key)?' selected':'')+'" data-consult-select-exercise data-muscle="'+hpeConsultBuilderMuscle+'" data-index="'+item.index+'" aria-pressed="'+hpeConsultPendingExercises.has(item.key)+'" onclick="hpeConsultBuilderFlipExercise(this.dataset.muscle,Number(this.dataset.index))">'+(hpeConsultPendingExercises.has(item.key)?'✓ Selecionado':'+ Selecionar')+'</button></div>').join('')+(visibleRows.length?'':'<p class="consult-empty">Nenhum exercício encontrado para este filtro.</p>')+'<p id="consultBuilderSearchResult" role="status"></p><button type="button" class="custom-exercise" data-workout-id="'+hpeConsultBuilderWorkoutId+'" onclick="hpeConsultAddExercise(this.dataset.workoutId)">+ Cadastrar outro exercício</button></div><div class="consult-batch-toolbar"><p role="status"><strong id="consultBatchCount">'+hpeConsultPendingExercises.size+'</strong> exercício(s) selecionado(s)</p><div><button type="button" class="primary" onclick="hpeConsultBuilderReviewBatch()" '+(hpeConsultPendingExercises.size?'':'disabled')+'>Configurar e adicionar selecionados</button><button type="button" onclick="hpeConsultBuilderClearPending()" '+(hpeConsultPendingExercises.size?'':'disabled')+'>Limpar seleção</button></div><small>Marque vários exercícios, inclusive de outros grupos, e configure todos juntos antes de adicionar.</small></div></section>';
}
window.hpeConsultBuilderFilter=value=>{
 hpeConsultBuilderQuery=String(value||'');
 const query=hpeConsultBuilderNormalize(hpeConsultBuilderQuery);
 let visible=0;
 document.querySelectorAll('[data-consult-exercise-row]').forEach(row=>{const text=hpeConsultBuilderNormalize(row.textContent);row.hidden=!text.includes(query);if(!row.hidden)visible++});
 const message=document.getElementById('consultBuilderSearchResult');if(message)message.textContent=visible?visible+' exercício(s) encontrados':'Nenhum exercício encontrado. Tente outro nome.';
};
window.hpeConsultBuilderToggleExercise=(muscle,index,selected)=>{
 const name=muscleLibrary[muscle]?.exercises[index];if(!name)return;
 const key=hpeConsultBuilderKey(muscle,index);
 if(selected)hpeConsultPendingExercises.set(key,{name,muscle,sets:3,reps:'12',weight:0,rest:60,notes:'',gif:'',video:''});
 else hpeConsultPendingExercises.delete(key);
 document.querySelectorAll('[data-consult-select-exercise]').forEach(button=>{const buttonKey=hpeConsultBuilderKey(button.dataset.muscle,Number(button.dataset.index)),isSelected=hpeConsultPendingExercises.has(buttonKey);button.classList.toggle('selected',isSelected);button.setAttribute('aria-pressed',String(isSelected));button.textContent=isSelected?'✓ Selecionado':'+ Selecionar'});
 const count=document.getElementById('consultBatchCount');if(count)count.textContent=String(hpeConsultPendingExercises.size);
 document.querySelectorAll('.consult-batch-toolbar button').forEach(button=>button.disabled=!hpeConsultPendingExercises.size);
};
window.hpeConsultBuilderFlipExercise=(muscle,index)=>hpeConsultBuilderToggleExercise(muscle,index,!hpeConsultPendingExercises.has(hpeConsultBuilderKey(muscle,index)));
window.hpeConsultBuilderClearPending=()=>{hpeConsultPendingExercises.clear();render()};
window.hpeConsultBuilderReviewBatch=()=>{
 if(!hpeConsultPendingExercises.size||hpeProfile?.role!=='personal')return;
 const workoutId=hpeConsultBuilderWorkoutId,items=[...hpeConsultPendingExercises.values()].map(item=>({...item}));
 modal('<h2>Revisar '+items.length+' exercícios</h2><p>Para '+esc(hpeConsultRecord()?.name||'aluno')+' · '+esc(hpeConsultWorkout(workoutId)?.day||'Treino')+'. Ajuste a prescrição de cada exercício antes de salvar.</p><form id="consultBatchForm">'+items.map((item,index)=>'<fieldset class="consult-batch-item"><legend>'+String(index+1)+'. '+esc(item.name)+'</legend>'+((typeof hpeMotionSquare==='function')?hpeMotionSquare(item):'')+'<div class="inline"><label>Séries<input data-item="'+index+'" name="sets" type="number" min="1" max="20" value="3" required></label><label>Repetições / tempo<input data-item="'+index+'" name="reps" value="12" maxlength="150" required></label><label>Carga (kg)<input data-item="'+index+'" name="weight" type="number" min="0" max="1000" step="0.5" value="0" required></label><label>Descanso (s)<input data-item="'+index+'" name="rest" type="number" min="0" max="600" value="60" required></label></div><label>Orientação e método<textarea data-item="'+index+'" name="notes" maxlength="2000"></textarea></label></fieldset>').join('')+'<p id="consultBatchError" role="alert"></p><div class="consult-shortcuts"><button type="button" onclick="document.getElementById(this.dataset.dialog).close()" data-dialog="modal">Continuar selecionando</button><button class="primary">Adicionar '+items.length+' exercícios ao treino</button></div></form>');
 const form=document.getElementById('consultBatchForm'),capture=()=>form.querySelectorAll('[data-item]').forEach(input=>{const item=items[Number(input.dataset.item)];item[input.name]=['sets','weight','rest'].includes(input.name)?Number(input.value):input.value});
 form.addEventListener('input',capture);
 form.onsubmit=async event=>{
  event.preventDefault();capture();
  const error=document.getElementById('consultBatchError'),button=form.querySelector('button.primary');
  if(!items.every(item=>Number.isInteger(item.sets)&&item.sets>=1&&item.sets<=20&&String(item.reps||'').trim()&&item.reps.length<=150&&Number.isFinite(item.weight)&&item.weight>=0&&item.weight<=1000&&Number.isInteger(item.rest)&&item.rest>=0&&item.rest<=600&&item.notes.length<=2000)){error.textContent='Confira séries, repetições, carga e descanso de todos os exercícios.';return}
  const workout=hpeConsultWorkout(workoutId);if(!workout){error.textContent='Este treino não está mais disponível.';return}
  button.disabled=true;workout.exercises=workout.exercises||[];
  workout.exercises.push(...items.map(item=>({...item,id:crypto.randomUUID(),reps:String(item.reps).trim()})));
  try{await hpeConsultSaveProgram(hpeConsultProgram());hpeConsultPendingExercises.clear();hpeConsultBuilderTab='lista';$('#modal').close();render();toast(items.length+' exercícios adicionados à ficha da consultoria.')}catch(saveError){button.disabled=false;error.textContent=saveError?.message||'Não foi possível salvar os exercícios.'}
 };
};
function hpeConsultBuilderPlanHtml(workout){
 const exercises=workout.exercises||[];
 return '<section class="card consult-builder-plan"><div class="row"><div><span class="eyebrow">TREINO DO ALUNO</span><h2>Treino '+hpeConsultWorkoutDivision(workout,hpeConsultProgram().workouts.indexOf(workout))+' · '+esc(workout.title||'Treino')+'</h2><p>'+exercises.length+' exercício(s) nesta divisão. Tudo fica salvo apenas na consultoria deste aluno.</p></div><button class="primary" data-tab="exercicios" onclick="hpeConsultBuilderSetTab(this.dataset.tab)">+ Adicionar exercícios</button></div>'+(exercises.length?'<div class="consult-exercise-list">'+exercises.map((item,index)=>'<div class="consult-exercise-item"><span class="num">'+String(index+1).padStart(2,'0')+'</span><div class="consult-exercise-info">'+hpeConsultExerciseMotion(item)+'<div class="consult-exercise-copy"><b>'+esc(item.name)+'</b><p>'+esc(item.sets||'—')+' séries × '+esc(item.reps||'—')+' · '+esc(hpeConsultExerciseLoadText(item))+' · descanso '+esc(item.rest??'—')+'s</p>'+(item.notes?'<small>'+esc(item.notes)+'</small>':'')+'</div></div><button data-workout-id="'+workout.id+'" data-exercise-id="'+item.id+'" onclick="hpeConsultEditExercise(this.dataset.workoutId,this.dataset.exerciseId)">Editar</button><button class="danger" data-workout-id="'+workout.id+'" data-exercise-id="'+item.id+'" onclick="hpeConsultRemoveExercise(this.dataset.workoutId,this.dataset.exerciseId)">Remover</button></div>').join('')+'</div>':'<div class="consult-empty"><h3>Esta divisão ainda não tem exercícios</h3><p>Escolha um grupo muscular ou cadastre um exercício personalizado.</p><button class="primary" data-tab="mapa" onclick="hpeConsultBuilderSetTab(this.dataset.tab)">Abrir mapa muscular</button></div>')+'</section>';
}
function hpeConsultBuilderHtml(workout){
 const tabs=[['mapa','Mapa muscular'],['exercicios','Exercícios'],['lista','Treino do aluno']];
 const division=hpeConsultWorkoutDivision(workout,hpeConsultProgram().workouts.indexOf(workout));
 const content=hpeConsultBuilderTab==='mapa'?hpeConsultBuilderMapHtml():hpeConsultBuilderTab==='exercicios'?hpeConsultBuilderExercisesHtml():hpeConsultBuilderPlanHtml(workout);
 return hpeConsultWorkspaceHeader(false)+'<section class="card consult-panel"><div class="row"><div><span class="eyebrow">CONSTRUTOR DE TREINO · TREINO '+division+'</span><h2>'+esc(workout.title||'Treino')+'</h2><p>Use as mesmas etapas do treino do app: escolha músculos, selecione exercícios e ajuste cada prescrição.</p></div><span class="tag">'+(workout.exercises||[]).length+' EXERCÍCIOS</span></div><div class="training-tabs" role="tablist" aria-label="Etapas da criação do treino">'+tabs.map(([key,label])=>'<button id="consult-training-tab-'+key+'" role="tab" aria-controls="consult-training-pane" aria-selected="'+(hpeConsultBuilderTab===key)+'" class="'+(hpeConsultBuilderTab===key?'primary':'')+'" data-tab="'+key+'" onclick="hpeConsultBuilderSetTab(this.dataset.tab)">'+label+(key==='lista'?' <span class="tab-count">'+(workout.exercises||[]).length+'</span>':'')+'</button>').join('')+'</div><section id="consult-training-pane" class="pane-'+hpeConsultBuilderTab+'" role="tabpanel" aria-labelledby="consult-training-tab-'+hpeConsultBuilderTab+'">'+content+'</section></section>';
}
window.hpeConsultOpenWorkoutBuilder=(id,tab='mapa')=>{
 if(hpeProfile?.role!=='personal'||!hpeConsultWorkout(id))return;
 const workout=hpeConsultWorkout(id);hpeConsultActiveDivision=hpeConsultWorkoutDivision(workout,hpeConsultProgram().workouts.indexOf(workout));
 hpeConsultBuilderWorkoutId=String(id);hpeConsultBuilderTab=['mapa','exercicios','lista'].includes(tab)?tab:'mapa';hpeConsultPendingExercises.clear();hpeConsultBuilderQuery='';hpeConsultBuilderPortion='';render();
};
window.hpeConsultCloseWorkoutBuilder=()=>{const workout=hpeConsultWorkout(hpeConsultBuilderWorkoutId);if(workout)hpeConsultActiveDivision=hpeConsultWorkoutDivision(workout,hpeConsultProgram().workouts.indexOf(workout));hpeConsultBuilderWorkoutId=null;hpeConsultBuilderTab='mapa';hpeConsultPendingExercises.clear();render()};
function hpeConsultExerciseLoadText(exercise){
 if(exercise?.weight!==undefined&&exercise?.weight!==null&&Number.isFinite(Number(exercise.weight)))return Number(exercise.weight).toFixed(Number(exercise.weight)%1?1:0).replace('.',',')+' kg';
 return String(exercise?.load||'Sem carga definida');
}
function hpeConsultExerciseMotion(exercise){return typeof hpeMotionSquare==='function'?hpeMotionSquare(exercise):'<div class="hpe-motion unavailable"><span>Demonstração indisponível</span></div>'}
function hpeConsultWorkoutCardCoach(workout,workoutIndex=0){
 const exercises=workout.exercises||[];
 return '<article class="consult-workout-card"><div class="row"><div><span class="eyebrow">TREINO '+hpeConsultWorkoutDivision(workout,workoutIndex)+'</span><h3>'+esc(workout.title||'Treino')+'</h3></div><span class="tag">'+exercises.length+' EXERCÍCIOS</span></div>'+
 (exercises.length?'<div class="consult-exercise-list">'+exercises.map((x,i)=>'<div class="consult-exercise-item"><span class="num">'+String(i+1).padStart(2,'0')+'</span><div class="consult-exercise-info">'+hpeConsultExerciseMotion(x)+'<div class="consult-exercise-copy"><b>'+esc(x.name)+'</b><p>'+esc(x.sets||'—')+' séries × '+esc(x.reps||'—')+' · '+esc(hpeConsultExerciseLoadText(x))+' · descanso '+esc(x.rest??'—')+'s</p>'+(x.notes?'<small>'+esc(x.notes)+'</small>':'')+'</div></div><button data-workout-id="'+workout.id+'" data-exercise-id="'+x.id+'" onclick="hpeConsultEditExercise(this.dataset.workoutId,this.dataset.exerciseId)">Editar</button><button class="danger" data-workout-id="'+workout.id+'" data-exercise-id="'+x.id+'" onclick="hpeConsultRemoveExercise(this.dataset.workoutId,this.dataset.exerciseId)">Remover</button></div>').join('')+'</div>':'<div class="consult-empty">Adicione exercícios a este treino.</div>')+
 '<div class="consult-shortcuts"><button class="primary" data-workout-id="'+workout.id+'" onclick="hpeConsultOpenWorkoutBuilder(this.dataset.workoutId)">Montar ficha no construtor</button><button data-workout-id="'+workout.id+'" onclick="hpeConsultEditWorkout(this.dataset.workoutId)">Editar nome</button><button class="danger" data-workout-id="'+workout.id+'" onclick="hpeConsultConfirmRemoveWorkout(this.dataset.workoutId)">Remover treino</button></div></article>';
}
function hpeConsultWorkoutCardStudent(workout,workoutIndex=0){
 const exercises=workout.exercises||[],completed=hpeConsultState.sessions.some(s=>s.workout_id===String(workout.id)&&s.session_date===hpeConsultToday()),active=hpeConsultRunner?.workoutId===String(workout.id),otherActive=!!hpeConsultRunner&& !active;
 return '<article class="consult-workout-card"><div class="row"><div><span class="eyebrow">TREINO '+hpeConsultWorkoutDivision(workout,workoutIndex)+'</span><h3>'+esc(workout.title||'Treino')+'</h3></div><span class="tag">'+(completed?'CONCLUÍDO HOJE':active?'EM ANDAMENTO':exercises.length+' EXERCÍCIOS')+'</span></div>'+
 (exercises.length?'<div class="consult-exercise-list">'+exercises.map((x,i)=>'<div class="consult-exercise-item"><span class="num">'+String(i+1).padStart(2,'0')+'</span><div class="consult-exercise-info">'+hpeConsultExerciseMotion(x)+'<div class="consult-exercise-copy"><b>'+esc(x.name)+'</b><p>'+esc(x.sets||'—')+' séries × '+esc(x.reps||'—')+' · '+esc(hpeConsultExerciseLoadText(x))+' · descanso '+esc(x.rest??'—')+'s</p>'+(x.notes?'<small>'+esc(x.notes)+'</small>':'')+'</div></div></div>').join('')+'</div>':'<div class="consult-empty">O personal ainda não adicionou exercícios neste treino.</div>')+
 (completed?'<p class="consult-status done">✓ Você registrou este treino hoje.</p>':exercises.length?'<button class="primary" onclick="'+(active?'hpeConsultResumeWorkout':'hpeConsultStartWorkout')+'(\''+workout.id+'\')" '+(otherActive?'disabled':'')+'>'+(active?'Continuar treino':'Iniciar treino')+'</button>':'')+'</article>';
}
function hpeConsultDivisionNavHtml(program,studentMode){
 const workouts=program.workouts||[],letters=hpeConsultDivisionLetters(program),exists=workouts.some((workout,index)=>hpeConsultWorkoutDivision(workout,index)===hpeConsultActiveDivision);
 return '<nav class="consult-division-nav" aria-label="Divisões da ficha"><div class="program-tabs" role="tablist" aria-label="Treinos A a E">'+letters.map(letter=>'<button role="tab" aria-selected="'+(hpeConsultActiveDivision===letter)+'" class="'+(hpeConsultActiveDivision===letter?'primary':'')+'" data-division="'+letter+'" onclick="hpeConsultSelectDivision(this.dataset.division)">Treino '+letter+'</button>').join('')+'</div>'+(studentMode||exists?'':'<div class="consult-division-actions"><button class="primary" onclick="hpeConsultAddWorkout(\''+hpeConsultActiveDivision+'\')">+ Montar treino '+hpeConsultActiveDivision+'</button></div>')+'</nav>';
}
window.hpeConsultSelectDivision=division=>{const letter=String(division||'').toUpperCase();if(!/^[A-Z]$/.test(letter))return;hpeConsultActiveDivision=letter;hpeConsultBuilderWorkoutId=null;hpeConsultPendingExercises.clear();render()};
function hpeConsultRunnerEntries(index){return (hpeConsultRunner?.seriesEntries||[]).filter(entry=>entry.index===index)}
function hpeConsultRunnerSetCount(exercise){return Math.max(1,Math.min(20,Math.floor(Number(exercise?.sets)||1)))}
function hpeConsultRunnerIsDone(index,workout){const exercise=workout.exercises?.[index];return !!exercise&&hpeConsultRunnerEntries(index).length>=hpeConsultRunnerSetCount(exercise)}
function hpeConsultRunnerAllDone(workout){return !!(workout.exercises?.length)&&workout.exercises.every((exercise,index)=>hpeConsultRunnerEntries(index).length>=hpeConsultRunnerSetCount(exercise))}
function hpeConsultRunnerUnit(exercise){return /min|seg|["'’]/i.test(String(exercise?.reps||''))?'s':'reps'}
function hpeConsultRunnerTarget(exercise,number){const text=String(exercise?.reps||'').replace(/^de\s*/i,'');const parts=text.split('/'),part=parts[number-1]||parts.at(-1)||text,n=part.match(/\d+/)?.[0];return n?Number(n)*(hpeConsultRunnerUnit(exercise)==='s'&&/min/i.test(text)?60:1):''}
function hpeConsultRunnerClock(seconds){const n=Math.max(0,Math.floor(seconds)),hours=Math.floor(n/3600),minutes=Math.floor(n%3600/60),remaining=n%60;return hours?[hours,minutes,remaining].map(value=>String(value).padStart(2,'0')).join(':'):[minutes,remaining].map(value=>String(value).padStart(2,'0')).join(':')}
function hpeConsultEnsureRunnerTimer(){if(hpeConsultRunnerTimer||!hpeConsultRunner)return;hpeConsultRunnerTimer=setInterval(()=>{if(!hpeConsultRunner){clearInterval(hpeConsultRunnerTimer);hpeConsultRunnerTimer=null;return}const elapsed=document.querySelector('[data-consult-runner-duration]');if(elapsed)elapsed.textContent=hpeConsultRunnerClock((Date.now()-hpeConsultRunner.startedAt)/1000);if(!hpeConsultRunner.restUntil)return;const remaining=Math.max(0,Math.ceil((hpeConsultRunner.restUntil-Date.now())/1000));document.querySelectorAll('[data-consult-rest-countdown]').forEach(node=>node.textContent=remaining+'s');if(remaining===0){const workout=hpeConsultWorkout(hpeConsultRunner.workoutId),index=hpeConsultRunner.activeExercise;hpeConsultRunner.restUntil=0;if(workout&&hpeConsultRunnerIsDone(index,workout)&&index<workout.exercises.length-1)hpeConsultRunner.activeExercise=index+1;render()}},1000)}
function hpeConsultRunnerHtml(workout){
 const exercises=workout.exercises||[],activeIndex=Math.max(0,Math.min(hpeConsultRunner.activeExercise||0,exercises.length-1)),exercise=exercises[activeIndex],entries=hpeConsultRunnerEntries(activeIndex),number=entries.length+1,doneCount=exercises.filter((_,index)=>hpeConsultRunnerIsDone(index,workout)).length,allDone=hpeConsultRunnerAllDone(workout),remaining=hpeConsultRunner.restUntil?Math.max(0,Math.ceil((hpeConsultRunner.restUntil-Date.now())/1000)):0;
 hpeConsultEnsureRunnerTimer();
 const header='<div class="consult-runner-header"><div><span class="eyebrow">SESSÃO DE TREINO · '+esc(workout.day||'TREINO')+'</span><h2>'+esc(workout.title||'Treino')+'</h2><p>'+doneCount+' de '+exercises.length+' exercícios concluídos</p></div><strong data-consult-runner-duration>'+hpeConsultRunnerClock((Date.now()-hpeConsultRunner.startedAt)/1000)+'</strong></div><div class="consult-runner-progress"><span style="width:'+Math.round(doneCount/Math.max(exercises.length,1)*100)+'%"></span></div><button class="consult-runner-back" onclick="hpeConsultCloseRunner()">‹ Voltar à ficha</button>';
 if(allDone)return '<section class="card consult-runner">'+header+'<div class="session-success"><span class="goal-icon">✓</span><h2>Você concluiu todas as séries!</h2><p>Finalize para salvar suas cargas, repetições e duração no histórico da consultoria.</p><button class="primary" onclick="hpeConsultOpenRunnerFinish()">✓ Finalizar treino</button></div></section>';
 if(remaining)return '<section class="card consult-runner">'+header+'<div class="consult-rest-panel"><span class="eyebrow">DESCANSO</span><h2>Recupere para a próxima série</h2><strong data-consult-rest-countdown>'+remaining+'s</strong><p>O treino continua automaticamente quando o descanso terminar.</p><button onclick="hpeConsultSkipRest()">Pular descanso</button></div></section>';
 if(!exercise)return '<section class="card consult-runner">'+header+'<div class="consult-empty">Este treino ainda não tem exercícios.</div></section>';
 const parsedWeight=Number(exercise.weight),defaultWeight=Number.isFinite(parsedWeight)?parsedWeight:(Number.parseFloat(String(exercise.load||'').replace(',','.'))||0),unit=hpeConsultRunnerUnit(exercise),rest=Math.max(0,Math.min(600,Number(exercise.rest)||0));
 return '<section class="card consult-runner">'+header+'<section class="consult-runner-exercise"><span class="tag">EXERCÍCIO '+(activeIndex+1)+' DE '+exercises.length+'</span><h2>'+esc(exercise.name)+'</h2><p>'+hpeConsultRunnerSetCount(exercise)+' séries · '+esc(exercise.reps||'—')+' previstas · '+rest+'s de descanso</p>'+(exercise.notes?'<p class="consult-runner-notes">'+esc(exercise.notes)+'</p>':'')+'<div class="consult-runner-motion">'+hpeConsultExerciseMotion(exercise)+'</div><div class="series-checks">'+Array.from({length:hpeConsultRunnerSetCount(exercise)},(_,index)=>'<span class="'+(index<entries.length?'recorded':'')+'">'+(index<entries.length?'✓':index+1)+'</span>').join('')+'</div><form class="consult-runner-form" onsubmit="hpeConsultRecordSeries(event)"><h3>Série '+number+' de '+hpeConsultRunnerSetCount(exercise)+'</h3><p class="note">Registre cada série para acompanhar as cargas e repetições realizadas.</p><div class="inline"><label>Carga realizada (kg)<input name="weight" type="number" min="0" max="1000" step="0.5" value="'+(entries.at(-1)?.weight??defaultWeight)+'" required></label><label>'+(unit==='s'?'Tempo realizado (segundos)':'Repetições realizadas')+'<input name="reps" type="number" min="1" max="'+(unit==='s'?7200:100)+'" value="'+hpeConsultRunnerTarget(exercise,number)+'" required></label></div><button class="primary">✓ Série concluída</button></form><h3>Séries registradas</h3>'+(entries.length?entries.map(entry=>'<div class="listrow"><span class="tag">SÉRIE '+entry.set+'</span><b>'+entry.reps+' '+(entry.unit==='s'?'seg':'reps')+' × '+entry.weight+' kg</b></div>').join(''):'<p class="note">Nenhuma série registrada ainda.</p>')+'</section></section>';
}
window.hpeConsultStartWorkout=id=>{if(hpeProfile?.role!=='aluno')return;const workout=hpeConsultWorkout(id);if(!workout?.exercises?.length)return;if(hpeConsultState.sessions.some(session=>session.workout_id===String(id)&&session.session_date===hpeConsultToday())){toast('Este treino já foi registrado hoje.');return}if(hpeConsultRunner&&hpeConsultRunner.workoutId!==String(id)){toast('Continue ou finalize o treino que já está em andamento.');return}hpeConsultRunner=hpeConsultRunner||{workoutId:String(id),startedAt:Date.now(),activeExercise:0,seriesEntries:[],restUntil:0};hpeConsultRunner.view=true;hpeConsultEnsureRunnerTimer();render()};
window.hpeConsultResumeWorkout=id=>{if(hpeProfile?.role!=='aluno'||hpeConsultRunner?.workoutId!==String(id))return;hpeConsultRunner.view=true;hpeConsultEnsureRunnerTimer();render()};
window.hpeConsultCloseRunner=()=>{if(!hpeConsultRunner)return;hpeConsultRunner.view=false;render()};
window.hpeConsultSkipRest=()=>{if(!hpeConsultRunner)return;const workout=hpeConsultWorkout(hpeConsultRunner.workoutId),index=hpeConsultRunner.activeExercise;hpeConsultRunner.restUntil=0;if(workout&&hpeConsultRunnerIsDone(index,workout)&&index<workout.exercises.length-1)hpeConsultRunner.activeExercise=index+1;render()};
window.hpeConsultRecordSeries=event=>{event.preventDefault();if(hpeProfile?.role!=='aluno'||!hpeConsultRunner||hpeConsultRunner.restUntil>Date.now())return;const workout=hpeConsultWorkout(hpeConsultRunner.workoutId),index=hpeConsultRunner.activeExercise,exercise=workout?.exercises?.[index];if(!exercise)return;const form=new FormData(event.currentTarget),weight=Number(form.get('weight')),reps=Number(form.get('reps')),unit=hpeConsultRunnerUnit(exercise);if(!Number.isFinite(weight)||weight<0||weight>1000||!Number.isInteger(reps)||reps<1||reps>(unit==='s'?7200:100)){toast('Confira a carga e as repetições desta série.');return}const entries=hpeConsultRunnerEntries(index);hpeConsultRunner.seriesEntries.push({index,name:exercise.name,set:entries.length+1,weight,reps,unit});const allDone=hpeConsultRunnerAllDone(workout),rest=Math.max(0,Math.min(600,Number(exercise.rest)||0));if(!allDone&&rest>0)hpeConsultRunner.restUntil=Date.now()+rest*1000;else if(hpeConsultRunnerIsDone(index,workout)&&index<workout.exercises.length-1)hpeConsultRunner.activeExercise=index+1;hpeConsultEnsureRunnerTimer();render()};
window.hpeConsultOpenRunnerFinish=()=>{if(hpeProfile?.role!=='aluno'||!hpeConsultRunner)return;const workout=hpeConsultWorkout(hpeConsultRunner.workoutId);if(!workout||!hpeConsultRunnerAllDone(workout))return;const duration=Math.max(1,Math.round((Date.now()-hpeConsultRunner.startedAt)/60000));modal('<h2>Finalizar treino</h2><p>'+esc(workout.title||'Treino')+' · '+workout.exercises.length+' exercícios</p><form id="hpeConsultSessionForm"><label>Duração do treino (minutos)<input name="duration" type="number" min="1" max="300" value="'+duration+'" required></label><label>Esforço percebido<select name="effort"><option value="">Não informar</option>'+Array.from({length:10},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+(i===0?' · leve':i===9?' · muito intenso':'')+'</option>').join('')+'</select></label><label>Comentário opcional<textarea name="feedback" rows="3" maxlength="1000"></textarea></label><button class="primary">Salvar treino e séries</button></form>');$('#hpeConsultSessionForm').onsubmit=event=>hpeConsultSaveSession(event,workout.id)};
function hpeConsultWorkoutHtml(studentMode){
 const program=hpeConsultProgram(),workouts=program.workouts||[],count=workouts.reduce((sum,w)=>sum+(w.exercises||[]).length,0);
 if(!studentMode&&hpeConsultBuilderWorkoutId){const workout=hpeConsultWorkout(hpeConsultBuilderWorkoutId);if(workout)return hpeConsultBuilderHtml(workout);hpeConsultBuilderWorkoutId=null;hpeConsultPendingExercises.clear()}
 if(studentMode&&hpeConsultRunner?.view){const workout=hpeConsultWorkout(hpeConsultRunner.workoutId);if(workout)return hpeConsultWorkspaceHeader(true)+hpeConsultRunnerHtml(workout);hpeConsultRunner=null}
 const divisionWorkouts=workouts.map((workout,index)=>({workout,index})).filter(item=>hpeConsultWorkoutDivision(item.workout,item.index)===hpeConsultActiveDivision);
 const divisionContent=divisionWorkouts.length?'<div class="consult-workouts consult-division-workouts">'+divisionWorkouts.map(({workout,index})=>studentMode?hpeConsultWorkoutCardStudent(workout,index):hpeConsultWorkoutCardCoach(workout,index)).join('')+'</div>':'<div class="consult-empty"><h3>'+(studentMode?'Treino '+hpeConsultActiveDivision+' ainda não foi disponibilizado':'Treino '+hpeConsultActiveDivision+' ainda não foi montado')+'</h3><p>'+(studentMode?'Seu personal avisará quando publicar esta divisão.':'Use “Montar treino '+hpeConsultActiveDivision+'” para preencher esta divisão ou “Nova divisão” para criar outra.')+'</p></div>';
 return hpeConsultWorkspaceHeader(studentMode)+'<section class="card consult-panel"><div class="row"><div><span class="eyebrow">'+(studentMode?'SEU PLANO':'MONTAGEM DA FICHA')+'</span><h2>'+esc(program.title||'Ficha personalizada')+'</h2><p>'+(studentMode?'Plano montado pelo seu personal. Use a ficha como orientação do acompanhamento.':'Esta ficha pertence somente à consultoria online deste aluno.')+'</p></div>'+(studentMode?'<button class="primary" onclick="hpeConsultDownloadWorkoutPdf()">Baixar ficha em PDF</button>':'<button class="primary" onclick="hpeConsultAddWorkout()">+ Nova divisão</button>')+'</div>'+
 (studentMode?'<p class="note">Divisões montadas: '+workouts.length+' · Exercícios: '+count+'</p>':'<label class="consult-program-title">Nome da ficha<input id="hpeConsultProgramTitle" value="'+esc(program.title||'Ficha personalizada')+'" maxlength="100" onchange="hpeConsultRenameProgram(this.value)"></label>')+
 hpeConsultDivisionNavHtml(program,studentMode)+divisionContent+'</section>';
}
function hpeConsultPeriodStart(period,key=hpeConsultToday()){return period==='month'?key.slice(0,7)+'-01':hpeConsultWeekStart(key)}
function hpeConsultWeightSeries(records,period){
 const now=hpeConsultToday(),count=period==='month'?6:8,result=[];
 for(let i=count-1;i>=0;i--){
  let start;
  if(period==='month'){const d=new Date(now.slice(0,7)+'-01T12:00:00');d.setMonth(d.getMonth()-i);start=d.toISOString().slice(0,7)+'-01'}
  else start=hpeConsultShiftDate(hpeConsultWeekStart(now),-7*i);
  const end=period==='month'?start.slice(0,7)+'-31':hpeConsultShiftDate(start,6);
  const group=records.filter(x=>x.measurement_date>=start&&x.measurement_date<=end);
  const last=group[group.length-1];
  result.push({key:start,label:period==='month'?start.slice(5,7)+'/'+start.slice(0,4).slice(2):start.slice(5),weight:last?Number(last.weight_kg):null});
 }
 return result;
}
function hpeConsultWeightChart(records,period){
 const series=hpeConsultWeightSeries(records,period),values=series.map(x=>x.weight).filter(Number.isFinite);
 if(!values.length)return '<div class="consult-empty">Registre o peso para montar seu histórico semanal e mensal.</div>';
 const min=Math.min(...values),max=Math.max(...values),range=Math.max(1,max-min);
 return '<div class="consult-weight-chart '+(period==='month'?'monthly':'weekly')+'">'+series.map(x=>'<div class="consult-weight-column"><div class="consult-weight-value">'+(x.weight===null?'—':x.weight.toFixed(1).replace('.',',')+' kg')+'</div><div class="consult-weight-track"><span style="height:'+(x.weight===null?3:Math.round(20+(x.weight-min)/range*70))+'%"></span></div><small>'+esc(x.label)+'</small></div>').join('')+'</div>';
}
function hpeConsultMeasurementHistory(records){
 if(!records.length)return'<div class="consult-empty">Nenhum peso registrado ainda.</div>';
 return '<div class="consult-table-wrap"><table class="consult-table"><thead><tr><th>Data</th><th>Peso</th><th>Observação</th></tr></thead><tbody>'+records.map(x=>'<tr><td>'+hpeConsultDate(x.measurement_date)+'</td><td><b>'+Number(x.weight_kg).toFixed(1).replace('.',',')+' kg</b></td><td>'+esc(x.note||'—')+'</td></tr>').join('')+'</tbody></table></div>';
}
function hpeConsultPhotoUploadForm(place){
 const consent=!!hpeConsultState.intake?.photos_consent_at;
 if(place==='progress'&&role==='aluno'){
  if(!consent)return'<div class="consult-empty"><b>Envio de fotos desativado.</b><p>Se quiser enviar fotos, autorize o compartilhamento no questionário primeiro.</p><button onclick="hpeConsultSetSection(\'questionnaire\')">Abrir questionário</button></div>';
  return '<form class="consult-photo-form" onsubmit="hpeConsultPhotoSubmit(event)"><label>Ângulo<select name="angle" required>'+hpeConsultAngles.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select></label><label>Foto de evolução<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required></label><label>Comentário opcional<textarea name="caption" rows="2" maxlength="300" placeholder="Ex.: registro do início do mês"></textarea></label><button class="primary">Enviar foto ao personal e ao chat</button><p class="note">A foto será privada e ficará visível somente para você e seu personal.</p></form>';
 }
 if(place==='chat'&&role==='aluno'&&consent)return '<div class="consult-chat-photo"><label>Anexar foto<input type="file" name="chatPhoto" accept="image/jpeg,image/png,image/webp"></label><label>Ângulo<select name="chatAngle">'+hpeConsultAngles.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select></label></div>';
 return'';
}
function hpeConsultPhotosHtml(studentMode){
 const photos=hpeConsultState.photos,latestByAngle={};
 for(const [key] of hpeConsultAngles)latestByAngle[key]=photos.find(p=>p.angle===key)||null;
 return hpeConsultWorkspaceHeader(studentMode)+'<section class="card consult-panel"><div class="row"><div><span class="eyebrow">EVOLUÇÃO FOTOGRÁFICA</span><h2>Frente, lados e costas</h2></div><span class="tag">'+photos.length+' FOTOS</span></div>'+
 (studentMode?hpeConsultPhotoUploadForm('progress'):'<p>Fotos enviadas pelo aluno. Os arquivos ficam em armazenamento privado e não aparecem nas outras áreas do app.</p>')+
 '<div class="consult-photo-angles">'+hpeConsultAngles.map(([key,label])=>{const p=latestByAngle[key],url=p?hpeConsultState.signedUrls[p.id]:'';return'<article class="consult-photo-angle"><span class="eyebrow">'+label.toUpperCase()+'</span>'+(p&&url?'<img src="'+esc(url)+'" alt="Foto de evolução: '+label+'" loading="lazy"><small>'+hpeConsultDate(p.created_at)+'</small>':'<div class="consult-photo-placeholder">Nenhuma foto enviada</div>')+'</article>'}).join('')+'</div>'+
 (photos.length?'<h3>Histórico de fotos</h3><div class="consult-photo-gallery">'+photos.map(p=>'<article class="consult-photo-card">'+(hpeConsultState.signedUrls[p.id]?'<img src="'+esc(hpeConsultState.signedUrls[p.id])+'" alt="Foto '+esc(hpeConsultAngleLabel(p.angle))+'" loading="lazy">':'<div class="consult-photo-placeholder">Foto não disponível</div>')+'<div><b>'+esc(hpeConsultAngleLabel(p.angle))+'</b><small>'+hpeConsultDateTime(p.created_at)+'</small>'+(p.caption?'<p>'+esc(p.caption)+'</p>':'')+(studentMode?'':'<button class="danger" onclick="hpeConsultDeletePhoto(\''+p.id+'\')">Remover foto</button>')+'</div></article>').join('')+'</div>':'')+'</section>';
}
function hpeConsultCheckinsHtml(studentMode){
 const current=hpeConsultWeekCheckin(),history=hpeConsultState.checkins;
 if(studentMode)return hpeConsultWorkspaceHeader(true)+'<section class="card consult-panel"><div class="row"><div><span class="eyebrow">ACOMPANHAMENTO SEMANAL</span><h2>Check-in da semana de '+hpeConsultDate(hpeConsultWeekStart())+'</h2></div><span class="tag">'+(current?'ENVIADO':'PENDENTE')+'</span></div><p>Conte como estão energia, sono, recuperação e qualquer desconforto no treino.</p><form class="consult-form" onsubmit="hpeConsultSaveCheckin(event)">'+
 '<label>Nível de energia<select name="energy" required><option value="">Selecione</option>'+['Muito baixa','Baixa','Regular','Boa','Muito boa'].map((x,i)=>'<option value="'+(i+1)+'" '+(Number(current?.energy)===i+1?'selected':'')+'>'+(i+1)+' · '+x+'</option>').join('')+'</select></label>'+
 '<label>Como está seu sono e sua recuperação?<select name="recovery" required><option value="">Selecione</option>'+['Muito ruim','Ruim','Regular','Boa','Muito boa'].map((x,i)=>'<option value="'+(i+1)+'" '+(Number(current?.recovery)===i+1?'selected':'')+'>'+(i+1)+' · '+x+'</option>').join('')+'</select></label>'+
 '<label>Sentiu dor ou desconforto em algum exercício?<textarea name="discomfort" rows="3" maxlength="500">'+esc(current?.discomfort||'')+'</textarea></label><label>Comentário ou pedido de ajuste<textarea name="notes" rows="3" maxlength="700">'+esc(current?.notes||'')+'</textarea></label><button class="primary">'+(current?'Atualizar check-in':'Enviar check-in da semana')+'</button></form>'+
 hpeConsultCheckinHistory(history)+'</section>';
 return hpeConsultWorkspaceHeader(false)+'<section class="card consult-panel"><div class="row"><div><span class="eyebrow">CHECK-INS</span><h2>Histórico do aluno</h2></div><span class="tag">'+history.length+' REGISTROS</span></div>'+(history.length?hpeConsultCheckinHistory(history):'<div class="consult-empty">Aguardando o primeiro check-in semanal.</div>')+'</section>';
}
function hpeConsultCheckinHistory(history){
 return history.length?'<div class="consult-checkin-history">'+history.map(x=>'<article class="consult-history-item"><div><b>Semana de '+hpeConsultDate(x.week_start)+'</b><p>Energia '+x.energy+'/5 · Recuperação '+x.recovery+'/5</p>'+(x.discomfort?'<p><b>Desconforto:</b> '+esc(x.discomfort)+'</p>':'')+(x.notes?'<p>'+esc(x.notes)+'</p>':'')+'</div><span class="tag">'+hpeConsultDate(x.created_at)+'</span></article>').join('')+'</div>':'';
}
function hpeConsultProgressHtml(studentMode){
 const records=hpeConsultState.measurements.slice().sort((a,b)=>String(b.measurement_date).localeCompare(String(a.measurement_date))),last=hpeConsultLatestWeight(),delta=hpeConsultDelta(records,hpeConsultPeriod);
 return hpeConsultWorkspaceHeader(studentMode)+'<section class="card consult-panel"><div class="row"><div><span class="eyebrow">PESO E EVOLUÇÃO</span><h2>Acompanhe sua evolução</h2></div><div class="consult-period-switch" role="group" aria-label="Período do gráfico"><button class="'+(hpeConsultPeriod==='week'?'active':'')+'" onclick="hpeConsultSetPeriod(\'week\')">Semanas</button><button class="'+(hpeConsultPeriod==='month'?'active':'')+'" onclick="hpeConsultSetPeriod(\'month\')">Meses</button></div></div>'+
 '<div class="grid stats consult-stats">'+hpeConsultStat('Peso atual',last?Number(last.weight_kg).toFixed(1).replace('.',',')+' kg':'—',last?'Registrado em '+hpeConsultDate(last.measurement_date):'Aguardando primeira medida')+hpeConsultStat('Variação '+(hpeConsultPeriod==='week'?'semanal':'mensal'),hpeConsultChangeLabel(delta),delta===null?'Registre outra medida para comparar':'Comparação com a última medida anterior ao período')+hpeConsultStat('Variação total',records.length>1?hpeConsultChangeLabel(Number(last.weight_kg)-Number(records[records.length-1].weight_kg)):'Ainda sem comparação','Desde a primeira medida registrada')+'</div>'+
 '<div class="consult-chart-wrap"><h3>'+(hpeConsultPeriod==='week'?'Últimas 8 semanas':'Últimos 6 meses')+'</h3>'+hpeConsultWeightChart(records.slice().reverse(),hpeConsultPeriod)+'</div>'+
 (studentMode?'<form class="consult-weight-form" onsubmit="hpeConsultSaveWeight(event)"><h3>Registrar meu peso</h3><div class="inline"><label>Peso (kg)<input name="weight" type="number" step="0.1" min="20" max="400" required></label><label>Data<input name="measurementDate" type="date" value="'+hpeConsultToday()+'" max="'+hpeConsultToday()+'" required></label></div><label>Observação opcional<input name="note" maxlength="300" placeholder="Ex.: medido pela manhã"></label><button class="primary">Salvar peso</button><p class="note">O relatório compara as medidas registradas por semana e por mês.</p></form>':'')+
 '<h3>Histórico de medidas</h3>'+hpeConsultMeasurementHistory(records)+'</section>'+
 hpeConsultPhotosHtml(studentMode);
}
function hpeConsultChatHtml(studentMode){
 const photosById={};hpeConsultState.photos.forEach(p=>photosById[p.id]=p);
 const messages=hpeConsultState.messages;
 return hpeConsultWorkspaceHeader(studentMode)+'<section class="card consult-panel"><div class="row"><div><span class="eyebrow">CONVERSA PRIVADA</span><h2>Chat com '+(studentMode?esc(hpeConsultRecord().personal_name||'seu personal'):esc(hpeConsultRecord().name))+'</h2></div><span class="tag">CONSULTORIA</span></div><div class="consult-chat">'+
 (messages.length?messages.map(m=>{const mine=m.author_id===hpeProfile.id,photo=m.photo_id?photosById[m.photo_id]:null,url=photo?hpeConsultState.signedUrls[photo.id]:'';return'<article class="consult-chat-message '+(mine?'mine':'')+'"><small>'+(mine?'Você':studentMode?'Personal':'Aluno')+' · '+hpeConsultDateTime(m.created_at)+'</small>'+(m.body?'<p>'+esc(m.body)+'</p>':'')+(photo&&url?'<img src="'+esc(url)+'" alt="Foto enviada pelo chat: '+esc(hpeConsultAngleLabel(photo.angle))+'" loading="lazy">':'')+'</article>'}).join(''):'<div class="consult-empty">Inicie a conversa com seu personal.</div>')+'</div>'+
 '<form class="consult-chat-form" onsubmit="hpeConsultSendMessage(event)"><label>Mensagem<textarea name="body" rows="2" maxlength="2000" placeholder="Escreva sua mensagem…"></textarea></label>'+hpeConsultPhotoUploadForm('chat')+'<button class="primary">Enviar mensagem</button></form><p class="note">A conversa e os anexos desta tela ficam separados do chat geral do app.</p></section>';
}
function hpeConsultReportsHtml(){
 const sessions=hpeConsultWeekSessions(),target=hpeConsultStudentTarget(),program=hpeConsultProgram();
 return hpeConsultWorkspaceHeader(true)+'<section class="card consult-panel"><span class="eyebrow">DOCUMENTOS DA CONSULTORIA</span><h2>Baixe suas fichas e relatórios</h2><div class="consult-report-grid"><article><div class="report-icon">PDF</div><h3>Ficha de treino</h3><p>'+program.workouts.length+' treino(s) · '+program.workouts.reduce((n,w)=>n+(w.exercises||[]).length,0)+' exercício(s)</p><button class="primary" onclick="hpeConsultDownloadWorkoutPdf()" '+(program.workouts.length?'':'disabled')+'>Baixar ficha em PDF</button></article><article><div class="report-icon">PDF</div><h3>Relatório semanal</h3><p>'+sessions.length+' de '+target+' treino(s) registrado(s) nesta semana.</p><button class="primary" onclick="hpeConsultDownloadWeeklyReport()">Baixar relatório da semana</button></article></div><p class="note">O relatório semanal reúne treinos concluídos, evolução do peso e o check-in enviado ao personal.</p></section>';
}
function hpeConsultRenderCoach(seq){
 if(!hpeConsultRequire('personal'))return;
 const content=$('#content');
 content.innerHTML='<section class="card consult-loading">Carregando carteira da consultoria…</section>';
 hpeAuth.from('hpe_consultation_students').select('*').eq('personal_id',hpeProfile.id).order('created_at',{ascending:false}).then(async result=>{
  if(seq!==hpeConsultRenderSeq||page!=='consultoria')return;
  if(result.error)throw result.error;
  hpeConsultState.roster=result.data||[];
  window.hpeConsultationAccountIds=new Set(hpeConsultState.roster.map(x=>x.student_id));
  await hpeConsultLoadRosterMetrics(hpeConsultState.roster);
  if(seq!==hpeConsultRenderSeq||page!=='consultoria')return;
  if(!hpeConsultSelectedId||!hpeConsultState.roster.some(x=>x.id===hpeConsultSelectedId))hpeConsultSelectedId=null;
  if(hpeConsultSection==='roster'||!hpeConsultSelectedId){hpeConsultSection='roster';content.innerHTML=hpeConsultCoachRosterHtml();return}
  hpeConsultState.record=hpeConsultState.roster.find(x=>x.id===hpeConsultSelectedId)||null;
  await hpeConsultLoadRelated(hpeConsultState.record,seq);
  if(seq===hpeConsultRenderSeq&&page==='consultoria')content.innerHTML=hpeConsultCoachSectionHtml();
 }).catch(error=>{if(seq===hpeConsultRenderSeq&&page==='consultoria')content.innerHTML='<section class="card consult-empty"><h2>Não foi possível carregar a consultoria</h2><p>'+esc(error?.message||'Verifique sua conexão e tente novamente.')+'</p><button onclick="render()">Tentar novamente</button></section>'});
}
function hpeConsultRenderStudent(seq){
 if(!hpeConsultRequire('aluno'))return;
 const content=$('#content');
 if(['roster','overview'].includes(hpeConsultSection))hpeConsultSection='home';
 content.innerHTML='<section class="card consult-loading">Carregando seu acompanhamento…</section>';
 hpeAuth.from('hpe_consultation_students').select('*').eq('student_id',hpeProfile.id).maybeSingle().then(async result=>{
  if(seq!==hpeConsultRenderSeq||page!=='consultoria')return;
  if(result.error)throw result.error;
  hpeConsultState.record=result.data||null;
  if(!hpeConsultState.record){content.innerHTML=heading('CONSULTORIA ONLINE','Acesso ainda não ativado.','Peça ao seu personal para cadastrar você na carteira de consultoria.');return}
  hpeConsultSelectedId=hpeConsultState.record.id;
  await hpeConsultLoadRelated(hpeConsultState.record,seq);
  if(seq===hpeConsultRenderSeq&&page==='consultoria')content.innerHTML=hpeConsultStudentSectionHtml();
 }).catch(error=>{if(seq===hpeConsultRenderSeq&&page==='consultoria')content.innerHTML='<section class="card consult-empty"><h2>Não foi possível carregar seu acompanhamento</h2><p>'+esc(error?.message||'Verifique sua conexão e tente novamente.')+'</p><button onclick="render()">Tentar novamente</button></section>'});
}
async function hpeConsultLoadRelated(record,seq){
 if(!record)return;
 const consultationId=record.id;
 const results=await Promise.all([
  hpeAuth.from('hpe_consultation_intakes').select('*').eq('consultation_id',consultationId).maybeSingle(),
  hpeAuth.from('hpe_consultation_programs').select('*').eq('consultation_id',consultationId).maybeSingle(),
  hpeAuth.from('hpe_consultation_photos').select('*').eq('consultation_id',consultationId).order('created_at',{ascending:false}).limit(100),
  hpeAuth.from('hpe_consultation_messages').select('*').eq('consultation_id',consultationId).order('created_at',{ascending:false}).limit(200),
  hpeAuth.from('hpe_consultation_measurements').select('*').eq('consultation_id',consultationId).order('measurement_date',{ascending:false}).limit(400),
  hpeAuth.from('hpe_consultation_sessions').select('*').eq('consultation_id',consultationId).order('session_date',{ascending:false}).limit(365),
  hpeAuth.from('hpe_consultation_checkins').select('*').eq('consultation_id',consultationId).order('week_start',{ascending:false}).limit(52)
 ]);
 if(seq!==hpeConsultRenderSeq||page!=='consultoria')return;
 const error=results.find(x=>x.error)?.error;if(error)throw error;
 hpeConsultState.intake=results[0].data||null;
 hpeConsultState.program=results[1].data||null;
 hpeConsultState.photos=results[2].data||[];
 hpeConsultState.messages=(results[3].data||[]).slice().reverse();
 hpeConsultState.measurements=results[4].data||[];
 hpeConsultState.sessions=results[5].data||[];
 hpeConsultState.checkins=results[6].data||[];
 hpeConsultState.signedUrls={};
 await Promise.all(hpeConsultState.photos.map(async photo=>{try{const signed=await hpeAuth.storage.from(hpeConsultBucket).createSignedUrl(photo.storage_path,3600);if(!signed.error&&signed.data?.signedUrl)hpeConsultState.signedUrls[photo.id]=signed.data.signedUrl}catch{}}));
 if(hpeConsultSection==='chat')try{await hpeAuth.rpc('hpe_consultation_mark_seen',{target_consultation:consultationId})}catch{}
}
function hpeConsultCoachSectionHtml(){
 switch(hpeConsultSection){
  case'questionnaire':return hpeConsultQuestionnaireHtml(false);
  case'workout':return hpeConsultWorkoutHtml(false);
  case'progress':return hpeConsultProgressHtml(false);
  case'checkins':return hpeConsultCheckinsHtml(false);
  case'chat':return hpeConsultChatHtml(false);
  default:return hpeConsultCoachOverviewHtml();
 }
}
function hpeConsultStudentSectionHtml(){
 switch(hpeConsultSection){
  case'questionnaire':return hpeConsultQuestionnaireHtml(true);
  case'workout':return hpeConsultWorkoutHtml(true);
  case'progress':return hpeConsultProgressHtml(true);
  case'checkins':return hpeConsultCheckinsHtml(true);
  case'chat':return hpeConsultChatHtml(true);
  case'reports':return hpeConsultReportsHtml();
  default:return hpeConsultStudentHomeHtml();
 }
}
window.hpeConsultOpenRoster=()=>{hpeConsultBuilderWorkoutId=null;hpeConsultPendingExercises.clear();hpeConsultSelectedId=null;hpeConsultSection='roster';render()};
window.hpeConsultOpenStudent=(id,section='overview')=>{hpeConsultBuilderWorkoutId=null;hpeConsultPendingExercises.clear();hpeConsultSelectedId=String(id);hpeConsultSection=section;render()};
window.hpeConsultSetSection=section=>{hpeConsultSection=String(section||'overview');if(hpeProfile?.role==='aluno'&&hpeConsultSection==='overview')hpeConsultSection='home';if(hpeConsultSection!=='workout'){hpeConsultBuilderWorkoutId=null;hpeConsultPendingExercises.clear()}render()};
window.hpeConsultSetPeriod=period=>{hpeConsultPeriod=period==='month'?'month':'week';render()};
window.hpeConsultCreateStudent=()=>{
 if(hpeProfile?.role!=='personal')return;
 modal('<h2>Novo aluno da consultoria online</h2><p>Este cadastro é separado da lista “Meus alunos”. O aluno receberá um novo código e uma senha temporária gerados pelo personal.</p><form id="hpeConsultStudentForm"><label>Nome completo<input name="name" maxlength="80" required></label><label>WhatsApp (opcional)<input name="whatsapp" type="tel" placeholder="(31) 99999-9999" maxlength="24"></label><label>Objetivo<select name="goal"><option>Hipertrofia</option><option>Condicionamento</option><option>Força</option></select></label><label>Nível<select name="level"><option>Iniciante</option><option>Intermediário</option><option>Avançado</option></select></label><p id="hpeConsultCreateError" role="alert"></p><button class="primary">Cadastrar aluno e gerar acesso</button></form>');
 $('#hpeConsultStudentForm').onsubmit=async event=>{
  event.preventDefault();const form=new FormData(event.currentTarget),button=event.currentTarget.querySelector('button'),status=$('#hpeConsultCreateError'),name=String(form.get('name')||'').trim(),whatsapp=hpeNormalizeWhatsApp? hpeNormalizeWhatsApp(form.get('whatsapp')):String(form.get('whatsapp')||'').trim();
  if(!name){status.textContent='Informe o nome do aluno.';return}
  if(whatsapp===null){status.textContent='Confira o WhatsApp ou deixe o campo em branco.';return}
  button.disabled=true;
  let created=null;
  try{
   created=await hpeAccountsCall({action:'create_consultation_student',name,whatsapp:whatsapp||'',goal:form.get('goal')||'Hipertrofia',level:form.get('level')||'Iniciante'});
   if(!created?.profile?.id||!created?.consultation?.id)throw Error('A conta foi criada, mas o acompanhamento não foi retornado.');
   window.hpeConsultationAccountIds.add(created.profile.id);
   hpeConsultSelectedId=created.consultation.id;hpeConsultSection='questionnaire';
   $('#modal').close();await hpeAccountsRefresh();render();
   hpeShowStudentCredentials(created.access_code,created.temporary_password,'Acesso da consultoria criado.',whatsapp||'');
  }catch(error){
   status.textContent=error?.message||'Não foi possível cadastrar este aluno.';
  }finally{button.disabled=false}
 };
};
window.hpeConsultConfirmRemove=id=>{
 if(hpeProfile?.role!=='personal')return;
 const row=hpeConsultState.roster.find(x=>x.id===id);if(!row)return;
 modal('<h2>Remover '+esc(row.name)+' da consultoria?</h2><p>Esta ação encerra o acesso do aluno e exclui o questionário, a ficha, os check-ins, o peso, as fotos e a conversa desta consultoria.</p><p>Ela não altera os alunos nem os registros existentes nas outras abas.</p><button class="danger" onclick="hpeConsultRemoveStudent(\''+row.id+'\')">Remover aluno e dados da consultoria</button><button onclick="$(\'#modal\').close()">Cancelar</button>');
};
window.hpeConsultRemoveStudent=async id=>{
 if(hpeProfile?.role!=='personal')return;
 const row=hpeConsultState.roster.find(x=>x.id===id);if(!row)return;
 const button=$('#modalbody .danger');if(button)button.disabled=true;
 try{
  await hpeAccountsCall({action:'remove_consultation_student',target:row.id});
  window.hpeConsultationAccountIds.delete(row.student_id);hpeConsultSelectedId=null;hpeConsultSection='roster';$('#modal').close();await hpeAccountsRefresh();render();toast('Aluno removido da consultoria e acesso encerrado.');
 }catch(error){if(button)button.disabled=false;toast(error?.message||'Não foi possível remover este aluno.')}
};
window.hpeConsultResetStudent=async id=>{
 if(hpeProfile?.role!=='personal')return;
 const row=hpeConsultState.roster.find(x=>x.id===id);if(!row)return;
 try{const result=await hpeAccountsCall({action:'reset_consultation_student_password',target:id});hpeShowStudentCredentials(result.access_code,result.temporary_password,'Nova senha temporária gerada.',row.whatsapp||'')}
 catch(error){modal('<h2>Não foi possível redefinir</h2><p>'+esc(error?.message||'Tente novamente em instantes.')+'</p><button onclick="$(\'#modal\').close()">Fechar</button>')}
};
async function hpeConsultSaveProgram(program){
 const record=hpeConsultRecord();if(hpeProfile?.role!=='personal'||!record)throw Error('Somente o personal responsável pode alterar a ficha.');
 const updatedAt=new Date().toISOString(),{error}=await hpeAuth.from('hpe_consultation_programs').upsert({consultation_id:record.id,program,updated_at:updatedAt},{onConflict:'consultation_id'});
 if(error)throw error;
 hpeConsultState.program={...(hpeConsultState.program||{}),consultation_id:record.id,program,updated_at:updatedAt};
}
window.hpeConsultRenameProgram=async value=>{
 const program=hpeConsultProgram();program.title=String(value||'Ficha personalizada').trim().slice(0,100)||'Ficha personalizada';
 try{await hpeConsultSaveProgram(program);toast('Nome da ficha atualizado.')}catch(error){toast(error.message);render()}
};
window.hpeConsultAddWorkout=(requestedDivision='')=>{
 const program=hpeConsultProgram(),used=new Set(program.workouts.map((workout,index)=>hpeConsultWorkoutDivision(workout,index))),letters=Array.from({length:26},(_,index)=>String.fromCharCode(65+index)),firstAvailable=letters.find(letter=>!used.has(letter))||'A',preferred=String(requestedDivision||'').toUpperCase(),selected=preferred&&!used.has(preferred)?preferred:firstAvailable;
 modal('<h2>Adicionar treino à ficha</h2><p>A ficha já oferece as divisões A, B, C, D e E. Você também pode adicionar outras divisões até Z.</p><form id="hpeConsultWorkoutForm"><label>Divisão<select name="division" required>'+hpeConsultDivisionOptionsHtml(program,selected)+'</select></label><label>Nome do treino<input name="title" maxlength="100" placeholder="Ex.: Peitoral e tríceps" required></label><p id="hpeConsultWorkoutError" role="alert"></p><button class="primary">Criar divisão</button></form>');
 $('#hpeConsultWorkoutForm').onsubmit=async event=>{event.preventDefault();const f=new FormData(event.currentTarget),division=String(f.get('division')||'').toUpperCase(),currentProgram=hpeConsultProgram(),button=event.currentTarget.querySelector('button'),status=document.getElementById('hpeConsultWorkoutError');if(!/^[A-Z]$/.test(division)){status.textContent='Escolha uma divisão entre A e Z.';return}if(currentProgram.workouts.some((workout,index)=>hpeConsultWorkoutDivision(workout,index)===division)){status.textContent='Esta divisão já existe na ficha. Escolha outra letra.';return}const workout={id:crypto.randomUUID(),day:'Treino '+division,division,title:String(f.get('title')||'').trim(),exercises:[]};if(!workout.title){status.textContent='Informe o nome do treino.';return}currentProgram.workouts.push(workout);button.disabled=true;try{await hpeConsultSaveProgram(currentProgram);hpeConsultActiveDivision=division;$('#modal').close();toast('Divisão criada. Agora escolha os músculos e configure os exercícios.');hpeConsultOpenWorkoutBuilder(workout.id,'mapa')}catch(error){currentProgram.workouts=currentProgram.workouts.filter(item=>item.id!==workout.id);button.disabled=false;status.textContent=error?.message||'Não foi possível criar a divisão.'}};
};
window.hpeConsultEditWorkout=id=>{
 const workout=hpeConsultWorkout(id);if(!workout)return;
 const program=hpeConsultProgram(),division=hpeConsultWorkoutDivision(workout,program.workouts.indexOf(workout));
 modal('<h2>Editar treino</h2><form id="hpeConsultWorkoutForm"><label>Divisão<select name="division" required>'+hpeConsultDivisionOptionsHtml(program,division,id)+'</select></label><label>Nome do treino<input name="title" maxlength="100" value="'+esc(workout.title||'')+'" required></label><p id="hpeConsultWorkoutError" role="alert"></p><button class="primary">Salvar alterações</button></form>');
 $('#hpeConsultWorkoutForm').onsubmit=async event=>{event.preventDefault();const f=new FormData(event.currentTarget),nextDivision=String(f.get('division')||'').toUpperCase(),oldDivision=workout.division,oldDay=workout.day,oldTitle=workout.title;workout.division=nextDivision;workout.day='Treino '+nextDivision;workout.title=String(f.get('title')||'').trim();try{await hpeConsultSaveProgram(hpeConsultProgram());hpeConsultActiveDivision=nextDivision;$('#modal').close();render();toast('Treino atualizado.')}catch(error){workout.division=oldDivision;workout.day=oldDay;workout.title=oldTitle;document.getElementById('hpeConsultWorkoutError').textContent=error?.message||'Não foi possível salvar as alterações.'}};
};
window.hpeConsultConfirmRemoveWorkout=id=>{
 const w=hpeConsultWorkout(id);if(!w)return;
 modal('<h2>Remover '+esc(w.title)+'?</h2><p>O treino e seus exercícios serão retirados da ficha da consultoria.</p><button class="danger" onclick="hpeConsultRemoveWorkout(\''+w.id+'\')">Remover treino</button><button onclick="$(\'#modal\').close()">Cancelar</button>');
};
window.hpeConsultRemoveWorkout=async id=>{const program=hpeConsultProgram();program.workouts=program.workouts.filter(w=>String(w.id)!==String(id));try{await hpeConsultSaveProgram(program);$('#modal').close();render();toast('Treino removido da ficha.')}catch(error){toast(error.message)}};
window.hpeConsultAddExercise=id=>hpeConsultEditExercise(id,null);
window.hpeConsultEditExercise=(workoutId,exerciseId)=>{
 const workout=hpeConsultWorkout(workoutId);if(!workout)return;
 const exercise=exerciseId?(workout.exercises||[]).find(x=>x.id===exerciseId):{name:'',sets:3,reps:'10–12',load:'',rest:60,notes:''};if(!exercise)return;
 modal('<h2>'+(exerciseId?'Editar exercício':'Adicionar exercício')+' · '+esc(workout.title)+'</h2><form id="hpeConsultExerciseForm"><label>Exercício<input name="name" maxlength="100" value="'+esc(exercise.name||'')+'" required></label><div class="inline"><label>Séries<input name="sets" type="number" min="1" max="20" value="'+esc(exercise.sets||3)+'" required></label><label>Repetições ou tempo<input name="reps" maxlength="80" value="'+esc(exercise.reps||'10–12')+'" required></label></div><div class="inline"><label>Carga ou orientação<input name="load" maxlength="80" value="'+esc(exercise.load||'')+'" placeholder="Opcional"></label><label>Descanso (segundos)<input name="rest" type="number" min="0" max="600" value="'+esc(exercise.rest??60)+'" required></label></div><label>Orientação<textarea name="notes" maxlength="1000" rows="3">'+esc(exercise.notes||'')+'</textarea></label><button class="primary">Salvar exercício</button></form>');
 $('#hpeConsultExerciseForm').onsubmit=event=>hpeConsultSaveExercise(event,workoutId,exerciseId);
};
window.hpeConsultSaveExercise=async(event,workoutId,exerciseId)=>{
 event.preventDefault();const f=new FormData(event.currentTarget),workout=hpeConsultWorkout(workoutId);if(!workout)return;
 const value={id:exerciseId||crypto.randomUUID(),name:String(f.get('name')||'').trim(),sets:Number(f.get('sets')),reps:String(f.get('reps')||'').trim(),load:String(f.get('load')||'').trim(),rest:Number(f.get('rest')),notes:String(f.get('notes')||'').trim()};
 if(!value.name)return;
 workout.exercises=workout.exercises||[];
 if(exerciseId){const i=workout.exercises.findIndex(x=>x.id===exerciseId);if(i>=0)workout.exercises[i]=value}else workout.exercises.push(value);
 try{await hpeConsultSaveProgram(hpeConsultProgram());$('#modal').close();render();toast('Ficha de treino salva.')}catch(error){toast(error.message)}
};
window.hpeConsultRemoveExercise=async(workoutId,exerciseId)=>{
 const workout=hpeConsultWorkout(workoutId);if(!workout)return;
 workout.exercises=(workout.exercises||[]).filter(x=>x.id!==exerciseId);
 try{await hpeConsultSaveProgram(hpeConsultProgram());render();toast('Exercício removido da ficha.')}catch(error){toast(error.message)}
};
window.hpeConsultRemoveWorkout=async id=>{
 const program=hpeConsultProgram();program.workouts=program.workouts.filter(workout=>String(workout.id)!==String(id));
 try{await hpeConsultSaveProgram(program);if(String(hpeConsultBuilderWorkoutId)===String(id)){hpeConsultBuilderWorkoutId=null;hpeConsultPendingExercises.clear()}$('#modal').close();render();toast('Treino removido da ficha da consultoria.')}catch(error){toast(error.message)}
};
window.hpeConsultAddExercise=id=>hpeConsultEditExercise(id,null);
window.hpeConsultBuilderAddExercise=(muscle,index)=>{
 const name=muscleLibrary[muscle]?.exercises[index];if(!name||!hpeConsultBuilderWorkoutId)return;
 hpeConsultEditExercise(hpeConsultBuilderWorkoutId,null,{name,muscle,sets:3,reps:'12',weight:0,rest:60,notes:'',gif:'',video:''});
};
window.hpeConsultEditExercise=(workoutId,exerciseId,preset=null)=>{
 if(hpeProfile?.role!=='personal')return;
 const workout=hpeConsultWorkout(workoutId);if(!workout)return;
 const exercise=exerciseId?(workout.exercises||[]).find(item=>item.id===exerciseId):(preset||{name:'',sets:3,reps:'12',weight:0,rest:60,notes:'',gif:'',video:''});if(!exercise)return;
 const weight=exercise.weight!==undefined?Number(exercise.weight):(Number.parseFloat(String(exercise.load||'').replace(',','.'))||0);
 modal('<h2>'+(exerciseId?'Editar exercício':'Adicionar exercício')+' · '+esc(workout.title)+'</h2><form id="hpeConsultExerciseForm"><label>Exercício<input name="name" maxlength="100" value="'+esc(exercise.name||'')+'" required></label><div class="inline"><label>Séries<input name="sets" type="number" min="1" max="20" value="'+esc(exercise.sets??3)+'" required></label><label>Repetições ou tempo<input name="reps" maxlength="150" value="'+esc(exercise.reps||'12')+'" required></label></div><div class="inline"><label>Carga (kg)<input name="weight" type="number" min="0" max="1000" step="0.5" value="'+esc(weight)+'" required></label><label>Descanso (s)<input name="rest" type="number" min="0" max="600" value="'+esc(exercise.rest??60)+'" required></label></div><label>Orientação e método<textarea name="notes" maxlength="2000" rows="3">'+esc(exercise.notes||'')+'</textarea></label><label>URL de demonstração GIF (HTTPS, opcional)<input name="gif" type="url" value="'+esc(exercise.gif||'')+'" placeholder="https://…/exercicio.gif"></label><label>Vídeo de demonstração (HTTPS, opcional)<input name="video" type="url" value="'+esc(exercise.video||'')+'" placeholder="https://…/exercicio.mp4"></label><p id="consultExerciseError" role="alert"></p><button class="primary">Salvar exercício</button></form>');
 $('#hpeConsultExerciseForm').onsubmit=event=>hpeConsultSaveExercise(event,workoutId,exerciseId,exercise);
};
window.hpeConsultSaveExercise=async(event,workoutId,exerciseId,previous={})=>{
 event.preventDefault();const f=new FormData(event.currentTarget),workout=hpeConsultWorkout(workoutId);if(!workout||hpeProfile?.role!=='personal')return;
 const value={id:exerciseId||crypto.randomUUID(),name:String(f.get('name')||'').trim(),sets:Number(f.get('sets')),reps:String(f.get('reps')||'').trim(),weight:Number(f.get('weight')),rest:Number(f.get('rest')),notes:String(f.get('notes')||'').trim().slice(0,2000),gif:String(f.get('gif')||'').trim(),video:String(f.get('video')||'').trim(),muscle:previous?.muscle||''};
 const status=document.getElementById('consultExerciseError'),button=event.currentTarget.querySelector('button');
 if(!value.name||!Number.isInteger(value.sets)||value.sets<1||value.sets>20||!value.reps||value.reps.length>150||!Number.isFinite(value.weight)||value.weight<0||value.weight>1000||!Number.isInteger(value.rest)||value.rest<0||value.rest>600){if(status)status.textContent='Confira nome, séries, repetições, carga e descanso.';return}
 if((value.gif&&!value.gif.toLowerCase().startsWith('https://'))||(value.video&&!value.video.toLowerCase().startsWith('https://'))){if(status)status.textContent='Use links HTTPS para as demonstrações.';return}
 workout.exercises=workout.exercises||[];
 if(exerciseId){const index=workout.exercises.findIndex(item=>item.id===exerciseId);if(index>=0)workout.exercises[index]=value}else workout.exercises.push(value);
 button.disabled=true;
 try{await hpeConsultSaveProgram(hpeConsultProgram());if(hpeConsultBuilderWorkoutId)hpeConsultBuilderTab='lista';$('#modal').close();render();toast('Exercício salvo na ficha da consultoria.')}catch(error){button.disabled=false;if(status)status.textContent=error?.message||'Não foi possível salvar o exercício.'}
};
window.hpeConsultRemoveExercise=async(workoutId,exerciseId)=>{
 if(hpeProfile?.role!=='personal')return;const workout=hpeConsultWorkout(workoutId);if(!workout)return;
 workout.exercises=(workout.exercises||[]).filter(item=>item.id!==exerciseId);
 try{await hpeConsultSaveProgram(hpeConsultProgram());render();toast('Exercício removido da ficha.')}catch(error){toast(error.message)}
};
window.hpeConsultPreviewExercise=(workoutId,exerciseId)=>{
 const exercise=(hpeConsultWorkout(workoutId)?.exercises||[]).find(item=>item.id===exerciseId);if(!exercise)return;
 const video=String(exercise.video||'').trim(),gif=String(exercise.gif||'').trim();let media='';
 try{
  if(video){const url=new URL(video);if(url.protocol!=='https:')throw Error();const path=url.pathname.toLowerCase(),isVideo=['.mp4','.webm','.ogg'].some(extension=>path.endsWith(extension));media=isVideo?'<video controls playsinline preload="metadata" class="consult-demo-video" src="'+esc(url.href)+'"></video>':'<a class="media-link" href="'+esc(url.href)+'" target="_blank" rel="noopener noreferrer">Abrir demonstração ↗</a>'}
  else if(gif){const url=new URL(gif);if(url.protocol!=='https:')throw Error();media='<img class="consult-demo-image" src="'+esc(url.href)+'" alt="Demonstração de '+esc(exercise.name)+'">'}
  else if(typeof hpeExerciseMedia==='function'){const item=hpeExerciseMedia(exercise);if(item)media=item.type==='video'?'<video controls playsinline preload="metadata" class="consult-demo-video" src="'+esc(item.url)+'"></video>':'<img class="consult-demo-image" src="'+esc(item.url)+'" alt="Demonstração de '+esc(exercise.name)+'">'}
 }catch{}
 modal('<span class="eyebrow">DEMONSTRAÇÃO</span><h2>'+esc(exercise.name)+'</h2>'+(media||'<div class="consult-empty">Ainda não há uma demonstração cadastrada para este exercício.</div>')+'<p>'+esc(exercise.sets||'—')+' séries × '+esc(exercise.reps||'—')+' · '+esc(hpeConsultExerciseLoadText(exercise))+' · '+esc(exercise.rest??'—')+'s de descanso</p>'+(exercise.notes?'<p>'+esc(exercise.notes)+'</p>':''));
};
window.hpeConsultSaveIntake=async event=>{
 event.preventDefault();if(hpeProfile?.role!=='aluno')return;
 const form=new FormData(event.currentTarget),consent=form.get('healthConsent')==='yes';
 if(!consent){toast('Autorize o compartilhamento do questionário com seu personal para salvar.');return}
 const conditions=String(form.get('conditions')||'no'),injury=String(form.get('injury')||'no');
 const conditionsDetail=String(form.get('conditionsDetail')||'').trim(),injuryDetail=String(form.get('injuryDetail')||'').trim();
 if(conditions==='yes'&&!conditionsDetail){toast('Descreva a condição de saúde que o personal deve considerar.');return}
 if(injury==='yes'&&!injuryDetail){toast('Descreva a lesão, dor ou limitação para o personal adaptar o treino.');return}
 const availableDays=form.getAll('availableDays').map(Number).filter(x=>x>=0&&x<7);
 const answers={goal:String(form.get('goal')||'').trim(),weeklyFrequency:Number(form.get('weeklyFrequency')),duration:String(form.get('duration')||'45'),availableDays,conditions,conditionsDetail,injury,injuryDetail,healthGuidance:String(form.get('healthGuidance')||'').trim().slice(0,700),exerciseDifficulty:String(form.get('exerciseDifficulty')||'').trim().slice(0,700),exerciseAdaptation:String(form.get('exerciseAdaptation')||'').trim().slice(0,700),notes:String(form.get('notes')||'').trim().slice(0,700)};
 const now=new Date().toISOString(),payload={consultation_id:hpeConsultRecord().id,student_id:hpeProfile.id,answers,consent_at:now,photos_consent_at:form.get('photosConsent')==='yes'?now:null,updated_at:now};
 const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const {error}=await hpeAuth.from('hpe_consultation_intakes').upsert(payload,{onConflict:'consultation_id'});if(error)throw error;toast('Questionário salvo e compartilhado com seu personal.');render()}catch(error){toast(error?.message||'Não foi possível salvar o questionário.')}finally{button.disabled=false}
};
window.hpeConsultSaveCheckin=async event=>{
 event.preventDefault();if(hpeProfile?.role!=='aluno')return;
 const form=new FormData(event.currentTarget),energy=Number(form.get('energy')),recovery=Number(form.get('recovery'));
 if(energy<1||energy>5||recovery<1||recovery>5){toast('Informe energia e recuperação.');return}
 const now=new Date().toISOString(),payload={consultation_id:hpeConsultRecord().id,student_id:hpeProfile.id,week_start:hpeConsultWeekStart(),energy,recovery,discomfort:String(form.get('discomfort')||'').trim().slice(0,500),notes:String(form.get('notes')||'').trim().slice(0,700),updated_at:now};
 const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const {error}=await hpeAuth.from('hpe_consultation_checkins').upsert(payload,{onConflict:'consultation_id,week_start'});if(error)throw error;toast('Check-in da semana enviado ao personal.');render()}catch(error){toast(error?.message||'Não foi possível salvar seu check-in.')}finally{button.disabled=false}
};
window.hpeConsultSaveWeight=async event=>{
 event.preventDefault();if(hpeProfile?.role!=='aluno')return;
 const form=new FormData(event.currentTarget),weight=Number(form.get('weight')),date=String(form.get('measurementDate')||hpeConsultToday());
 if(weight<20||weight>400||!Number.isFinite(weight)||date>hpeConsultToday()){toast('Confira o peso e a data informados.');return}
 const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const {error}=await hpeAuth.from('hpe_consultation_measurements').insert({consultation_id:hpeConsultRecord().id,student_id:hpeProfile.id,measurement_date:date,weight_kg:weight,note:String(form.get('note')||'').trim().slice(0,300)});if(error){if(error.code==='23505')throw Error('Já existe uma medida para esta data. Escolha outra data.');throw error}toast('Peso registrado na sua evolução.');render()}catch(error){toast(error?.message||'Não foi possível salvar o peso.')}finally{button.disabled=false}
};
window.hpeConsultOpenSession=workoutId=>{
 const w=hpeConsultWorkout(workoutId);if(!w)return;
 modal('<h2>Registrar treino concluído</h2><p>'+esc(w.title)+' · '+(w.exercises||[]).length+' exercícios</p><form id="hpeConsultSessionForm"><label>Duração aproximada (minutos)<input name="duration" type="number" min="1" max="300" placeholder="Opcional"></label><label>Esforço percebido<select name="effort"><option value="">Não informar</option>'+Array.from({length:10},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+(i===0?' · leve':i===9?' · muito intenso':'')+'</option>').join('')+'</select></label><label>Comentário opcional<textarea name="feedback" rows="3" maxlength="1000"></textarea></label><button class="primary">Salvar treino concluído</button></form>');
 $('#hpeConsultSessionForm').onsubmit=event=>hpeConsultSaveSession(event,workoutId);
};
function hpeConsultRunnerSummary(entries){
 const grouped=new Map();
 for(const entry of entries||[]){const values=grouped.get(entry.name)||[];values.push(String(entry.reps)+(entry.unit==='s'?'s':' reps')+' × '+String(entry.weight)+'kg');grouped.set(entry.name,values)}
 return [...grouped].map(([name,values])=>name+': '+values.join(', ')).join(' | ').slice(0,560);
}
window.hpeConsultSaveSession=async(event,workoutId)=>{
 event.preventDefault();const w=hpeConsultWorkout(workoutId);if(!w||hpeProfile?.role!=='aluno')return;
 const form=new FormData(event.currentTarget),duration=form.get('duration'),effort=form.get('effort'),runner=hpeConsultRunner?.workoutId===String(workoutId)?hpeConsultRunner:null,elapsed=runner?Math.max(1,Math.round((Date.now()-runner.startedAt)/60000)):null,note=String(form.get('feedback')||'').trim().slice(0,420),series=runner?hpeConsultRunnerSummary(runner.seriesEntries):'',feedback=[note,series?'Séries registradas · '+series:''].filter(Boolean).join('\n\n').slice(0,1000),payload={consultation_id:hpeConsultRecord().id,student_id:hpeProfile.id,workout_id:String(w.id),workout_title:String(w.title||'Treino').slice(0,120),session_date:hpeConsultToday(),duration_minutes:duration?Number(duration):elapsed,effort:effort?Number(effort):null,exercise_count:(w.exercises||[]).length,feedback};
 const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const {error}=await hpeAuth.from('hpe_consultation_sessions').insert(payload);if(error){if(error.code==='23505')throw Error('Este treino já foi registrado hoje.');throw error}$('#modal').close();if(runner){hpeConsultRunner=null;if(hpeConsultRunnerTimer){clearInterval(hpeConsultRunnerTimer);hpeConsultRunnerTimer=null}}toast('Treino registrado no seu acompanhamento.');render()}catch(error){toast(error?.message||'Não foi possível registrar o treino.')}finally{button.disabled=false}
};
async function hpeConsultCompressImage(file){
 if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Escolha uma foto JPG, PNG ou WEBP.');
 if(file.size>15*1024*1024)throw Error('A foto deve ter até 15 MB antes da compressão.');
 let bitmap;
 try{bitmap=await createImageBitmap(file)}catch{throw Error('Não foi possível abrir esta imagem. Escolha outra foto.')}
 const max=1600,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 const context=canvas.getContext('2d');context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));
 if(!blob)throw Error('Não foi possível preparar a foto.');
 if(blob.size>10*1024*1024)throw Error('A foto ainda ficou maior que 10 MB. Escolha uma imagem menor.');
 return blob;
}
async function hpeConsultUploadPhoto(file,angle,caption){
 if(hpeProfile?.role!=='aluno')throw Error('Somente o aluno pode enviar fotos de evolução.');
 if(!hpeConsultState.intake?.photos_consent_at)throw Error('O aluno precisa autorizar o envio de fotos no questionário.');
 const record=hpeConsultRecord();if(!record)throw Error('A consultoria não está disponível.');
 const blob=await hpeConsultCompressImage(file),id=crypto.randomUUID(),path=record.personal_id+'/'+record.id+'/'+id+'.jpg';
 const {error:uploadError}=await hpeAuth.storage.from(hpeConsultBucket).upload(path,blob,{contentType:'image/jpeg',cacheControl:'3600',upsert:false});
 if(uploadError)throw uploadError;
 const {data:photo,error:photoError}=await hpeAuth.from('hpe_consultation_photos').insert({consultation_id:record.id,personal_id:record.personal_id,uploader_id:hpeProfile.id,angle,storage_path:path,caption:String(caption||'').trim().slice(0,300)}).select('*').single();
 if(photoError){await hpeAuth.storage.from(hpeConsultBucket).remove([path]);throw photoError}
 const body=(caption?'Foto de evolução · '+hpeConsultAngleLabel(angle)+' · '+String(caption).trim():'Foto de evolução · '+hpeConsultAngleLabel(angle)).slice(0,2000);
 const {error:messageError}=await hpeAuth.from('hpe_consultation_messages').insert({consultation_id:record.id,author_id:hpeProfile.id,body,photo_id:photo.id});
 if(messageError)toast('Foto salva na evolução; não foi possível anexá-la à conversa.');
 return photo;
}
window.hpeConsultPhotoSubmit=async event=>{
 event.preventDefault();const form=new FormData(event.currentTarget),file=form.get('photo');
 if(!(file instanceof File)||!file.size){toast('Escolha uma foto para enviar.');return}
 const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{await hpeConsultUploadPhoto(file,String(form.get('angle')||'front'),String(form.get('caption')||''));toast('Foto enviada ao personal e adicionada à conversa.');render()}catch(error){toast(error?.message||'Não foi possível enviar a foto.')}finally{button.disabled=false}
};
window.hpeConsultDeletePhoto=async id=>{
 if(hpeProfile?.role!=='personal')return;
 const photo=hpeConsultState.photos.find(x=>x.id===id);if(!photo)return;
 const {error}=await hpeAuth.storage.from(hpeConsultBucket).remove([photo.storage_path]);if(error){toast('Não foi possível remover o arquivo da foto.');return}
 const result=await hpeAuth.from('hpe_consultation_photos').delete().eq('id',id);if(result.error){toast('Arquivo removido, mas o registro não pôde ser atualizado.');return}
 toast('Foto removida da evolução e do chat.');render();
};
window.hpeConsultSendMessage=async event=>{
 event.preventDefault();if(!['personal','aluno'].includes(hpeProfile?.role))return;
 const form=new FormData(event.currentTarget),body=String(form.get('body')||'').trim(),file=form.get('chatPhoto');
 if(file instanceof File&&file.size){
  if(hpeProfile.role!=='aluno'){toast('O envio de fotos é feito pelo aluno nesta consultoria.');return}
  const button=event.currentTarget.querySelector('button');button.disabled=true;
  try{await hpeConsultUploadPhoto(file,String(form.get('chatAngle')||'front'),body);toast('Foto enviada na conversa.');render()}catch(error){toast(error?.message||'Não foi possível enviar a foto.')}finally{button.disabled=false}
  return;
 }
 if(!body){toast('Escreva uma mensagem ou selecione uma foto.');return}
 const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const {error}=await hpeAuth.from('hpe_consultation_messages').insert({consultation_id:hpeConsultRecord().id,author_id:hpeProfile.id,body});if(error)throw error;toast('Mensagem enviada ao acompanhamento.');render()}catch(error){toast(error?.message||'Não foi possível enviar a mensagem.')}finally{button.disabled=false}
};
function hpeConsultPdfText(text){
 return String(text??'').normalize('NFC').replace(/[–—]/g,'-').replace(/[•·]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[×]/g,'x').replace(/[^\x20-\xFF]/g,'?');
}
function hpeConsultPdfHex(text){
 return Array.from(hpeConsultPdfText(text)).map(ch=>ch.charCodeAt(0).toString(16).padStart(2,'0')).join('').toUpperCase();
}
function hpeConsultPdfWrap(text,max=90){
 const words=hpeConsultPdfText(text).split(/\s+/),out=[];let line='';
 for(const word of words){if(!line){line=word;continue}if((line+' '+word).length>max){out.push(line);line=word}else line+=' '+word}
 if(line)out.push(line);return out.length?out:[''];
}
function hpeConsultDownloadPdf(filename,documentTitle,rows){
 const expanded=[];
 rows.forEach(row=>{const style=row.style||'normal',max=style==='title'?55:style==='subtitle'?75:92;hpeConsultPdfWrap(row.text,max).forEach(text=>expanded.push({text,style}))});
 const pages=[];let pageRows=[];
 expanded.forEach(row=>{if(pageRows.length>=44){pages.push(pageRows);pageRows=[]}pageRows.push(row)});if(pageRows.length||!pages.length)pages.push(pageRows);
 const objects=[];
 objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
 const pageNumbers=pages.map((_,i)=>5+i*2);
 objects[2]='<< /Type /Pages /Kids ['+pageNumbers.map(n=>n+' 0 R').join(' ')+'] /Count '+pages.length+' >>';
 objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
 objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
 pages.forEach((rows,index)=>{
  const pageNo=5+index*2,contentNo=pageNo+1;
  let content='BT\n';
  let y=790;
  rows.forEach(row=>{const font=row.style==='title'?'/F2 18':row.style==='subtitle'?'/F2 13':row.style==='section'?'/F2 11':'/F1 10.5';const leading=row.style==='title'?28:row.style==='section'?21:16;if(row.style==='blank'){y-=8;return}content+=font+' Tf 1 0 0 1 50 '+y+' Tm <'+hpeConsultPdfHex(row.text)+'> Tj\n';y-=leading});
  content+='/F1 8 Tf 1 0 0 1 50 28 Tm <'+hpeConsultPdfHex('HPE Força Bruta - Consultoria Online  |  Página '+(index+1)+' de '+pages.length)+'> Tj ET';
  objects[pageNo]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+contentNo+' 0 R >>';
  objects[contentNo]='<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream';
 });
 let pdf='%PDF-1.4\n%HPE\n';const offsets=[0];
 for(let i=1;i<objects.length;i++){offsets[i]=new TextEncoder().encode(pdf).length;pdf+=i+' 0 obj\n'+objects[i]+'\nendobj\n'}
 const xref=new TextEncoder().encode(pdf).length;pdf+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';
 for(let i=1;i<objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
 const blob=new Blob([pdf],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast(documentTitle+' em PDF baixado.');
}
window.hpeConsultDownloadWorkoutPdf=()=>{
 const program=hpeConsultProgram(),workouts=program.workouts||[];
 if(!workouts.length){toast('A ficha ainda não tem treinos para baixar.');return}
 const rows=[{text:program.title||'Ficha personalizada',style:'title'},{text:'Aluno: '+hpeConsultRecord().name,style:'subtitle'},{text:'Personal: '+(hpeConsultRecord().personal_name||'Personal da consultoria')},{text:'Gerado em: '+hpeConsultDate(hpeConsultToday())},{text:'',style:'blank'}];
 workouts.forEach(w=>{rows.push({text:(w.day||'TREINO')+' - '+(w.title||'Treino'),style:'section'});(w.exercises||[]).forEach((x,i)=>{rows.push({text:(i+1)+'. '+x.name,style:'subtitle'});rows.push({text:(x.sets||'—')+' séries x '+(x.reps||'—')+' | Carga: '+hpeConsultExerciseLoadText(x)+' | Descanso: '+(x.rest??'—')+' s'});if(x.notes)rows.push({text:'Orientação: '+x.notes})});rows.push({text:'',style:'blank'})});
 hpeConsultDownloadPdf('hpe-ficha-'+hpeConsultPdfFilename(hpeConsultRecord().name)+'.pdf','Ficha de treino',rows);
};
function hpeConsultPdfFilename(name){return hpeConsultPdfText(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'aluno'}
window.hpeConsultDownloadWeeklyReport=()=>{
 const record=hpeConsultRecord(),start=hpeConsultWeekStart(),today=hpeConsultToday(),sessions=hpeConsultWeekSessions().slice().sort((a,b)=>String(a.session_date).localeCompare(String(b.session_date))),checkin=hpeConsultWeekCheckin(),last=hpeConsultLatestWeight(),delta=hpeConsultDelta(hpeConsultState.measurements,'week'),target=hpeConsultStudentTarget();
 const weightRows=hpeConsultState.measurements.filter(x=>x.measurement_date>=start&&x.measurement_date<=today).slice().sort((a,b)=>String(a.measurement_date).localeCompare(String(b.measurement_date)));
 const rows=[{text:'RELATÓRIO SEMANAL DA CONSULTORIA',style:'title'},{text:'Aluno: '+record.name,style:'subtitle'},{text:'Personal: '+(record.personal_name||'Personal da consultoria')},{text:'Período: '+hpeConsultDate(start)+' a '+hpeConsultDate(today)},{text:'Gerado em: '+hpeConsultDateTime(new Date().toISOString())},{text:'',style:'blank'},{text:'TREINOS CONCLUÍDOS',style:'section'},{text:sessions.length+' de '+target+' treino(s) registrados nesta semana.'}];
 if(sessions.length)sessions.forEach(x=>rows.push({text:'- '+hpeConsultDate(x.session_date)+' | '+x.workout_title+(x.duration_minutes?' | '+x.duration_minutes+' min':'')+(x.effort?' | esforço '+x.effort+'/10':'')+(x.feedback?' | '+x.feedback:'')}));
 if(!sessions.length)rows.push({text:'Nenhum treino registrado nesta semana.'});
 rows.push({text:'',style:'blank'},{text:'EVOLUÇÃO DO PESO',style:'section'});
 if(last)rows.push({text:'Peso mais recente: '+Number(last.weight_kg).toFixed(1).replace('.',',')+' kg ('+hpeConsultDate(last.measurement_date)+').'});
 else rows.push({text:'Nenhuma medida de peso registrada.'});
 rows.push({text:'Variação semanal: '+hpeConsultChangeLabel(delta)+'.'});
 weightRows.forEach(x=>rows.push({text:'- '+hpeConsultDate(x.measurement_date)+' | '+Number(x.weight_kg).toFixed(1).replace('.',',')+' kg'+(x.note?' | '+x.note:'')}));
 rows.push({text:'',style:'blank'},{text:'CHECK-IN DA SEMANA',style:'section'});
 if(checkin){rows.push({text:'Energia: '+checkin.energy+'/5 | Recuperação: '+checkin.recovery+'/5.'});if(checkin.discomfort)rows.push({text:'Desconforto: '+checkin.discomfort});if(checkin.notes)rows.push({text:'Observações: '+checkin.notes})}else rows.push({text:'Check-in ainda não respondido.'});
 rows.push({text:'',style:'blank'},{text:'Este relatório resume os registros da consultoria online e não substitui avaliação de profissional de saúde.'});
 hpeConsultDownloadPdf('hpe-relatorio-semanal-'+hpeConsultPdfFilename(record.name)+'-'+start+'.pdf','Relatório semanal',rows);
};
const hpeConsultBaseGo=go;
go=function(next){if(hpeProfile?.consultation_only&&next!=='consultoria'){next='consultoria';hpeConsultSection='home'}hpeConsultBaseGo(next)};
window.hpeConsultEnterStudent=()=>{hpeConsultSelectedId=null;hpeConsultSection='home';page='consultoria';render()};
const hpeConsultBaseRender=render;
render=function(){
 if(hpeProfile?.consultation_only&&page!=='consultoria'){page='consultoria';hpeConsultSection='home'}
 hpeConsultBaseRender();
 if(document.body.classList.contains('signed-out'))return;
 const nav=$('#nav');
 if(hpeProfile?.consultation_only){const picker=$('#role');if(picker){picker.hidden=true;picker.disabled=true}nav.innerHTML='<button data-consult-nav class="active" aria-current="page" onclick="go(\'consultoria\')">◉ &nbsp; Minha Consultoria</button>';const seq=++hpeConsultRenderSeq;hpeConsultRenderStudent(seq);return}
 const picker=$('#role');if(picker){picker.hidden=false;picker.disabled=false}
 if(role==='personal'&&!nav.querySelector('[data-consult-nav]'))nav.insertAdjacentHTML('beforeend','<button data-consult-nav class="'+(page==='consultoria'?'active':'')+'" onclick="go(\'consultoria\')">◉ &nbsp; Consultoria Online</button>');
 if(role==='aluno'&&!nav.querySelector('[data-consult-nav]'))nav.insertAdjacentHTML('beforeend','<button data-consult-nav class="'+(page==='consultoria'?'active':'')+'" onclick="go(\'consultoria\')">◉ &nbsp; Minha Consultoria</button>');
 if(page!=='consultoria')return;
 const seq=++hpeConsultRenderSeq;
 if(role==='personal')hpeConsultRenderCoach(seq);
 else if(role==='aluno')hpeConsultRenderStudent(seq);
 else $('#content').innerHTML='<section class="card consult-empty">Entre como personal ou aluno para abrir a consultoria.</section>';
};
