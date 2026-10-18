// Cache only the public app shell. Auth requests and cloud records are never cached.
const CACHE='hpe-shell-offline-v17';
const ASSETS=['exercise-preview.js','exercise-preview.css','./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','hpe-forca-bruta.png','atlas-realista.png','style.css','login.css','muscles.css','workout.css','mobile.css','training-tabs.css','finance.css','agenda-views.css','licenses.css','training-upgrade.css','brand.css','theme.css','install.css','whatsapp.css','cloud-sync.css','student-sharing.css','offline.css','training-library.css','ceo-message.css','erlaine-cofundadora.png','ceo-rodiney-patrick.jpg','app-preferences.css','app-preferences.js','student-experience.js','student-experience.css','student-signup.js','student-signup.css','auth-start.js','account-scope.js','app.js','catalog.js','muscles.js','catalog-integration.js','workout.js','progress.js','anatomy.js','training-tabs.js','finance.js','agenda-views.js','licenses.js','lifetime.js','training-upgrade.js','realistic-map.js','theme.js','supabase-client.js','supabase-auth.js','cloud-accounts.js','whatsapp.js','cloud-sync.js','student-sharing.js','offline.js','training-models.js','training-library.js','install.js'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})));await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('hpe-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
// Hosting redirects /index.html to /. A redirected cached Response cannot
// satisfy reload navigations with redirect: manual (Chrome reports ERR_FAILED).
function navigationResponse(response){
 const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
async function appNavigation(request){
 try{const cache=await caches.open(CACHE);const shell=await cache.match(new URL('index.html',self.registration.scope));if(shell?.ok)return navigationResponse(shell)}catch{}
 try{const response=await fetch(new Request(request,{redirect:'follow'}));if(response.ok)return navigationResponse(response);return response}catch{
  return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HPE Força Bruta</title><body style="background:#101211;color:#f2f4ee;font:18px system-ui;padding:32px"><h1>Vamos reconectar seu app.</h1><p>Não foi possível carregar os arquivos neste momento. Conecte à internet e tente novamente.</p><p>Seus registros salvos neste aparelho continuam preservados.</p><a href="./" style="color:#c4f36b">Tentar novamente</a></body></html>',{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
 }
}
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){event.respondWith(appNavigation(event.request));return}
 if(ASSETS.some(path=>new URL(path,self.registration.scope).href===url.href))event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(event.request)||fetch(event.request)})());
});
self.addEventListener('message',event=>{if(event.data?.type==='HPE_OFFLINE_CHECK')event.waitUntil((async()=>{const cache=await caches.open(CACHE);const present=await Promise.all(ASSETS.map(path=>cache.match(new URL(path,self.registration.scope))));event.ports[0]?.postMessage({ready:present.every(Boolean)})})())});




