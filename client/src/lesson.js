// Lesson engine: linear-equation model, step derivation, and application.
// Pure functions — unit-testable without a browser.
import { ri } from './skills.js';

const rnz = (min, max) => { let n = 0; while (n === 0) n = ri(min, max); return n; };
let keyCounter = 0;
const key = () => 't' + (++keyCounter);

const varTerm = coef => ({ id: key(), type: 'var', coef });
const constTerm = val => ({ id: key(), type: 'const', val });

export const LEVELS = [
  { id: 1, name: 'One-step', example: 'x + 5 = 12' },
  { id: 2, name: 'Two-step', example: '3x + 5 = 14' },
  { id: 3, name: 'Both sides', example: '5x + 2 = 2x + 14' }
];

// Generate ax + b = cx + d with integer solution s, plus the step list.
export function generateEquation(level) {
  let a, c;
  if (level === 1) { a = 1; c = 0; }
  else if (level === 2) { a = ri(2, 9); c = 0; }
  else { a = ri(2, 7); c = ri(2, 7); while (c === a) c = ri(2, 7); }
  const s = ri(-6, 6);
  const b = rnz(-9, 9);
  const d = (a - c) * s + b;

  const steps = [];
  if (c !== 0) steps.push({
    text: `Subtract ${fmtCoef(c)} from both sides`,
    why: 'Get all the x-terms together on one side.',
    op: { kind: 'term', coef: -c, val: 0 }
  });
  steps.push({
    text: `${b > 0 ? 'Subtract' : 'Add'} ${Math.abs(b)} ${b > 0 ? 'from' : 'to'} both sides`,
    why: 'Get the constants together on the other side.',
    op: { kind: 'term', coef: 0, val: -b }
  });
  steps.push({
    text: `Divide both sides by ${a - c}`,
    why: 'Isolate x — whatever you do to one side, you must do to the other!',
    op: { kind: 'div', by: a - c }
  });

  return {
    a, b, c, d, solution: s,
    left: [varTerm(a), constTerm(b)],
    right: c !== 0 ? [varTerm(c), constTerm(d)] : [constTerm(d)],
    steps,
    check: `Check: ${a}(${fmtNum(s)})${b >= 0 ? ' + ' + b : ' − ' + Math.abs(b)} = ${a * s + b} ✓`
  };
}

// Combine like terms and drop zeros. Keeps ≤1 var + ≤1 const per side.
function combine(terms) {
  let coef = 0, val = 0;
  for (const t of terms) t.type === 'var' ? coef += t.coef : val += t.val;
  const out = [];
  if (coef) out.push(varTerm(coef));
  if (val) out.push(constTerm(val));
  return out;
}

// Apply one step's operation to both sides → [newLeft, newRight]
export function applyOp(left, right, op) {
  if (op.kind === 'div') {
    const div = t => t.type === 'var'
      ? { ...t, coef: t.coef / op.by }
      : { ...t, val: t.val / op.by };
    return [combine(left.map(div)), combine(right.map(div))];
  }
  const add = side => combine([
    ...side,
    ...(op.coef ? [varTerm(op.coef)] : []),
    ...(op.val ? [constTerm(op.val)] : [])
  ]);
  return [add(left), add(right)];
}

// Which existing term ids get cancelled by this op (for the fade-out animation)?
export function cancelledIds(side, op) {
  if (op.kind === 'div') return new Set(side.map(t => t.id)); // everything transforms
  const ids = new Set();
  const coefSum = side.filter(t => t.type === 'var').reduce((s, t) => s + t.coef, 0);
  const valSum = side.filter(t => t.type === 'const').reduce((s, t) => s + t.val, 0);
  if (op.coef && coefSum + op.coef === 0) side.filter(t => t.type === 'var').forEach(t => ids.add(t.id));
  if (op.val && valSum + op.val === 0) side.filter(t => t.type === 'const').forEach(t => ids.add(t.id));
  return ids;
}

// ---------- formatting ----------
const MINUS = '−';
export const fmtNum = n => String(n).replace('-', MINUS);
export const fmtCoef = c => c === 1 ? 'x' : c === -1 ? MINUS + 'x' : fmtNum(c) + 'x';
export const fmtSigned = n => (n < 0 ? `${MINUS} ${-n}` : `+ ${n}`);
export const fmtSignedCoef = c => {
  const abs = Math.abs(c);
  return `${c < 0 ? MINUS : '+'} ${abs === 1 ? 'x' : abs + 'x'}`;
};
export function termText(t, first) {
  if (t.type === 'var') {
    if (first) return fmtCoef(t.coef);
    const abs = Math.abs(t.coef);
    return `${t.coef < 0 ? MINUS : '+'} ${abs === 1 ? 'x' : abs + 'x'}`;
  }
  return first ? fmtNum(t.val) : fmtSigned(t.val);
}
