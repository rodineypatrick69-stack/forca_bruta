// Drafts belong to one personal, student and training division at a time.
let hpeBatchScope='',hpeBatchItems=new Map();
function hpeBatchContext(){return role==='personal'&&!document.body.classList.contains('signed-out')&&ownsStudent(student)?`${window.activePersonalId}:${student}:${window.currentTrainingBlock||'A'}`:''}
function hpeBatchSync(){const scope=hpeBatchContext();if(scope!==hpeBatchScope){hpeBatchItems.clear();hpeBatchScope=scope}return scope}
function hpeBatchKey(name){return window.hpeExerciseNameKey(name)}
function hpeBatchChoice(muscle,index,name){const checked=hpeBatchItems.has(hpeBatchKey(name));return `<label class="batch-choice"><input type="checkbox" data-batch-muscle="${muscle}" data-batch-index="${index}" ${checked?'checked':''} aria-label="Selecionar ${esc(name)}" onchange="hpeToggleBatch('${muscle}',${index},this.checked)"><span>Selecionar</span></label>`}
function hpeBatchToolbar(){return `<div class="batch-toolbar"><p role="status"><strong id="batch-count">${hpeBatchItems.size}</strong> exercício(s) selecionado(s)</p><div><button id="batch-review" class="primary" onclick="hpeReviewBatch()" ${hpeBatchItems.size?'':'disabled'}>Configurar e adicionar selecionados</button><button onclick="hpeClearBatch()">Limpar seleção</button></div><small>Selecione em vários grupos musculares. Os exercícios serão adicionados juntos após a revisão.</small></div>`}
function hpeBatchPaint(){document.querySelectorAll('[data-batch-muscle]').forEach(input=>{const name=muscleLibrary[input.dataset.batchMuscle]?.exercises[Number(input.dataset.batchIndex)];input.checked=hpeBatchItems.has(hpeBatchKey(name));input.closest('.exercise')?.classList.toggle('batch-selected',input.checked)});const count=document.getElementById('batch-count');if(count)count.textContent=hpeBatchItems.size;const review=document.getElementById('batch-review');if(review)review.disabled=!hpeBatchItems.size}
window.hpeToggleBatch=(muscle,index,selected)=>{
 if(!hpeBatchSync())return;const name=muscleLibrary[muscle]?.exercises[index];if(!name||!hpeHasDemonstration({name}))return;
 const key=hpeBatchKey(name);if(selected){if(!hpeBatchItems.has(key))hpeBatchItems.set(key,{name,muscle,sets:3,reps:'12',weight:0,rest:60,notes:'',gif:'',video:''})}else hpeBatchItems.delete(key);
 hpeBatchPaint();
};
window.hpeClearBatch=()=>{hpeBatchItems.clear();hpeBatchPaint()};
function hpeBatchValid(x){return Number.isInteger(x.sets)&&x.sets>=1&&x.sets<=20&&typeof x.reps==='string'&&x.reps.trim().length>0&&x.reps.length<=150&&Number.isFinite(x.weight)&&x.weight>=0&&x.weight<=1000&&Number.isInteger(x.rest)&&x.rest>=0&&x.rest<=600&&x.notes.length<=2000&&hpeHasDemonstration(x)}
window.hpeReviewBatch=()=>{
 if(!hpeBatchSync()||!hpeBatchItems.size)return;
 const scope=hpeBatchScope,items=[...hpeBatchItems.values()];
 modal(`<h2>Revisar ${items.length} exercícios</h2><p>Para ${esc(current().name)} · Treino ${esc(window.currentTrainingBlock||'A')}. Ajuste a prescrição de cada exercício e adicione todos de uma vez.</p><form id="batch-form">${items.map((x,i)=>`<fieldset class="batch-item"><legend>${i+1}. ${esc(x.name)}</legend>${hpeMotionSquare(x)}<div class="batch-fields"><label>Séries<input data-item="${i}" name="sets" type="number" min="1" max="20" value="${x.sets}" required></label><label>Repetições / tempo<input data-item="${i}" name="reps" value="${esc(x.reps)}" maxlength="150" required></label><label>Carga (kg)<input data-item="${i}" name="weight" type="number" min="0" max="1000" step="0.5" value="${x.weight}" required></label><label>Descanso (s)<input data-item="${i}" name="rest" type="number" min="0" max="600" value="${x.rest}" required></label></div><label>Orientação<textarea data-item="${i}" name="notes" maxlength="2000">${esc(x.notes)}</textarea></label></fieldset>`).join('')}<p id="batch-error" role="alert"></p><div class="batch-form-actions"><button type="button" onclick="document.getElementById('modal').close()">Continuar selecionando</button><button class="primary">Adicionar ${items.length} exercícios ao treino</button></div></form>`);
 const form=document.getElementById('batch-form');
 const capture=()=>form.querySelectorAll('[data-item]').forEach(input=>{const x=items[Number(input.dataset.item)];x[input.name]=['sets','weight','rest'].includes(input.name)?Number(input.value):input.value});
 form.addEventListener('input',capture);
 form.onsubmit=event=>{
  event.preventDefault();capture();
  if(scope!==hpeBatchContext()){document.getElementById('batch-error').textContent='O aluno ou a divisão mudou. Feche e selecione novamente.';return}
  if(!items.every(hpeBatchValid)){document.getElementById('batch-error').textContent='Confira séries, repetições, carga e descanso antes de adicionar.';return}
  const button=form.querySelector('button.primary');if(button.disabled)return;button.disabled=true;
  plan().push(...items.map(x=>({...x,reps:x.reps.trim()})));save();hpeBatchItems.clear();document.getElementById('modal').close();trainingTab='lista';render();toast(`${items.length} exercícios adicionados com a configuração revisada.`);
 };
};
const batchRender=render;render=function(){hpeBatchSync();batchRender();if(role==='personal'&&page==='treinos'&&trainingTab==='exercicios'){document.querySelector('.exercise-search')?.insertAdjacentHTML('beforebegin',hpeBatchToolbar());hpeBatchPaint()}};
