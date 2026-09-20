import { useCallback, useEffect, useState } from 'react';
import { api, setToken } from './api.js';
import Auth from './components/Auth.jsx';
import SkillsPage from './components/SkillsPage.jsx';
import HomeworkPage from './components/HomeworkPage.jsx';
import DashboardPage from './components/DashboardPage.jsx';
import AwardsPage from './components/AwardsPage.jsx';
import TeacherStudents from './components/TeacherStudents.jsx';
import TeacherAssign from './components/TeacherAssign.jsx';
import PracticePage from './components/PracticePage.jsx';
import Confetti from './components/Confetti.jsx';

function ToastList({ toasts }) {
  return (
    <div id="toast-container">
      {toasts.map(t => (
        <div className="toast" key={t.id}>
          <span className="toast-emoji">{t.emoji}</span><span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('aa_user') || 'null'));
  const [page, setPage] = useState('home');
  const [me, setMe] = useState(null);
  const [homework, setHomework] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [practiceCfg, setPracticeCfg] = useState(null);
  const [confettiTick, setConfettiTick] = useState(0);

  const toast = useCallback((emoji, msg) => {
    const id = Math.random().toString(36);
    setToasts(t => [...t, { id, emoji, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3600);
  }, []);
  const fireConfetti = useCallback(() => setConfettiTick(t => t + 1), []);

  const refreshMe = useCallback(async () => {
    try { setMe(await api('GET', '/api/me')); } catch { /* token expired */ }
  }, []);
  const refreshHomework = useCallback(async () => {
    try { setHomework(await api('GET', '/api/homework')); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (user) {
      setPage(user.role === 'teacher' ? 'students' : 'home');
      refreshMe();
      if (user.role === 'student') refreshHomework();
    }
  }, [user, refreshMe, refreshHomework]);

  function onAuth({ token, user: u }) {
    setToken(token);
    localStorage.setItem('aa_user', JSON.stringify(u));
    setUser(u);
  }
  function logout() {
    setToken(null);
    localStorage.removeItem('aa_user');
    setUser(null); setMe(null); setHomework(null); setPracticeCfg(null);
  }

  if (!user) {
    return (<>
      <Auth onAuth={onAuth} />
      <ToastList toasts={toasts} />
    </>);
  }

  const isTeacher = user.role === 'teacher';
  const nav = isTeacher
    ? [['students', '👥 Students'], ['assign', '📝 Assign']]
    : [['home', '📚 Skills'], ['homework', '📝 Homework'], ['dashboard', '📊 My Progress'], ['awards', '🏆 Awards']];

  const startSkill = skillId => setPracticeCfg({ mode: 'skill', skillId });
  const startHomework = assignment => setPracticeCfg({ mode: 'homework', assignment });

  function exitPractice(cfg) {
    setPracticeCfg(null);
    refreshMe();
    if (!isTeacher) refreshHomework();
    setPage(cfg.mode === 'homework' ? 'homework' : 'home');
  }

  return (<>
    <Confetti tick={confettiTick} />
    <header className="topbar">
      <div className="brand brand-sm">
        <span className="brand-logo">∑</span>
        <span className="brand-name">Algebra<span className="brand-accent">Ace</span></span>
      </div>
      <nav className="main-nav">
        {nav.map(([id, label]) => (
          <button key={id} type="button"
            className={'nav-btn' + (page === id && !practiceCfg ? ' active' : '')}
            onClick={() => { setPracticeCfg(null); setPage(id); }}>
            {label}
          </button>
        ))}
      </nav>
      <div className="user-chip">
        {!isTeacher && <span className="stars-chip">⭐ {me?.user?.stars ?? user.stars}</span>}
        <span className="greeting">Hi, {user.displayName}!</span>
        <button className="btn btn-ghost" type="button" onClick={logout}>Log out</button>
      </div>
    </header>

    {practiceCfg ? (
      <PracticePage cfg={practiceCfg} me={me} toast={toast}
        fireConfetti={fireConfetti} onExit={() => exitPractice(practiceCfg)} />
    ) : (<>
      {page === 'home' && <SkillsPage me={me} homework={homework}
        onStartSkill={startSkill} onStartHomework={startHomework} toast={toast} />}
      {page === 'homework' && <HomeworkPage homework={homework} onStart={startHomework} />}
      {page === 'dashboard' && <DashboardPage me={me} onStartSkill={startSkill} />}
      {page === 'awards' && <AwardsPage me={me} />}
      {page === 'students' && <TeacherStudents />}
      {page === 'assign' && <TeacherAssign toast={toast} />}
    </>)}

    <ToastList toasts={toasts} />
  </>);
}
