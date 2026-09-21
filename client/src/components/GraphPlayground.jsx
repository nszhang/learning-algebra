import { useEffect, useRef, useState } from 'react';
import { ri } from '../skills.js';
import { fmtNum } from '../lesson.js';

const BASE_RANGE = 10;     // visible math units at 1× zoom
const SIZE = 440;          // svg px
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 1000;
const ZOOM_STEP = 1.25;

// "nice" 1-2-5 step so ~10 grid intervals always fill the view
function niceStep(span) {
  const raw = span / 10;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const mult of [1, 2, 5, 10]) if (mult * mag >= raw) return mult * mag;
  return 10 * mag;
}

// tick values across [-range, range] at the given step
function ticks(range, step) {
  const out = [];
  const n = Math.ceil(range / step);
  for (let i = -n; i <= n; i++) {
    const v = i * step;
    if (Math.abs(v) <= range + 1e-9) out.push(v);
  }
  return out;
}

function fmtTick(v, step) {
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return String(Number(v.toFixed(Math.min(decimals, 12))));
}

function fmtZoom(z) {
  return z >= 10 ? String(Math.round(z)) : String(Number(z.toFixed(2)));
}

// segment of y = mx + b clipped to the visible square [-range, range]²
function clipLine(m, b, range) {
  const pts = [];
  for (const x of [-range, range]) {
    const y = m * x + b;
    if (Math.abs(y) <= range + 1e-9) pts.push([x, y]);
  }
  if (m !== 0) for (const y of [-range, range]) {
    const x = (y - b) / m;
    if (Math.abs(x) <= range + 1e-9 && pts.every(p => Math.abs(p[0] - x) > 1e-9)) pts.push([x, y]);
  }
  return pts.length >= 2 ? [pts[0], pts[1]] : null;
}

function Line({ m, b, range, scale, dashed, color, width }) {
  const seg = clipLine(m, b, range);
  if (!seg) return null;
  const toX = x => (x + range) * scale;
  const toY = y => (range - y) * scale;
  return <line x1={toX(seg[0][0])} y1={toY(seg[0][1])} x2={toX(seg[1][0])} y2={toY(seg[1][1])}
    stroke={color} strokeWidth={width} strokeDasharray={dashed ? '8 6' : undefined} strokeLinecap="round" />;
}

export default function GraphPlayground({ toast, fireConfetti }) {
  const [m, setM] = useState(1);
  const [b, setB] = useState(2);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState('explore'); // 'explore' | 'match'
  const [target, setTarget] = useState(() => ({ m: ri(-4, 4) || 2, b: ri(-8, 8) }));
  const [won, setWon] = useState(false);
  const svgRef = useRef(null);

  const range = BASE_RANGE / zoom;
  const scale = SIZE / (range * 2);
  const step = niceStep(range * 2);
  const toX = x => (x + range) * scale;
  const toY = y => (range - y) * scale;

  const matched = mode === 'match' && m === target.m && b === target.b;
  const change = setter => e => setter(Number(e.target.value));

  // mouse-scroll zoom (native listener: React's onWheel is passive and
  // cannot preventDefault to stop the page scrolling)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * factor * 1000) / 1000)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = factor =>
    setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * factor * 1000) / 1000)));

  // − / + buttons that nudge a value in clean increments (works even where
  // range-slider dragging is awkward)
  function Stepper({ value, set, step: st, min, max }) {
    const nudge = dir => set(Math.min(max, Math.max(min, Math.round((value + dir * st) / st) * st)));
    return (
      <div className="stepper">
        <button type="button" className="btn btn-ghost stepper-btn"
          onClick={() => nudge(-1)} disabled={value <= min} aria-label="decrease">−</button>
        <input type="range" min={min} max={max} step={st} value={value}
          onChange={change(set)} aria-label="slider" />
        <button type="button" className="btn btn-ghost stepper-btn"
          onClick={() => nudge(1)} disabled={value >= max} aria-label="increase">+</button>
      </div>
    );
  }

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
  const triVisible = Math.abs(b) <= range && Math.abs(b + m) <= range;

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
          <svg ref={svgRef} width={SIZE} height={SIZE} className="graph-svg" aria-label="coordinate plane">
            {/* grid + ticks (adaptive to zoom) */}
            {ticks(range, step).map(v => (<g key={v}>
              <line x1={toX(v)} y1={0} x2={toX(v)} y2={SIZE} stroke={v === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth={v === 0 ? 2 : 1} />
              <line x1={0} y1={toY(v)} x2={SIZE} y2={toY(v)} stroke={v === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth={v === 0 ? 2 : 1} />
              {v !== 0 && (<>
                <text x={toX(v)} y={toY(0) + 14} fontSize="10" fill="#94a3b8" textAnchor="middle">{fmtTick(v, step)}</text>
                <text x={toX(0) + 5} y={toY(v) + 3} fontSize="10" fill="#94a3b8">{fmtTick(v, step)}</text>
              </>)}
            </g>))}

            {/* target line (match mode) */}
            {mode === 'match' && <Line m={target.m} b={target.b} range={range} scale={scale} dashed color={matched ? '#16a34a' : '#a855f7'} width={3} />}

            {/* slope triangle */}
            {triVisible && m !== 0 && (<g>
              <path d={`M ${toX(0)} ${toY(b)} L ${toX(1)} ${toY(b)} L ${toX(1)} ${toY(b + m)}`}
                fill="rgba(245,158,11,.18)" stroke="#f59e0b" strokeWidth="2" />
              <text x={toX(0.5)} y={toY(b) + (m > 0 ? 16 : -8)} fontSize="12" fill="#b45309" textAnchor="middle">run = 1</text>
              <text x={toX(1) + 6} y={toY(b + m / 2)} fontSize="12" fill="#b45309">rise = {fmtNum(m)}</text>
            </g>)}

            {/* the student's line */}
            <Line m={m} b={b} range={range} scale={scale} color={matched ? '#16a34a' : '#4f46e5'} width={4} />

            {/* y-intercept dot */}
            {Math.abs(b) <= range && (<g>
              <circle cx={toX(0)} cy={toY(b)} r="6" fill={matched ? '#16a34a' : '#4f46e5'} stroke="#fff" strokeWidth="2" />
              <text x={toX(0) - 8} y={toY(b) - 10} fontSize="12" fontWeight="700"
                fill={matched ? '#16a34a' : '#4f46e5'} textAnchor="end">(0, {fmtNum(b)})</text>
            </g>)}
          </svg>

          <div className="zoom-bar">
            <button type="button" className="btn btn-ghost stepper-btn" aria-label="zoom out"
              onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={zoom <= ZOOM_MIN}>−</button>
            <span className="zoom-label">🔍 {fmtZoom(zoom)}×</span>
            <button type="button" className="btn btn-ghost stepper-btn" aria-label="zoom in"
              onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX}>+</button>
            <button type="button" className="btn btn-ghost" onClick={() => setZoom(1)}
              disabled={zoom === 1}>Reset</button>
            <span className="muted zoom-hint">scroll over the graph to zoom (0.1× – 1000×)</span>
          </div>

          <div className="graph-eq">{eqText}</div>
          {mode === 'match' && (
            <div className={'match-status' + (matched ? ' won' : '')}>
              {matched ? '🎉 Perfect match!' : 'Match the dashed purple line — adjust m and b!'}
            </div>
          )}
        </div>
      </section>

      <aside className="lesson-steps">
        <h4>🎛️ Controls</h4>
        <label className="slider-row">
          <span><strong>m</strong> (slope) = <strong className="slider-val">{fmtNum(m)}</strong></span>
          <Stepper value={m} set={setM} step={0.5} min={-5} max={5} />
        </label>
        <div className="preset-row">
          {[-2, -1, 0, 1, 2].map(v => (
            <button key={v} type="button"
              className={'preset-btn' + (m === v ? ' active' : '')}
              onClick={() => setM(v)}>m = {fmtNum(v)}</button>
          ))}
        </div>
        <label className="slider-row">
          <span><strong>b</strong> (y-intercept) = <strong className="slider-val">{fmtNum(b)}</strong></span>
          <Stepper value={b} set={setB} step={1} min={-10} max={10} />
        </label>
        <div className="graph-facts">
          <p>📈 <strong>Slope m</strong> = rise ÷ run. Watch the orange triangle: for every 1 step right, the line rises by m.</p>
          <p>📍 <strong>y-intercept b</strong> is where the line crosses the y-axis: the point (0, b).</p>
          <p>↕️ Positive m slopes up, negative m slopes down, m = 0 is flat.</p>
          <p>🔍 Scroll on the graph to zoom — the axis scale adapts automatically.</p>
        </div>
      </aside>
    </div>
  );
}
