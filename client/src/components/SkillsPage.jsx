import { useState } from 'react';
import { TOPICS } from '../skills.js';
import { homeworkSkillIdsToday, findHomeworkForSkill } from '../homework.js';
import Medallion from './Medallion.jsx';

export default function SkillsPage({ me, homework, onStartSkill, onStartHomework, toast }) {
  const [open, setOpen] = useState(() => new Set([TOPICS[0]?.id]));
  const hwSkills = homeworkSkillIdsToday(homework);
  const scoreOf = id => me?.skillProgress?.find(p => p.skill_id === id)?.score || 0;

  function toggle(id) {
    setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function clickSkill(skillId) {
    const hw = findHomeworkForSkill(skillId, homework);
    if (hw) {
      toast('📝', 'This skill is in your homework — answers count toward it!');
      onStartHomework(hw);
    } else {
      onStartSkill(skillId);
    }
  }

  return (
    <main className="page">
      <div className="page-head">
        <h2>Algebra Skills</h2>
        <p className="muted">Pick a skill and practice until your SmartScore hits <strong>100</strong>! Medals: 🥉 70 &nbsp; 🥈 90 &nbsp; 🥇 100</p>
      </div>
      <div>
        {TOPICS.map(topic => {
          const avg = Math.round(topic.skills.reduce((s, sk) => s + scoreOf(sk.id), 0) / topic.skills.length);
          return (
            <div className={'topic-card' + (open.has(topic.id) ? ' open' : '')} key={topic.id}>
              <div className="topic-head" onClick={() => toggle(topic.id)}>
                <span className="topic-icon">{topic.icon}</span>
                <h3>{topic.name}</h3>
                <div className="topic-progress"><div className="topic-progress-fill" style={{ width: avg + '%' }} /></div>
                <span className="topic-pct">{avg}%</span>
                <span className="topic-caret">▶</span>
              </div>
              <div className="skill-list">
                {topic.skills.map(s => (
                  <div className="skill-row" key={s.id} onClick={() => clickSkill(s.id)}>
                    <span className="skill-code">{s.code}</span>
                    <span className="skill-name">{s.title}</span>
                    {hwSkills.has(s.id) && <span className="hw-tag">📝 HW</span>}
                    <Medallion score={scoreOf(s.id)} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
