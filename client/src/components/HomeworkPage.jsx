import { localDateStr, addDays, niceDate, dailyWithProgress, skillName } from '../homework.js';

function HwCard({ assign, onStart }) {
  const total = assign.total ?? assign.items.reduce((s, i) => s + i.count, 0);
  const done = assign.done ?? (assign.progress || []).reduce((s, p) => s + Math.min(p.count, p.done), 0);
  const from = assign.daily ? '📅 Daily Practice' : `🍎 From ${assign.teacherName || 'your teacher'}`;
  return (
    <div className={'hw-card' + (assign.completed ? ' done' : '')}>
      <div className="hw-head">
        <strong>{from}</strong>
        <span className="muted">due {niceDate(assign.due)}</span>
        {assign.completed
          ? <span className="hw-done-badge">✅ Completed</span>
          : <span className="hw-progress-badge">{done}/{total} done</span>}
      </div>
      <div className="hw-items">
        {assign.items.map(item => {
          const p = (assign.progress || []).find(x => x.skillId === item.skillId);
          const d = Math.min(item.count, p ? p.done : 0);
          return (
            <span key={item.skillId} className={'hw-chip' + (d >= item.count ? ' chip-done' : '')}>
              {skillName(item.skillId)} {d}/{item.count}
            </span>
          );
        })}
      </div>
      <p className="muted hw-note">Answer {total} questions to finish — wrong answers still count, so just do your best! 💪</p>
      {!assign.completed && (
        <button className="btn btn-primary" type="button" onClick={() => onStart(assign)}>
          {done > 0 ? 'Continue' : 'Start'} ▸
        </button>
      )}
    </div>
  );
}

export default function HomeworkPage({ homework, onStart }) {
  if (!homework) return <main className="page"><p className="muted">Loading…</p></main>;
  const today = localDateStr();

  const todayList = [
    dailyWithProgress(today, homework),
    ...homework.assignments.filter(a => a.due.slice(0, 10) <= today)
  ];

  const weekList = [];
  for (let i = 1; i < 7; i++) {
    const d = localDateStr(addDays(new Date(), i));
    weekList.push(dailyWithProgress(d, homework));
    homework.assignments.filter(a => a.due.slice(0, 10) === d).forEach(a => weekList.push(a));
  }

  return (
    <main className="page">
      <div className="page-head">
        <h2>📝 Homework</h2>
        <p className="muted">A fresh set of exercises awaits you every day — plus anything your teacher assigns. Finish them all to earn ⭐!</p>
      </div>
      <h3 className="section-title">Due today</h3>
      <div>{todayList.map(a => <HwCard key={a.id} assign={a} onStart={onStart} />)}</div>
      <h3 className="section-title">Coming up this week</h3>
      <div>{weekList.map(a => <HwCard key={a.id} assign={a} onStart={onStart} />)}</div>
    </main>
  );
}
