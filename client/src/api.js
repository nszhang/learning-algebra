// Tiny API client with JWT handling.
let token = localStorage.getItem('aa_token') || null;

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('aa_token', t);
  else localStorage.removeItem('aa_token');
}

export async function api(method, path, body) {
  const res = await fetch(path, {
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
