(() => {
  const API_URL = 'https://forcabruta.vercel.app/api/ai-assistant';
  const query = (selector, root = document) => root.querySelector(selector);
  let conversation = [];
  let sending = false;
  let previousProfileId = null;
  let assistantAvailable = false;
  let availabilityRequest = null;
  let availabilityRetryAt = 0;

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function currentProfileId() {
    try {
      return typeof hpeProfile === 'undefined' ? null : (hpeProfile?.id || null);
    } catch {
      return null;
    }
  }

  function syncIdentity() {
    const profileId = currentProfileId();
    if (profileId !== previousProfileId) {
      conversation = [];
      previousProfileId = profileId;
    }
  }

  async function checkAvailability() {
    if (role !== 'personal' || assistantAvailable || availabilityRequest || Date.now() < availabilityRetryAt) return;
    availabilityRequest = (async () => {
      try {
        const response = await fetch(API_URL, { headers: { Accept: 'application/json' } });
        const result = await response.json().catch(() => ({}));
        assistantAvailable = response.ok && result.available === true;
        availabilityRetryAt = Date.now() + (assistantAvailable ? 60_000 : 30_000);
      } catch {
        assistantAvailable = false;
        availabilityRetryAt = Date.now() + 30_000;
      } finally {
        availabilityRequest = null;
        if (assistantAvailable && role === 'personal') render();
      }
    })();
    await availabilityRequest;
  }

  function renderNavButton() {
    const nav = query('#nav');
    if (!nav) return;
    let button = query('#hpeAiNav', nav);
    if (role !== 'personal' || !assistantAvailable) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement('button');
      button.id = 'hpeAiNav';
      button.type = 'button';
      button.innerHTML = '<span aria-hidden="true">✦</span> &nbsp; Assistente IA';
      button.addEventListener('click', () => go('hpe-ai'));
      nav.append(button);
    }
    button.classList.toggle('active', page === 'hpe-ai');
  }

  function drawAssistant() {
    const root = query('#content');
    if (!root) return;
    const transcript = conversation.length
      ? conversation.map(message =>
          '<article class="hpe-ai-message ' + message.role + '">' +
            '<span class="hpe-ai-speaker">' + (message.role === 'user' ? 'Você' : 'Assistente HPE') + '</span>' +
            '<p>' + escapeHTML(message.content).replace(/\n/g, '<br>') + '</p>' +
          '</article>'
        ).join('')
      : '<article class="hpe-ai-message assistant"><span class="hpe-ai-speaker">Assistente HPE</span><p>Olá! Posso ajudar com ideias gerais para organizar treinos e explicar exercícios. Revise as sugestões antes de usá-las.</p></article>';

    root.innerHTML =
      '<section class="hpe-ai-page">' +
        '<div class="hpe-ai-heading card">' +
          '<span class="eyebrow">APOIO AO PERSONAL</span>' +
          '<h1>Assistente IA</h1>' +
          '<p>Converse sobre organização de treinos, exercícios e comunicação com alunos.</p>' +
          '<div class="hpe-ai-notice"><b>Privacidade e revisão:</b> o assistente não acessa as fichas do HPE. Não informe nomes, contatos, fotos, exames, lesões ou dados de saúde. Use as respostas como rascunho e revise antes de orientar o aluno.</div>' +
        '</div>' +
        '<div class="hpe-ai-chat card">' +
          '<div class="hpe-ai-toolbar"><span class="tag">NVIDIA NEMOTRON</span><button type="button" id="hpeAiClear">Limpar conversa</button></div>' +
          '<div class="hpe-ai-transcript" id="hpeAiTranscript" role="log" aria-live="polite" aria-label="Conversa com o assistente">' + transcript + '</div>' +
          '<form id="hpeAiForm" class="hpe-ai-form">' +
            '<label class="sr-only" for="hpeAiInput">Sua pergunta</label>' +
            '<textarea id="hpeAiInput" maxlength="2400" rows="3" placeholder="Ex.: Sugira uma estrutura de treino de força para nível intermediário." required ' + (sending ? 'disabled' : '') + '></textarea>' +
            '<div class="hpe-ai-form-footer"><small>Até 2.400 caracteres. Não inclua dados pessoais ou clínicos.</small><button class="primary" type="submit" ' + (sending ? 'disabled' : '') + '>' + (sending ? 'Aguarde…' : 'Enviar pergunta ↗') + '</button></div>' +
          '</form>' +
          '<p class="hpe-ai-disclaimer">A IA pode errar. Não substitui a avaliação do personal nem a orientação de profissionais de saúde.</p>' +
        '</div>' +
      '</section>';

    const transcriptNode = query('#hpeAiTranscript');
    transcriptNode.scrollTop = transcriptNode.scrollHeight;
    query('#hpeAiClear').addEventListener('click', () => {
      conversation = [];
      drawAssistant();
    });
    query('#hpeAiForm').addEventListener('submit', submitQuestion);
  }

  async function submitQuestion(event) {
    event.preventDefault();
    if (sending) return;
    const input = query('#hpeAiInput');
    const text = input?.value.trim();
    if (!text) return;

    conversation.push({ role: 'user', content: text });
    conversation = conversation.slice(-12);
    sending = true;
    render();

    try {
      if (typeof hpeAuth === 'undefined' || !hpeAuth) throw new Error('AUTH_REQUIRED');
      const sessionResult = await hpeAuth.auth.getSession();
      const session = sessionResult?.data?.session;
      if (sessionResult?.error || !session?.access_token) throw new Error('AUTH_REQUIRED');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 50_000);
      let response;
      try {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + session.access_token
          },
          body: JSON.stringify({ messages: conversation.slice(-12) }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.reply !== 'string') {
        const error = new Error(result.message || 'Não consegui obter uma resposta agora.');
        error.status = response.status;
        throw error;
      }
      conversation.push({ role: 'assistant', content: result.reply });
      conversation = conversation.slice(-12);
    } catch (error) {
      const message = error?.name === 'AbortError'
        ? 'A resposta demorou demais. Tente novamente.'
        : (error?.message === 'AUTH_REQUIRED'
          ? 'Sua sessão expirou. Entre novamente no HPE.'
          : (error?.message || 'Não consegui conectar à IA. Tente novamente mais tarde.'));
      conversation.push({ role: 'assistant', content: message });
      conversation = conversation.slice(-12);
    } finally {
      sending = false;
      render();
    }
  }

  const originalRender = render;
  render = function hpeRenderWithAssistant() {
    syncIdentity();
    if (role === 'personal' && !assistantAvailable) void checkAvailability();
    if (page === 'hpe-ai' && (role !== 'personal' || !assistantAvailable)) page = 'inicio';
    originalRender();
    renderNavButton();
    if (page === 'hpe-ai' && role === 'personal') drawAssistant();
  };

  const originalGo = go;
  go = function hpeGoWithAssistant(nextPage) {
    if (nextPage === 'hpe-ai') {
      if (role !== 'personal' || !assistantAvailable) return originalGo('inicio');
      page = 'hpe-ai';
      render();
      return;
    }
    originalGo(nextPage);
  };
  window.go = go;

  try {
    if (typeof logoutButton !== 'undefined' && logoutButton) {
      const previousLogout = logoutButton.onclick;
      logoutButton.onclick = async function clearAssistantOnLogout(event) {
        conversation = [];
        previousProfileId = null;
        return previousLogout?.call(this, event);
      };
    }
  } catch {}
})();
