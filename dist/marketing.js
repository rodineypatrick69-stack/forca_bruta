(()=>{
 const originalShowLogin=window.showLogin;
 if(typeof originalShowLogin!=='function')return;
 window.showLogin=function(selected=window.loginRole){
  originalShowLogin(selected);
  const story=document.querySelector('.login-story');
  if(!story||story.querySelector('.hpe-marketing'))return;
  story.insertAdjacentHTML('beforeend',`<section class="hpe-marketing"><h2>Treino e acompanhamento no mesmo lugar.</h2><p>Uma rotina mais organizada para quem orienta e mais clareza para quem treina.</p><div class="hpe-audience"><div><b>Para o personal</b><span>Organize alunos, monte planos e acompanhe a evolução.</span></div><div><b>Para o aluno</b><span>Consulte seu treino, veja os movimentos e registre seu progresso.</span></div></div><button class="primary hpe-demo-cta" type="button" onclick="hpeShowPublicDemo()">Ver demonstração do app</button></section>`);
 };
 const studentInvite=new URLSearchParams(location.search).get('perfil')==='aluno';
 if(document.body.classList.contains('signed-out'))window.showLogin(studentInvite?'aluno':undefined);
 window.hpeShowPublicDemo=()=>{
  const move=window.hpeExerciseMedia?.({name:'Supino reto'}),movement=move&&window.hpeMediaElement?window.hpeMediaElement(move,'Supino reto',true):'<div class="hpe-demo-placeholder">Demonstração de exercício</div>';
  window.modal(`<div class="hpe-public-demo"><span class="eyebrow">PRÉVIA DO APLICATIVO</span><h2>Veja como o treino fica organizado</h2><p>Uma amostra da experiência que personal e aluno encontram no HPE.</p><div class="hpe-demo-workout"><div class="hpe-demo-movement">${movement}</div><div class="hpe-demo-details"><span class="tag">TREINO A · PEITO E TRÍCEPS</span><h3>Supino reto</h3><p>4 séries · 10 repetições · descanso de 60 s</p><div class="hpe-demo-row"><b>Crucifixo inclinado</b><span>3 × 12</span></div><div class="hpe-demo-row"><b>Tríceps na polia</b><span>3 × 12</span></div><div class="hpe-demo-progress"><span>REGISTRO DE EVOLUÇÃO</span><b>Treino concluído · 42 min</b></div></div></div><p class="hpe-demo-note">Prévia ilustrativa. O treino real é definido pelo personal.</p><div class="hpe-demo-actions"><button type="button" onclick="$('#modal').close()">Voltar</button><button class="primary" type="button" onclick="$('#modal').close();showLogin('aluno')">Sou aluno</button><button class="primary" type="button" onclick="$('#modal').close();showLogin('personal')">Sou personal</button></div></div>`);
 };
})();
