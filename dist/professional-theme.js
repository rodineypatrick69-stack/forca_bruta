(()=>{
 const update=()=>{
  const key=typeof page==='string'?page:'inicio';
  const group=document.body.classList.contains('signed-out')?'training':/financ|licenc|admin|avali/.test(key)?'records':/aluno|intera|agenda/.test(key)?'coaching':/evolu|perfil/.test(key)?'progress':'training';
  if(document.body.dataset.background!==group)document.body.dataset.background=group;
 };
 new MutationObserver(update).observe(document.querySelector('#content'),{childList:true,subtree:true});
 new MutationObserver(update).observe(document.body,{attributes:true,attributeFilter:['class']});
 update();
})();
