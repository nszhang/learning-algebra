import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { TOPICS } from '../skills.js';
import { niceDate, skillName } from '../homework.js';

function StudentCard({ s }) {
  const [open, setOpen] = useState(false);
  const pct = s.stats.answered ? Math.round(100 * s.stats.correct / s.stats.answered) : 0;
  const mastered = s.skillProgress.filter(p => p.score >= 100).length;
  const total = s.skillProgress.reduce((sum, p) => sum + p.score, 0);
  const scoreOf = id => s.skillProgress.find(p => p.skill_id === id)?.score || 0;

  return (
    <div className={'student-card' + (open ? ' open' : '')}>
      <div className="student-head" onClick={() => setOpen(!open)}>
        <strong>{s.displayName}</strong> <span className="muted">@{s.username}</span>
        <span className="student-stats">
          📊 {total} &nbsp;•&nbsp; 🥇 {mastered} mastered &nbsp;•&nbsp; 🎯 {pct}% &nbsp;•&nbsp;
          ⏱️ {Math.floor(s.stats.time_sec / 60)}m &nbsp;•&nbsp; 📝 {s.stats.homework_done} homeworks &nbsp;•&nbsp; ⭐ {s.stars}
        </span>
        <span className="topic-caret">▶</span>
      </div>
      {open && (
        <div className="student-detail">
          {TOPICS.map(t => {
            const avg = Math.round(t.skills.reduce((sum, sk) => sum + scoreOf(sk.id), 0) / t.skills.length);
            return (
              <div className="dash-row" style={{ cursor: 'default' }} key={t.id}>
                <span style={{ minWidth: 200 }}>{t.icon} {t.name}</span>
                <div className="dash-bar"><div className="dash-bar-fill" style={{ width: avg + '%' }} /></div>
                <span className="dash-score">{avg}</span>
              </div>
            );
          })}
          <h4 style={{ margin: '14px 0 6px' }}>Assignments</h4>
          {s.assignments.length === 0
            ? <p className="muted">No assignments yet — use the Assign tab.</p>
            : s.assignments.map(a => (
              <div className="hw-mini" key={a.id}>
                due {niceDate(a.due)} — {a.items.map(i => skillName(i.skillId)).join(', ')}:{' '}
                {a.completed ? '✅ done' : a.done > 0 ? `⏳ ${a.done}/${a.total}` : '⬜ not started'}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default function TeacherStudents() {
  const [students, setStudents] = useState(null);

  useEffect(() => {
    api('GET', '/api/students').then(setStudents).catch(() => setStudents([]));
  }, []);

  return (
    <main className="page">
      <div className="page-head">
        <h2>👥 Student Progress</h2>
        <p className="muted">Click a student to see their topic breakdown and homework status.</p>
      </div>
      {students === null
        ? <p className="muted">Loading…</p>
        : students.length === 0
          ? <p className="muted">No student accounts yet. Students can sign up from the login page.</p>
          : students.map(s => <StudentCard key={s.id} s={s} />)}
    </main>
  );
}
