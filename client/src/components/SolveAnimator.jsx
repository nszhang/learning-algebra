import { useEffect, useState } from 'react';
import {
  LEVELS, generateEquation, applyOp, cancelledIds,
  fmtSignedCoef, fmtSigned, termText
} from '../lesson.js';

const SPEEDS = {
  slow:   { label: '🐢 Slow',   op: 1700, cancel: 1300, gap: 1200 },
  normal: { label: '🚶 Normal', op: 1100, cancel: 900,  gap: 700 },
  fast:   { label: '🐇 Fast',   op: 550,  cancel: 400,  gap: 300 }
};

function TermChip({ term, first, fading }) {
  return (
    <span className={'term-chip' + (fading ? ' chip-fade' : '')}>
      {termText(term, first)}
    </span>
  );
}

function Side({ terms, op, phase }) {
  const cancelled = phase === 'cancel' && op ? cancelledIds(terms, op) : new Set();
  return (
    <div className="eq-side">
      {terms.length === 0 && <span className="term-chip">0</span>}
      {terms.map((t, i) => (
        <TermChip key={t.id} term={t} first={i === 0} fading={cancelled.has(t.id)} />
      ))}
      {(phase === 'op' || phase === 'cancel') && op && op.kind === 'term' && (<>
        {op.coef !== 0 &&
          <span className={'term-chip op-chip' + (phase === 'cancel' ? ' chip-fade' : '')}>{fmtSignedCoef(op.coef)}</span>}
        {op.val !== 0 &&
          <span className={'term-chip op-chip' + (phase === 'cancel' ? ' chip-fade' : '')}>{fmtSigned(op.val)}</span>}
      </>)}
      {(phase === 'op' || phase === 'cancel') && op && op.kind === 'div' && (
        <div className={'div-bar' + (phase === 'cancel' ? ' chip-fade' : '')}>÷ {op.by}</div>
      )}
    </div>
  );
}

export default function SolveAnimator({ toast, fireConfetti }) {
  const [level, setLevel] = useState(2);
  const [eq, setEq] = useState(() => generateEquation(2));
  const [left, setLeft] = useState(eq.left);
  const [right, setRight] = useState(eq.right);
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState('idle');   // 'idle' | 'op' | 'cancel'
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);  // freezes mid-phase
  const [done, setDone] = useState(false);
  const [speed, setSpeed] = useState('normal');
  const [history, setHistory] = useState([]);   // snapshots before each step

  const d = SPEEDS[speed];
  const currentOp = stepIdx < eq.steps.length ? eq.steps[stepIdx].op : null;

  function finishEquation() {
    setDone(true);
    setPlaying(false);
    fireConfetti?.();
    toast?.('🎓', `Solved! x = ${eq.solution}`);
  }

  function commitStep() {
    const [l, r] = applyOp(left, right, eq.steps[stepIdx].op);
    setHistory(h => [...h, { left, right }]);
    setLeft(l); setRight(r);
    const next = stepIdx + 1;
    setStepIdx(next);
    setPhase('idle');
    if (next >= eq.steps.length) finishEquation();
  }

  // phase progression: runs whenever a phase is active and not frozen
  useEffect(() => {
    if (phase === 'idle' || paused) return;
    if (phase === 'op') {
      const t = setTimeout(() => setPhase('cancel'), d.op);
      return () => clearTimeout(t);
    }
    const t = setTimeout(commitStep, d.cancel);
    return () => clearTimeout(t);
  }); // intentionally dep-free: closures stay fresh every render

  // autoplay: start the next step after a gap
  useEffect(() => {
    if (!playing || paused || phase !== 'idle' || done) return;
    const t = setTimeout(() => setPhase('op'), d.gap);
    return () => clearTimeout(t);
  });

  function newEquation(lv = level) {
    const e = generateEquation(lv);
    setEq(e); setLeft(e.left); setRight(e.right);
    setStepIdx(0); setPhase('idle'); setPlaying(false); setPaused(false);
    setDone(false); setHistory([]);
  }

  function playPause() {
    if (done) { newEquation(); setPlaying(true); return; }
    if (playing) { setPlaying(false); setPaused(true); return; }  // freeze now
    setPlaying(true); setPaused(false);
    if (phase === 'idle') setPhase('op');
  }

  function stepForward() {
    if (done) return;
    setPlaying(false); setPaused(false);
    if (phase === 'idle') setPhase('op');   // phase chain completes this one step
  }

  function stepBack() {
    if (phase !== 'idle' || stepIdx === 0) return;
    const prev = history[stepIdx - 1];
    setLeft(prev.left); setRight(prev.right);
    setHistory(h => h.slice(0, stepIdx - 1));
    setStepIdx(stepIdx - 1);
    setDone(false);
  }

  const busy = phase !== 'idle';

  return (
    <div className="learn-grid">
      <section className="lesson-board">
        <div className="lesson-controls">
          <div className="level-tabs">
            {LEVELS.map(l => (
              <button key={l.id} type="button"
                className={'role-tab' + (level === l.id ? ' active' : '')}
                onClick={() => { setLevel(l.id); newEquation(l.id); }}>
                {l.name}
              </button>
            ))}
          </div>
          <div className="level-tabs">
            {Object.entries(SPEEDS).map(([id, s]) => (
              <button key={id} type="button"
                className={'role-tab' + (speed === id ? ' active' : '')}
                onClick={() => setSpeed(id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lesson-controls">
          <div className="anim-controls">
            <button className="btn btn-primary" type="button" onClick={playPause}>
              {playing ? '⏸ Pause' : done ? '↺ Replay' : paused || stepIdx > 0 ? '▶ Resume' : '▶ Play'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={stepBack}
              disabled={playing || busy || stepIdx === 0}>⏮ Back</button>
            <button className="btn btn-ghost" type="button" onClick={stepForward}
              disabled={playing || done}>⏭ Step</button>
            <button className="btn btn-ghost" type="button" onClick={() => newEquation()}>🎲 New equation</button>
          </div>
          <div className="anim-progress muted">
            {done ? 'Solved!' : `Step ${Math.min(stepIdx + 1, eq.steps.length)} of ${eq.steps.length}`}
            {paused && busy && ' • ⏸ paused'}
          </div>
        </div>

        <div className="eq-stage">
          <div className="eq-row">
            <Side terms={left} op={currentOp} phase={phase} />
            <span className="eq-equals">=</span>
            <Side terms={right} op={currentOp} phase={phase} />
          </div>
          <div className="balance">
            <div className="balance-beam" />
            <div className="balance-fulcrum" />
          </div>
          <div className="balance-caption">Both sides always stay balanced — do the same thing to each side!</div>
        </div>

        {done && (
          <div className="feedback good lesson-done">
            <h3>🎉 Solved! x = {eq.solution}</h3>
            <p className="explain">{eq.check}</p>
          </div>
        )}
      </section>

      <aside className="lesson-steps">
        <h4>📋 Steps</h4>
        {eq.steps.map((s, i) => (
          <div key={i} className={
            'lesson-step' +
            (i < stepIdx ? ' step-done' : i === stepIdx && !done ? ' step-current' : '')
          }>
            <span className="step-num">{i < stepIdx ? '✓' : i + 1}</span>
            <div>
              <div className="step-text">{s.text}</div>
              {i === stepIdx && <div className="step-why muted">{s.why}</div>}
            </div>
          </div>
        ))}
        {done && (
          <div className="lesson-step step-done">
            <span className="step-num">🏁</span>
            <div><div className="step-text"><strong>x = {eq.solution}</strong></div></div>
          </div>
        )}
      </aside>
    </div>
  );
}
