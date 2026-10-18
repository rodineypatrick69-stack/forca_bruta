// Exact aliases only: different equipment and variations must never share a guessed demo.
const hpeMediaCatalog=[
 ['supino-reto-barra',['Supino reto','Supino Reto com Barra']],
 ['supino-reto-halteres',['Supino Reto com Halteres','Supino halter']],
 ['supino-inclinado-barra',['Supino Inclinado com Barra','Supino inclinado']],
 ['supino-inclinado-30-halteres',['Supino Inclinado com Halteres','Supino Inclinado 30']],
 ['supino-declinado-halteres',['Supino Declinado com Halteres']],
 ['supino-sentado-maquina',['Supino Sentado','Supino Sentado na Máquina']],
 ['voador-peitoral',['Voador / Pec Deck / Borboleta','Voador','Peck deck','Voador peitoral']],
 ['crucifixo-crossover-alto',['Crossover na Polia Alta (Puxando de cima para baixo)','Crucifixo Crossover Polia Alta']],
 ['cadeira-extensora',['Cadeira Extensora']],
 ['agachamento-livre-barra',['Agachamento Livre','Agachamento Livre com Barra']],
 ['agachamento-frontal',['Agachamento Frontal','Agachamento Frontal (Front Squat)']],
 ['agachamento-smith',['Agachamento no Smith']],
 ['agachamento-hack',['Agachamento Hack','Hack Machine']],
 ['agachamento-goblet',['Agachamento Goblet','Agachamento Goblet (Halter segurado à frente do peito)']],
 ['belt-squat',['Agachamento com cinto — belt squat','Belt Squat']]
];
function hpeMediaName(name){return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ')}
const hpeMediaByName=new Map(hpeMediaCatalog.flatMap(([file,names])=>names.map(name=>[hpeMediaName(name),`exercise-media/${file}.mp4`])));
function hpeSafeMedia(url){if(!url)return '';try{const u=new URL(url,location.href);return u.protocol==='https:'||u.origin===location.origin?u.href:''}catch{return ''}}
function hpeExerciseMedia(x){const gif=hpeSafeMedia(x.gif);if(gif)return {url:gif,type:'image'};const video=hpeSafeMedia(x.video);if(video&&/\.(mp4|webm|ogg)$/i.test(new URL(video).pathname))return {url:video,type:'video'};const imported=window.HPE_EXERCISE_DEMOS?.[window.hpeExerciseNameKey?.(x.name)];if(imported){const url=hpeSafeMedia(imported);if(url)return {url,type:'image'}}const file=hpeMediaByName.get(hpeMediaName(x.name));return file?{url:new URL(file,location.href).href,type:'video'}:null}
function hpeMediaElement(media,name,large=false){return media.type==='video'?`<video ${large?'controls autoplay':''} muted loop playsinline preload="${large?'auto':'none'}" aria-label="Movimento de ${esc(name)}" src="${esc(media.url)}" onerror="hpeMediaFailed(this)"></video>`:`<img src="${esc(media.url)}" alt="Movimento de ${esc(name)}" loading="lazy" onerror="hpeMediaFailed(this)">`}
window.hpeMediaFailed=element=>{const box=element.closest('.hpe-motion');if(box){box.classList.add('unavailable');box.innerHTML='<span>Demonstração indisponível</span>'}else element.replaceWith(Object.assign(document.createElement('p'),{textContent:'Não foi possível carregar a demonstração. Confira sua conexão ou peça ao personal para atualizar o arquivo.'}))};
function hpeMotionSquare(x){const media=hpeExerciseMedia(x);return media?`<button type="button" class="hpe-motion" data-motion-name="${esc(x.name)}" data-motion-url="${esc(media.url)}" data-motion-type="${media.type}" aria-label="Ampliar movimento de ${esc(x.name)}">${hpeMediaElement(media,x.name)}<span>⤢ Ampliar</span></button>`:'<div class="hpe-motion unavailable"><span>Demonstração não cadastrada</span></div>'}
const motionDialog=document.createElement('dialog');motionDialog.id='hpe-motion-dialog';motionDialog.innerHTML='<button type="button" class="close" aria-label="Fechar demonstração">×</button><div class="hpe-motion-body"></div>';document.body.append(motionDialog);
let motionTrigger;
function hpeOpenMotion(media,name){motionTrigger=document.activeElement;motionDialog.querySelector('.hpe-motion-body').innerHTML=`<span class="eyebrow">DEMONSTRAÇÃO DO MOVIMENTO</span><h2>${esc(name)}</h2>${hpeMediaElement(media,name,true)}<p>Use a tela na horizontal para visualizar o movimento maior.</p>`;motionDialog.showModal()}
motionDialog.querySelector('.close').onclick=()=>motionDialog.close();motionDialog.addEventListener('click',event=>{if(event.target===motionDialog){const r=motionDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)motionDialog.close()}});motionDialog.addEventListener('close',()=>{motionDialog.querySelector('.hpe-motion-body').innerHTML='';motionTrigger?.focus()});
document.addEventListener('click',event=>{const b=event.target.closest('button.hpe-motion');if(b)hpeOpenMotion({url:b.dataset.motionUrl,type:b.dataset.motionType},b.dataset.motionName)});
function hpeStudentOverview(){return `<section class="card hpe-session-list"><h2>Exercícios do treino</h2><p>Confira séries, repetições e o movimento de cada exercício.</p>${plan().map((x,i)=>`<div class="exercise ${done.has(i)?'motion-complete':''}"><span class="num">${done.has(i)?'✓':i+1}</span><div class="details"><b>${esc(x.name)}</b><p>${x.sets} séries × ${esc(x.reps)} repetições · ${x.weight} kg</p>${x.notes?`<p>${esc(x.notes)}</p>`:''}</div>${hpeMotionSquare(x)}</div>`).join('')}</section>`}
const motionRender=render;render=function(){motionRender();if(document.body.classList.contains('signed-out')||page!=='treinos')return;document.querySelectorAll('#content .exercise').forEach(row=>{if(row.querySelector('.hpe-motion'))return;const name=row.querySelector('.details b')?.textContent;if(!name)return;const item=row.closest('#muscle-exercises')?{name}:plan().find(x=>x.name===name)||{name};row.classList.add('with-motion');row.querySelector('.details').insertAdjacentHTML('beforebegin',hpeMotionSquare(item))});if(role==='aluno'&&workoutStarted){const runner=document.querySelector('.series-runner'),x=plan()[activeExercise];if(runner&&x)runner.querySelector('h2').insertAdjacentHTML('afterend',`<div class="hpe-active-motion">${hpeMotionSquare(x)}</div>`);document.querySelector('.workout-controls')?.insertAdjacentHTML('afterend',hpeStudentOverview())}hpeObserveMotion()};
const hpeMotionObserver=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{if(isIntersecting)target.play().catch(()=>{});else target.pause()}),{rootMargin:'100px'});
function hpeObserveMotion(){hpeMotionObserver.disconnect();document.querySelectorAll('#content .hpe-motion video').forEach(video=>hpeMotionObserver.observe(video))}
const motionDemo=window.demo;window.demo=index=>{const x=plan()[index];if(!x)return;const media=hpeExerciseMedia(x);if(media)hpeOpenMotion(media,x.name);else if(x.video)motionDemo(index);else modal(`<h2>${esc(x.name)}</h2><p>Demonstração não cadastrada. Peça ao seu personal para adicionar o GIF ou vídeo deste exercício.</p>`)};
