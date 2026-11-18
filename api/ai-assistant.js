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
const planRequestsByUser = new Map();
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

function modelKey() {
  const isPreview = process.env.VERCEL_ENV === "preview";
  const key = (process.env.NVIDIA_API_KEY || (isPreview ? process.env.NVIDIA_API_Keys : "") || "").trim();
  return isPreview && !key.startsWith("nvapi-") ? "" : key;
}

function isModelEnabled() {
  const environment = process.env.VERCEL_ENV;
  const isTest = environment === "preview" || environment === "development";
  const isLicensedProduction = environment === "production" &&
    process.env.NVIDIA_API_PRODUCTION_LICENSED === "true";
  return Boolean(modelKey() && (isTest || isLicensedProduction));
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
  query.searchParams.set("select", "role,personal_id,consultation_only");
  query.searchParams.set("id", "eq." + user.id);
  query.searchParams.set("limit", "1");
  const profileResponse = await fetch(query, { headers });
  if (!profileResponse.ok) return null;
  const profiles = await profileResponse.json();
  if (!Array.isArray(profiles) || !profiles[0]) return null;
  return { id: user.id, ...profiles[0] };
}


const PLAN_PROMPT = [
  "Você monta uma sugestão geral e conservadora de treino para um aluno adulto, sem avaliação clínica.",
  "Use somente nomes exatos do catálogo recebido e distribua 5 a 8 exercícios em um treino de corpo inteiro reutilizável.",
  "Considere o objetivo, a experiência e a frequência semanal, mas não prescreva cargas, diagnósticos, tratamentos, medicamentos, suplementos ou progressões.",
  "Use observações curtas sobre execução controlada e interrupção se houver dor.",
  "Retorne somente JSON válido, sem Markdown, neste formato: {\"title\":\"Treino A\",\"summary\":\"resumo curto\",\"exercises\":[{\"name\":\"nome exato do catálogo\",\"sets\":3,\"reps\":\"8–12\",\"rest\":60,\"notes\":\"observação curta\"}]}.",
  "Não inclua links, imagens, URLs, campos extras ou nomes que não estejam no catálogo."
].join(" ");
const PLAN_GROUPS = new Set(["peitoral","dorsais","quadriceps","posteriores","gluteos","deltoide","biceps","triceps","abdomen"]);
function consumePlanRateLimit(userId) {
  const now = Date.now();
  const current = planRequestsByUser.get(userId);
  if (!current || now - current.startedAt >= 60 * 60_000) {
    planRequestsByUser.set(userId, { startedAt: now, count: 1 });
    if (planRequestsByUser.size > 1000) {
      for (const [id, entry] of planRequestsByUser) {
        if (now - entry.startedAt >= 60 * 60_000) planRequestsByUser.delete(id);
      }
    }
    return true;
  }
  if (current.count >= 3) return false;
  current.count += 1;
  return true;
}
function parseModelJson(content) {
  if (typeof content !== "string") throw new Error("INVALID_MODEL_JSON");
  const text = content.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("INVALID_MODEL_JSON");
  return JSON.parse(text.slice(start, end + 1));
}
function safePlanText(value, maxLength, fallback) {
  if (typeof value !== "string") return fallback;
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength) || fallback;
}
async function generateIndependentPlan(res, profile, body) {
  const goals = new Set(["Hipertrofia","Condicionamento","Força"]);
  const levels = new Set(["Iniciante","Intermediário","Avançado"]);
  if (!goals.has(body.goal) || !levels.has(body.level) || !Number.isInteger(body.days) || ![2,3].includes(body.days)) {
    return send(res, 400, { error: "INVALID_PLAN_OPTIONS", message: "Confira o objetivo, o nível e os dias de treino." });
  }
  if (!Array.isArray(body.catalog) || body.catalog.length < 12 || body.catalog.length > 80) {
    return send(res, 400, { error: "INVALID_EXERCISE_CATALOG", message: "A biblioteca de exercícios não está pronta. Atualize o app." });
  }
  const catalog = new Map();
  for (const item of body.catalog) {
    if (!item || typeof item.name !== "string" || item.name.trim() !== item.name ||
        item.name.length < 2 || item.name.length > 75 ||
        !/^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .,'’()\/-]+$/.test(item.name) ||
        typeof item.group !== "string" || !PLAN_GROUPS.has(item.group) ||
        catalog.has(item.name.toLocaleLowerCase("pt-BR"))) {
      return send(res, 400, { error: "INVALID_EXERCISE_CATALOG", message: "A biblioteca de exercícios contém dados inválidos." });
    }
    catalog.set(item.name.toLocaleLowerCase("pt-BR"), { name: item.name, group: item.group });
  }
  if (JSON.stringify(body.catalog).length > 20_000) {
    return send(res, 413, { error: "PLAN_REQUEST_TOO_LARGE", message: "A biblioteca de exercícios enviada é muito grande." });
  }
  if (!consumePlanRateLimit(profile.id)) {
    return send(res, 429, { error: "PLAN_RATE_LIMITED", message: "Você já gerou três sugestões nesta hora. Tente novamente mais tarde." });
  }
  if (!isModelEnabled()) {
    return send(res, 503, { error: "AI_NOT_CONFIGURED", message: "A IA está disponível somente no ambiente de testes neste momento." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + modelKey(),
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: PLAN_PROMPT },
          { role: "user", content: JSON.stringify({ goal: body.goal, level: body.level, daysPerWeek: body.days, catalog: [...catalog.values()] }) }
        ],
        temperature: 0.2,
        top_p: 0.85,
        max_tokens: 1800,
        stream: false,
        chat_template_kwargs: { enable_thinking: false }
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      if (response.status === 429) return send(res, 429, { error: "MODEL_BUSY", message: "A NVIDIA está limitando solicitações. Tente novamente em instantes." });
      return send(res, 502, { error: "MODEL_UNAVAILABLE", message: "A IA não respondeu agora. Tente novamente mais tarde." });
    }
    const result = await response.json();
    let draft;
    try {
      const content = result && result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
      draft = parseModelJson(content);
    } catch {
      return send(res, 502, { error: "INVALID_MODEL_RESPONSE", message: "A IA não conseguiu formatar o treino. Gere outra sugestão." });
    }
    if (!draft || !Array.isArray(draft.exercises) || draft.exercises.length < 5 || draft.exercises.length > 8) {
      return send(res, 502, { error: "INVALID_MODEL_RESPONSE", message: "A IA não conseguiu montar um treino válido. Gere outra sugestão." });
    }
    const used = new Set();
    const exercises = [];
    for (const item of draft.exercises) {
      const name = item && typeof item.name === "string" ? item.name.trim() : "";
      const entry = catalog.get(name.toLocaleLowerCase("pt-BR"));
      if (!entry || entry.name !== name || used.has(entry.name)) {
        return send(res, 502, { error: "INVALID_MODEL_RESPONSE", message: "A IA sugeriu um movimento fora da biblioteca. Gere outra sugestão." });
      }
      used.add(entry.name);
      const rawReps = item && typeof item.reps === "string" ? item.reps.trim() : "";
      const reps = /^\d{1,2}(?:\s*[-–]\s*\d{1,2})?(?:\s*(?:reps?|seg(?:undos?)?|s))?$/i.test(rawReps)
        ? rawReps.slice(0, 24) : "8–12";
      const setsValue = Number(item.sets);
      const restValue = Number(item.rest);
      exercises.push({
        name: entry.name,
        group: entry.group,
        sets: Number.isFinite(setsValue) ? Math.max(2, Math.min(4, Math.round(setsValue))) : 3,
        reps,
        rest: Number.isFinite(restValue) ? Math.max(45, Math.min(180, Math.round(restValue / 5) * 5)) : 60,
        notes: safePlanText(item.notes, 160, "")
      });
    }
    return send(res, 200, {
      plan: {
        title: safePlanText(draft.title, 60, "Treino A"),
        summary: safePlanText(draft.summary, 220, "Sugestão geral para revisar antes de salvar."),
        goal: body.goal,
        level: body.level,
        weeklyFrequency: body.days,
        exercises
      },
      model: MODEL
    });
  } catch {
    return send(res, 504, { error: "MODEL_TIMEOUT", message: "A resposta demorou demais. Tente novamente." });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async function aiAssistant(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const origin = req.headers.origin || "";
  const isAllowedOrigin = origin ? allowOrigin(origin, res) : req.headers["sec-fetch-site"] === "same-origin";
  if (!isAllowedOrigin) return send(res, 403, { error: "ORIGIN_NOT_ALLOWED", message: "Origem não autorizada." });

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return send(res, 200, { available: isModelEnabled() });
  if (req.method !== "POST") return send(res, 405, { error: "METHOD_NOT_ALLOWED", message: "Use POST." });

  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return send(res, 401, { error: "AUTH_REQUIRED", message: "Entre no HPE para usar o assistente." });

  let body;
  try {
    body = parseBody(req.body);
  } catch {
    return send(res, 400, { error: "INVALID_JSON", message: "Não foi possível ler a solicitação." });
  }

  let profile;
  try {
    profile = await getPersonalProfile(match[1]);
  } catch {
    return send(res, 503, { error: "AUTH_CHECK_FAILED", message: "Não foi possível validar sua conta agora." });
  }
  if (!profile) return send(res, 403, { error: "PROFILE_NOT_ALLOWED", message: "Sua conta não pode usar este serviço." });

  if (body.action === "generate_plan") {
    if (profile.role !== "aluno" || profile.personal_id !== null || profile.consultation_only === true) {
      return send(res, 403, { error: "INDEPENDENT_STUDENT_ONLY", message: "A criação de treino com IA está disponível para alunos independentes." });
    }
    return generateIndependentPlan(res, profile, body);
  }

  if (body.action && body.action !== "chat") {
    return send(res, 400, { error: "UNKNOWN_ACTION", message: "Ação não reconhecida." });
  }
  if (profile.role !== "personal") {
    return send(res, 403, { error: "PERSONAL_ONLY", message: "O assistente de conversa está disponível apenas para personais cadastrados." });
  }
  if (!consumeRateLimit(profile.id)) return send(res, 429, { error: "RATE_LIMITED", message: "Aguarde um minuto antes de enviar novas perguntas." });
  if (!isModelEnabled()) {
    return send(res, 503, { error: "AI_NOT_CONFIGURED", message: "O assistente ainda está sendo configurado." });
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
        Authorization: "Bearer " + modelKey(),
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
