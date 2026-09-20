/* ============================================================
   AlgebraAce — skills & question generators
   Each generator returns:
   { prompt, type: 'num'|'mc', answer, choices?, explain }
   ============================================================ */

// ---------- helpers ----------
const ri  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[ri(0, arr.length - 1)];
const rnz = (min, max) => { let n = 0; while (n === 0) n = ri(min, max); return n; };
const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = ri(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const m = s => `<span class="math">${s}</span>`;          // inline math chip
const sup = n => `<sup>${n}</sup>`;
const MINUS = '−';                                          // U+2212 for display
const signed = n => (n < 0 ? `${MINUS} ${-n}` : `+ ${n}`);  // "+ 5" / "− 5"
const fmtNum = n => String(n).replace('-', MINUS);

// coefficient + variable, e.g. 3x, −2x, x, −x
function cx(c, v = 'x') {
  if (c === 1) return v;
  if (c === -1) return MINUS + v;
  return fmtNum(c) + v;
}

// unique string choices including `correct`
function mcChoices(correct, distractors) {
  const set = [correct];
  for (const d of distractors) if (!set.includes(d)) set.push(d);
  return shuffle(set);
}

/* ============================================================
   TOPICS & SKILLS
   ============================================================ */
const TOPICS = [
  {
    id: 'expr', icon: '🧮', name: 'Expressions',
    skills: [
      {
        id: 'A1', code: 'A.1', title: 'Evaluate linear expressions',
        gen() {
          const a = ri(2, 9), b = rnz(-9, 9), v = rnz(-5, 5);
          const ans = a * v + b;
          return {
            type: 'num',
            prompt: `If ${m(`x = ${fmtNum(v)}`)}, what is the value of ${m(`${cx(a)} ${signed(b)}`)} ?`,
            answer: ans,
            explain: `Substitute ${fmtNum(v)} for x: ${cx(a)} ${signed(b)}
              = ${a}(${fmtNum(v)}) ${signed(b)}
              = ${fmtNum(a * v)} ${signed(b)}
              = <strong>${fmtNum(ans)}</strong>.`
          };
        }
      },
      {
        id: 'A2', code: 'A.2', title: 'Combine like terms',
        gen() {
          const c1 = rnz(-9, 9), c2 = rnz(-9, 9), c3 = rnz(-9, 9);
          const k = c1 + c2 + c3;
          const term = n => n === 0 ? '' : (Math.abs(n) === 1 ? ` ${n < 0 ? MINUS : '+'} x` : ` ${signed(n)}x`);
          const expr = `${cx(c1)}${term(c2)}${term(c3)}`;
          const correct = k === 0 ? '0' : cx(k);
          const choices = mcChoices(correct, [cx(k + 1), cx(k - 1), cx(k + 2), cx(Math.abs(c1) + Math.abs(c2) + Math.abs(c3))]);
          return {
            type: 'mc',
            prompt: `Simplify: ${m(expr)}`,
            answer: correct, choices,
            explain: `Add the coefficients of x: ${c1} + (${c2}) + (${c3}) = ${k}.
              So ${expr} = <strong>${correct}</strong>.`
          };
        }
      }
    ]
  },

  {
    id: 'onestep', icon: '➕', name: 'One-step equations',
    skills: [
      {
        id: 'B1', code: 'B.1', title: 'Solve one-step equations: addition & subtraction',
        gen() {
          const a = rnz(-12, 12), s = ri(-10, 10);
          const b = s + a;
          return {
            type: 'num',
            prompt: `Solve for x: ${m(`x ${signed(a)} = ${fmtNum(b)}`)}`,
            answer: s,
            explain: `Undo ${a > 0 ? 'addition' : 'subtraction'}:
              x = ${fmtNum(b)} ${a > 0 ? MINUS : '+'} ${Math.abs(a)} = <strong>${fmtNum(s)}</strong>.
              Check: ${fmtNum(s)} ${signed(a)} = ${fmtNum(b)} ✓`
          };
        }
      },
      {
        id: 'B2', code: 'B.2', title: 'Solve one-step equations: multiplication & division',
        gen() {
          const a = ri(2, 12), s = ri(-9, 9);
          const b = a * s;
          return {
            type: 'num',
            prompt: `Solve for x: ${m(`${cx(a)} = ${fmtNum(b)}`)}`,
            answer: s,
            explain: `Divide both sides by ${a}: x = ${fmtNum(b)} ÷ ${a} = <strong>${fmtNum(s)}</strong>.
              Check: ${a}(${fmtNum(s)}) = ${fmtNum(b)} ✓`
          };
        }
      }
    ]
  },

  {
    id: 'multistep', icon: '🔀', name: 'Two-step & multi-step equations',
    skills: [
      {
        id: 'C1', code: 'C.1', title: 'Solve two-step equations',
        gen() {
          const a = ri(2, 9), b = rnz(-9, 9), s = ri(-8, 8);
          const c = a * s + b;
          return {
            type: 'num',
            prompt: `Solve for x: ${m(`${cx(a)} ${signed(b)} = ${fmtNum(c)}`)}`,
            answer: s,
            explain: `Step 1: subtract ${fmtNum(b)} from both sides → ${cx(a)} = ${fmtNum(c - b)}.<br>
              Step 2: divide by ${a} → x = ${fmtNum(c - b)} ÷ ${a} = <strong>${fmtNum(s)}</strong>.`
          };
        }
      },
      {
        id: 'C2', code: 'C.2', title: 'Solve equations with variables on both sides',
        gen() {
          let a = ri(2, 7), c = ri(2, 7);
          while (c === a) c = ri(2, 7);
          const s = ri(-6, 6), b = rnz(-8, 8);
          const d = (a - c) * s + b;
          return {
            type: 'num',
            prompt: `Solve for x: ${m(`${cx(a)} ${signed(b)} = ${cx(c)} ${signed(d)}`)}`,
            answer: s,
            explain: `Step 1: subtract ${cx(c)} from both sides → ${cx(a - c)} ${signed(b)} = ${fmtNum(d)}.<br>
              Step 2: subtract ${fmtNum(b)} → ${cx(a - c)} = ${fmtNum(d - b)}.<br>
              Step 3: divide by ${a - c} → x = <strong>${fmtNum(s)}</strong>.`
          };
        }
      }
    ]
  },

  {
    id: 'ineq', icon: '⚖️', name: 'Inequalities',
    skills: [
      {
        id: 'D1', code: 'D.1', title: 'Solve one-step inequalities',
        gen() {
          const a = rnz(-12, 12), s = ri(-10, 10);
          const b = s + a;
          const op = pick(['<', '>', '≤', '≥']);
          const correct = `x ${op} ${fmtNum(s)}`;
          const choices = mcChoices(correct, [
            `x ${'<'} ${fmtNum(s)}`, `x ${'>'} ${fmtNum(s)}`,
            `x ${'≤'} ${fmtNum(s)}`, `x ${'≥'} ${fmtNum(s)}`
          ]);
          return {
            type: 'mc',
            prompt: `Solve the inequality: ${m(`x ${signed(a)} ${op} ${fmtNum(b)}`)}`,
            answer: correct, choices,
            explain: `${a > 0 ? 'Subtract' : 'Add'} ${Math.abs(a)} ${a > 0 ? 'from' : 'to'} both sides:
              x ${op} ${fmtNum(b)} ${a > 0 ? MINUS : '+'} ${Math.abs(a)}, so <strong>${correct}</strong>.
              Adding or subtracting never flips the inequality sign.`
          };
        }
      },
      {
        id: 'D2', code: 'D.2', title: 'Solve two-step inequalities',
        gen() {
          let a = rnz(-9, 9); if (a === 1) a = 2;
          const b = rnz(-9, 9), s = ri(-7, 7);
          const c = a * s + b;
          const strict = pick([true, false]);
          const flip = a < 0;
          const opIn = strict ? (flip ? '>' : '<') : (flip ? '≥' : '≤');
          const opOut = strict ? (flip ? '<' : '>') : (flip ? '≤' : '≥');
          const correct = `x ${opOut} ${fmtNum(s)}`;
          const choices = mcChoices(correct, [
            `x < ${fmtNum(s)}`, `x > ${fmtNum(s)}`, `x ≤ ${fmtNum(s)}`, `x ≥ ${fmtNum(s)}`
          ]);
          return {
            type: 'mc',
            prompt: `Solve the inequality: ${m(`${cx(a)} ${signed(b)} ${opIn} ${fmtNum(c)}`)}`,
            answer: correct, choices,
            explain: `Step 1: subtract ${fmtNum(b)} from both sides → ${cx(a)} ${opIn} ${fmtNum(c - b)}.<br>
              Step 2: divide both sides by ${fmtNum(a)}.
              ${flip ? `⚠️ Dividing by a <strong>negative</strong> flips the sign: ${opIn} becomes ${opOut}.` : 'Dividing by a positive keeps the sign the same.'}<br>
              Answer: <strong>${correct}</strong>.`
          };
        }
      }
    ]
  },

  {
    id: 'lines', icon: '📈', name: 'Slope & linear functions',
    skills: [
      {
        id: 'E1', code: 'E.1', title: 'Find the slope from two points',
        gen() {
          const slope = rnz(-5, 5);
          const dx = pick([1, 2]);
          const x1 = ri(-6, 6), y1 = ri(-6, 6);
          const x2 = x1 + dx, y2 = y1 + slope * dx;
          return {
            type: 'num',
            prompt: `Find the slope of the line through ${m(`(${x1}, ${fmtNum(y1)})`)} and ${m(`(${x2}, ${fmtNum(y2)})`)}.`,
            answer: slope,
            explain: `Slope = (y₂ ${MINUS} y₁) ÷ (x₂ ${MINUS} x₁)
              = (${fmtNum(y2)} ${MINUS} (${fmtNum(y1)})) ÷ (${x2} ${MINUS} (${fmtNum(x1)}))
              = ${fmtNum(y2 - y1)} ÷ ${x2 - x1} = <strong>${fmtNum(slope)}</strong>.`
          };
        }
      },
      {
        id: 'E2', code: 'E.2', title: 'Evaluate a linear function',
        gen() {
          const slope = rnz(-6, 6), b = rnz(-9, 9), v = rnz(-6, 6);
          const ans = slope * v + b;
          return {
            type: 'num',
            prompt: `For the function ${m(`y = ${cx(slope)} ${signed(b)}`)}, find y when ${m(`x = ${fmtNum(v)}`)}.`,
            answer: ans,
            explain: `Substitute: y = ${slope}(${fmtNum(v)}) ${signed(b)}
              = ${fmtNum(slope * v)} ${signed(b)} = <strong>${fmtNum(ans)}</strong>.`
          };
        }
      },
      {
        id: 'E3', code: 'E.3', title: 'Find the y-intercept from a point and slope',
        gen() {
          const slope = rnz(-5, 5), x1 = rnz(-6, 6), y1 = ri(-8, 8);
          const b = y1 - slope * x1;
          return {
            type: 'num',
            prompt: `A line has slope ${m(fmtNum(slope))} and passes through ${m(`(${fmtNum(x1)}, ${fmtNum(y1)})`)}.
              What is its y-intercept (the <em>b</em> in ${m('y = mx + b')})?`,
            answer: b,
            explain: `Use y = mx + b with the point: ${fmtNum(y1)} = ${slope}(${fmtNum(x1)}) + b
              → ${fmtNum(y1)} = ${fmtNum(slope * x1)} + b
              → b = ${fmtNum(y1)} ${MINUS} (${fmtNum(slope * x1)}) = <strong>${fmtNum(b)}</strong>.`
          };
        }
      }
    ]
  },

  {
    id: 'expo', icon: '💪', name: 'Exponents',
    skills: [
      {
        id: 'F1', code: 'F.1', title: 'Product rule of exponents',
        gen() {
          const a = ri(2, 9), b = ri(2, 9);
          return {
            type: 'num',
            prompt: `${m(`x${sup(a)} · x${sup(b)} = x${sup('?')}`)} — what is the missing exponent?`,
            answer: a + b,
            explain: `When multiplying powers with the same base, <em>add</em> the exponents:
              ${a} + ${b} = <strong>${a + b}</strong>. So x${sup(a)} · x${sup(b)} = x${sup(a + b)}.`
          };
        }
      },
      {
        id: 'F2', code: 'F.2', title: 'Power of a power',
        gen() {
          const a = ri(2, 6), b = ri(2, 5);
          return {
            type: 'num',
            prompt: `${m(`(x${sup(a)})${sup(b)} = x${sup('?')}`)} — what is the missing exponent?`,
            answer: a * b,
            explain: `A power raised to a power: <em>multiply</em> the exponents:
              ${a} × ${b} = <strong>${a * b}</strong>. So (x${sup(a)})${sup(b)} = x${sup(a * b)}.`
          };
        }
      },
      {
        id: 'F3', code: 'F.3', title: 'Negative exponents',
        gen() {
          const base = ri(2, 4), e = ri(1, 3);
          const val = Math.pow(base, e);
          const correct = `1/${val}`;
          const choices = mcChoices(correct, [`${MINUS}${val}`, `${val}`, `${MINUS}${base * e}`, `1/${base * e}`]);
          return {
            type: 'mc',
            prompt: `Evaluate: ${m(`${base}${sup(MINUS + String(e))}`)}`,
            answer: correct, choices,
            explain: `A negative exponent means a reciprocal:
              ${base}${sup(MINUS + String(e))} = 1 ÷ ${base}${sup(e)} = 1 ÷ ${val} = <strong>${correct}</strong>.`
          };
        }
      }
    ]
  },

  {
    id: 'systems', icon: '🤝', name: 'Systems of equations',
    skills: [
      {
        id: 'G1', code: 'G.1', title: 'Solve a system of two equations',
        gen() {
          const x = ri(-6, 6), y = ri(-6, 6);
          const s = x + y, d = x - y;
          return {
            type: 'num',
            prompt: `Solve the system and find <strong>x</strong>:<br>
              ${m(`x + y = ${fmtNum(s)}`)}<br>${m(`x ${MINUS} y = ${fmtNum(d)}`)}`,
            answer: x,
            explain: `Add the two equations: (x + y) + (x ${MINUS} y) = ${fmtNum(s)} + (${fmtNum(d)})
              → 2x = ${fmtNum(s + d)} → x = <strong>${fmtNum(x)}</strong>.
              (Then y = ${fmtNum(s)} ${MINUS} (${fmtNum(x)}) = ${fmtNum(y)}.)`
          };
        }
      }
    ]
  },

  {
    id: 'quad', icon: '🎯', name: 'Quadratic equations',
    skills: [
      {
        id: 'H1', code: 'H.1', title: 'Solve x² + bx + c = 0 by factoring',
        gen() {
          let p = ri(-8, 8), q = ri(-8, 8);
          while (q === p) q = ri(-8, 8);
          const b = -(p + q), c = p * q;
          const big = Math.max(p, q);
          const bStr = b === 0 ? '' : (Math.abs(b) === 1 ? ` ${b < 0 ? MINUS : '+'} x` : ` ${signed(b)}x`);
          const cStr = c === 0 ? '' : ` ${signed(c)}`;
          return {
            type: 'num',
            prompt: `Solve ${m(`x${sup(2)}${bStr}${cStr} = 0`)}. Enter the <strong>larger</strong> solution.`,
            answer: big,
            explain: `Find two numbers that multiply to ${fmtNum(c)} and add to ${fmtNum(b)}:
              ${fmtNum(-p)} and ${fmtNum(-q)}.<br>
              Factor: (x ${signed(-p)})(x ${signed(-q)}) = 0, so x = ${fmtNum(p)} or x = ${fmtNum(q)}.<br>
              The larger solution is <strong>${fmtNum(big)}</strong>.`
          };
        }
      }
    ]
  },

  {
    id: 'word', icon: '🌍', name: 'Word problems',
    skills: [
      {
        id: 'I1', code: 'I.1', title: 'Linear equation word problems',
        gen() {
          const t = ri(1, 3);
          if (t === 1) {
            // taxi-style
            const flat = ri(2, 6), rate = ri(2, 5), miles = ri(3, 12);
            const total = flat + rate * miles;
            return {
              type: 'num',
              prompt: `🚕 A taxi charges a flat fee of $${flat} plus a per-mile rate. A ${miles}-mile ride costs $${total}.
                What is the <strong>per-mile rate</strong> (in dollars)?`,
              answer: rate,
              explain: `Let r = per-mile rate. Then ${flat} + ${miles}r = ${total}.
                Subtract ${flat}: ${miles}r = ${total - flat}. Divide by ${miles}: r = <strong>${rate}</strong>.`
            };
          }
          if (t === 2) {
            // savings
            const have = ri(5, 30), per = ri(3, 10), weeks = ri(3, 10);
            const target = have + per * weeks;
            return {
              type: 'num',
              prompt: `🐷 Maya has $${have} saved and adds $${per} every week.
                After how many <strong>weeks</strong> will she have $${target}?`,
              answer: weeks,
              explain: `Let w = weeks. Then ${have} + ${per}w = ${target}.
                Subtract ${have}: ${per}w = ${target - have}. Divide by ${per}: w = <strong>${weeks}</strong>.`
            };
          }
          // sum & difference
          let s = ri(10, 40), d = ri(2, 8) * 2; // even difference keeps integers when s even... ensure parity:
          if ((s + d) % 2 !== 0) s += 1;
          const big = (s + d) / 2;
          return {
            type: 'num',
            prompt: `🔢 The sum of two numbers is ${s}. One number is ${d} more than the other.
              What is the <strong>larger</strong> number?`,
            answer: big,
            explain: `Let the numbers be x and x ${MINUS} ${d}. Then x + (x ${MINUS} ${d}) = ${s}
              → 2x = ${s + d} → x = <strong>${big}</strong>.`
          };
        }
      }
    ]
  }
];

// flat lookup: skill id -> { topic, skill }
const SKILL_INDEX = {};
TOPICS.forEach(topic => topic.skills.forEach(skill => {
  SKILL_INDEX[skill.id] = { topic, skill };
}));

/* ============================================================
   AWARDS
   check(u) receives the user object; return true when earned.
   ============================================================ */
const AWARDS = [
  { id: 'first',   emoji: '🌱', name: 'First Steps',     desc: 'Answer your very first question.',           check: u => u.stats.answered >= 1 },
  { id: 'q10',     emoji: '✏️', name: 'Warming Up',      desc: 'Answer 10 questions.',                        check: u => u.stats.answered >= 10 },
  { id: 'q50',     emoji: '📚', name: 'Bookworm',        desc: 'Answer 50 questions.',                        check: u => u.stats.answered >= 50 },
  { id: 'q100',    emoji: '💯', name: 'Century Club',    desc: 'Answer 100 questions.',                       check: u => u.stats.answered >= 100 },
  { id: 'q250',    emoji: '🚀', name: 'Unstoppable',     desc: 'Answer 250 questions.',                       check: u => u.stats.answered >= 250 },
  { id: 'c25',     emoji: '🎯', name: 'Sharpshooter',    desc: 'Get 25 questions correct.',                   check: u => u.stats.correct >= 25 },
  { id: 'c100',    emoji: '🏹', name: 'Eagle Eye',       desc: 'Get 100 questions correct.',                  check: u => u.stats.correct >= 100 },
  { id: 'streak5', emoji: '🔥', name: 'On Fire',         desc: 'Get 5 correct in a row.',                     check: u => u.stats.bestStreak >= 5 },
  { id: 'streak10',emoji: '⚡', name: 'Lightning Mind',  desc: 'Get 10 correct in a row.',                    check: u => u.stats.bestStreak >= 10 },
  { id: 'master1', emoji: '🥇', name: 'First Mastery',   desc: 'Reach a SmartScore of 100 on any skill.',     check: u => masteredCount(u) >= 1 },
  { id: 'master3', emoji: '🏅', name: 'Triple Crown',    desc: 'Master 3 skills (SmartScore 100).',           check: u => masteredCount(u) >= 3 },
  { id: 'master8', emoji: '👑', name: 'Algebra Royalty', desc: 'Master 8 skills (SmartScore 100).',           check: u => masteredCount(u) >= 8 },
  { id: 'score300',emoji: '📈', name: 'Rising Star',     desc: 'Reach a total SmartScore of 300.',            check: u => totalScore(u) >= 300 },
  { id: 'score800',emoji: '🌟', name: 'Score Superstar', desc: 'Reach a total SmartScore of 800.',            check: u => totalScore(u) >= 800 },
  { id: 'time10',  emoji: '⏰', name: 'Dedicated',       desc: 'Practice for 10 total minutes.',              check: u => u.stats.timeSec >= 600 },
  { id: 'time30',  emoji: '🕰️', name: 'Marathoner',      desc: 'Practice for 30 total minutes.',              check: u => u.stats.timeSec >= 1800 },
  { id: 'stars10', emoji: '⭐', name: 'Star Collector',  desc: 'Earn 10 stars.',                              check: u => u.stars >= 10 },
  { id: 'stars25', emoji: '💫', name: 'Superstar',       desc: 'Earn 25 stars.',                              check: u => u.stars >= 25 },
  { id: 'hw1',  emoji: '📝', name: 'Homework Hero',    desc: 'Complete your first homework assignment.',     check: u => (u.stats.homeworkDone || 0) >= 1 },
  { id: 'hw5',  emoji: '🗓️', name: 'Steady Scholar',   desc: 'Complete 5 homework assignments.',             check: u => (u.stats.homeworkDone || 0) >= 5 },
  { id: 'hw10', emoji: '🏫', name: "Teacher's Favorite", desc: 'Complete 10 homework assignments.',          check: u => (u.stats.homeworkDone || 0) >= 10 }
];

function masteredCount(u) {
  return Object.values(u.skills).filter(s => s.score >= 100).length;
}
function totalScore(u) {
  return Object.values(u.skills).reduce((sum, s) => sum + (s.score || 0), 0);
}

/* ============================================================
   PRAISE & ENCOURAGEMENT
   ============================================================ */
const PRAISE = [
  'Correct! 🎉', 'Nice work! 👏', 'You got it! ✅', 'Brilliant! 💡',
  'Exactly right! 🌟', 'Super! 🙌', 'Way to go! 🚀', 'Outstanding! 🏆'
];
const PRAISE_CHALLENGE = [
  'Amazing — that was a Challenge Zone question! 🔥',
  'Wow! Challenge Zone conquered! ⚡',
  'Incredible focus in the Challenge Zone! 🧠'
];
const ENCOURAGE = [
  'Good effort! Mistakes help your brain grow. 🌱',
  'Not quite — but you\'re closer than you think! 💪',
  'Keep going! Every expert was once a beginner. 🐣',
  'Almost! Read the explanation and try the next one. 📖',
  'Don\'t give up — you\'re building real skills! 🧗'
];
const MASTERY_MSGS = [
  'You mastered this skill — SmartScore 100! 🥇',
  'MASTERY! You\'re officially an ace at this skill! 🏆',
  'PERFECT SCORE! Take a bow! 🎊'
];
