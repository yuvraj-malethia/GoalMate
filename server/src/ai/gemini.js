/**
 * Gemini REST client. There is no SDK here: Gemini is a single HTTP endpoint,
 * and owning the client makes these four things explicit:
 *
 *  1. Model fallback. Each request walks a list of models (config.js). A model
 *     that is retired, overloaded or out of quota is skipped for a while
 *     (a "cool-down"), and the model that last answered is tried first.
 *  2. Structured output. For roadmaps, plans and reviews Gemini is given a
 *     JSON schema and must answer with matching JSON, instead of prose we'd
 *     have to pick apart.
 *  3. Streaming. Chat answers arrive in pieces (Server-Sent Events), so the
 *     first words show up after about a second.
 *  4. Honest errors. "No key", "invalid key" and "quota used up" reach the
 *     UI as clear messages. The original app faked a reply instead.
 */
import { GEMINI_API_KEY, GEMINI_BASE_URL, GEMINI_MODELS } from '../config.js';

const MINUTE = 60_000;

/** code: not_configured | invalid_key | quota | unavailable | blocked | bad_response */
export class AiError extends Error {
  constructor(code, message, cooldownMs = 0) {
    super(message);
    this.code = code;
    this.cooldownMs = cooldownMs; // how long to skip the model that caused this
  }
  /** The HTTP status sent to the browser. */
  get status() {
    return this.code === 'not_configured' ? 503 : this.code === 'quota' ? 429 : 502;
  }
}

/* ------------------------------------------------------------------ */
/* Choosing a model                                                    */
/* ------------------------------------------------------------------ */

const preferred = new Map(); // tier → { model, at }: the model that last answered
const coolingUntil = new Map(); // model → time it may be tried again
let lastModel = null;
let lastError = null;

/** Shown on the Settings page. */
export function aiStatus() {
  return { configured: !!GEMINI_API_KEY, models: GEMINI_MODELS.smart, lastError, lastModel };
}

const isLite = (model) => model.includes('lite');

/** The tier's models in the order to try them: last winner first (for 10 min), cooling models skipped. */
function modelsToTry(tier) {
  const models = GEMINI_MODELS[tier];
  const last = preferred.get(tier);
  const ordered = last && Date.now() - last.at < 10 * MINUTE ? [last.model, ...models.filter((m) => m !== last.model)] : models;
  const ready = ordered.filter((m) => (coolingUntil.get(m) ?? 0) <= Date.now());
  return ready.length ? ready : ordered; // all cooling down: try them anyway
}

/**
 * The full Flash models in the "smart" tier share this much time in total.
 * On the free tier they are sometimes very slow; after the budget the fast
 * (Lite) models answer instead, so a roadmap never takes minutes.
 */
const SMART_BUDGET_MS = 20_000;

/** Run `attempt(model, timeoutMs)` for each model in turn until one succeeds. */
async function withFallback(tier, timeoutMs, attempt) {
  if (!GEMINI_API_KEY) throw new AiError('not_configured', 'The server has no Gemini API key.');
  const started = Date.now();
  let report = null; // the error to show if every model fails

  for (const model of modelsToTry(tier)) {
    let limit = timeoutMs;
    if (tier === 'smart' && !isLite(model)) {
      limit = Math.min(timeoutMs, SMART_BUDGET_MS - (Date.now() - started));
      if (limit < 3000) continue; // budget used up: go straight to the Lite models
    }
    try {
      const result = await attempt(model, limit);
      preferred.set(tier, { model, at: Date.now() });
      lastModel = model;
      lastError = null;
      return result;
    } catch (e) {
      const err = toAiError(e);
      console.warn(`[ai] ${model}: ${err.message}`);
      if (err.cooldownMs) coolingUntil.set(model, Date.now() + err.cooldownMs);
      // A quota problem is more useful to report than a later "model not found".
      if (!report || err.code === 'quota') report = err;
      // Another model won't help with a bad key or a refused prompt.
      if (err.code === 'invalid_key' || err.code === 'blocked') {
        report = err;
        break;
      }
    }
  }
  lastError = report?.message ?? 'Gemini is unavailable right now.';
  throw report ?? new AiError('unavailable', 'Gemini is unavailable right now. Try again in a minute.');
}

function toAiError(e) {
  if (e instanceof AiError) return e;
  if (e?.name === 'TimeoutError') return new AiError('unavailable', 'Gemini took too long to answer.', MINUTE);
  return new AiError('unavailable', `Could not reach Gemini: ${e?.message ?? e}`);
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

/**
 * Flash models "think" before answering by default, which added seconds per
 * call without making these short answers better, so we ask for as little
 * thinking as each kind of model allows. A model that rejects the setting is
 * remembered and asked without it.
 */
const rejectsThinkingConfig = new Set();

function requestBody(model, o) {
  const generationConfig = { temperature: o.temperature ?? 0.7 };
  if (o.schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = o.schema;
  }
  if (!rejectsThinkingConfig.has(model)) {
    generationConfig.thinkingConfig = { thinkingLevel: isLite(model) ? 'minimal' : 'low' };
  }
  return {
    systemInstruction: o.system ? { parts: [{ text: o.system }] } : undefined,
    contents: [
      ...(o.history ?? []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: o.prompt }] },
    ],
    generationConfig,
  };
}

/** Turn a failed HTTP response into an AiError. */
async function failure(res) {
  let message = `${res.status} ${res.statusText}`;
  let reason = '';
  try {
    const body = JSON.parse(await res.text());
    message = body.error?.message || message;
    reason = body.error?.details?.find((d) => d.reason)?.reason || '';
  } catch {
    // Not JSON: keep the status line.
  }
  if (reason === 'API_KEY_INVALID' || /api key not valid/i.test(message)) {
    return new AiError('invalid_key', 'The Gemini API key was rejected. Check GEMINI_API_KEY in your .env file.');
  }
  if (res.status === 403) return new AiError('invalid_key', `Gemini refused the request: ${message}`);
  if (res.status === 429) {
    return new AiError('quota', 'The free Gemini quota is used up for now. Wait a minute and try again.', MINUTE);
  }
  if (res.status === 404) return new AiError('unavailable', `Model not available: ${message}`, 60 * MINUTE);
  const busy = res.status === 503 || /high demand|overloaded|unavailable/i.test(message);
  return new AiError('unavailable', `Gemini error: ${message}`, busy ? MINUTE : 0);
}

async function post(model, method, o, timeoutMs) {
  const send = () =>
    fetch(`${GEMINI_BASE_URL}/${model}:${method}`, {
      method: 'POST',
      // The key goes in a header, never in the URL, so it can't end up in logs.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify(requestBody(model, o)),
      signal: AbortSignal.timeout(timeoutMs),
    });

  let res = await send();
  if (res.ok) return res;
  let err = await failure(res);
  if (res.status === 400 && /thinking/i.test(err.message) && !rejectsThinkingConfig.has(model)) {
    rejectsThinkingConfig.add(model);
    res = await send();
    if (res.ok) return res;
    err = await failure(res);
  }
  throw err;
}

/** The answer text of a response (or one streamed chunk), skipping the model's "thoughts". */
function extractText(data) {
  if (data.promptFeedback?.blockReason) throw new AiError('blocked', 'Gemini declined to answer this request.');
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');
  if (!text && candidate?.finishReason === 'SAFETY') throw new AiError('blocked', 'Gemini declined to answer this request.');
  return text;
}

/** Parse JSON even if the model wrapped it in a code fence or added a sentence around it. */
export function parseJsonLoose(text) {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
    throw new AiError('bad_response', 'Gemini returned malformed JSON.');
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Options: { system, prompt, history?, temperature?, tier? }
 *  tier "fast"  — Lite models first (~1–2 s): chat, steps, Plan my day, writing help
 *  tier "smart" — full Flash models first: roadmaps, weekly review
 */
export function generateText(o) {
  return withFallback(o.tier ?? 'fast', 30_000, async (model, timeoutMs) => {
    const res = await post(model, 'generateContent', o, timeoutMs);
    const text = extractText(await res.json()).trim();
    if (!text) throw new AiError('bad_response', 'Gemini returned an empty answer.');
    return text;
  });
}

/** Like generateText, plus `schema`: the answer is parsed JSON matching it. */
export function generateJson(o) {
  return withFallback(o.tier ?? 'fast', 30_000, async (model, timeoutMs) => {
    const res = await post(model, 'generateContent', o, timeoutMs);
    return parseJsonLoose(extractText(await res.json()));
  });
}

/**
 * Stream the answer as text chunks. Falls back to the next model only if one
 * fails before answering; once text has reached the user it can't restart.
 */
export async function* streamText(o) {
  const res = await withFallback(o.tier ?? 'fast', 60_000, (model, timeoutMs) =>
    post(model, 'streamGenerateContent?alt=sse', o, timeoutMs),
  );
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Server-Sent Events: one "data: {json}" line per chunk.
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith('data:')) continue;
      let chunk;
      try {
        chunk = JSON.parse(line.slice(5));
      } catch {
        continue; // incomplete or unknown event
      }
      const text = extractText(chunk);
      if (text) yield text;
    }
  }
}
