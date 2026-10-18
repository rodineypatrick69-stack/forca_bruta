let hpeInstallPrompt=null;
const hpeStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const hpeInstallButton=document.createElement('button');
hpeInstallButton.className='hpe-install';hpeInstallButton.textContent='↓ Instalar no celular';
hpeInstallButton.hidden=hpeStandalone();document.body.append(hpeInstallButton);
const hpeInstallDialog=document.createElement('dialog');hpeInstallDialog.className='hpe-install-dialog';
hpeInstallDialog.innerHTML=`<button class="close" aria-label="Fechar instruções">×</button><h2>HPE no seu celular</h2><p>Adicione o aplicativo à tela de início para abrir em uma janela própria.</p><button id="hpe-native-install" hidden>Instalar aplicativo</button><h3>Android</h3><ol><li>Abra este endereço no Chrome.</li><li>No menu ⋮, toque em <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b>.</li><li>Confirme a instalação.</li></ol><h3>iPhone e iPad</h3><ol><li>Abra este endereço no Safari.</li><li>Toque em <b>Compartilhar</b> e em <b>Adicionar à Tela de Início</b>.</li><li>Ative “Abrir como App”, se aparecer, e toque em <b>Adicionar</b>.</li></ol><p class="install-note">Entre com internet e toque em Preparar uso offline antes de ir à academia. Treinos baixados e registros podem ser usados sem sinal. Cadastros, recuperação de senha e mídia externa exigem conexão. Confira os indicadores para sincronizar.</p><p class="install-note">APK para Android e versão da App Store ainda não estão disponíveis.</p>`;
document.body.append(hpeInstallDialog);
hpeInstallButton.onclick=()=>{document.querySelector('#hpe-native-install').hidden=!hpeInstallPrompt;hpeInstallDialog.showModal()};
hpeInstallDialog.querySelector('.close').onclick=()=>hpeInstallDialog.close();
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();hpeInstallPrompt=event;document.querySelector('#hpe-native-install').hidden=false});
document.querySelector('#hpe-native-install').onclick=async()=>{if(!hpeInstallPrompt)return;const prompt=hpeInstallPrompt;hpeInstallPrompt=null;await prompt.prompt();const choice=await prompt.userChoice;document.querySelector('#hpe-native-install').hidden=true;if(choice.outcome==='accepted')hpeInstallDialog.close()};
window.addEventListener('appinstalled',()=>{hpeInstallButton.hidden=true;hpeInstallPrompt=null;hpeInstallDialog.close()});
if('serviceWorker' in navigator)window.addEventListener('load',async()=>{
 let registration;
 try{
  registration=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});
  let updatePending=false;
  const safeReload=()=>{
   if(!updatePending||document.visibilityState!=='visible'||document.querySelector('dialog[open]')||window.isWorkoutActive?.())return;
   const key='hpe-update-applied-'+window.HPE_APP_VERSION;
   if(sessionStorage.getItem(key))return;
   sessionStorage.setItem(key,'1');location.reload();
  };
  const checkUpdate=async()=>{
   try{
    const response=await fetch(new URL('version.json?'+Date.now(),location.href),{cache:'no-store'});
    if(response.ok){const current=await response.json();if(current.version&&current.version!==window.HPE_APP_VERSION){updatePending=true;await registration.update()}}
   }catch{}
   try{await registration.update()}catch{}
  };
  navigator.serviceWorker.addEventListener('controllerchange',()=>{updatePending=true;safeReload()});
  window.addEventListener('focus',()=>{checkUpdate();safeReload()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){checkUpdate();safeReload()}});
  setInterval(()=>{checkUpdate();safeReload()},30*60*1000);
  checkUpdate();
 }catch{}
});

