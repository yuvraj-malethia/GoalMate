/** Thin fetch wrapper. Cookies carry the session, so there is no token handling here. */

export class ApiError extends Error {
  status;
  code;
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
  /** AI features failing because no key/quota — shown differently from real errors. */
  get isAiSetup() {
    return this.code === 'not_configured' || this.code === 'invalid_key';
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Can’t reach the server. Is it running?');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data.code);
  }
  return res.json();
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};

export const qs = (params) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export function errorMessage(e) {
  return e instanceof Error ? e.message : 'Something went wrong.';
}

/**
 * Streams a chat reply from POST /api/ai/chat (Server-Sent Events over fetch).
 * Calls onDelta for every chunk and resolves when the server sends `done`.
 */
export async function streamChat(thread, message, onDelta, signal) {
  let res;
  try {
    res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread, message }),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') return { messages: [] };
    throw new ApiError(0, 'Can’t reach the server. Is it running?');
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error || 'The AI request failed.', data.code);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let error;
  let messages = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = /^event: (.*)$/m.exec(raw)?.[1];
        const data = /^data: (.*)$/m.exec(raw)?.[1];
        if (!event || !data) continue;
        const payload = JSON.parse(data);
        if (event === 'delta') onDelta(payload.text);
        if (event === 'error') error = payload.message;
        if (event === 'done') messages = payload.messages ?? [];
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') error = 'The connection dropped before the answer finished.';
  }
  return { error, messages };
}
