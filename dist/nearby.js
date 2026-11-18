(() => {
  const state={visible:false,statusLoaded:false,busy:false,people:[],radius:10,heading:null,compassStarted:false};
  const directions=['N','NE','E','SE','S','SW','W','NW'];
  const direction=value=>directions[Math.round(((Number(value)||0)%360)/45)%8];
  const status=message=>{const el=document.getElementById('hpeNearbyStatus');if(el)el.textContent=message;};
  const getPosition=()=>new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(new Error('Este navegador não oferece acesso ao GPS.'));
    navigator.geolocation.getCurrentPosition(
      p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude}),
      e=>reject(new Error(e.code===1?'Permita o acesso à localização nas configurações do navegador.':'Não foi possível obter sua localização. Confira o GPS e tente novamente.')),
      {enableHighAccuracy:true,timeout:15000,maximumAge:60000}
    );
  });
  const call=body=>{
    if(typeof hpeAccountsCall!=='function')return Promise.reject(new Error('A conexão segura com o serviço ainda não está pronta.'));
    return hpeAccountsCall(body);
  };
  const radar=people=>{
    const markers=people.slice(0,30).map((item,index)=>{
      const angle=(Number(item.bearing_deg)||0)*Math.PI/180;
      const r=Math.min(1,Number(item.distance_km)/state.radius)*40;
      const left=Math.max(8,Math.min(92,50+Math.sin(angle)*r)),top=Math.max(8,Math.min(92,50-Math.cos(angle)*r));
      const kind=item.role==='personal'?'coach':'student',label=item.role==='personal'?'Personal':'Aluno';
      return '<span class="hpe-nearby-dot '+kind+'" style="left:'+left.toFixed(1)+'%;top:'+top.toFixed(1)+'%" title="'+esc(label+': '+item.name)+'" aria-hidden="true">'+(index+1)+'</span>';
    }).join('');
    return '<div class="hpe-nearby-radar" role="img" aria-label="Bússola com perfis próximos orientados pelo norte"><span class="hpe-nearby-north">N</span><span class="hpe-nearby-east">L</span><span class="hpe-nearby-south">S</span><span class="hpe-nearby-west">O</span><span class="hpe-nearby-ring ring-one"></span><span class="hpe-nearby-ring ring-two"></span><span class="hpe-nearby-center">Você</span>'+markers+'</div>';
  };
  const row=(item,index)=>{
    const kmText=Number(item.distance_km).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+' km';
    const label=item.role==='personal'?'Personal cadastrado':'Aluno procurando personal';
    const contact=item.whatsapp?'<a class="hpe-nearby-route" href="https://wa.me/'+String(item.whatsapp).replace(/\D/g,'')+'" target="_blank" rel="noopener noreferrer">WhatsApp</a>':'';
    return '<li class="hpe-nearby-row"><span class="hpe-nearby-number">'+(index+1)+'</span><span class="hpe-nearby-item"><b>'+esc(item.name||label)+'</b><small>'+label+' · '+kmText+' · '+direction(item.bearing_deg)+' ('+Math.round(Number(item.bearing_deg)||0)+'°)</small></span>'+contact+'</li>';
  };
  const paint=()=>{
    const radarEl=document.getElementById('hpeNearbyRadar'),list=document.getElementById('hpeNearbyPeople');
    if(radarEl)radarEl.innerHTML=radar(state.people);
    if(list)list.innerHTML=state.people.length?state.people.map(row).join(''):'<li class="hpe-nearby-empty">Nenhum perfil próximo compartilhou a localização nas últimas 24 horas.</li>';
  };
  const renderCard=()=>{
    const role=typeof hpeProfile!=='undefined'?hpeProfile?.role:'';
    if(!['aluno','personal'].includes(role)||typeof page==='undefined'||page!=='inicio')return;
    const content=document.getElementById('content');if(!content||document.getElementById('hpeNearbyCard'))return;
    const student=role==='aluno',target=student?'personais próximos':'alunos sem personal';
    const consent=student?'Seu nome e WhatsApp serão mostrados a personais disponíveis que você permitir localizar.':'Seu nome e WhatsApp serão mostrados a alunos que procuram personal.';
    const card=document.createElement('section');card.id='hpeNearbyCard';card.className='card hpe-nearby-card';
    card.innerHTML='<div class="hpe-nearby-heading"><div><span class="eyebrow">BUSCA POR PERTO</span><h2>Encontre '+(student?'personais próximos':'alunos próximos')+'</h2><p>Use o GPS do aparelho para ver direções e distâncias aproximadas.</p></div><span class="hpe-nearby-compass-icon" aria-hidden="true">⌖</span></div>'+
      '<div class="hpe-nearby-controls"><label>Distância<select id="hpeNearbyRadius"><option value="5">Até 5 km</option><option value="10" selected>Até 10 km</option><option value="20">Até 20 km</option></select></label><button class="primary" id="hpeNearbySearchButton" type="button">⌖ Buscar perfis perto de mim</button></div>'+
      '<label class="hpe-nearby-consent"><input id="hpeNearbyVisible" type="checkbox"><span><b>Quero aparecer para '+target+'.</b><small>'+consent+' A localização compartilhada expira após 24 horas; desligue quando quiser.</small></span></label>'+
      '<p class="hpe-nearby-status" id="hpeNearbyStatus" role="status">A busca só começa quando você tocar no botão. O GPS será solicitado pelo navegador.</p>'+
      '<div class="hpe-nearby-results"><div><div class="hpe-nearby-result-heading"><h3>Orientação</h3><button type="button" class="hpe-nearby-compass-button" id="hpeCompassButton">Calibrar bússola do aparelho</button></div><div id="hpeNearbyRadar" class="hpe-nearby-radar-wrap"><span class="hpe-nearby-initial">Os resultados aparecerão aqui.</span></div><small class="hpe-nearby-legend">A bússola aponta para o norte; os pontos mostram a direção. Distâncias aproximadas.</small></div>'+
      '<div><h3>'+(student?'Personais cadastrados':'Alunos procurando personal')+'</h3><ol id="hpeNearbyPeople" class="hpe-nearby-list"><li class="hpe-nearby-empty">Toque em buscar para iniciar.</li></ol>'+
      (student?'<p class="hpe-nearby-attribution">A localização de academias públicas depende da conexão com um serviço de mapas.</p>':'')+'</div></div>';
    content.insertAdjacentElement('afterbegin',card);
    card.querySelector('#hpeNearbySearchButton').addEventListener('click',scan);
    card.querySelector('#hpeNearbyVisible').addEventListener('change',toggleVisibility);
    card.querySelector('#hpeCompassButton').addEventListener('click',startCompass);
    const radius=card.querySelector('#hpeNearbyRadius');radius.value=String(state.radius);radius.addEventListener('change',()=>{state.radius=Number(radius.value)||10;});
    if(!state.statusLoaded){state.statusLoaded=true;call({action:'discovery_status'}).then(result=>{state.visible=result.visible===true;const box=document.getElementById('hpeNearbyVisible');if(box)box.checked=state.visible;}).catch(error=>status(error.message));}
  };
  async function toggleVisibility(event){
    const enabled=event.target.checked;event.target.disabled=true;
    try{
      if(enabled){status('Solicitando GPS para compartilhar sua posição por até 24 horas…');const p=await getPosition();await call({action:'discovery_visibility',enabled:true,latitude:p.lat,longitude:p.lon});state.visible=true;status('Você está visível na busca por até 24 horas.');}
      else{await call({action:'discovery_visibility',enabled:false});state.visible=false;status('Você não aparece mais na busca.');}
    }catch(error){event.target.checked=!enabled;status(error.message||'Não foi possível atualizar sua visibilidade.');}
    finally{event.target.disabled=false;}
  }
  async function scan(){
    if(state.busy)return;state.busy=true;
    const button=document.getElementById('hpeNearbySearchButton');if(button)button.disabled=true;
    try{
      status('Solicitando sua localização…');const p=await getPosition();
      status('Buscando '+(hpeProfile.role==='aluno'?'personais cadastrados':'alunos sem personal')+' em até '+state.radius+' km…');
      const result=await call({action:'discovery_nearby',latitude:p.lat,longitude:p.lon,radius_km:state.radius});
      state.people=result.results||[];paint();
      status('Busca concluída. Os perfis aparecem apenas com autorização e por até 24 horas.');
    }catch(error){status(error.message||'Não foi possível concluir a busca.');}
    finally{state.busy=false;if(button)button.disabled=false;}
  }
  async function startCompass(){
    if(state.compassStarted)return;
    try{
      const device=window.DeviceOrientationEvent;
      if(!device){status('Este aparelho não oferece bússola digital; as direções usam o norte do mapa.');return;}
      if(typeof device.requestPermission==='function'){
        const permission=await device.requestPermission();
        if(permission!=='granted'){status('A bússola não foi autorizada. As direções continuam apontando para o norte do mapa.');return;}
      }
      const handler=event=>{
        const value=Number.isFinite(event.webkitCompassHeading)?event.webkitCompassHeading:event.absolute&&Number.isFinite(event.alpha)?(360-event.alpha)%360:null;
        if(value===null)return;state.heading=(value+360)%360;
        const radarEl=document.getElementById('hpeNearbyRadar');if(radarEl)radarEl.style.transform='rotate('+(-state.heading)+'deg)';
      };
      window.addEventListener('deviceorientationabsolute',handler,true);window.addEventListener('deviceorientation',handler,true);
      state.compassStarted=true;status('Bússola ativada. Gire o aparelho para acompanhar as direções.');
    }catch{status('Não foi possível ativar a bússola. As direções usam o norte do mapa.');}
  }
  const baseRender=render;
  render=function(){baseRender();renderCard();};
  window.addEventListener('pageshow',renderCard);
})();