for(const key of new Set(suppliedCatalog.map(g=>g.muscle))){const groups=suppliedCatalog.filter(g=>g.muscle===key);muscleLibrary[key].groups=groups;muscleLibrary[key].exercises=groups.flatMap(g=>g.exercises);muscleLibrary[key].portions=groups.flatMap(g=>g.exercises.map(()=>g.label))}
let selectedPortion='';
function muscleFilters(){const groups=muscleLibrary[selectedMuscle].groups||[];return groups.length?`<label style="margin-bottom:20px">Filtrar por porção muscular<select aria-label="Porção muscular" onchange="filterPortion(this.value)"><option value="">Todas as porções</option>${groups.map(g=>`<option value="${esc(g.label)}" ${selectedPortion===g.label?'selected':''}>${esc(g.label)}</option>`).join('')}</select></label>`:''}
window.filterPortion=value=>{selectedPortion=value;render()};
const originalChooseMuscle=window.chooseMuscle;window.chooseMuscle=key=>{selectedPortion='';originalChooseMuscle(key)};
const originalChangeBodySide=window.changeBodySide;window.changeBodySide=side=>{selectedPortion='';originalChangeBodySide(side)};

