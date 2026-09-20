import { useEffect, useState } from 'react';
import { ri } from '../skills.js';
import { fmtNum } from '../lesson.js';

const RANGE = 10;          // math coords: -10..10
const SIZE = 440;          // svg px
const SCALE = SIZE / (RANGE * 2);
const toX = x => (x + RANGE) * SCALE;
const toY = y => (RANGE - y) * SCALE;

// segment of y = mx + b clipped to the visible square [-10,10]²
function clipLine(m, b) {
  const pts = [];
  for (const x of [-RANGE, RANGE]) {
    const y = m * x + b;
    if (Math.abs(y) <= RANGE + 1e-9) pts.push([x, y]);
  }
  if (m !== 0) for (const y of [-RANGE, RANGE]) {
    const x = (y - b) / m;
    if (Math.abs(x) <= RANGE + 1e-9 && pts.every(p => Math.abs(p[0] - x) > 1e-9)) pts.push([x, y]);
  }
  return pts.length >= 2 ? [pts[0], pts[1]] : null;
}

function Line({ m, b, dashed, color, width }) {
  const seg = clipLine(m, b);
  if (!seg) return null;
  return <line x1={toX(seg[0][0])} y1={toY(seg[0][1])} x2={toX(seg[1][0])} y2={toY(seg[1][1])}
    stroke={color} strokeWidth={width} strokeDasharray={dashed ? '8 6' : undefined} strokeLinecap="round" />;
}

export default function GraphPlayground({ toast, fireConfetti }) {
  const [m, setM] = useState(1);
  const [b, setB] = useState(2);
  const [mode, setMode] = useState('explore'); // 'explore' | 'match'
  const [target, setTarget] = useState(() => ({ m: ri(-4, 4) || 2, b: ri(-8, 8) }));
  const [won, setWon] = useState(false);

  const matched = mode === 'match' && m === target.m && b === target.b;

  const change = setter => e => setter(Number(e.target.value));

  // celebrate once per match
  useEffect(() => {
    if (matched && !won) {
      setWon(true);
      fireConfetti?.();
      toast?.('🎯', 'Line matched! Great eye!');
    }
  }, [matched, won, fireConfetti, toast]);

  function newTarget() {
    let t;
    do { t = { m: ri(-4, 4) || 3, b: ri(-8, 8) }; } while (t.m === m && t.b === b);
    setTarget(t);
    setWon(false);
  }

  // slope triangle from (0,b) to (1, b+m), drawn when fully visible
  const triVisible = Math.abs(b) <= RANGE && Math.abs(b + m) <= RANGE;

  const eqText = `y = ${m === 0 ? '' : (m === 1 ? 'x' : m === -1 ? '−x' : fmtNum(m) + 'x')}${m === 0 ? fmtNum(b) : (b > 0 ? ' + ' + b : b < 0 ? ' − ' + Math.abs(b) : '')}`;

  return (
    <div className="learn-grid">
      <section className="lesson-board">
        <div className="lesson-controls">
          <div className="level-tabs">
            <button type="button" className={'role-tab' + (mode === 'explore' ? ' active' : '')}
              onClick={() => setMode('explore')}>🧭 Explore</button>
            <button type="button" className={'role-tab' + (mode === 'match' ? ' active' : '')}
              onClick={() => setMode('match')}>🎯 Match the line</button>
          </div>
          {mode === 'match' && (
            <button className="btn btn-ghost" type="button" onClick={newTarget}>🎲 New target</button>
          )}
        </div>

        <div className="graph-wrap">
          <svg width={SIZE} height={SIZE} className="graph-svg">
            {/* grid */}
            {Array.from({ length: RANGE * 2 + 1 }, (_, i) => i - RANGE).map(v => (<g key={v}>
              <line x1={toX(v)} y1={0} x2={toX(v)} y2={SIZE} stroke={v === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth={v === 0 ? 2 : 1} />
              <line x1={0} y1={toY(v)} x2={SIZE} y2={toY(v)} stroke={v === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth={v === 0 ? 2 : 1} />
              {v !== 0 && v % 2 === 0 && (<>
                <text x={toX(v)} y={toY(0) + 14} fontSize="10" fill="#94a3b8" textAnchor="middle">{v}</text>
                <text x={toX(0) + 5} y={toY(v) + 3} fontSize="10" fill="#94a3b8">{v}</text>
              </>)}
            </g>))}

            {/* target line (match mode) */}
            {mode === 'match' && <Line m={target.m} b={target.b} dashed color={matched ? '#16a34a' : '#a855f7'} width={3} />}

            {/* slope triangle */}
            {triVisible && m !== 0 && (<g>
              <path d={`M ${toX(0)} ${toY(b)} L ${toX(1)} ${toY(b)} L ${toX(1)} ${toY(b + m)}`}
                fill="rgba(245,158,11,.18)" stroke="#f59e0b" strokeWidth="2" />
              <text x={toX(0.5)} y={toY(b) + (m > 0 ? 16 : -8)} fontSize="12" fill="#b45309" textAnchor="middle">run = 1</text>
              <text x={toX(1) + 6} y={toY(b + m / 2)} fontSize="12" fill="#b45309">rise = {fmtNum(m)}</text>
            </g>)}

            {/* the student's line */}
            <Line m={m} b={b} color={matched ? '#16a34a' : '#4f46e5'} width={4} />

            {/* y-intercept dot */}
            {Math.abs(b) <= RANGE && (<g>
              <circle cx={toX(0)} cy={toY(b)} r="6" fill={matched ? '#16a34a' : '#4f46e5'} stroke="#fff" strokeWidth="2" />
              <text x={toX(0) - 8} y={toY(b) - 10} fontSize="12" fontWeight="700"
                fill={matched ? '#16a34a' : '#4f46e5'} textAnchor="end">(0, {fmtNum(b)})</text>
            </g>)}
          </svg>

          <div className="graph-eq">{eqText}</div>
          {mode === 'match' && (
            <div className={'match-status' + (matched ? ' won' : '')}>
              {matched ? '🎉 Perfect match!' : `Match the ${won ? '' : 'dashed purple '}line — adjust m and b!`}
            </div>
          )}
        </div>
      </section>

      <aside className="lesson-steps">
        <h4>🎛️ Controls</h4>
        <label className="slider-row">
          <span><strong>m</strong> (slope) = <strong className="slider-val">{fmtNum(m)}</strong></span>
          <input type="range" min="-5" max="5" step="0.5" value={m} onChange={change(setM)} />
        </label>
        <label className="slider-row">
          <span><strong>b</strong> (y-intercept) = <strong className="slider-val">{fmtNum(b)}</strong></span>
          <input type="range" min="-10" max="10" step="1" value={b} onChange={change(setB)} />
        </label>
        <div className="graph-facts">
          <p>📈 <strong>Slope m</strong> = rise ÷ run. Watch the orange triangle: for every 1 step right, the line rises by m.</p>
          <p>📍 <strong>y-intercept b</strong> is where the line crosses the y-axis: the point (0, b).</p>
          <p>↕️ Positive m slopes up, negative m slopes down, m = 0 is flat.</p>
        </div>
      </aside>
    </div>
  );
}
