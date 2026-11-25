// AI Coach backend: forwards the chat to Google Gemini and returns the reply.
// Needs GEMINI_API_KEY in Vercel → Project → Settings → Environment Variables.
// Optional: GEMINI_MODEL to force a specific model (it is tried first).
//
// Reliability: the function looks up which Gemini models this key can use,
// then tries them in order. If one is overloaded (503), rate limited (429) or
// missing (404), it moves on to the next, so one busy model never breaks the coach.

const API = "https://generativelanguage.googleapis.com/v1beta";
const MAX_MESSAGES = 40;
const MAX_CHARS = 8000;
const FALLBACKS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-flash-lite-latest"];

let cachedModels = null;
let cachedAt = 0;

const reply = (res, text, status = 200, model) => {
  if (model) res.setHeader("x-coach-model", model);
  return res.status(status).json({ content: [{ type: "text", text }] });
};

async function timed(url, opts, ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(t); }
}

// Rank flash models: stable before preview/experimental, newer versions first, full before lite.
function rank(name) {
  const v = parseFloat((name.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || "0");
  const unstable = /preview|exp|latest/.test(name) ? 1 : 0;
  const lite = /lite/.test(name) ? 1 : 0;
  return unstable * 100 + lite * 10 - v;
}

async function candidateModels(key) {
  const list = [];
  if (process.env.GEMINI_MODEL) list.push(process.env.GEMINI_MODEL.trim());
  if (!cachedModels || Date.now() - cachedAt > 3600e3) {
    try {
      const r = await timed(`${API}/models?pageSize=200`, { headers: { "x-goog-api-key": key } }, 6000);
      if (r.ok) {
        const d = await r.json();
        cachedModels = (d.models || [])
          .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
          .map(m => m.name.replace(/^models\//, ""))
          .filter(n => /^gemini-[\d.]+-flash(-lite)?(-preview[-\w]*)?$|^gemini-flash(-lite)?-latest$/.test(n))
          .sort((a, b) => rank(a) - rank(b));
        cachedAt = Date.now();
      }
    } catch (e) { console.error("Model list failed", e); }
  }
  for (const m of [...(cachedModels || []), ...FALLBACKS]) if (!list.includes(m)) list.push(m);
  return list;
}

export default async function handler(req, res) {
  const key = (process.env.GEMINI_API_KEY || "").trim();

  // GET /api/chat: health check (shows which models would be tried; never shows the key)
  if (req.method === "GET") {
    if (!key) return res.status(200).json({ ok: false, reason: "GEMINI_API_KEY is not set" });
    const models = await candidateModels(key);
    return res.status(200).json({ ok: true, models: models.slice(0, 8) });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!key) return reply(res, "The AI Coach isn't set up yet (missing API key).", 500);

  const { system, messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "No messages" });

  // Gemini needs alternating turns that start with the user.
  const contents = [];
  for (const m of messages.slice(-MAX_MESSAGES)) {
    if ((m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || !m.content.trim()) continue;
    const role = m.role === "assistant" ? "model" : "user";
    const text = m.content.slice(0, MAX_CHARS);
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += "\n\n" + text;
    else contents.push({ role, parts: [{ text }] });
  }
  while (contents.length && contents[0].role !== "user") contents.shift();
  if (!contents.length) return res.status(400).json({ error: "No user message" });

  const body = { contents, generationConfig: { maxOutputTokens: 8192, temperature: 0.7 } };
  if (typeof system === "string" && system) body.systemInstruction = { parts: [{ text: system.slice(0, 30000) }] };

  const models = await candidateModels(key);
  const started = Date.now();
  let lastStatus = 0, lastDetail = "";

  for (const model of models.slice(0, 6)) {
    if (Date.now() - started > 45000) break;
    let r;
    try {
      r = await timed(`${API}/models/${model}:generateContent`,
        { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) }, 30000);
    } catch (e) {
      lastStatus = 0; lastDetail = String(e && e.message || e);
      console.error("Gemini request failed", model, lastDetail);
      continue;
    }
    if (!r.ok) {
      lastStatus = r.status;
      lastDetail = (await r.text().catch(() => "")).slice(0, 300);
      console.error("Gemini error", model, r.status, lastDetail);
      if (r.status === 400 && /API key/i.test(lastDetail)) break;   // bad key: no point trying others
      if (r.status === 401 || r.status === 403) break;
      continue;                                                     // 404, 429, 500, 503 → next model
    }
    const data = await r.json().catch(() => ({}));
    const cand = data.candidates && data.candidates[0];
    const text = cand && cand.content && Array.isArray(cand.content.parts)
      ? cand.content.parts.filter(p => !p.thought).map(p => p.text || "").join("").trim() : "";
    if (text) return reply(res, text, 200, model);
    if (data.promptFeedback && data.promptFeedback.blockReason) {
      return reply(res, "Sorry, I can't help with that one. Try asking another way.", 200, model);
    }
    lastStatus = 200; lastDetail = "empty reply (" + (cand && cand.finishReason || "no candidate") + ")";
  }

  if (lastStatus === 400 || lastStatus === 401 || lastStatus === 403) {
    return reply(res, "The AI Coach's API key was rejected. Check GEMINI_API_KEY in Vercel.", 502);
  }
  if (lastStatus === 429) return reply(res, "The coach is getting a lot of questions right now. Try again in a minute.", 429);
  return reply(res, "The coach is busy right now. Please try again in a moment.", 503);
}
