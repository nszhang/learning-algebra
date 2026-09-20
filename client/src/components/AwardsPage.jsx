import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function AwardsPage({ me }) {
  const [meta, setMeta] = useState([]);

  useEffect(() => {
    api('GET', '/api/meta/awards').then(setMeta).catch(() => {});
  }, []);

  const earned = new Map((me?.awards || []).map(a => [a.award_id, a.earned_at]));

  return (
    <main className="page">
      <div className="page-head">
        <h2>My Awards</h2>
        <p className="muted">Earn badges by practicing, building streaks, and mastering skills.</p>
      </div>
      <div className="awards-grid">
        {meta.map(a => {
          const at = earned.get(a.id);
          return (
            <div className={'award-card ' + (at ? 'earned' : 'locked')} key={a.id}>
              <div className="award-emoji">{a.emoji}</div>
              <h4>{a.name}</h4>
              <p>{a.desc}</p>
              {at && <span className="award-date">Earned {new Date(at).toLocaleDateString()}</span>}
            </div>
          );
        })}
      </div>
    </main>
  );
}
