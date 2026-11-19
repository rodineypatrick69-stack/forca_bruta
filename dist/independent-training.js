(() => {
  const API_URL=window.location.hostname.endsWith('.vercel.app')?`${window.location.origin}/api/ai-assistant`:'https://forcabruta.vercel.app/api/ai-assistant';
  const groups={peitoral:'peitoral',dorsais:'costas',quadriceps:'quadríceps',posteriores:'posteriores',gluteos:'glúteos',deltoide:'ombros',biceps:'bíceps',triceps:'tríceps',abdomen:'abdômen'};
  const preferences={peitoral:/supino|crucifixo|voador/i,dorsais:/puxada|remada|barra fixa/i,quadriceps:/agachamento|extensora|leg press/i,posteriores:/stiff|romeno|flexora|terra/i,gluteos:/elevação pélvica|passada|afundo|glúteo/i,deltoide:/desenvolvimento|elevação lateral/i,biceps:/rosca direta|rosca martelo/i,triceps:/tríceps corda|tríceps testa|tríceps francês/i,abdomen:/prancha|abdominal/i};
  let generatedPlan=null,busy=false,availability=null,availabilityRequest=null,statusMessage='';
  const canUseStudentAI=()=>typeof hpeProfile!=='undefined'&&hpeProfile?.role==='aluno'&&hpeProfile?.consultation_only!==true;
  const independent=()=>window.hpeIndependentMode===true&&canUseStudentAI();
  const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mediaCatalog(){
    if(typeof hpeDriveExerciseLibrary==='undefined'||!Array.isArray(hpeDriveExerciseLibrary)||!window.HPE_EXERCISE_DEMOS||typeof window.hpeExerciseNameKey!=='function')return [];
    const result=[],seen=new Set();
    for(const group of Object.keys(groups)){
      const candidates=hpeDriveExerciseLibrary.filter(item=>item.muscle===group&&typeof item.name==='string'&&item.name.trim().length<=75&&/^[A-Za-zÀ-ÖØ-öø-ÿ]/.test(item.name.trim())&&!/^\d/.test(item.name.trim())&&/^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .,'’()\/-]+$/.test(item.name.trim())&&window.HPE_EXERCISE_DEMOS[window.hpeExerciseNameKey(item.name)]&&typeof hpeExerciseMedia==='function'&&hpeExerciseMedia({name:item.name}));
      candidates.sort((a,b)=>Number(preferences[group].test(b.name))-Number(preferences[group].test(a.name)));
      let added=0;
      for(const item of candidates){const name=item.name.trim(),key=window.hpeExerciseNameKey(name);if(seen.has(key))continue;seen.add(key);result.push({name,group});if(++added===5)break}
    }
    return result;
  }
  async function checkAvailability(){
    if(availability!==null||availabilityRequest)return availabilityRequest;
    availabilityRequest=(async()=>{try{const response=await fetch(API_URL,{headers:{Accept:'application/json'}});const body=await response.json().catch(()=>({}));availability=response.ok&&body.available===true;statusMessage=availability?(independent()?'A sugestão só será adicionada ao seu treino quando você tocar em “Salvar no meu treino”.':'A IA está pronta. Para alunos com personal, o resultado será um rascunho e não altera o treino atual.'):'A IA está indisponível neste ambiente no momento.'}catch{availability=false;statusMessage='A IA está indisponível neste ambiente no momento.'}finally{availabilityRequest=null;if(canUseStudentAI()&&page==='independent-plan')render()}})();
    return availabilityRequest;
  }
  function renderNav(){
    const nav=document.getElementById('nav');if(!nav)return;
    nav.querySelector('#hpeIndependentPlanNav')?.remove();
    if(!canUseStudentAI())return;
    const button=document.createElement('button');button.id='hpeIndependentPlanNav';button.type='button';button.classList.toggle('active',page==='independent-plan');button.innerHTML='<span aria-hidden="true">✦</span> &nbsp; Meu treino com IA';button.onclick=()=>window.go('independent-plan');nav.append(button);
  }
  function renderHomeCard(){
    const content=document.getElementById('content');if(!content||document.getElementById('hpeIndependentHome'))return;
    const card=document.createElement('section');card.id='hpeIndependentHome';card.className='card hpe-independent-home';
    card.innerHTML='<div><span class="eyebrow">ALUNO INDEPENDENTE</span><h2>Seu primeiro treino começa aqui.</h2><p>Monte um plano inicial com a IA e use as demonstrações e o descanso cronometrado do HPE.</p><button class="primary" type="button" onclick="window.go(\'independent-plan\')">✦ Criar treino com IA</button></div><span class="hpe-independent-mark" aria-hidden="true">✦</span>';
    const hero=content.querySelector('.hero');if(hero)hero.before(card);else content.prepend(card);
  }
  function previewMedia(exercise){
    if(typeof hpeExerciseMedia!=='function')return '<div class="hpe-independent-media-empty">Demonstração disponível no treino salvo.</div>';
    const media=hpeExerciseMedia(exercise);if(!media)return '<div class="hpe-independent-media-empty">Demonstração disponível no treino salvo.</div>';
    return media.type==='video'?`<video class="hpe-independent-media" muted loop playsinline preload="metadata" aria-label="Demonstração de ${escapeHTML(exercise.name)}" src="${escapeHTML(media.url)}"></video>`:`<img class="hpe-independent-media" loading="lazy" alt="Demonstração de ${escapeHTML(exercise.name)}" src="${escapeHTML(media.url)}">`;
  }
  function drawPlanPage(){
    const root=document.getElementById('content');if(!root)return;
    const profileStudent=data.students.find(item=>item.id===student);
    const preferredGoal=profileStudent?.goal||hpeProfile?.goal,preferredLevel=profileStudent?.level||hpeProfile?.level;
    const goal=['Hipertrofia','Condicionamento','Força'].includes(preferredGoal)?preferredGoal:'Hipertrofia';
    const level=['Iniciante','Intermediário','Avançado'].includes(preferredLevel)?preferredLevel:'Iniciante';
    const exercises=generatedPlan?.exercises||[];
    const planPreview=generatedPlan?`<section class="card hpe-independent-plan-result"><div class="hpe-independent-plan-head"><div><span class="eyebrow">SUGESTÃO DA IA</span><h2>${escapeHTML(generatedPlan.title||'Treino A')}</h2><p>${escapeHTML(generatedPlan.summary||'Treino geral para revisar antes de salvar.')}</p></div><span class="tag">${Number(generatedPlan.weeklyFrequency)||3} DIAS/SEMANA</span></div><div class="hpe-independent-exercise-grid">${exercises.map((item,index)=>`<article class="hpe-independent-exercise"><span class="hpe-independent-number">${String(index+1).padStart(2,'0')}</span>${previewMedia(item)}<div><b>${escapeHTML(item.name)}</b><p>${Number(item.sets)||3} séries × ${escapeHTML(item.reps||'8–12')} · ${Number(item.rest)||60}s de descanso</p>${item.notes?`<small>${escapeHTML(item.notes)}</small>`:''}</div></article>`).join('')}</div><div class="hpe-independent-plan-actions"><button type="button" onclick="window.hpeIndependentRegenerate()" ${busy?'disabled':''}>Gerar outra sugestão</button><button type="button" class="primary" onclick="window.hpeIndependentSavePlan()">Salvar no meu treino</button></div></section>`:'';
    root.innerHTML=`<section class="hpe-independent-page"><div class="hpe-independent-heading card"><span class="eyebrow">TREINO INICIAL · IA HPE</span><h1>Crie seu plano de treino</h1><p>Escolha seu objetivo, experiência e frequência. A IA monta uma sugestão usando movimentos com demonstrações que já existem no app.</p><form id="hpeIndependentPlanForm" class="hpe-independent-form"><label>Objetivo<select name="goal"><option ${goal==='Hipertrofia'?'selected':''}>Hipertrofia</option><option ${goal==='Condicionamento'?'selected':''}>Condicionamento</option><option ${goal==='Força'?'selected':''}>Força</option></select></label><label>Nível<select name="level"><option ${level==='Iniciante'?'selected':''}>Iniciante</option><option ${level==='Intermediário'?'selected':''}>Intermediário</option><option ${level==='Avançado'?'selected':''}>Avançado</option></select></label><label>Dias de treino por semana<select name="days"><option value="2">2 dias</option><option value="3" selected>3 dias</option></select></label><button class="primary" type="submit" ${busy||availability===false?'disabled':''}>${busy?'Montando seu treino…':'✦ Gerar sugestão com IA'}</button></form><p class="hpe-independent-status" id="hpeIndependentPlanStatus" role="status" aria-live="polite">${escapeHTML(statusMessage||(availability===null?'Conferindo disponibilidade da IA…':independent()?'A sugestão só será adicionada ao seu treino quando você tocar em “Salvar no meu treino”.':'A sugestão será um rascunho para conversar com seu personal e não altera o treino atual.'))}</p><p class="note">Sugestão geral, sem avaliação clínica ou acompanhamento individual. Se você tiver dor, lesão, gravidez ou condição de saúde, converse com um profissional antes de treinar. Interrompa se sentir dor.</p></div>${planPreview}</section>`;
    if(canUseStudentAI()&&!independent()&&generatedPlan){
      const actions=root.querySelector('.hpe-independent-plan-actions');
      actions?.querySelector('[onclick="window.hpeIndependentSavePlan()"]')?.remove();
      if(actions){const note=document.createElement('p');note.className='note';note.textContent='Como você tem um personal conectado, esta sugestão é apenas um rascunho para conversar com ele. Seu treino atual não será alterado.';actions.before(note)}
    }
    const form=document.getElementById('hpeIndependentPlanForm');form.onsubmit=generatePlan;
    if(availability===null)void checkAvailability();
  }
  async function generatePlan(event){
    event.preventDefault();if(!canUseStudentAI()||busy)return;
    const form=event.currentTarget,fields=new FormData(form),status=document.getElementById('hpeIndependentPlanStatus'),button=form.querySelector('button');
    const catalog=mediaCatalog();if(catalog.length<12){status.textContent='A biblioteca de demonstrações não está pronta. Atualize o app e tente novamente.';return}
    const {data:sessionResult,error:sessionError}=await hpeAuth.auth.getSession(),session=sessionResult?.session;
    if(sessionError||!session?.access_token){status.textContent='Sua sessão expirou. Entre novamente no HPE.';return}
    busy=true;button.disabled=true;button.textContent='Montando seu treino…';statusMessage='A IA está organizando uma sugestão. Isso pode levar alguns segundos.';status.textContent=statusMessage;
    try{
      const response=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:'generate_plan',goal:fields.get('goal'),level:fields.get('level'),days:Number(fields.get('days')),catalog}),signal:AbortSignal.timeout(55000)});
      const result=await response.json().catch(()=>({}));if(!response.ok||!result.plan||!Array.isArray(result.plan.exercises))throw new Error(result.message||'Não consegui montar um plano agora. Tente novamente.');
      generatedPlan=result.plan;availability=true;statusMessage=independent()?'Revise a sugestão. Ela só será salva quando você escolher “Salvar no meu treino”.':'Revise a sugestão com seu personal; ela não altera seu treino atual.';
    }catch(error){statusMessage=error?.name==='AbortError'?'A resposta demorou demais. Tente novamente.':error?.message||'Não consegui conectar à IA.'}
    finally{busy=false;drawPlanPage()}
  }
  window.hpeIndependentRegenerate=()=>{generatedPlan=null;drawPlanPage()};
  window.hpeIndependentSavePlan=()=>{
    if(!independent()||!generatedPlan?.exercises?.length)return;
    const saved=generatedPlan.exercises.map(item=>({name:item.name,sets:Number(item.sets)||3,reps:String(item.reps||'8–12'),weight:0,rest:Number(item.rest)||60,gif:'',video:'',muscle:String(item.group||''),notes:String(item.notes||'')}));
    data.plans[student]=saved;const profileStudent=data.students.find(item=>item.id===student);if(profileStudent){profileStudent.goal=generatedPlan.goal||profileStudent.goal;profileStudent.level=generatedPlan.level||profileStudent.level}
    data.studentGoals[student]={...(data.studentGoals[student]||{}),weekly:Number(generatedPlan.weeklyFrequency)||3};save();generatedPlan=null;window.go('treinos');toast('Treino salvo. As demonstrações e o descanso estão prontos.');
  };
  const originalRender=render;
  render=function hpeIndependentRender(){originalRender();renderNav();if(!canUseStudentAI())return;if(page==='independent-plan')drawPlanPage();else if(page==='inicio'&&independent())renderHomeCard()};
  const originalGo=window.go;
  window.go=function hpeIndependentGo(nextPage){if(nextPage==='independent-plan'){if(!canUseStudentAI())return originalGo('inicio');page=nextPage;render();return}return originalGo(nextPage)};
})();
