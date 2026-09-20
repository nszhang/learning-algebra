// Tiny API client with JWT handling.
// BASE_URL lets the app live under a subpath (e.g. /learning-algebra/):
// built output calls /learning-algebra/api/..., dev output calls /api/...
// (which the Vite dev server proxies to :3001).
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

let token = localStorage.getItem('aa_token') || null;

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('aa_token', t);
  else localStorage.removeItem('aa_token');
}

export async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
