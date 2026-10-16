window.activePersonalId='personal-demo';
function ownsStudent(id){return data.students.some(s=>s.id===Number(id)&&(s.personalId||'personal-demo')===window.activePersonalId)}
function visibleStudents(){return role==='personal'?data.students.filter(s=>(s.personalId||'personal-demo')===window.activePersonalId):data.students}
