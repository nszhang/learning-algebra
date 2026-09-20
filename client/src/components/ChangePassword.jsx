import { useState } from 'react';
import { api } from '../api.js';

// Modal: change own password (any role).
export default function ChangePassword({ onClose, toast }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('POST', '/api/auth/password', { currentPassword: current, newPassword: next });
      toast('✅', 'Password changed');
      onClose();
    } catch (err) {
      toast('⚠️', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <h3>🔑 Change password</h3>
        <form className="form-vertical" onSubmit={submit}>
          <label>Current password
            <input type="password" required value={current}
              onChange={e => setCurrent(e.target.value)} />
          </label>
          <label>New password
            <input type="password" minLength="4" maxLength="40" required value={next}
              onChange={e => setNext(e.target.value)} />
          </label>
          <div className="modal-actions">
            <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? '…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
