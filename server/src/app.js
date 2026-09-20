// Express app factory — inject a pg-compatible pool (or pg-mem in tests).
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as db from './db.js';
import { nextScore, medalFor } from './scoring.js';
import { AWARDS, AWARD_META } from './awards.js';

const SKILL_IDS = ['A1','A2','B1','B2','C1','C2','D1','D2','E1','E2','E3','F1','F2','F3','G1','H1','I1'];
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function createApp(pool, jwtSecret = 'dev-secret-change-me') {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const sign = user => jwt.sign({ uid: user.id, role: user.role }, jwtSecret, { expiresIn: '30d' });
  const publicUser = u => ({
    id: u.id, username: u.username, displayName: u.display_name,
    role: u.role, stars: u.stars, createdAt: u.created_at
  });

  // ---------- auth middleware ----------
  function auth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    try {
      const payload = jwt.verify(token, jwtSecret);
      req.uid = payload.uid;
      req.role = payload.role;
      next();
    } catch {
      res.status(401).json({ error: 'Session expired — please log in again' });
    }
  }
  const teacherOnly = (req, res, next) =>
    req.role === 'teacher' ? next() : res.status(403).json({ error: 'Teachers only' });

  // ---------- helpers ----------
  async function awardContext(userId, starsOverride) {
    const [stats, progress, awards, userRow] = await Promise.all([
      db.getStats(pool, userId),
      db.getAllSkillProgress(pool, userId),
      db.getAwards(pool, userId),
      pool.query('SELECT stars FROM users WHERE id = $1', [userId]).then(r => r.rows[0])
    ]);
    return {
      stats,
      mastered: progress.filter(p => p.score >= 100).length,
      totalScore: progress.reduce((s, p) => s + p.score, 0),
      stars: starsOverride ?? userRow.stars,
      earned: new Set(awards.map(a => a.award_id))
    };
  }

  // Evaluate awards, grant new ones (+2 stars each), return list of newly earned.
  async function checkAwards(userId, starsOverride) {
    const ctx = await awardContext(userId, starsOverride);
    const newly = [];
    for (const a of AWARDS) {
      if (!ctx.earned.has(a.id) && a.check(ctx)) {
        await db.grantAward(pool, userId, a.id);
        await db.addStars(pool, userId, 2);
        newly.push({ id: a.id, emoji: a.emoji, name: a.name, stars: 2 });
        ctx.stars += 2; // so stars-based awards see the bonus
      }
    }
    return { newly, stars: ctx.stars };
  }

  function hwTotals(items, progressRows) {
    const total = items.reduce((s, i) => s + i.count, 0);
    const done = items.reduce((s, i) => {
      const row = progressRows.find(r => r.skill_id === i.skillId);
      return s + Math.min(i.count, row ? row.done : 0);
    }, 0);
    return { done, total };
  }

  function itemProgress(items, progressRows) {
    return items.map(i => {
      const row = progressRows.find(r => r.skill_id === i.skillId);
      return { skillId: i.skillId, count: i.count, done: row ? row.done : 0, correct: row ? row.correct : 0 };
    });
  }

  // ---------- auth routes ----------
  app.post('/api/auth/signup', async (req, res) => {
    const { username, displayName, password, role } = req.body || {};
    const uname = String(username || '').trim().toLowerCase();
    if (!USERNAME_RE.test(uname))
      return res.status(400).json({ error: 'Username must be 3–20 chars: letters, numbers, underscores.' });
    if (!password || String(password).length < 4)
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    if (!['student', 'teacher'].includes(role))
      return res.status(400).json({ error: 'Role must be student or teacher.' });
    if (await db.findUserByUsername(pool, uname))
      return res.status(409).json({ error: 'That username is taken — try another!' });

    const passHash = await bcrypt.hash(String(password), 10);
    const user = await db.createUser(pool, {
      username: uname,
      displayName: String(displayName || '').trim() || uname,
      passHash, role
    });
    res.json({ token: sign(user), user: publicUser(user) });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    const user = await db.findUserByUsername(pool, String(username || '').trim().toLowerCase());
    if (!user || !(await bcrypt.compare(String(password || ''), user.pass_hash)))
      return res.status(401).json({ error: 'Incorrect username or password.' });
    res.json({ token: sign(user), user: publicUser(user) });
  });

  app.get('/api/meta/awards', (req, res) => res.json(AWARD_META));

  // ---------- student data ----------
  app.get('/api/me', auth, async (req, res) => {
    const [userRow, stats, progress, awards] = await Promise.all([
      pool.query('SELECT * FROM users WHERE id = $1', [req.uid]).then(r => r.rows[0]),
      db.getStats(pool, req.uid),
      db.getAllSkillProgress(pool, req.uid),
      db.getAwards(pool, req.uid)
    ]);
    res.json({ user: publicUser(userRow), stats, skillProgress: progress, awards });
  });

  // The workhorse: record one answered question. Handles SmartScore, stats,
  // medals, stars, homework progress/completion, and awards in one call.
  app.post('/api/answers', auth, async (req, res) => {
    const { skillId, correct, streak, assignmentId, items } = req.body || {};
    if (!SKILL_IDS.includes(skillId)) return res.status(400).json({ error: 'Unknown skill' });
    if (typeof correct !== 'boolean') return res.status(400).json({ error: 'correct must be boolean' });

    // --- SmartScore ---
    const prev = await db.getSkillProgress(pool, req.uid, skillId);
    const score = nextScore(prev.score, correct);
    const medals = Array.isArray(prev.medals) ? prev.medals : [];
    let newMedal = null;
    let starDelta = 0;
    const medal = medalFor(score);
    if (medal && !medals.includes(medal.id)) {
      medals.push(medal.id);
      newMedal = medal;
      starDelta += medal.stars;
    }
    await db.saveSkillProgress(pool, req.uid, skillId, {
      score,
      answered: prev.answered + 1,
      correct: prev.correct + (correct ? 1 : 0),
      medals
    });
    await db.recordAnswerStats(pool, req.uid, correct, Math.max(0, streak | 0));

    // --- homework progress (when in homework mode) ---
    let homework = null;
    if (assignmentId) {
      let hwItems = null;
      if (assignmentId.startsWith('daily-')) {
        // daily sets are deterministic and client-computed
        hwItems = Array.isArray(items) ? items.filter(i =>
          SKILL_IDS.includes(i.skillId) && Number.isInteger(i.count) && i.count > 0 && i.count <= 50) : null;
      } else {
        const { rows } = await pool.query(
          'SELECT items FROM assignments WHERE id = $1 AND student_id = $2', [assignmentId, req.uid]);
        hwItems = rows[0] ? rows[0].items : null;
      }
      if (!hwItems) return res.status(400).json({ error: 'Unknown assignment' });

      const alreadyDone = (await db.getCompletedHomework(pool, req.uid))
        .some(c => c.assignment_id === assignmentId);
      if (!alreadyDone) {
        await db.recordHomeworkAnswer(pool, req.uid, assignmentId, skillId, correct);
        const progress = await db.getHomeworkProgress(pool, req.uid);
        const rows = progress.filter(r => r.assignment_id === assignmentId);
        const { done, total } = hwTotals(hwItems, rows);
        const justCompleted = hwItems.every(i => {
          const row = rows.find(r => r.skill_id === i.skillId);
          return (row ? row.done : 0) >= i.count;
        });
        if (justCompleted) {
          await db.markHomeworkCompleted(pool, req.uid, assignmentId);
          starDelta += 5;
        }
        homework = { done, total, justCompleted };
      } else {
        const progress = (await db.getHomeworkProgress(pool, req.uid))
          .filter(r => r.assignment_id === assignmentId);
        homework = { ...hwTotals(hwItems, progress), justCompleted: false };
      }
    }

    if (starDelta) await db.addStars(pool, req.uid, starDelta);
    const { stars: starsNow } = await pool.query('SELECT stars FROM users WHERE id = $1', [req.uid])
      .then(r => r.rows[0]);
    const { newly: newAwards, stars } = await checkAwards(req.uid, starsNow);

    res.json({ score, newMedal, newAwards, stars, homework });
  });

  app.post('/api/time', auth, async (req, res) => {
    const seconds = Math.max(0, Math.min(600, req.body?.seconds | 0));
    if (seconds) await db.addTime(pool, req.uid, seconds);
    const { newly: newAwards, stars } = await checkAwards(req.uid);
    res.json({ newAwards, stars });
  });

  // ---------- homework (student) ----------
  app.get('/api/homework', auth, async (req, res) => {
    const [assignments, progress, completed] = await Promise.all([
      db.getAssignmentsForStudent(pool, req.uid),
      db.getHomeworkProgress(pool, req.uid),
      db.getCompletedHomework(pool, req.uid)
    ]);
    const completedSet = new Set(completed.map(c => c.assignment_id));
    res.json({
      assignments: assignments.map(a => ({
        id: a.id, due: a.due, items: a.items, teacherName: a.teacher_name,
        progress: itemProgress(a.items, progress.filter(r => r.assignment_id === a.id)),
        ...hwTotals(a.items, progress.filter(r => r.assignment_id === a.id)),
        completed: completedSet.has(a.id)
      })),
      dailyProgress: progress.filter(r => r.assignment_id.startsWith('daily-')),
      dailyCompleted: completed.filter(c => c.assignment_id.startsWith('daily-'))
        .map(c => c.assignment_id)
    });
  });

  // ---------- teacher ----------
  app.get('/api/students', auth, teacherOnly, async (req, res) => {
    const students = await db.getStudentsWithStats(pool);
    const result = [];
    for (const s of students) {
      const [progress, assignments, hwProgress, completed] = await Promise.all([
        db.getAllSkillProgress(pool, s.id),
        db.getAssignmentsForStudent(pool, s.id),
        db.getHomeworkProgress(pool, s.id),
        db.getCompletedHomework(pool, s.id)
      ]);
      const completedSet = new Set(completed.map(c => c.assignment_id));
      result.push({
        id: s.id, username: s.username, displayName: s.display_name, stars: s.stars,
        stats: {
          answered: s.answered || 0, correct: s.correct || 0, time_sec: s.time_sec || 0,
          best_streak: s.best_streak || 0, homework_done: s.homework_done || 0
        },
        skillProgress: progress,
        assignments: assignments.map(a => ({
          id: a.id, due: a.due, items: a.items,
          progress: itemProgress(a.items, hwProgress.filter(r => r.assignment_id === a.id)),
          ...hwTotals(a.items, hwProgress.filter(r => r.assignment_id === a.id)),
          completed: completedSet.has(a.id)
        }))
      });
    }
    res.json(result);
  });

  app.post('/api/assignments', auth, teacherOnly, async (req, res) => {
    const { studentId, due, items } = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(due || '')))
      return res.status(400).json({ error: 'Due date must be YYYY-MM-DD' });
    if (!Array.isArray(items) || !items.length)
      return res.status(400).json({ error: 'Pick at least one skill' });
    const clean = items.filter(i => SKILL_IDS.includes(i.skillId))
      .map(i => ({ skillId: i.skillId, count: Math.max(1, Math.min(20, i.count | 0 || 5)) }));
    if (!clean.length) return res.status(400).json({ error: 'No valid skills' });
    const student = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'student'", [studentId]).then(r => r.rows[0]);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const id = 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    await db.createAssignment(pool, { id, teacherId: req.uid, studentId: student.id, due, items: clean });
    res.json({ id });
  });

  app.get('/api/assignments', auth, teacherOnly, async (req, res) => {
    const rows = await db.getAssignmentsByTeacher(pool, req.uid);
    const result = [];
    for (const a of rows) {
      const progress = await db.getHomeworkProgress(pool, a.student_id);
      const completed = await db.getCompletedHomework(pool, a.student_id);
      result.push({
        id: a.id, due: a.due, items: a.items,
        studentName: a.student_name, studentUsername: a.student_username,
        progress: itemProgress(a.items, progress.filter(r => r.assignment_id === a.id)),
        ...hwTotals(a.items, progress.filter(r => r.assignment_id === a.id)),
        completed: completed.some(c => c.assignment_id === a.id)
      });
    }
    res.json(result);
  });

  app.delete('/api/assignments/:id', auth, teacherOnly, async (req, res) => {
    const ok = await db.deleteAssignment(pool, req.params.id, req.uid);
    res.status(ok ? 200 : 404).json({ ok });
  });

  return app;
}
