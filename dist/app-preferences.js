function hpeDetachPreferenceBars(){for(const node of [syncBar,sharedBar,offlineBar,hpeInstallButton])if(node.closest('.app-preferences'))document.body.append(node)}
const preferencesModal=modal;modal=function(html){hpeDetachPreferenceBars();preferencesModal(html)};
$('#modal').addEventListener('close',()=>{if(!$('#modal').open)hpeDetachPreferenceBars()});
window.hpeOpenPreferences=()=>{
 modal(`<section class="app-preferences"><h2>Configurações do app</h2><p>A sincronização e o preparo offline continuam sem cobrir suas telas.</p><h3>Instalar no celular</h3><p>Adicione o app à tela de início do Android ou iPhone.</p><div id="hpeInstallSettings"></div>${hpeProfile?'<h3>Conexão e uso offline</h3><div id="hpeConnectionSettings"></div>':'<p>Entre na sua conta para preparar os treinos offline.</p>'}</section>`);
 $('#hpeInstallSettings').append(hpeInstallButton);
 if(hpeProfile)for(const bar of [syncBar,sharedBar,offlineBar])$('#hpeConnectionSettings').append(bar);
};
const preferencesRender=render;render=function(){preferencesRender();if(!document.body.classList.contains('signed-out'))$('#nav').insertAdjacentHTML('beforeend','<button onclick="hpeOpenPreferences()">⚙ &nbsp; Configurações do app</button>')};
const preferencesLogin=showLogin;showLogin=function(selected=loginRole){preferencesLogin(selected);$('.login-card').insertAdjacentHTML('beforeend','<button class="app-preferences-entry" onclick="hpeOpenPreferences()">Instalação e configurações do app</button>')};window.showLogin=showLogin;
const preferencesToast=toast;toast=function(message){if(/sincroniz|conexão|conexao|offline|baixad|download|contas atualizadas|dados locais|alterações aguardando/i.test(message))return;preferencesToast(message)};
if(document.body.classList.contains('signed-out'))showLogin(loginRole);else render();
