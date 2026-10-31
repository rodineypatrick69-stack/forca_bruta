// Use the same media resolver for the picker, templates and saved workout plans.
// A temporary loading/network error never deletes an exercise.
function hpeHasDemonstration(exercise){return !!hpeExerciseMedia(exercise)||/^https:\/\//i.test(exercise.video||'')}
for(const group of Object.values(muscleLibrary)){
 const indices=group.exercises.map((name,i)=>hpeHasDemonstration({name})?i:-1).filter(i=>i>=0);
 group.exercises=indices.map(i=>group.exercises[i]);
 group.portions=indices.map(i=>group.portions?.[i]||'');
 group.groups=(group.groups||[]).map(g=>({...g,exercises:g.exercises.filter(name=>hpeHasDemonstration({name}))})).filter(g=>g.exercises.length);
}
for(const model of window.hpeTrainingModels||[]){
 let removed=0;
 for(const block of model.blocks){const before=block.exercises.length;block.exercises=block.exercises.filter(hpeHasDemonstration);removed+=before-block.exercises.length}
 model.blocks=model.blocks.filter(b=>b.exercises.length);
 if(removed)model.notes.push(`${removed} exercícios sem demonstração foram retirados desta ficha. Revise a divisão antes de aplicar.`);
}
window.hpeTrainingModels=(window.hpeTrainingModels||[]).filter(m=>m.blocks.length);
function hpeCleanMissingDemos(){
 // Keep exercise indices stable for the entire active session.
 if(workoutStarted||document.body.classList.contains('signed-out'))return 0;
 let count=0;
 const clean=(items,owner,block)=>{
  if(!Array.isArray(items))return;
  for(let i=items.length-1;i>=0;i--){
   if(hpeHasDemonstration(items[i]))continue;
   // Retain the original prescription for recovery; never touch session history.
   data.removedDemoExercises??=[];
   data.removedDemoExercises.push({student:owner,block,index:i,exercise:{...items[i]},reason:'missing-demonstration',removedAt:new Date().toISOString()});
   items.splice(i,1);count++;
  }
 };
 for(const [owner,items] of Object.entries(data.plans||{}))clean(items,owner,'A');
 for(const [owner,blocks] of Object.entries(data.alternatePlans||{}))for(const [block,items] of Object.entries(blocks))clean(items,owner,block);
 if(count){done.clear();activeExercise=0;save()}
 return count;
}
const availabilityRender=render;
render=function(){const removed=hpeCleanMissingDemos();availabilityRender();if(removed)toast(`${removed} exercício(s) sem demonstração retirado(s) dos treinos.`)};
const availabilityEdit=window.editExercise;
window.editExercise=(index,preset)=>{
 availabilityEdit(index,preset);
 const form=document.querySelector('#exerciseForm');if(!form)return;
 const submit=form.onsubmit;
 form.onsubmit=event=>{
  const fields=new FormData(form),exercise={name:String(fields.get('name')||'').trim(),gif:String(fields.get('gif')||'').trim(),video:String(fields.get('video')||'').trim()};
  if(!hpeHasDemonstration(exercise)){event.preventDefault();toast('Escolha um exercício com demonstração ou adicione seu GIF/vídeo.');return}
  return submit(event);
 };
};
