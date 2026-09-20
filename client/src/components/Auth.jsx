import { useState } from 'react';
import { api } from '../api.js';

// Login only — accounts (students and teachers) are created by an admin.
export default function Auth({ onAuth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const data = await api('POST', '/api/auth/login', { username, password });
      onAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="screen-auth" className="active">
      <div className="auth-hero">
        <div className="auth-card">
          <div className="brand">
            <span className="brand-logo">∑</span>
            <h1>Algebra<span className="brand-accent">Ace</span></h1>
          </div>
          <p className="tagline">Master algebra, one skill at a time. Earn medals, ribbons, and stars as your SmartScore climbs to 100!</p>

          <form id="form-auth" onSubmit={submit} autoComplete="off">
            <label>Username
              <input type="text" maxLength="20" required placeholder="e.g. math_wizard"
                value={username} onChange={e => setUsername(e.target.value)} />
            </label>
            <label>Password
              <input type="password" maxLength="40" required placeholder="••••••"
                value={password} onChange={e => setPassword(e.target.value)} />
            </label>
            <p className="auth-error">{error}</p>
            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} type="submit" disabled={busy}>
              {busy ? '…' : 'Log in'}
            </button>
          </form>
          <p className="auth-hint">Don't have an account? Ask your teacher or the site admin to create one for you.</p>
        </div>

        <div className="auth-side">
          <h2>Why students love AlgebraAce</h2>
          <ul className="feature-list">
            <li>🏅 <strong>SmartScore 0–100</strong> — watch your score climb as you learn</li>
            <li>🎉 <strong>Awards &amp; prizes</strong> — medals, badges, and stars for every milestone</li>
            <li>📊 <strong>Progress tracking</strong> — your growth, saved to your account</li>
            <li>💡 <strong>Step-by-step explanations</strong> — learn from every mistake</li>
            <li>🔥 <strong>Challenge Zone</strong> — prove mastery above 90!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
