const MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const ALLOWED_ORIGINS = new Set([
  "https://forja-treino-academia.rodineypatrick69.chatgpt.site",
  "https://forja-treino-academia.younggoby6.chatgpt.site",
  "https://forcabruta.vercel.app"
]);
const requestsByUser = new Map();
const SYSTEM_PROMPT = [
  "Você é o Assistente HPE Força Bruta, um apoio textual para personal trainers.",
  "Responda sempre em português do Brasil, com linguagem clara, prática e respeitosa.",
  "Ajude com organização de treinos, explicação geral de exercícios e comunicação com alunos.",
  "Você não acessa fichas, cadastros, fotos, questionários ou histórico do HPE. Não afirme que consultou esses dados.",
  "Não salve nem altere treinos. Apresente ideias como rascunhos para o personal revisar.",
  "Não diagnostique, trate ou prescreva para lesões, doenças, gravidez ou sintomas; encaminhe a decisão ao profissional de saúde e ao personal responsável.",
  "Não recomende medicamentos, hormônios, anabolizantes ou protocolos de suplementação.",
  "Peça ao usuário para não inserir nomes completos, contatos, fotos, exames ou informações de saúde identificáveis."
].join(" ");

function send(res, status, body) {
  res.status(status).json(body);
}

function allowOrigin(origin, res) {
  if (!origin) return false;
  let allowed = ALLOWED_ORIGINS.has(origin);
  if (!allowed) {
    try {
      const host = new URL(origin).hostname;
      allowed = /^forcabruta-[a-z0-9-]+-rodineypatrick69-9071\.vercel\.app$/.test(host);
    } catch {}
  }
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  return allowed;
}

function parseBody(body) {
  if (typeof body === "string") return JSON.parse(body);
  if (body && typeof body === "object") return body;
  return {};
}

function consumeRateLimit(userId) {
  const now = Date.now();
  const current = requestsByUser.get(userId);
  if (!current || now - current.startedAt >= 60_000) {
    requestsByUser.set(userId, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= 10) return false;
  current.count += 1;
  return true;
}

async function getPersonalProfile(accessToken) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + accessToken
  };
  const userResponse = await fetch(SUPABASE_URL + "/auth/v1/user", { headers });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  if (!user || typeof user.id !== "string") return null;

  const query = new URL(SUPABASE_URL + "/rest/v1/hpe_profiles");
  query.searchParams.set("select", "role");
  query.searchParams.set("id", "eq." + user.id);
  query.searchParams.set("limit", "1");
  const profileResponse = await fetch(query, { headers });
  if (!profileResponse.ok) return null;
  const profiles = await profileResponse.json();
  if (!Array.isArray(profiles) || profiles[0]?.role !== "personal") return null;
  return { id: user.id };
}

module.exports = async function aiAssistant(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const origin = req.headers.origin || "";
  if (!allowOrigin(origin, res)) return send(res, 403, { error: "ORIGIN_NOT_ALLOWED", message: "Origem não autorizada." });

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return send(res, 405, { error: "METHOD_NOT_ALLOWED", message: "Use POST." });

  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return send(res, 401, { error: "AUTH_REQUIRED", message: "Entre no HPE para usar o assistente." });

  let profile;
  try {
    profile = await getPersonalProfile(match[1]);
  } catch {
    return send(res, 503, { error: "AUTH_CHECK_FAILED", message: "Não foi possível validar sua conta agora." });
  }
  if (!profile) return send(res, 403, { error: "PERSONAL_ONLY", message: "Este assistente está disponível apenas para personais cadastrados." });
  if (!consumeRateLimit(profile.id)) return send(res, 429, { error: "RATE_LIMITED", message: "Aguarde um minuto antes de enviar novas perguntas." });
  if (!process.env.NVIDIA_API_KEY) {
    return send(res, 503, { error: "AI_NOT_CONFIGURED", message: "O assistente ainda está sendo configurado." });
  }

  let body;
  try {
    body = parseBody(req.body);
  } catch {
    return send(res, 400, { error: "INVALID_JSON", message: "Não foi possível ler a mensagem." });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 12) {
    return send(res, 400, { error: "INVALID_MESSAGES", message: "Envie até 12 mensagens de conversa." });
  }
  const messages = [];
  let totalLength = 0;
  for (const item of body.messages) {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") {
      return send(res, 400, { error: "INVALID_MESSAGE", message: "Uma mensagem está em formato inválido." });
    }
    const content = item.content.trim();
    if (!content || content.length > 2400) {
      return send(res, 400, { error: "MESSAGE_TOO_LONG", message: "Cada mensagem deve ter até 2.400 caracteres." });
    }
    totalLength += content.length;
    messages.push({ role: item.role, content });
  }
  if (totalLength > 8000 || messages[messages.length - 1].role !== "user") {
    return send(res, 400, { error: "CONVERSATION_TOO_LONG", message: "Revise o tamanho da conversa e envie uma pergunta." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.NVIDIA_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.35,
        top_p: 0.9,
        max_tokens: 1000,
        stream: false,
        chat_template_kwargs: { enable_thinking: false }
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      if (response.status === 429) return send(res, 429, { error: "MODEL_BUSY", message: "A NVIDIA está limitando solicitações no momento. Tente novamente em instantes." });
      return send(res, 502, { error: "MODEL_UNAVAILABLE", message: "A IA não respondeu agora. Tente novamente mais tarde." });
    }
    const result = await response.json();
    const reply = result?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return send(res, 502, { error: "EMPTY_RESPONSE", message: "A IA retornou uma resposta vazia. Tente novamente." });
    }
    return send(res, 200, { reply: reply.trim(), model: MODEL });
  } catch {
    return send(res, 504, { error: "MODEL_TIMEOUT", message: "A resposta demorou demais. Tente novamente." });
  } finally {
    clearTimeout(timeout);
  }
};

module.exports.config = { maxDuration: 60 };
