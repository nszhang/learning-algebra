import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { TOPICS } from '../skills.js';
import { localDateStr, niceDate, skillName } from '../homework.js';

export default function TeacherAssign({ toast }) {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [due, setDue] = useState(localDateStr());
  const [count, setCount] = useState(5);
  const [checked, setChecked] = useState(() => new Set());
  const [assignments, setAssignments] = useState([]);

  async function load() {
    try {
      const [stu, list] = await Promise.all([
        api('GET', '/api/students'),
        api('GET', '/api/assignments')
      ]);
      setStudents(stu);
      if (!studentId && stu.length) setStudentId(String(stu[0].id));
      setAssignments(list);
    } catch (e) { toast('⚠️', e.message); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSkill(id) {
    setChecked(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function submit(e) {
    e.preventDefault();
    if (!studentId) return toast('⚠️', 'No student accounts available.');
    if (!checked.size) return toast('⚠️', 'Pick at least one skill.');
    try {
      await api('POST', '/api/assignments', {
        studentId: Number(studentId), due,
        items: [...checked].map(skillId => ({ skillId, count }))
      });
      const stu = students.find(s => String(s.id) === String(studentId));
      toast('📝', `Assigned ${checked.size} skill(s) to ${stu?.displayName || 'student'}, due ${niceDate(due)}`);
      setChecked(new Set());
      load();
    } catch (err) { toast('⚠️', err.message); }
  }

  async function remove(id) {
    try {
      await api('DELETE', `/api/assignments/${id}`);
      toast('🗑️', 'Assignment deleted');
      load();
    } catch (e) { toast('⚠️', e.message); }
  }

  return (
    <main className="page">
      <div className="page-head">
        <h2>📝 Assign Exercises</h2>
        <p className="muted">Choose a student, a due date, and the skills to practice.</p>
      </div>

      <form className="assign-card" onSubmit={submit}>
        <div className="assign-grid">
          <label>Student
            <select value={studentId} onChange={e => setStudentId(e.target.value)}>
              {students.map(s => <option key={s.id} value={s.id}>{s.displayName} (@{s.username})</option>)}
            </select>
          </label>
          <label>Due date
            <input type="date" required value={due} onChange={e => setDue(e.target.value)} />
          </label>
          <label>Questions per skill
            <input type="number" min="1" max="20" value={count}
              onChange={e => setCount(Number(e.target.value))} />
          </label>
        </div>
        <div>
          {TOPICS.map(t => (
            <div className="assign-topic" key={t.id}>
              <strong>{t.icon} {t.name}</strong>
              {t.skills.map(s => (
                <label className="assign-skill" key={s.id}>
                  <input type="checkbox" checked={checked.has(s.id)} onChange={() => toggleSkill(s.id)} />
                  {s.code} {s.title}
                </label>
              ))}
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-lg" type="submit">Assign homework</button>
      </form>

      <h3 className="section-title">Assignments</h3>
      <div>
        {assignments.length === 0 && <p className="muted">No assignments yet — create one above!</p>}
        {assignments.map(a => (
          <div className="assign-row" key={a.id}>
            <span>👤 <strong>{a.studentName}</strong></span>
            <span>📅 {niceDate(a.due)}</span>
            <span>{a.items.map(i => skillName(i.skillId)).join(', ')} ({a.total} questions)</span>
            <span>{a.completed ? '✅ done' : a.done > 0 ? `⏳ ${a.done}/${a.total}` : '⬜ not started'}</span>
            <button className="btn btn-ghost assign-del" type="button" onClick={() => remove(a.id)}>🗑️</button>
          </div>
        ))}
      </div>
    </main>
  );
}
