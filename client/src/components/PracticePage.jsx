import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { SKILL_INDEX, PRAISE, PRAISE_CHALLENGE, ENCOURAGE, MASTERY_MSGS, pick, fmtNum } from '../skills.js';
import { niceDate } from '../homework.js';

let audioCtx = null;
function beep(freq, dur) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq; o.type = 'sine';
    g.gain.setValueAtTime(0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch { /* audio unavailable */ }
}

export default function PracticePage({ cfg, me, toast, fireConfetti, onExit }) {
  const isHw = cfg.mode === 'homework';

  // homework queue: items with remaining questions
  const [queue, setQueue] = useState(() => isHw
    ? cfg.assignment.items.map(i => {
        const p = (cfg.assignment.progress || []).find(x => x.skillId === i.skillId);
        return { skillId: i.skillId, count: i.count, done: p ? p.done : 0 };
      }).filter(it => it.done < it.count)
    : null);
  const [qi, setQi] = useState(0);

  const currentItem = isHw ? queue[Math.min(qi, queue.length - 1)] : null;
  const skillId = isHw ? currentItem.skillId : cfg.skillId;
  const skill = SKILL_INDEX[skillId].skill;

  const [question, setQuestion] = useState(() => skill.gen());
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState(null); // { correct, title }
  const [inputVal, setInputVal] = useState('');
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(
    () => me?.skillProgress?.find(p => p.skill_id === skillId)?.score || 0);
  const [session, setSession] = useState({ answered: 0, correct: 0, streak: 0, seconds: 0, rewards: [] });
  const [hwTotals, setHwTotals] = useState(() => isHw
    ? { done: cfg.assignment.done ?? 0, total: cfg.assignment.total ?? cfg.assignment.items.reduce((s, i) => s + i.count, 0) }
    : null);
  const [hwDone, setHwDone] = useState(false);
  const secondsRef = useRef(0);
  const inputRef = useRef(null);

  // practice timer + 15s time pings to the server
  useEffect(() => {
    const t = setInterval(() => {
      setSession(s => ({ ...s, seconds: s.seconds + 1 }));
      secondsRef.current += 1;
      if (secondsRef.current % 15 === 0) {
        api('POST', '/api/time', { seconds: 15 })
          .then(r => r.newAwards.forEach(a => toast(a.emoji, `Badge earned: ${a.name}! +2 ⭐`)))
          .catch(() => {});
      }
    }, 1000);
    return () => clearInterval(t);
  }, [toast]);

  // when the homework queue moves to a new skill, reset its displayed score
  useEffect(() => {
    setScore(me?.skillProgress?.find(p => p.skill_id === skillId)?.score || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId]);

  useEffect(() => { inputRef.current?.focus(); }, [question]);

  function nextQuestion() {
    setQuestion(skill.gen());
    setAnswered(false); setFeedback(null); setInputVal(''); setSelected(null);
  }

  async function submitAnswer() {
    if (answered) return;
    let correct;
    if (question.type === 'num') {
      if (inputVal.trim() === '') return;
      correct = Math.abs(Number(inputVal) - question.answer) < 1e-9;
    } else {
      if (selected === null) return;
      correct = selected === question.answer;
    }

    beep(correct ? 880 : 220, correct ? 0.12 : 0.2);
    const newStreak = correct ? session.streak + 1 : 0;
    setSession(s => ({
      ...s, answered: s.answered + 1,
      correct: s.correct + (correct ? 1 : 0), streak: newStreak
    }));
    setAnswered(true);
    setFeedback({
      correct,
      title: correct ? (score >= 90 ? pick(PRAISE_CHALLENGE) : pick(PRAISE)) : pick(ENCOURAGE)
    });

    try {
      const body = { skillId, correct, streak: newStreak };
      if (isHw) {
        body.assignmentId = cfg.assignment.id;
        if (cfg.assignment.daily) body.items = cfg.assignment.items;
      }
      const r = await api('POST', '/api/answers', body);
      setScore(r.score);

      const rewards = [];
      if (r.newMedal) {
        rewards.push(`${r.newMedal.emoji} ${r.newMedal.label} (+${r.newMedal.stars}⭐)`);
        toast(r.newMedal.emoji, `${r.newMedal.label} +${r.newMedal.stars} ⭐`);
        if (r.newMedal.id === 'gold') { fireConfetti(); toast('🎊', pick(MASTERY_MSGS)); }
      }
      r.newAwards.forEach(a => {
        rewards.push(`${a.emoji} Badge: ${a.name} (+2⭐)`);
        toast(a.emoji, `Badge earned: ${a.name}! +2 ⭐`);
      });

      if (isHw && r.homework) {
        setHwTotals({ done: r.homework.done, total: r.homework.total });
        const nq = queue.map((it, idx) => idx === qi ? { ...it, done: it.done + 1 } : it);
        setQueue(nq);
        if (nq[qi].done >= nq[qi].count) setQi(qi + 1);
        if (r.homework.justCompleted) {
          setHwDone(true);
          rewards.push('🎉 Homework complete! (+5⭐)');
          fireConfetti();
          toast('🎉', 'Homework complete! +5 ⭐');
        }
      }
      if (rewards.length) setSession(s => ({ ...s, rewards: [...s.rewards, ...rewards] }));
    } catch (e) {
      toast('⚠️', e.message);
    }
  }

  function advanceOrSubmit() {
    if (!answered) return submitAnswer();
    if (hwDone) return onExit();
    nextQuestion();
  }

  const medalText = isHw
    ? (hwDone ? '🎉 Done! Head back to see your stars.' : `📝 Homework: ${hwTotals.done}/${hwTotals.total} questions done`)
    : score >= 100 ? '🥇 Mastered!'
    : score >= 90 ? '🥈 Silver — Challenge Zone!'
    : score >= 70 ? '🥉 Bronze — on your way!'
    : 'Reach 70 for a bronze medal 🥉';

  return (
    <main className="page">
      <div className="practice-head">
        <button className="btn btn-ghost" type="button" onClick={onExit}>
          ← Back to {isHw ? 'homework' : 'skills'}
        </button>
        <div className="practice-title">
          <span className="skill-code">{isHw ? (cfg.assignment.daily ? 'Daily' : 'HW') : skill.code}</span>
          <h2>{isHw
            ? (cfg.assignment.daily ? `Daily Practice — ${niceDate(cfg.assignment.due)}` : `Homework from ${cfg.assignment.teacherName || 'your teacher'}`)
            : skill.title}</h2>
        </div>
        {isHw && (
          <div className="practice-banner">
            {hwDone
              ? <>🎉 <strong>Homework complete!</strong> Amazing work — you earned 5 ⭐</>
              : <>📝 <strong>{cfg.assignment.daily ? 'Daily Practice' : 'Homework'}</strong> due {niceDate(cfg.assignment.due)}
                  {' • '}{SKILL_INDEX[currentItem.skillId].skill.code}: question {currentItem.done + 1} of {currentItem.count}
                  {' • '}Overall {hwTotals.done} of {hwTotals.total} questions</>}
          </div>
        )}
      </div>

      <div className="practice-layout">
        <section className="question-panel">
          <div className="question-prompt" dangerouslySetInnerHTML={{ __html: question.prompt }} />

          {question.type === 'num' ? (
            <div style={{ marginBottom: 22 }}>
              <input ref={inputRef} className="answer-input" type="number" step="any" placeholder="?"
                autoComplete="off" value={inputVal} disabled={answered}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') advanceOrSubmit(); }} />
            </div>
          ) : (
            <div className="choices" style={{ marginBottom: 22 }}>
              {question.choices.map(c => (
                <button key={c} type="button"
                  className={'choice-btn' + (selected === c ? ' selected' : '')}
                  disabled={answered}
                  onClick={() => setSelected(c)}>{c}</button>
              ))}
            </div>
          )}

          <div className="practice-actions">
            <button className="btn btn-primary btn-lg" type="button" onClick={advanceOrSubmit}>
              {!answered ? 'Submit' : hwDone ? 'Finish 🎉' : 'Next question'}
            </button>
          </div>

          {feedback && (
            <div className={'feedback ' + (feedback.correct ? 'good' : 'bad')}>
              <h3>{feedback.title}</h3>
              {!feedback.correct && (<>
                <p className="explain">The correct answer is <strong>
                  {question.type === 'num' ? fmtNum(question.answer) : question.answer}</strong>.</p>
                <p className="explain"><strong>Why?</strong>{' '}
                  <span dangerouslySetInnerHTML={{ __html: question.explain }} /></p>
              </>)}
              {feedback.correct && score >= 100 && !isHw && (
                <p className="explain">🥇 <strong>SmartScore 100 — mastery achieved!</strong> Keep practicing to stay sharp, or try another skill!</p>)}
            </div>
          )}
        </section>

        <aside className="score-panel">
          <div className="score-card">
            <div className="score-label">SmartScore</div>
            <div className={'score-value' + (score >= 100 ? ' gold' : '')}>{score}</div>
            <div className="score-bar">
              <div className="score-bar-zone zone-challenge" />
              <div className={'score-bar-fill' + (score >= 100 ? ' gold' : '')} style={{ width: score + '%' }} />
            </div>
            <div className="score-bar-labels"><span>0</span><span className="cz-label">Challenge Zone 90+</span><span>100</span></div>
            <div className="score-medal">{medalText}</div>
          </div>

          <div className="session-card">
            <div className="session-row"><span>🔥 Streak</span><strong>{session.streak}</strong></div>
            <div className="session-row"><span>✅ Correct</span><strong>{session.correct}/{session.answered}</strong></div>
            <div className="session-row"><span>⏱️ Time</span>
              <strong>{Math.floor(session.seconds / 60)}:{String(session.seconds % 60).padStart(2, '0')}</strong></div>
          </div>

          {session.rewards.length > 0 && (
            <div className="session-rewards">
              <h4>🎁 Earned this session</h4>
              {session.rewards.map((r, i) => <span className="reward-pill" key={i}>{r}</span>)}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
