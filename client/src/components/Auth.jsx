import { useState } from 'react';
import { api } from '../api.js';

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('student');
  const [username, setUsername] = useState('');
  const [display, setDisplay] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const data = mode === 'signup'
        ? await api('POST', '/api/auth/signup', { username, displayName: display, password, role })
        : await api('POST', '/api/auth/login', { username, password });
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

          <div className="auth-tabs">
            <button type="button" className={'auth-tab' + (mode === 'login' ? ' active' : '')}
              onClick={() => { setMode('login'); setError(''); }}>Log in</button>
            <button type="button" className={'auth-tab' + (mode === 'signup' ? ' active' : '')}
              onClick={() => { setMode('signup'); setError(''); }}>Sign up</button>
          </div>

          <form id="form-auth" onSubmit={submit} autoComplete="off">
            <label>Username
              <input type="text" maxLength="20" required placeholder="e.g. math_wizard"
                value={username} onChange={e => setUsername(e.target.value)} />
            </label>
            {mode === 'signup' && (<>
              <label>Display name
                <input type="text" maxLength="30" placeholder="e.g. Alex"
                  value={display} onChange={e => setDisplay(e.target.value)} />
              </label>
              <div id="role-row">
                <span className="role-label">I am a…</span>
                <div className="role-tabs">
                  <button type="button" className={'role-tab' + (role === 'student' ? ' active' : '')}
                    onClick={() => setRole('student')}>🎒 Student</button>
                  <button type="button" className={'role-tab' + (role === 'teacher' ? ' active' : '')}
                    onClick={() => setRole('teacher')}>🍎 Teacher</button>
                </div>
              </div>
            </>)}
            <label>Password
              <input type="password" maxLength="40" required placeholder="••••••"
                value={password} onChange={e => setPassword(e.target.value)} />
            </label>
            <p className="auth-error">{error}</p>
            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} type="submit" disabled={busy}>
              {busy ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
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
