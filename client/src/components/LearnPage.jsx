import { useState } from 'react';
import SolveAnimator from './SolveAnimator.jsx';
import GraphPlayground from './GraphPlayground.jsx';

export default function LearnPage({ toast, fireConfetti }) {
  const [tab, setTab] = useState('solve');
  return (
    <main className="page">
      <div className="page-head">
        <h2>🎓 Learn</h2>
        <p className="muted">Watch how equations get solved, then play with lines on the graph.</p>
      </div>
      <div className="auth-tabs" style={{ maxWidth: 420, marginBottom: 20 }}>
        <button type="button" className={'auth-tab' + (tab === 'solve' ? ' active' : '')}
          onClick={() => setTab('solve')}>🧮 Solve step-by-step</button>
        <button type="button" className={'auth-tab' + (tab === 'graph' ? ' active' : '')}
          onClick={() => setTab('graph')}>📈 Graph playground</button>
      </div>
      {tab === 'solve'
        ? <SolveAnimator toast={toast} fireConfetti={fireConfetti} />
        : <GraphPlayground toast={toast} fireConfetti={fireConfetti} />}
    </main>
  );
}
