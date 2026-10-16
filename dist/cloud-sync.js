let hpeSyncOwner=null,hpeSyncRevision=0,hpeSyncReady=false,hpeSyncDirty=false,hpeSyncBusy=false,hpeSyncConflict=false,hpeSyncTimer;
const syncBar=document.createElement('section');syncBar.className='hpe-sync-bar';syncBar.hidden=true;
syncBar.innerHTML='<span id="hpeSyncStatus" role="status">Sincronização aguardando login</span><button onclick="hpeSyncNow()">Sincronizar</button>';document.body.append(syncBar);
function hpeSyncStatus(text){$('#hpeSyncStatus').textContent=text;syncBar.hidden=!hpeProfile}
function hpeSyncPayload(value){return JSON.parse(JSON.stringify(value,(key,item)=>['password','ceoAccount'].includes(key)?undefined:item))}
function hpeSyncMeta(){localStorage.setItem('hpe-sync-meta-'+hpeSyncOwner,JSON.stringify({revision:hpeSyncRevision,dirty:hpeSyncDirty}))}
function hpeSyncPersist(){localStorage.setItem(window.hpeDataKey,JSON.stringify(data));hpeSyncMeta()}
async function hpeSyncStart(profile){
  clearTimeout(hpeSyncTimer);hpeSyncOwner=profile.id;hpeSyncReady=false;hpeSyncConflict=false;hpeSyncBusy=false;
  const owner=profile.id;let meta;try{meta=JSON.parse(localStorage.getItem('hpe-sync-meta-'+owner))}catch{}
  hpeSyncRevision=meta?.revision||0;hpeSyncDirty=Boolean(meta?.dirty);
  hpeSyncStatus('Carregando dados do Supabase…');
  try{
    const {data:remote,error}=await hpeAuth.from('hpe_account_data').select('payload,revision').eq('user_id',owner).maybeSingle();if(owner!==hpeProfile?.id)return;if(error)throw error;
    if(remote){
      if(!meta&&localStorage.getItem(window.hpeDataKey)&&JSON.stringify(hpeSyncPayload(data))!==JSON.stringify(remote.payload)){hpeSyncDirty=true;hpeSyncConflict=true;hpeSyncMeta();hpeSyncStatus('Há dados locais anteriores. Toque em Sincronizar para preservar uma cópia.');return}
      if(hpeSyncDirty&&hpeSyncRevision!==remote.revision){hpeSyncConflict=true;hpeSyncStatus('Há alterações em outro aparelho. Toque em Sincronizar.');return}
      if(!hpeSyncDirty)data={...hpeEmptyData(profile),...remote.payload};
      hpeSyncRevision=remote.revision;
    }else {hpeSyncRevision=0;hpeSyncDirty=true}
    hpeSyncReady=true;hpeSyncPersist();hpeSyncStatus(hpeSyncDirty?'Alterações aguardando envio…':'Dados sincronizados');if(hpeSyncDirty)await hpeSyncFlush();
  }catch{hpeSyncStatus('Sincronização indisponível. Dados preservados neste aparelho.');}
}
window.hpeSyncChanged=()=>{
  if(!hpeProfile||hpeProfile.id!==hpeSyncOwner)return;
  hpeSyncDirty=true;hpeSyncMeta();clearTimeout(hpeSyncTimer);
  if(!hpeSyncReady||hpeSyncConflict)return;
  hpeSyncStatus('Alterações aguardando envio…');hpeSyncTimer=setTimeout(hpeSyncFlush,700);
};
async function hpeSyncFlush(){
  if(!hpeSyncReady||!hpeSyncDirty||hpeSyncBusy||hpeSyncConflict||hpeProfile?.id!==hpeSyncOwner)return;
  const owner=hpeSyncOwner,payload=hpeSyncPayload(data),snapshot=JSON.stringify(payload);hpeSyncBusy=true;hpeSyncStatus('Salvando no Supabase…');
  try{
    const {data:revision,error}=await hpeAuth.rpc('hpe_save_account',{expected_revision:hpeSyncRevision,account_payload:payload});
    if(hpeProfile?.id!==owner)return;
    if(error){if(error.message?.includes('SYNC_CONFLICT')){hpeSyncConflict=true;hpeSyncStatus('Conflito entre aparelhos. Toque em Sincronizar.')}else hpeSyncStatus('Sem sincronização. Alterações mantidas neste aparelho.');return}
    hpeSyncRevision=revision;hpeSyncDirty=JSON.stringify(hpeSyncPayload(data))!==snapshot;hpeSyncMeta();hpeSyncStatus(hpeSyncDirty?'Alterações aguardando envio…':'Dados sincronizados');if(hpeSyncDirty)hpeSyncTimer=setTimeout(hpeSyncFlush,700);
  }catch{if(hpeProfile?.id===owner)hpeSyncStatus('Falha de conexão. Alterações preservadas.')}finally{if(hpeProfile?.id===owner)hpeSyncBusy=false}
}
window.hpeSyncNow=async()=>{
  if(!hpeProfile)return;
  if(hpeSyncConflict){
    modal('<h2>Alterações em dois aparelhos</h2><p>Para evitar substituir dados, a sincronização foi pausada. Baixe uma cópia das alterações deste aparelho antes de carregar os dados da nuvem.</p><button onclick="hpeSyncBackup()">Baixar cópia deste aparelho</button><button onclick="hpeSyncUseCloud()">Usar dados da nuvem</button>');return;
  }
  if(!hpeSyncReady){await hpeSyncStart(hpeProfile);render();return}
  if(hpeSyncDirty){await hpeSyncFlush();return}
  if(window.isWorkoutActive?.()||$('#modal').open){hpeSyncStatus('Finalize o treino ou feche o formulário para atualizar.');return}
  await hpeSyncStart(hpeProfile);if(typeof hpeAccountsRefresh==='function')await hpeAccountsRefresh();render();
};
window.hpeSyncBackup=()=>{const blob=new Blob([JSON.stringify(hpeSyncPayload(data),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='hpe-copia-do-aparelho.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
window.hpeSyncUseCloud=async()=>{if(!hpeProfile)return;localStorage.setItem('hpe-conflict-backup-'+hpeProfile.id,JSON.stringify(hpeSyncPayload(data)));hpeSyncDirty=false;hpeSyncMeta();$('#modal').close();await hpeSyncStart(hpeProfile);render()};
window.addEventListener('online',()=>{if(hpeSyncReady)hpeSyncFlush()});
window.addEventListener('beforeunload',event=>{if(hpeProfile&&hpeSyncDirty){event.preventDefault();event.returnValue=''}});
const syncLogout=logoutButton.onclick;logoutButton.onclick=async()=>{await hpeSyncFlush();if(hpeSyncDirty&&hpeProfile){modal('<h2>Alterações ainda não sincronizadas</h2><p>Elas estão preservadas neste aparelho. Sincronize antes de sair para vê-las em outro dispositivo.</p><button onclick="hpeSyncExit()">Sair mantendo cópia local</button>');return}await syncLogout();syncBar.hidden=true;hpeSyncReady=false};
window.hpeSyncExit=async()=>{await syncLogout();syncBar.hidden=true;hpeSyncReady=false};
