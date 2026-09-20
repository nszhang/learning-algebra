/* ============================================================
   AlgebraAce — app logic
   Accounts, SmartScore engine, practice flow, rewards, dashboard
   ============================================================ */

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const USERS_KEY = 'algebraace_users';
const SESSION_KEY = 'algebraace_session';
const ASSIGN_KEY = 'algebraace_assignments';

/* ============================================================
   STORAGE & ACCOUNTS
   ============================================================ */
function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
  catch { return {}; }
}
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadAssignments() {
  try { return JSON.parse(localStorage.getItem(ASSIGN_KEY)) || []; }
  catch { return []; }
}
function saveAssignments() {
  localStorage.setItem(ASSIGN_KEY, JSON.stringify(assignments));
}
let assignments = loadAssignments();

// NOTE: demo-grade hash — fine for a local learning app, not for production.
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return 'h' + h.toString(36);
}

function newUser(displayName, password, role) {
  return {
    displayName,
    pass: hash(password),
    role: role || 'student',
    created: Date.now(),
    stars: 0,
    skills: {},           // skillId -> { score, answered, correct, medals: [] }
    stats: { answered: 0, correct: 0, timeSec: 0, bestStreak: 0, homeworkDone: 0 },
    awards: {},           // awardId -> timestamp
    homework: {}          // assignmentId -> { progress: {skillId:{done,correct}}, completed, completedAt }
  };
}

let users = loadUsers();
let currentUser = null;      // username string
let user = null;             // user object (reference into users)

function persist() {
  users[currentUser] = user;
  saveUsers(users);
}

function skillState(id) {
  if (!user.skills[id]) user.skills[id] = { score: 0, answered: 0, correct: 0, medals: [] };
  return user.skills[id];
}

/* ============================================================
   AUTH UI
   ============================================================ */
let authMode = 'login';
let authRole = 'student';

function setAuthMode(mode) {
  authMode = mode;
  $('#tab-login').classList.toggle('active', mode === 'login');
  $('#tab-signup').classList.toggle('active', mode === 'signup');
  $('#display-name-row').classList.toggle('hidden', mode === 'login');
  $('#role-row').classList.toggle('hidden', mode === 'login');
  $('#auth-submit').textContent = mode === 'login' ? 'Log in' : 'Create account';
  $('#auth-error').textContent = '';
}

$('#tab-login').addEventListener('click', () => setAuthMode('login'));
$('#tab-signup').addEventListener('click', () => setAuthMode('signup'));

function setAuthRole(role) {
  authRole = role;
  $('#role-student').classList.toggle('active', role === 'student');
  $('#role-teacher').classList.toggle('active', role === 'teacher');
}
$('#role-student').addEventListener('click', () => setAuthRole('student'));
$('#role-teacher').addEventListener('click', () => setAuthRole('teacher'));

$('#form-auth').addEventListener('submit', e => {
  e.preventDefault();
  const uname = $('#auth-username').value.trim().toLowerCase();
  const pass = $('#auth-password').value;
  const err = $('#auth-error');

  if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
    err.textContent = 'Username must be 3–20 chars: letters, numbers, underscores.';
    return;
  }
  if (pass.length < 4) { err.textContent = 'Password must be at least 4 characters.'; return; }

  if (authMode === 'signup') {
    if (users[uname]) { err.textContent = 'That username is taken — try another!'; return; }
    const display = $('#auth-display').value.trim() || uname;
    users[uname] = newUser(display, pass, authRole);
    saveUsers(users);
    startSession(uname);
  } else {
    const u = users[uname];
    if (!u || u.pass !== hash(pass)) { err.textContent = 'Incorrect username or password.'; return; }
    startSession(uname);
  }
});

function startSession(uname) {
  currentUser = uname;
  user = users[uname];
  // migrate older accounts
  user.role = user.role || 'student';
  user.homework = user.homework || {};
  user.stats.homeworkDone = user.stats.homeworkDone || 0;

  localStorage.setItem(SESSION_KEY, uname);
  $('#screen-auth').classList.remove('active');
  $('#app-shell').classList.remove('hidden');
  $('#user-greeting').textContent = `Hi, ${user.displayName}!`;
  updateStarsChip();

  const isTeacher = user.role === 'teacher';
  ['skills', 'homework', 'dashboard', 'awards'].forEach(id =>
    $('#nav-' + id).classList.toggle('hidden', isTeacher));
  ['students', 'assign'].forEach(id =>
    $('#nav-' + id).classList.toggle('hidden', !isTeacher));
  showPage(isTeacher ? 'students' : 'home');
}

$('#btn-logout').addEventListener('click', () => {
  stopPracticeTimer();
  persist();
  localStorage.removeItem(SESSION_KEY);
  currentUser = null; user = null;
  $('#app-shell').classList.add('hidden');
  $('#screen-auth').classList.add('active');
  $('#auth-password').value = '';
});

function updateStarsChip() {
  $('#user-stars').textContent = `⭐ ${user.stars}`;
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function showPage(name) {
  stopPracticeTimer();
  ['home', 'homework', 'dashboard', 'awards', 'students', 'assign', 'practice'].forEach(p =>
    $('#screen-' + p).classList.toggle('active', p === name));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
  if (name === 'home') renderSkills();
  if (name === 'homework') renderHomework();
  if (name === 'dashboard') renderDashboard();
  if (name === 'awards') renderAwards();
  if (name === 'students') renderTeacherStudents();
  if (name === 'assign') renderAssign();
}

$$('.nav-btn').forEach(b => b.addEventListener('click', () => showPage(b.dataset.nav)));

/* ============================================================
   SKILLS HOME
   ============================================================ */
function medallionHTML(score) {
  let cls = '', label = score;
  if (score >= 100) { cls = 'm-gold'; label = '100'; }
  else if (score >= 90) { cls = 'm-silver'; }
  else if (score >= 70) { cls = 'm-bronze'; }
  else if (score > 0) { cls = 'm-prog'; }
  return `<div class="medallion ${cls}">${score > 0 ? label : '·'}</div>`;
}

function renderSkills() {
  const hwSkills = homeworkSkillIdsToday();
  const container = $('#skills-container');
  container.innerHTML = '';
  TOPICS.forEach((topic, i) => {
    const scores = topic.skills.map(s => (user.skills[s.id] || {}).score || 0);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const card = document.createElement('div');
    card.className = 'topic-card' + (i === 0 ? ' open' : '');
    card.innerHTML = `
      <div class="topic-head">
        <span class="topic-icon">${topic.icon}</span>
        <h3>${topic.name}</h3>
        <div class="topic-progress"><div class="topic-progress-fill" style="width:${avg}%"></div></div>
        <span class="topic-pct">${avg}%</span>
        <span class="topic-caret">▶</span>
      </div>
      <div class="skill-list">
        ${topic.skills.map(s => {
          const st = user.skills[s.id] || { score: 0 };
          return `<div class="skill-row" data-skill="${s.id}">
            <span class="skill-code">${s.code}</span>
            <span class="skill-name">${s.title}</span>
            ${hwSkills.has(s.id) ? '<span class="hw-tag">📝 HW</span>' : ''}
            ${medallionHTML(st.score)}
          </div>`;
        }).join('')}
      </div>`;
    card.querySelector('.topic-head').addEventListener('click', () => card.classList.toggle('open'));
    container.appendChild(card);
  });

  container.querySelectorAll('.skill-row').forEach(row =>
    row.addEventListener('click', () => {
      // If this skill is part of an unfinished homework assignment, route the
      // student into homework mode so answers count toward the assignment.
      const hw = findHomeworkForSkill(row.dataset.skill);
      if (hw) {
        toast('📝', 'This skill is in your homework — answers count toward it!');
        startHomework(hw);
      } else {
        startPractice(row.dataset.skill);
      }
    }));
}

/* ============================================================
   SMARTSCORE ENGINE (IXL-style)
   Fast gains early, small gains + big penalties near mastery.
   ============================================================ */
function scoreDelta(score, correct) {
  if (correct) {
    if (score < 60) return ri(8, 12);
    if (score < 75) return ri(5, 8);
    if (score < 85) return ri(3, 5);
    if (score < 90) return ri(2, 3);
    if (score < 96) return ri(1, 2);
    return 1;
  }
  if (score < 60) return -ri(2, 5);
  if (score < 75) return -ri(4, 7);
  if (score < 85) return -ri(6, 10);
  if (score < 90) return -ri(8, 12);
  return -ri(10, 16); // Challenge Zone penalty
}

function medalFor(score) {
  if (score >= 100) return { id: 'gold',   emoji: '🥇', stars: 3, label: 'Gold medal — MASTERED!' };
  if (score >= 90)  return { id: 'silver', emoji: '🥈', stars: 2, label: 'Silver medal — Challenge Zone reached!' };
  if (score >= 70)  return { id: 'bronze', emoji: '🥉', stars: 1, label: 'Bronze medal — keep climbing!' };
  return null;
}

/* ============================================================
   PRACTICE
   ============================================================ */
const practice = {
  skill: null,
  question: null,
  answered: false,
  selectedChoice: null,
  session: null,
  timerId: null,
  mode: 'skill',   // 'skill' | 'homework'
  hw: null,        // { assign, queue: [{skillId,count,done}], qi }
  hwDone: false
};

function startPractice(skillId) {
  const { topic, skill } = SKILL_INDEX[skillId];
  practice.mode = 'skill';
  practice.hw = null;
  practice.hwDone = false;
  $('#practice-banner').classList.add('hidden');
  practice.skill = skill;
  practice.session = { correct: 0, answered: 0, streak: 0, seconds: 0, rewards: [] };
  $('#practice-code').textContent = skill.code;
  $('#practice-title').textContent = skill.title;
  $('#session-rewards').innerHTML = '';
  updateScorePanel();
  nextQuestion();
  showPage('practice');
  startPracticeTimer();
}

$('#btn-exit-practice').addEventListener('click', () => {
  persist();
  showPage(practice.mode === 'homework' ? 'homework' : 'home');
});

function startPracticeTimer() {
  stopPracticeTimer();
  practice.timerId = setInterval(() => {
    practice.session.seconds++;
    user.stats.timeSec++;
    const s = practice.session.seconds;
    $('#session-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (s % 15 === 0) { checkAwards(); persist(); }
  }, 1000);
}
function stopPracticeTimer() {
  if (practice.timerId) { clearInterval(practice.timerId); practice.timerId = null; }
}

function nextQuestion() {
  if (practice.mode === 'homework') {
    const item = practice.hw.queue[practice.hw.qi];
    practice.skill = SKILL_INDEX[item.skillId].skill;
    updateHwBanner();
  }
  practice.question = practice.skill.gen();
  practice.answered = false;
  practice.selectedChoice = null;

  $('#question-prompt').innerHTML = practice.question.prompt;
  $('#feedback').className = 'feedback hidden';
  $('#feedback').innerHTML = '';

  const area = $('#answer-area');
  if (practice.question.type === 'num') {
    area.innerHTML = `<input id="answer-input" class="answer-input" type="number" step="any" placeholder="?" autocomplete="off" />`;
    const input = $('#answer-input');
    input.focus();
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') advanceOrSubmit();
    });
  } else {
    area.innerHTML = `<div class="choices">${practice.question.choices.map((c, i) =>
      `<button class="choice-btn" data-i="${i}" type="button">${c}</button>`).join('')}</div>`;
    area.querySelectorAll('.choice-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        if (practice.answered) return;
        area.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        practice.selectedChoice = practice.question.choices[+btn.dataset.i];
      }));
  }

  const btn = $('#btn-submit');
  btn.textContent = 'Submit';
  btn.disabled = false;
}

function advanceOrSubmit() {
  if (!practice.answered) { submitAnswer(); return; }
  if (practice.hwDone) { persist(); showPage('homework'); return; }
  nextQuestion();
}

$('#btn-submit').addEventListener('click', advanceOrSubmit);

function submitAnswer() {
  if (practice.answered) return;
  const q = practice.question;
  let given, correct;

  if (q.type === 'num') {
    const raw = $('#answer-input').value.trim();
    if (raw === '') { $('#answer-input').focus(); return; }
    given = Number(raw);
    correct = Math.abs(given - q.answer) < 1e-9;
  } else {
    if (practice.selectedChoice === null) return;
    given = practice.selectedChoice;
    correct = given === q.answer;
  }

  practice.answered = true;
  applyScore(correct);
  if (practice.mode === 'homework') recordHomeworkAnswer(correct);
  showFeedback(correct, given);

  const btn = $('#btn-submit');
  btn.textContent = practice.hwDone ? 'Finish 🎉' : 'Next question';
}

function applyScore(correct) {
  const st = skillState(practice.skill.id);
  const before = st.score;
  st.score = Math.max(0, Math.min(100, before + scoreDelta(before, correct)));
  if (correct && st.score >= 98) st.score = 100;
  st.answered++;
  if (correct) st.correct++;

  // user stats
  user.stats.answered++;
  const s = practice.session;
  s.answered++;
  if (correct) {
    user.stats.correct++;
    s.correct++;
    s.streak++;
    user.stats.bestStreak = Math.max(user.stats.bestStreak, s.streak);
  } else {
    s.streak = 0;
  }

  // medals
  const medal = medalFor(st.score);
  if (medal && !st.medals.includes(medal.id)) {
    st.medals.push(medal.id);
    user.stars += medal.stars;
    s.rewards.push(`${medal.emoji} ${medal.label} (+${medal.stars}⭐)`);
    renderSessionRewards();
    toast(medal.emoji, `${medal.label} +${medal.stars} ⭐`);
    if (medal.id === 'gold') {
      confettiBurst();
      toast('🎊', pick(MASTERY_MSGS));
    }
  }

  checkAwards();
  updateScorePanel();
  updateStarsChip();
  persist();
}

function renderSessionRewards() {
  const el = $('#session-rewards');
  if (!practice.session.rewards.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<h4>🎁 Earned this session</h4>` +
    practice.session.rewards.map(r => `<span class="reward-pill">${r}</span>`).join('');
}

function updateScorePanel() {
  const st = skillState(practice.skill.id);
  const sv = $('#score-value');
  sv.textContent = st.score;
  sv.classList.toggle('gold', st.score >= 100);
  sv.classList.remove('bounce'); void sv.offsetWidth; sv.classList.add('bounce');

  const fill = $('#score-bar-fill');
  fill.style.width = st.score + '%';
  fill.classList.toggle('gold', st.score >= 100);

  const medal = medalFor(st.score);
  $('#score-medal').textContent = practice.mode === 'homework' && practice.hw
    ? `📝 Homework: ${hwProgress(user, practice.hw.assign).done}/${hwProgress(user, practice.hw.assign).total} questions done`
    : medal
      ? (st.score >= 100 ? '🥇 Mastered!' : `${medal.emoji} ${st.score >= 90 ? 'Silver — Challenge Zone!' : 'Bronze — on your way!'}`)
      : 'Reach 70 for a bronze medal 🥉';

  const s = practice.session;
  $('#session-streak').textContent = s.streak;
  $('#session-correct').textContent = `${s.correct}/${s.answered}`;
}

function showFeedback(correct, given) {
  const st = skillState(practice.skill.id);
  const fb = $('#feedback');
  const inChallenge = st.score >= 90;
  fb.className = 'feedback ' + (correct ? 'good' : 'bad');

  if (correct) {
    beep(880, 0.12);
    fb.innerHTML = `<h3>${inChallenge ? pick(PRAISE_CHALLENGE) : pick(PRAISE)}</h3>
      ${st.score >= 100 ? '<p class="explain">🥇 <strong>SmartScore 100 — mastery achieved!</strong> Keep practicing to stay sharp, or try another skill!</p>' : ''}`;
  } else {
    beep(220, 0.2);
    const answerText = practice.question.type === 'num' ? fmtNum(practice.question.answer) : practice.question.answer;
    fb.innerHTML = `<h3>${pick(ENCOURAGE)}</h3>
      <p class="explain">The correct answer is <strong>${answerText}</strong>.</p>
      <p class="explain"><strong>Why?</strong> ${practice.question.explain}</p>`;
  }
}

/* ============================================================
   HOMEWORK (student) + TEACHER TOOLS
   ============================================================ */

// --- date helpers ---
function localDateStr(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function niceDate(str) {
  return new Date(str + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// --- daily auto-generated assignment (deterministic per date) ---
const ALL_SKILLS = TOPICS.flatMap(t => t.skills);
function dailyAssignment(dateString) {
  let seed = 0;
  for (const c of dateString) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const items = [];
  for (let i = 0; items.length < 3 && i < ALL_SKILLS.length * 2; i++) {
    const s = ALL_SKILLS[(seed + i * 5) % ALL_SKILLS.length];
    if (!items.find(x => x.skillId === s.id)) items.push({ skillId: s.id, count: 5 });
  }
  return { id: 'daily-' + dateString, daily: true, teacher: null, student: currentUser, due: dateString, items };
}

function hwState(assignId) {
  user.homework = user.homework || {};
  if (!user.homework[assignId]) user.homework[assignId] = { progress: {}, completed: false, completedAt: null };
  return user.homework[assignId];
}

// progress for ANY user object (used by teacher views too)
function hwProgress(u, assign) {
  const hs = (u.homework || {})[assign.id];
  const total = assign.items.reduce((s, i) => s + i.count, 0);
  const done = assign.items.reduce((s, i) =>
    s + Math.min(i.count, ((hs && hs.progress[i.skillId]) || {}).done || 0), 0);
  return { done, total, completed: !!(hs && hs.completed) };
}

function assignmentsFor(dateString) {
  const list = assignments.filter(a => a.student === currentUser && a.due === dateString);
  list.unshift(dailyAssignment(dateString));
  return list;
}

function renderHomework() {
  const todayWrap = $('#homework-today');
  todayWrap.innerHTML = '';
  assignmentsFor(localDateStr()).forEach(a => todayWrap.appendChild(hwCard(a)));

  const weekWrap = $('#homework-week');
  weekWrap.innerHTML = '';
  for (let i = 1; i < 7; i++) {
    const d = localDateStr(addDays(new Date(), i));
    assignmentsFor(d).forEach(a => weekWrap.appendChild(hwCard(a)));
  }
}

function hwCard(assign) {
  const prog = hwProgress(user, assign);
  const card = document.createElement('div');
  card.className = 'hw-card' + (prog.completed ? ' done' : '');
  const from = assign.daily ? '📅 Daily Practice' : `🍎 From ${assign.teacherName || assign.teacher}`;
  card.innerHTML = `
    <div class="hw-head">
      <strong>${from}</strong>
      <span class="muted">due ${niceDate(assign.due)}</span>
      ${prog.completed
        ? '<span class="hw-done-badge">✅ Completed</span>'
        : `<span class="hw-progress-badge">${prog.done}/${prog.total} done</span>`}
    </div>
    <div class="hw-items">
      ${assign.items.map(item => {
        const sk = SKILL_INDEX[item.skillId].skill;
        const done = Math.min(item.count, (hwState(assign.id).progress[item.skillId] || {}).done || 0);
        return `<span class="hw-chip ${done >= item.count ? 'chip-done' : ''}">${sk.code} ${done}/${item.count}</span>`;
      }).join('')}
    </div>
    <p class="muted hw-note">Answer ${prog.total} questions to finish — wrong answers still count, so just do your best! 💪</p>
    ${prog.completed ? '' : `<button class="btn btn-primary hw-start" type="button">${prog.done > 0 ? 'Continue' : 'Start'} ▸</button>`}`;
  const btn = card.querySelector('.hw-start');
  if (btn) btn.addEventListener('click', () => startHomework(assign));
  return card;
}

// --- homework practice session ---
function startHomework(assign) {
  const hs = hwState(assign.id);
  const queue = [];
  assign.items.forEach(item => {
    const done = (hs.progress[item.skillId] || {}).done || 0;
    if (done < item.count) queue.push({ skillId: item.skillId, count: item.count, done });
  });
  if (!queue.length) { toast('✅', 'This homework is already complete!'); return; }

  practice.mode = 'homework';
  practice.hw = { assign, queue, qi: 0 };
  practice.hwDone = false;
  practice.session = { correct: 0, answered: 0, streak: 0, seconds: 0, rewards: [] };
  $('#practice-code').textContent = assign.daily ? 'Daily' : 'HW';
  $('#practice-title').textContent = assign.daily
    ? `Daily Practice — ${niceDate(assign.due)}`
    : `Homework from ${assign.teacherName || assign.teacher}`;
  $('#session-rewards').innerHTML = '';
  nextQuestion();
  showPage('practice');
  startPracticeTimer();
}

function updateHwBanner() {
  const { assign, queue, qi } = practice.hw;
  const item = queue[qi];
  const prog = hwProgress(user, assign);
  const banner = $('#practice-banner');
  banner.classList.remove('hidden');
  banner.innerHTML = `📝 <strong>${assign.daily ? 'Daily Practice' : 'Homework'}</strong> due ${niceDate(assign.due)} &nbsp;•&nbsp;
    ${SKILL_INDEX[item.skillId].skill.code}: question ${item.done + 1} of ${item.count} &nbsp;•&nbsp; Overall ${prog.done} of ${prog.total} questions`;
}

// skills with unfinished homework due (or overdue) today
function homeworkSkillIdsToday() {
  const today = localDateStr();
  const ids = new Set();
  assignments
    .filter(a => a.student === currentUser && a.due <= today)
    .concat([dailyAssignment(today)])
    .forEach(a => {
      if (!hwProgress(user, a).completed) a.items.forEach(i => ids.add(i.skillId));
    });
  return ids;
}

// first unfinished assignment (due today or overdue) that still needs this skill
function findHomeworkForSkill(skillId) {
  const today = localDateStr();
  const candidates = assignments
    .filter(a => a.student === currentUser && a.due <= today)
    .concat([dailyAssignment(today)]);
  return candidates.find(a => {
    if (hwProgress(user, a).completed) return false;
    const item = a.items.find(i => i.skillId === skillId);
    if (!item) return false;
    const hs = (user.homework || {})[a.id];
    const done = ((hs && hs.progress[skillId]) || {}).done || 0;
    return done < item.count;
  }) || null;
}

function recordHomeworkAnswer(correct) {
  const { assign, queue } = practice.hw;
  const item = queue[practice.hw.qi];
  item.done++;
  const hs = hwState(assign.id);
  const p = hs.progress[item.skillId] || (hs.progress[item.skillId] = { done: 0, correct: 0 });
  p.done++;
  if (correct) p.correct++;
  if (item.done >= item.count) practice.hw.qi++;
  if (practice.hw.qi >= queue.length) completeHomework(assign);
  else updateHwBanner();
}

function completeHomework(assign) {
  const hs = hwState(assign.id);
  hs.completed = true;
  hs.completedAt = Date.now();
  user.stats.homeworkDone++;
  user.stars += 5;
  practice.hwDone = true;
  practice.session.rewards.push('🎉 Homework complete! (+5⭐)');
  renderSessionRewards();
  confettiBurst();
  toast('🎉', 'Homework complete! +5 ⭐');
  const banner = $('#practice-banner');
  banner.classList.remove('hidden');
  banner.innerHTML = '🎉 <strong>Homework complete!</strong> Amazing work — you earned 5 ⭐';
  checkAwards();
  updateStarsChip();
  persist();
}

// --- teacher: students overview ---
function renderTeacherStudents() {
  const wrap = $('#teacher-students');
  const students = Object.entries(users).filter(([, u]) => (u.role || 'student') === 'student');
  if (!students.length) {
    wrap.innerHTML = '<p class="muted">No student accounts yet. Students can sign up from the login page.</p>';
    return;
  }
  wrap.innerHTML = '';
  students.forEach(([uname, u]) => {
    const total = totalScore(u);
    const pct = u.stats.answered ? Math.round(100 * u.stats.correct / u.stats.answered) : 0;
    const card = document.createElement('div');
    card.className = 'student-card';
    card.innerHTML = `
      <div class="student-head">
        <strong>${u.displayName}</strong> <span class="muted">@${uname}</span>
        <span class="student-stats">📊 ${total} &nbsp;•&nbsp; 🥇 ${masteredCount(u)} mastered &nbsp;•&nbsp; 🎯 ${pct}% &nbsp;•&nbsp;
          ⏱️ ${Math.floor(u.stats.timeSec / 60)}m &nbsp;•&nbsp; 📝 ${u.stats.homeworkDone || 0} homeworks &nbsp;•&nbsp; ⭐ ${u.stars}</span>
        <span class="topic-caret">▶</span>
      </div>
      <div class="student-detail hidden">
        ${TOPICS.map(t => {
          const scores = t.skills.map(s => (u.skills[s.id] || {}).score || 0);
          const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          return `<div class="dash-row" style="cursor:default">
            <span style="min-width:200px">${t.icon} ${t.name}</span>
            <div class="dash-bar"><div class="dash-bar-fill" style="width:${avg}%"></div></div>
            <span class="dash-score">${avg}</span></div>`;
        }).join('')}
        <h4 style="margin:14px 0 6px">Assignments</h4>
        ${renderStudentHwList(uname, u)}
      </div>`;
    card.querySelector('.student-head').addEventListener('click', () => {
      card.querySelector('.student-detail').classList.toggle('hidden');
      card.classList.toggle('open');
    });
    wrap.appendChild(card);
  });
}

function renderStudentHwList(uname, u) {
  const list = assignments.filter(a => a.student === uname).sort((a, b) => a.due < b.due ? -1 : 1);
  if (!list.length) return '<p class="muted">No assignments yet — use the Assign tab.</p>';
  return list.map(a => {
    const prog = hwProgress(u, a);
    const status = prog.completed ? '✅ done' : prog.done > 0 ? `⏳ ${prog.done}/${prog.total}` : '⬜ not started';
    return `<div class="hw-mini">due ${niceDate(a.due)} — ${a.items.map(i => SKILL_INDEX[i.skillId].skill.code).join(', ')}: ${status}</div>`;
  }).join('');
}

// --- teacher: assign exercises ---
function renderAssign() {
  const students = Object.entries(users).filter(([, u]) => (u.role || 'student') === 'student');
  $('#assign-student').innerHTML = students.map(([un, u]) =>
    `<option value="${un}">${u.displayName} (@${un})</option>`).join('');
  if (!$('#assign-date').value) $('#assign-date').value = localDateStr();

  $('#assign-skills').innerHTML = TOPICS.map(t => `
    <div class="assign-topic"><strong>${t.icon} ${t.name}</strong>
      ${t.skills.map(s => `<label class="assign-skill"><input type="checkbox" value="${s.id}"> ${s.code} ${s.title}</label>`).join('')}
    </div>`).join('');
  renderAssignList();
}

function renderAssignList() {
  const wrap = $('#assign-list');
  const mine = assignments.filter(a => a.teacher === currentUser).sort((a, b) => b.created - a.created);
  if (!mine.length) { wrap.innerHTML = '<p class="muted">No assignments yet — create one above!</p>'; return; }
  wrap.innerHTML = '';
  mine.forEach(a => {
    const stu = users[a.student];
    const prog = hwProgress(stu || { homework: {} }, a);
    const status = prog.completed ? '✅ done' : prog.done > 0 ? `⏳ ${prog.done}/${prog.total}` : '⬜ not started';
    const row = document.createElement('div');
    row.className = 'assign-row';
    row.innerHTML = `
      <span>👤 <strong>${stu ? stu.displayName : a.student}</strong></span>
      <span>📅 ${niceDate(a.due)}</span>
      <span>${a.items.map(i => SKILL_INDEX[i.skillId].skill.code).join(', ')} (${a.items.reduce((s, i) => s + i.count, 0)} questions)</span>
      <span>${status}</span>
      <button class="btn btn-ghost assign-del" type="button">🗑️</button>`;
    row.querySelector('.assign-del').addEventListener('click', () => {
      assignments = assignments.filter(x => x.id !== a.id);
      saveAssignments();
      renderAssignList();
      toast('🗑️', 'Assignment deleted');
    });
    wrap.appendChild(row);
  });
}

$('#form-assign').addEventListener('submit', e => {
  e.preventDefault();
  const student = $('#assign-student').value;
  const due = $('#assign-date').value;
  const count = Math.max(1, Math.min(20, +$('#assign-count').value || 5));
  const skillIds = [...$$('#assign-skills input:checked')].map(c => c.value);
  if (!student) { toast('⚠️', 'No student accounts available.'); return; }
  if (!due) { toast('⚠️', 'Pick a due date.'); return; }
  if (!skillIds.length) { toast('⚠️', 'Pick at least one skill.'); return; }
  assignments.push({
    id: 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    teacher: currentUser,
    teacherName: user.displayName,
    student, due, created: Date.now(),
    items: skillIds.map(id => ({ skillId: id, count }))
  });
  saveAssignments();
  renderAssignList();
  toast('📝', `Assigned ${skillIds.length} skill(s) to ${users[student].displayName}, due ${niceDate(due)}`);
});

/* ============================================================
   AWARDS
   ============================================================ */
function checkAwards() {
  AWARDS.forEach(a => {
    if (!user.awards[a.id] && a.check(user)) {
      user.awards[a.id] = Date.now();
      user.stars += 2;
      if (practice.session) {
        practice.session.rewards.push(`${a.emoji} Badge: ${a.name} (+2⭐)`);
        renderSessionRewards();
      }
      toast(a.emoji, `Badge earned: ${a.name}! +2 ⭐`);
    }
  });
}

function renderAwards() {
  const grid = $('#awards-grid');
  grid.innerHTML = '';
  AWARDS.forEach(a => {
    const earned = user.awards[a.id];
    const card = document.createElement('div');
    card.className = 'award-card ' + (earned ? 'earned' : 'locked');
    card.innerHTML = `
      <div class="award-emoji">${a.emoji}</div>
      <h4>${a.name}</h4>
      <p>${a.desc}</p>
      ${earned ? `<span class="award-date">Earned ${new Date(earned).toLocaleDateString()}</span>` : ''}`;
    grid.appendChild(card);
  });
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard() {
  $('#dashboard-subtitle').textContent =
    `${user.displayName}'s learning journey — member since ${new Date(user.created).toLocaleDateString()}`;

  const total = totalScore(user);
  const mastered = masteredCount(user);
  const skillCount = TOPICS.reduce((n, t) => n + t.skills.length, 0);
  const mins = Math.floor(user.stats.timeSec / 60);
  const pct = user.stats.answered ? Math.round(100 * user.stats.correct / user.stats.answered) : 0;

  const cards = [
    ['📊', total, 'Total SmartScore'],
    ['🥇', `${mastered}/${skillCount}`, 'Skills mastered'],
    ['❓', user.stats.answered, 'Questions answered'],
    ['🎯', pct + '%', 'Accuracy'],
    ['🔥', user.stats.bestStreak, 'Best streak'],
    ['📝', user.stats.homeworkDone || 0, 'Homework done'],
    ['⏱️', mins + ' min', 'Time practiced'],
    ['⭐', user.stars, 'Stars earned'],
    ['🏆', Object.keys(user.awards).length, 'Badges earned']
  ];
  $('#stat-cards').innerHTML = cards.map(([emoji, num, label]) =>
    `<div class="stat-card"><div class="stat-emoji">${emoji}</div>
     <div class="stat-num">${num}</div><div class="stat-label">${label}</div></div>`).join('');

  $('#dashboard-skills').innerHTML = TOPICS.map(topic => `
    <h3 class="section-title">${topic.icon} ${topic.name}</h3>
    ${topic.skills.map(s => {
      const st = user.skills[s.id] || { score: 0, answered: 0 };
      return `<div class="dash-row" data-skill="${s.id}">
        <span class="skill-code">${s.code}</span>
        <span style="min-width:200px">${s.title}</span>
        <div class="dash-bar"><div class="dash-bar-fill" style="width:${st.score}%"></div></div>
        <span class="dash-score">${st.score}</span>
        ${medallionHTML(st.score)}
      </div>`;
    }).join('')}`).join('');

  $$('#dashboard-skills .dash-row').forEach(row =>
    row.addEventListener('click', () => startPractice(row.dataset.skill)));
}

/* ============================================================
   TOASTS, CONFETTI, SOUND
   ============================================================ */
function toast(emoji, msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-emoji">${emoji}</span><span>${msg}</span>`;
  $('#toast-container').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 3200);
}

function confettiBurst() {
  const canvas = $('#confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = innerWidth; canvas.height = innerHeight;
  const colors = ['#4f46e5', '#f59e0b', '#16a34a', '#ec4899', '#06b6d4', '#f97316'];
  const parts = Array.from({ length: 180 }, () => ({
    x: innerWidth / 2 + ri(-120, 120),
    y: innerHeight * 0.3,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 13 - 4,
    w: ri(6, 12), h: ri(8, 16),
    color: pick(colors),
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3
  }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (++frames < 160) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  })();
}

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

/* ============================================================
   BOOT — restore session if present
   ============================================================ */
(function boot() {
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved && users[saved]) startSession(saved);
})();
