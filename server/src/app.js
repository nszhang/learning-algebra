// Express app factory — inject a pg-compatible pool (or pg-mem in tests).
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
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
  const adminOnly = (req, res, next) =>
    req.role === 'admin' ? next() : res.status(403).json({ error: 'Admins only' });

  // No-confusion alphabet for generated passwords (no 0/O, 1/l/I).
  function genPassword(len = 10) {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(len);
    let pw = '';
    for (const b of bytes) pw += chars[b % chars.length];
    return pw;
  }

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
  // NOTE: no public signup — accounts are created by an admin via /api/admin/users.
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    const user = await db.findUserByUsername(pool, String(username || '').trim().toLowerCase());
    if (!user || !(await bcrypt.compare(String(password || ''), user.pass_hash)))
      return res.status(401).json({ error: 'Incorrect username or password.' });
    res.json({ token: sign(user), user: publicUser(user) });
  });

  // Change own password (any role).
  app.post('/api/auth/password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 4)
      return res.status(400).json({ error: 'New password must be at least 4 characters.' });
    const { rows } = await pool.query('SELECT pass_hash FROM users WHERE id = $1', [req.uid]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Account not found' });
    if (!(await bcrypt.compare(String(currentPassword || ''), user.pass_hash)))
      return res.status(403).json({ error: 'Current password is incorrect.' });
    await db.updatePassHash(pool, req.uid, await bcrypt.hash(String(newPassword), 10));
    res.json({ ok: true });
  });

  app.get('/api/meta/awards', (req, res) => res.json(AWARD_META));

  // health check for deploy platforms / load balancers
  app.get('/api/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

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
  // Only students in the teacher's roster (admin-managed via /api/admin/*).
  app.get('/api/students', auth, teacherOnly, async (req, res) => {
    const students = await db.getStudentsWithStats(pool, req.uid);
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
    if (!(await db.isTeacherOf(pool, req.uid, student.id)))
      return res.status(403).json({ error: 'That student is not in your roster.' });

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

  // ---------- admin ----------
  app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
    const [users, rosters] = await Promise.all([db.getAllUsers(pool), db.getTeacherStudentPairs(pool)]);
    res.json({
      users: users.map(publicUser),
      rosters: rosters.map(r => ({ teacherId: r.teacher_id, studentId: r.student_id }))
    });
  });

  app.post('/api/admin/users', auth, adminOnly, async (req, res) => {
    const { username, displayName, role, password } = req.body || {};
    const uname = String(username || '').trim().toLowerCase();
    if (!USERNAME_RE.test(uname))
      return res.status(400).json({ error: 'Username must be 3–20 chars: letters, numbers, underscores.' });
    if (!['student', 'teacher', 'admin'].includes(role))
      return res.status(400).json({ error: 'Role must be student, teacher, or admin.' });
    const pw = password ? String(password) : genPassword();
    if (pw.length < 4)
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    if (await db.findUserByUsername(pool, uname))
      return res.status(409).json({ error: 'That username is taken — try another!' });

    const user = await db.createUser(pool, {
      username: uname,
      displayName: String(displayName || '').trim() || uname,
      passHash: await bcrypt.hash(pw, 10),
      role
    });
    res.json({ user: publicUser(user), password: pw, generated: !password });
  });

  app.post('/api/admin/users/:id/password', auth, adminOnly, async (req, res) => {
    const id = req.params.id | 0;
    const target = await pool.query('SELECT id FROM users WHERE id = $1', [id]).then(r => r.rows[0]);
    if (!target) return res.status(404).json({ error: 'User not found' });
    const given = req.body?.password ? String(req.body.password) : '';
    const pw = given || genPassword();
    if (pw.length < 4)
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    await db.updatePassHash(pool, id, await bcrypt.hash(pw, 10));
    res.json({ ok: true, password: pw, generated: !given });
  });

  app.delete('/api/admin/users/:id', auth, adminOnly, async (req, res) => {
    const id = req.params.id | 0;
    if (id === req.uid)
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    const target = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]).then(r => r.rows[0]);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'admin' && (await db.countByRole(pool, 'admin')) <= 1)
      return res.status(400).json({ error: 'Cannot delete the last admin account.' });
    const ok = await db.deleteUser(pool, id);
    res.status(ok ? 200 : 404).json({ ok });
  });

  // Replace a teacher's whole roster: body { studentIds: [..] }
  app.put('/api/admin/teachers/:id/students', auth, adminOnly, async (req, res) => {
    const teacher = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'teacher'", [req.params.id | 0]).then(r => r.rows[0]);
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    const ids = [...new Set((Array.isArray(req.body?.studentIds) ? req.body.studentIds : [])
      .map(n => n | 0).filter(n => n > 0))];
    if (ids.length) {
      // validate in JS (tiny users table) — portable across pg drivers
      const { rows } = await pool.query("SELECT id FROM users WHERE role = 'student'");
      const valid = new Set(rows.map(r => r.id));
      if (ids.some(id => !valid.has(id)))
        return res.status(400).json({ error: 'studentIds must contain only student accounts.' });
      await db.setTeacherStudents(pool, teacher.id, ids);
    } else {
      await db.setTeacherStudents(pool, teacher.id, []);
    }
    res.json({ ok: true, count: ids.length });
  });

  return app;
}
