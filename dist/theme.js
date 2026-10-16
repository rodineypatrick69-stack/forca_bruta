function applyTheme(value){const theme=['claro','escuro'].includes(value)?value:'escuro';document.documentElement.dataset.theme=theme;localStorage.setItem('hpe-theme',theme);document.querySelectorAll('.theme-toggle').forEach(button=>{button.textContent=theme==='claro'?'☾ Escuro':'☀ Claro';button.setAttribute('aria-label',theme==='claro'?'Ativar tema escuro':'Ativar tema claro')});document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='claro'?'#f4f6f2':'#101211')}
window.toggleTheme=()=>applyTheme(document.documentElement.dataset.theme==='claro'?'escuro':'claro');
function themeButton(){return '<button class="theme-toggle" onclick="toggleTheme()" aria-label="Alterar tema">☀ Claro</button>'}
const themeHeader=document.createElement('span');themeHeader.innerHTML=themeButton();$('header>div').prepend(themeHeader);
const themeLogin=showLogin;showLogin=function(selected=loginRole){themeLogin(selected);$('.login-story').insertAdjacentHTML('afterbegin',`<div class="login-theme">${themeButton()}</div>`);applyTheme(localStorage.getItem('hpe-theme')||'escuro')};window.showLogin=showLogin;
applyTheme(localStorage.getItem('hpe-theme')||'escuro');
