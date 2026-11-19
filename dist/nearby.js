(() => {
  const state={visible:false,statusLoaded:false,busy:false,people:[],gyms:[],gymSearchFailed:false,radius:10,position:null,heading:null,compassStarted:false,map:null,mapLayer:null,mapContainer:null};
  const directions=['N','NE','E','SE','S','SW','W','NW'];
  const direction=value=>directions[Math.round(((Number(value)||0)%360)/45)%8];
  const radians=x=>x*Math.PI/180;
  const distance=(a,b)=>{const dLat=radians(b.lat-a.lat),dLon=radians(b.lon-a.lon),lat1=radians(a.lat),lat2=radians(b.lat),h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 12742*Math.asin(Math.sqrt(Math.min(1,h)));};
  const bearing=(a,b)=>{const lat1=radians(a.lat),lat2=radians(b.lat),dlon=radians(b.lon-a.lon);return (Math.atan2(Math.sin(dlon)*Math.cos(lat2),Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dlon))*180/Math.PI+360)%360;};
  const status=message=>{const el=document.getElementById('hpeNearbyStatus');if(el)el.textContent=message;};
  const getPosition=()=>new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(new Error('Este navegador não oferece acesso ao GPS.'));
    navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude}),e=>reject(new Error(e.code===1?'Permita o acesso à localização nas configurações do navegador.':'Não foi possível obter sua localização. Confira o GPS e tente novamente.')),{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
  });
  const call=body=>typeof hpeAccountsCall==='function'?hpeAccountsCall(body):Promise.reject(new Error('A conexão segura com o serviço ainda não está pronta.'));
  const findGyms=async(position,radius)=>{
    const meters=Math.min(20000,Math.max(1000,radius*1000));
    const approximatePosition={lat:Math.round(position.lat*1000)/1000,lon:Math.round(position.lon*1000)/1000};
    const around='(around:'+meters+','+approximatePosition.lat+','+approximatePosition.lon+')';
    const selectors=[
      'nwr["leisure"="fitness_centre"]'+around,
      'nwr["amenity"="gym"]'+around,
      'nwr["leisure"="sports_centre"]["sport"~"fitness|bodybuilding|weightlifting|strength_training",i]'+around,
      'nwr["sport"~"fitness|bodybuilding|weightlifting|strength_training",i]'+around
    ];
    const query='[out:json][timeout:25];('+selectors.join(';')+');out center tags;';
    const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter'];
    let data=null;
    for(let i=0;i<endpoints.length;i++){
      try{
        const response=await fetch(endpoints[i],{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(query),signal:AbortSignal.timeout(30000)});
        if(!response.ok)throw new Error('HTTP '+response.status);
        data=await response.json();break;
      }catch(error){
        if(i<endpoints.length-1)status('A busca de academias está lenta; tentando outra fonte do OpenStreetMap…');
      }
    }
    if(!data)throw new Error('O serviço de academias está temporariamente indisponível. Tente novamente em instantes.');
    const seen=new Set(),results=[];
    for(const feature of data.elements||[]){
      const lat=feature.lat??feature.center?.lat,lon=feature.lon??feature.center?.lon;if(typeof lat!=='number'||typeof lon!=='number')continue;
      const key=Math.round(lat*10000)+':'+Math.round(lon*10000);if(seen.has(key))continue;seen.add(key);
      const target={lat,lon},name=feature.tags?.name||feature.tags?.brand||feature.tags?.operator||'Academia';
      results.push({name,lat,lon,distance_km:distance(position,target),bearing_deg:bearing(position,target)});
    }
    return results.filter(gym=>gym.distance_km<=meters/1000).sort((a,b)=>a.distance_km-b.distance_km).slice(0,50);
  };
  const osmMap=item=>'https://www.openstreetmap.org/?mlat='+item.lat+'&mlon='+item.lon+'#map=17/'+item.lat+'/'+item.lon;
  const googleMapsSearch=position=>{const lat=(Math.round(position.lat*1000)/1000).toFixed(3),lon=(Math.round(position.lon*1000)/1000).toFixed(3);return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent('academias perto de '+lat+','+lon);};
  let leafletLoad=null;
  const loadMapLibrary=()=>{
    if(window.L)return Promise.resolve(window.L);
    if(leafletLoad)return leafletLoad;
    leafletLoad=new Promise((resolve,reject)=>{
      const cssId='hpeLeafletCss';
      let cssPromise=Promise.resolve();
      if(!document.getElementById(cssId)){
        cssPromise=new Promise((done,fail)=>{
          const link=document.createElement('link');link.id=cssId;link.rel='stylesheet';
          link.href='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
          link.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          link.crossOrigin='anonymous';link.onload=done;link.onerror=()=>fail(new Error('Não foi possível carregar o estilo do mapa.'));
          document.head.appendChild(link);
        });
      }
      const scriptPromise=new Promise((done,fail)=>{
        const script=document.createElement('script');script.dataset.hpeLeaflet='true';
        script.src='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
        script.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
        script.crossOrigin='anonymous';script.async=true;
        script.onload=()=>window.L?done():fail(new Error('A biblioteca do mapa não iniciou.'));
        script.onerror=()=>fail(new Error('Não foi possível carregar o mapa interativo.'));
        document.head.appendChild(script);
      });
      Promise.all([cssPromise,scriptPromise]).then(()=>resolve(window.L)).catch(error=>{
        document.getElementById(cssId)?.remove();
        document.querySelector('script[data-hpe-leaflet]')?.remove();
        leafletLoad=null;reject(error);
      });
    });
    return leafletLoad;
  };
  const profilePoint=(origin,item)=>{
    const distanceKm=Math.max(0,Number(item.distance_km)||0),theta=radians(Number(item.bearing_deg)||0),delta=distanceKm/6371.0088;
    const lat1=radians(origin.lat),lon1=radians(origin.lon);
    const lat2=Math.asin(Math.sin(lat1)*Math.cos(delta)+Math.cos(lat1)*Math.sin(delta)*Math.cos(theta));
    const lon2=lon1+Math.atan2(Math.sin(theta)*Math.sin(delta)*Math.cos(lat1),Math.cos(delta)-Math.sin(lat1)*Math.sin(lat2));
    return {lat:lat2*180/Math.PI,lon:((lon2*180/Math.PI+540)%360)-180};
  };
  const popupContent=(titleText,detailText,url,urlText)=>{
    const root=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('small');
    title.textContent=titleText;detail.textContent=detailText;root.append(title,detail);
    if(url){const link=document.createElement('a');link.href=url;link.textContent=urlText||'Abrir';link.target='_blank';link.rel='noopener noreferrer';root.append(link);}
    return root;
  };
  const mapIcon=kind=>{
    const label=kind==='you'?'V':kind==='gym'?'G':kind==='coach'?'P':'A';
    return L.divIcon({className:'hpe-nearby-leaflet-icon',html:'<span class="hpe-nearby-marker '+kind+'">'+label+'</span>',iconSize:[32,32],iconAnchor:[16,16],popupAnchor:[0,-13]});
  };
  const renderMap=()=>{
    const container=document.getElementById('hpeNearbyMap');if(!container||!state.position)return;
    if(!window.L){container.innerHTML=radar(state.people.map(x=>({...x,kind:'profile'})).concat(state.gyms.map(x=>({...x,kind:'gym'}))));return;}
    if(state.map&&state.mapContainer!==container){state.map.remove();state.map=null;state.mapLayer=null;state.mapContainer=null;}
    const center=[state.position.lat,state.position.lon],zoom=state.radius<=5?13:state.radius<=10?12:11;
    if(!state.map){
      container.innerHTML='';
      state.map=L.map(container,{scrollWheelZoom:false,zoomControl:true}).setView(center,zoom);
      state.mapContainer=container;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:19,
        attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
      }).addTo(state.map);
      state.mapLayer=L.layerGroup().addTo(state.map);
      const compass=L.control({position:'topright'});
      compass.onAdd=()=>{
        const control=L.DomUtil.create('div','hpe-nearby-map-compass');
        control.id='hpeNearbyHeading';control.setAttribute('aria-label','Indicador do norte');
        control.innerHTML='<span>N</span><b class="hpe-nearby-needle">▲</b>';
        return control;
      };
      compass.addTo(state.map);
    }else state.map.invalidateSize();
    state.mapLayer.clearLayers();
    const searchArea=L.circle(center,{radius:state.radius*1000,color:'#ff7900',weight:1.5,fillColor:'#ff7900',fillOpacity:.045,dashArray:'6 7',interactive:false}).addTo(state.mapLayer);
    const centerMarker=L.marker(center,{icon:mapIcon('you'),title:'Você'}).addTo(state.mapLayer);
    centerMarker.bindPopup(popupContent('Você','Sua posição atual · raio de busca de '+state.radius+' km'));
    for(const person of state.people){
      const point=profilePoint(state.position,person),roleLabel=person.role==='personal'?'Personal cadastrado':'Aluno procurando personal';
      const km=Number(person.distance_km||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+' km';
      const phone=String(person.whatsapp||'').replace(/\D/g,'');
      const marker=L.marker([point.lat,point.lon],{icon:mapIcon(person.role==='personal'?'coach':'student'),title:person.name||roleLabel}).addTo(state.mapLayer);
      marker.bindPopup(popupContent(person.name||roleLabel,roleLabel+' · posição aproximada · '+km+' · '+direction(person.bearing_deg),phone?'https://wa.me/'+phone:'',phone?'WhatsApp':''));
    }
    for(const gym of state.gyms){
      const km=Number(gym.distance_km||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+' km';
      const marker=L.marker([gym.lat,gym.lon],{icon:mapIcon('gym'),title:gym.name||'Academia'}).addTo(state.mapLayer);
      marker.bindPopup(popupContent(gym.name||'Academia','Academia próxima · '+km,osmMap(gym),'Abrir no OpenStreetMap'));
    }
    const bounds=searchArea.getBounds().pad(.08);
    state.map.fitBounds(bounds,{maxZoom:14,padding:[16,16]});
    requestAnimationFrame(()=>{if(state.map&&state.mapContainer===container)state.map.invalidateSize();});
    const needle=document.querySelector('#hpeNearbyHeading .hpe-nearby-needle');
    if(needle&&state.heading!==null)needle.style.transform='rotate('+(-state.heading)+'deg)';
  };
  const centerMap=()=>{
    if(!state.map||!state.position){status('Toque em buscar para carregar o mapa.');return;}
    state.map.setView([state.position.lat,state.position.lon],Math.max(12,state.map.getZoom()),{animate:true});
  };
  const radar=items=>{
    const markers=items.slice(0,30).map((item,index)=>{
      const angle=(Number(item.bearing_deg)||0)*Math.PI/180,r=Math.min(1,Number(item.distance_km)/state.radius)*40;
      const left=Math.max(8,Math.min(92,50+Math.sin(angle)*r)),top=Math.max(8,Math.min(92,50-Math.cos(angle)*r));
      const kind=item.kind==='gym'?'gym':item.role==='personal'?'coach':'student',label=item.kind==='gym'?'Academia':item.role==='personal'?'Personal':'Aluno';
      return '<span class="hpe-nearby-dot '+kind+'" style="left:'+left.toFixed(1)+'%;top:'+top.toFixed(1)+'%" title="'+esc(label+': '+item.name)+'" aria-hidden="true">'+(index+1)+'</span>';
    }).join('');
    return '<div class="hpe-nearby-radar" role="img" aria-label="Bússola com perfis e academias próximos"><span class="hpe-nearby-north">N</span><span class="hpe-nearby-east">L</span><span class="hpe-nearby-south">S</span><span class="hpe-nearby-west">O</span><span class="hpe-nearby-ring ring-one"></span><span class="hpe-nearby-ring ring-two"></span><span class="hpe-nearby-center">Você</span>'+markers+'</div>';
  };
  const row=(item,index,isGym)=>{
    const km=Number(item.distance_km).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+' km',label=isGym?'Academia':item.role==='personal'?'Personal cadastrado':'Aluno procurando personal';
    const link=isGym?'<a class="hpe-nearby-route" href="'+osmMap(item)+'" target="_blank" rel="noopener noreferrer">Ver mapa</a>':item.whatsapp?'<a class="hpe-nearby-route" href="https://wa.me/'+String(item.whatsapp).replace(/\D/g,'')+'" target="_blank" rel="noopener noreferrer">WhatsApp</a>':'';
    return '<li class="hpe-nearby-row"><span class="hpe-nearby-number">'+(index+1)+'</span><span class="hpe-nearby-item"><b>'+esc(item.name||label)+'</b><small>'+label+' · '+km+' · '+direction(item.bearing_deg)+' ('+Math.round(Number(item.bearing_deg)||0)+'°)</small></span>'+link+'</li>';
  };
  const paint=()=>{
    const list=document.getElementById('hpeNearbyPeople'),gyms=document.getElementById('hpeNearbyGyms');
    renderMap();
    if(list)list.innerHTML=state.people.length?state.people.map((p,i)=>row(p,i,false)).join(''):'<li class="hpe-nearby-empty">Nenhum perfil próximo compartilhou a localização nas últimas 24 horas.</li>';
    const gymEmpty=state.gymSearchFailed?'Não foi possível consultar as academias agora.':'O OpenStreetMap não tem academias cadastradas nesta área.';
    const googleLink=state.position?'<br><a class="hpe-nearby-route" href="'+googleMapsSearch(state.position)+'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Buscar academias no Google Maps</a>':'';
    if(gyms)gyms.innerHTML=state.gyms.length?state.gyms.map((g,i)=>row(g,i,true)).join(''):'<li class="hpe-nearby-empty">'+gymEmpty+' '+googleLink+'</li>';
  };
  const renderCard=()=>{
    const role=typeof hpeProfile!=='undefined'?hpeProfile?.role:'';
    if(!['aluno','personal'].includes(role)||typeof page==='undefined'||page!=='inicio')return;
    const content=document.getElementById('content');if(!content||document.getElementById('hpeNearbyCard'))return;
    const student=role==='aluno',target=student?'personais próximos':'alunos sem personal',consent=student?'Seu nome e WhatsApp serão mostrados a personais que você permitir localizar.':'Seu nome e WhatsApp serão mostrados a alunos que procuram personal.';
    const card=document.createElement('section');card.id='hpeNearbyCard';card.className='card hpe-nearby-card';
    card.innerHTML='<div class="hpe-nearby-heading"><div><span class="eyebrow">BUSCA POR PERTO</span><h2>Encontre '+(student?'academias e personais próximos':'alunos e academias próximos')+'</h2><p>Use o GPS para visualizar a região, localizar perfis que autorizaram aparecer e encontrar academias próximas.</p></div><span class="hpe-nearby-compass-icon" aria-hidden="true">⌖</span></div>'+
      '<div class="hpe-nearby-controls"><label>Distância<select id="hpeNearbyRadius"><option value="5">Até 5 km</option><option value="10" selected>Até 10 km</option><option value="20">Até 20 km</option></select></label><button class="primary" id="hpeNearbySearchButton" type="button">⌖ Buscar perto de mim</button></div>'+
      '<label class="hpe-nearby-consent"><input id="hpeNearbyVisible" type="checkbox"><span><b>Quero aparecer para '+target+'.</b><small>'+consent+' A localização compartilhada expira após 24 horas; desligue quando quiser.</small></span></label>'+
      '<p class="hpe-nearby-status" id="hpeNearbyStatus" role="status">A busca só começa quando você tocar no botão. O GPS será solicitado pelo navegador.</p>'+
      '<div class="hpe-nearby-results"><div><div class="hpe-nearby-result-heading"><h3>Mapa da região</h3><div class="hpe-nearby-map-actions"><button type="button" class="hpe-nearby-compass-button" id="hpeNearbyCenterButton">Centralizar em mim</button><button type="button" class="hpe-nearby-compass-button" id="hpeCompassButton">Ativar bússola</button></div></div><div id="hpeNearbyMap" class="hpe-nearby-map"><div class="hpe-nearby-map-placeholder">Toque em “Buscar perto de mim” para carregar o mapa.</div></div><div class="hpe-nearby-map-legend"><span><i class="you"></i>Você</span><span><i class="profile"></i>'+(student?'Personal':'Aluno')+'</span><span><i class="gym"></i>Academia</span></div><small class="hpe-nearby-legend">Arraste e use o zoom para explorar. Os pontos dos perfis são aproximados.</small></div>'+
      '<div><h3>'+(student?'Personais cadastrados':'Alunos procurando personal')+'</h3><ol id="hpeNearbyPeople" class="hpe-nearby-list"><li class="hpe-nearby-empty">Toque em buscar para iniciar.</li></ol>'+
      '<h3 class="hpe-nearby-subheading">Academias próximas</h3><ol id="hpeNearbyGyms" class="hpe-nearby-list"><li class="hpe-nearby-empty">As academias serão consultadas no mapa ao iniciar a busca.</li></ol><p class="hpe-nearby-attribution">Mapa e academias: © contribuidores do OpenStreetMap. Os cadastros podem estar incompletos. O Google Maps abre apenas quando você tocar no link, com localização arredondada a cerca de 100 m; perfis aparecem em posição aproximada.</p></div></div>';
    content.insertAdjacentElement('afterbegin',card);
    card.querySelector('#hpeNearbySearchButton').addEventListener('click',scan);
    card.querySelector('#hpeNearbyVisible').addEventListener('change',toggleVisibility);
    card.querySelector('#hpeCompassButton').addEventListener('click',startCompass);
    card.querySelector('#hpeNearbyCenterButton').addEventListener('click',centerMap);
    const radius=card.querySelector('#hpeNearbyRadius');radius.value=String(state.radius);radius.addEventListener('change',()=>{state.radius=Number(radius.value)||10;});
    if(state.position)paint();
    if(!state.statusLoaded){state.statusLoaded=true;call({action:'discovery_status'}).then(result=>{state.visible=result.visible===true;const box=document.getElementById('hpeNearbyVisible');if(box)box.checked=state.visible;}).catch(error=>status(error.message));}
  };
  async function toggleVisibility(event){
    const enabled=event.target.checked;event.target.disabled=true;
    try{
      if(enabled){status('Solicitando GPS para compartilhar sua posição por até 24 horas…');const p=await getPosition();await call({action:'discovery_visibility',enabled:true,latitude:p.lat,longitude:p.lon});state.visible=true;status('Você está visível para '+(hpeProfile.role==='personal'?'alunos':'personais')+' por até 24 horas.');}
      else{await call({action:'discovery_visibility',enabled:false});state.visible=false;status('Você não aparece mais na busca.');}
    }catch(error){event.target.checked=!enabled;status(error.message||'Não foi possível atualizar sua visibilidade.');}
    finally{event.target.disabled=false;}
  }
  async function scan(){
    if(state.busy)return;state.busy=true;const button=document.getElementById('hpeNearbySearchButton');if(button)button.disabled=true;
    try{
      status('Solicitando sua localização…');const p=await getPosition();state.position=p;state.people=[];state.gyms=[];state.gymSearchFailed=false;
      if(state.visible)await call({action:'discovery_visibility',enabled:true,latitude:p.lat,longitude:p.lon});
      status('Buscando '+(hpeProfile.role==='aluno'?'academias e personais':'alunos e academias')+' em até '+state.radius+' km…');
      const jobs=[call({action:'discovery_nearby',latitude:p.lat,longitude:p.lon,radius_km:state.radius}),findGyms(p,state.radius),loadMapLibrary()];
      const done=await Promise.allSettled(jobs);
      state.people=done[0].status==='fulfilled'?(done[0].value?.results||[]):[];
      state.gyms=done[1].status==='fulfilled'?done[1].value:[];state.gymSearchFailed=done[1].status==='rejected';
      paint();
      const errors=done.slice(0,2).filter(x=>x.status==='rejected').map(x=>x.reason?.message||'Falha na busca.');
      if(done[2].status==='rejected')errors.push('O mapa interativo não carregou; as listas e a bússola continuam disponíveis.');
      status(errors.length?errors.join(' '):'Busca concluída. Perfis aparecem somente quando autorizam o compartilhamento por até 24 horas.');
    }catch(error){status(error.message||'Não foi possível concluir a busca.');}
    finally{state.busy=false;if(button)button.disabled=false;}
  }
  async function startCompass(){
    if(state.compassStarted)return;
    try{
      const device=window.DeviceOrientationEvent;if(!device){status('Este aparelho não oferece bússola digital; as direções usam o norte do mapa.');return;}
      if(typeof device.requestPermission==='function'&&await device.requestPermission()!=='granted'){status('A bússola não foi autorizada. As direções usam o norte do mapa.');return;}
      const handler=event=>{
        const value=Number.isFinite(event.webkitCompassHeading)?event.webkitCompassHeading:event.absolute&&Number.isFinite(event.alpha)?(360-event.alpha)%360:null;
        if(value===null)return;state.heading=(value+360)%360;const el=document.querySelector('#hpeNearbyHeading .hpe-nearby-needle');if(el)el.style.transform='rotate('+(-state.heading)+'deg)';const radarEl=document.querySelector('#hpeNearbyMap .hpe-nearby-radar');if(radarEl)radarEl.style.transform='rotate('+(-state.heading)+'deg)';
      };
      window.addEventListener('deviceorientationabsolute',handler,true);window.addEventListener('deviceorientation',handler,true);
      state.compassStarted=true;status('Bússola ativada. Gire o aparelho para acompanhar as direções.');
    }catch{status('Não foi possível ativar a bússola. As direções usam o norte do mapa.');}
  }
  const baseRender=render;render=function(){baseRender();renderCard();};
  window.addEventListener('pageshow',renderCard);
})();