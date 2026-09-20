import { useEffect, useRef, useState } from 'react';
import {
  LEVELS, generateEquation, applyOp, cancelledIds,
  fmtSignedCoef, fmtSigned, termText
} from '../lesson.js';

const PHASE_MS = { op: 1100, cancel: 900 };

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
  const [phase, setPhase] = useState('idle'); // 'idle' | 'op' | 'cancel'
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const timers = useRef([]);

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function newEquation(lv = level) {
    timers.current.forEach(clearTimeout);
    const e = generateEquation(lv);
    setEq(e); setLeft(e.left); setRight(e.right);
    setStepIdx(0); setPhase('idle'); setPlaying(false); setDone(false);
  }

  function runStep() {
    if (stepIdx >= eq.steps.length || phase !== 'idle') return;
    setPhase('op');
    later(() => setPhase('cancel'), PHASE_MS.op);
    later(() => {
      const [l, r] = applyOp(left, right, eq.steps[stepIdx].op);
      setLeft(l); setRight(r);
      const next = stepIdx + 1;
      setStepIdx(next);
      setPhase('idle');
      if (next >= eq.steps.length) {
        setDone(true);
        setPlaying(false);
        fireConfetti?.();
        toast?.('🎓', `Solved! x = ${eq.solution}`);
      }
    }, PHASE_MS.op + PHASE_MS.cancel);
  }

  // autoplay
  useEffect(() => {
    if (!playing || phase !== 'idle' || done) return;
    const t = setTimeout(runStep, 700);
    return () => clearTimeout(t);
  });

  const currentOp = stepIdx < eq.steps.length ? eq.steps[stepIdx].op : null;

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
          <div>
            <button className="btn btn-primary" type="button"
              onClick={() => (playing ? setPlaying(false) : (done ? (newEquation(), setPlaying(true)) : setPlaying(true)))}
              disabled={phase !== 'idle' && !playing}>
              {playing ? '⏸ Pause' : done ? '↺ Again' : stepIdx > 0 ? '▶ Resume' : '▶ Play'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={runStep}
              disabled={playing || phase !== 'idle' || done}>⏭ Step</button>
            <button className="btn btn-ghost" type="button" onClick={() => newEquation()}>🎲 New equation</button>
          </div>
        </div>

        <div className="eq-stage">
          <div className="eq-row">
            <Side terms={left} op={currentOp} phase={phase} />
            <span className="eq-equals">=</span>
            <Side terms={right} op={currentOp} phase={phase} />
          </div>
          {/* balance beam */}
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
