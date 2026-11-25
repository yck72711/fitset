// AI Coach backend: forwards the chat to Gemini and returns the reply.
// Needs GEMINI_API_KEY set in Vercel → Project → Settings → Environment Variables.
// Optional: GEMINI_MODEL to change the model without editing code.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_MESSAGES = 40;
const MAX_CHARS = 8000;

const reply = (res, text, status = 200) =>
  res.status(status).json({ content: [{ type: "text", text }] });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) return reply(res, "The AI Coach isn't set up yet (missing API key).", 500);

  const { system, messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "No messages" });

  const contents = messages.slice(-MAX_MESSAGES)
    .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content.slice(0, MAX_CHARS) }] }));

  const body = { contents, generationConfig: { maxOutputTokens: 4000 } };
  if (typeof system === "string" && system) body.systemInstruction = { parts: [{ text: system.slice(0, 20000) }] };

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) }
    );
    if (r.status === 429) return reply(res, "The coach is busy right now. Try again in a minute.", 429);
    if (!r.ok) return reply(res, "The coach hit a problem (Gemini " + r.status + "). Please try again.", 502);
    const data = await r.json();
    const cand = data.candidates && data.candidates[0];
    const text = cand && cand.content && cand.content.parts
      ? cand.content.parts.map(p => p.text || "").join("") : "";
    if (!text) return reply(res, "Sorry, I can't help with that one. Try asking another way.");
    return reply(res, text);
  } catch (e) {
    return reply(res, "The coach couldn't be reached (" + String(e && e.message || e).slice(0, 120) + ").", 500);
  }
}
