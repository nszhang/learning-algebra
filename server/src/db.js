// Data access layer — every SQL statement lives here.
// Functions take a pg-compatible Pool (or pg-mem adapter in tests).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initSchema(pool) {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  // Migration for installs created before the 'admin' role existed: the
  // users.role CHECK only allowed student/teacher. Recreate it (no-op change
  // for fresh DBs). Wrapped for in-memory test adapters that lack ALTER TABLE.
  try {
    await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
    await pool.query("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'teacher', 'admin'))");
  } catch { /* pg-mem: fresh schema already has the right constraint */ }
}

// ---------- users ----------
export async function createUser(pool, { username, displayName, passHash, role }) {
  const { rows } = await pool.query(
    `INSERT INTO users (username, display_name, pass_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING id, username, display_name, role, stars, created_at`,
    [username, displayName, passHash, role]);
  await pool.query('INSERT INTO stats (user_id) VALUES ($1)', [rows[0].id]);
  return rows[0];
}

export async function findUserByUsername(pool, username) {
  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return rows[0] || null;
}

export async function addStars(pool, userId, n) {
  await pool.query('UPDATE users SET stars = stars + $2 WHERE id = $1', [userId, n]);
}

// ---------- stats ----------
export async function getStats(pool, userId) {
  await pool.query('INSERT INTO stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  const { rows } = await pool.query('SELECT * FROM stats WHERE user_id = $1', [userId]);
  return rows[0];
}

export async function recordAnswerStats(pool, userId, correct, streak) {
  await pool.query(
    `UPDATE stats SET
       answered = answered + 1,
       correct = correct + $2,
       best_streak = GREATEST(best_streak, $3)
     WHERE user_id = $1`,
    [userId, correct ? 1 : 0, streak]);
}

export async function addTime(pool, userId, seconds) {
  await pool.query('UPDATE stats SET time_sec = time_sec + $2 WHERE user_id = $1', [userId, seconds]);
}

// ---------- skill progress ----------
export async function getSkillProgress(pool, userId, skillId) {
  const { rows } = await pool.query(
    'SELECT * FROM skill_progress WHERE user_id = $1 AND skill_id = $2', [userId, skillId]);
  return rows[0] || { score: 0, answered: 0, correct: 0, medals: [] };
}

export async function getAllSkillProgress(pool, userId) {
  const { rows } = await pool.query(
    'SELECT skill_id, score, answered, correct, medals FROM skill_progress WHERE user_id = $1', [userId]);
  return rows;
}

export async function saveSkillProgress(pool, userId, skillId, { score, answered, correct, medals }) {
  await pool.query(
    `INSERT INTO skill_progress (user_id, skill_id, score, answered, correct, medals)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, skill_id)
     DO UPDATE SET score = $3, answered = $4, correct = $5, medals = $6`,
    [userId, skillId, score, answered, correct, JSON.stringify(medals)]);
}

// ---------- awards ----------
export async function getAwards(pool, userId) {
  const { rows } = await pool.query(
    'SELECT award_id, earned_at FROM awards WHERE user_id = $1', [userId]);
  return rows;
}

export async function grantAward(pool, userId, awardId) {
  await pool.query(
    'INSERT INTO awards (user_id, award_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, awardId]);
}

// ---------- assignments ----------
export async function createAssignment(pool, { id, teacherId, studentId, due, items }) {
  await pool.query(
    'INSERT INTO assignments (id, teacher_id, student_id, due, items) VALUES ($1, $2, $3, $4, $5)',
    [id, teacherId, studentId, due, JSON.stringify(items)]);
}

export async function getAssignmentsForStudent(pool, studentId) {
  const { rows } = await pool.query(
    `SELECT a.*, u.display_name AS teacher_name
     FROM assignments a JOIN users u ON u.id = a.teacher_id
     WHERE a.student_id = $1 ORDER BY a.due`, [studentId]);
  return rows;
}

export async function getAssignmentsByTeacher(pool, teacherId) {
  const { rows } = await pool.query(
    `SELECT a.*, u.display_name AS student_name, u.username AS student_username
     FROM assignments a JOIN users u ON u.id = a.student_id
     WHERE a.teacher_id = $1 ORDER BY a.created_at DESC`, [teacherId]);
  return rows;
}

export async function deleteAssignment(pool, id, teacherId) {
  const { rowCount } = await pool.query(
    'DELETE FROM assignments WHERE id = $1 AND teacher_id = $2', [id, teacherId]);
  return rowCount > 0;
}

// ---------- homework progress ----------
export async function getHomeworkProgress(pool, userId) {
  const { rows } = await pool.query(
    'SELECT assignment_id, skill_id, done, correct FROM homework_progress WHERE user_id = $1', [userId]);
  return rows;
}

export async function recordHomeworkAnswer(pool, userId, assignmentId, skillId, correct) {
  const { rows } = await pool.query(
    `INSERT INTO homework_progress (user_id, assignment_id, skill_id, done, correct)
     VALUES ($1, $2, $3, 1, $4)
     ON CONFLICT (user_id, assignment_id, skill_id)
     DO UPDATE SET done = homework_progress.done + 1,
                   correct = homework_progress.correct + $4
     RETURNING done, correct`,
    [userId, assignmentId, skillId, correct ? 1 : 0]);
  return rows[0];
}

export async function getCompletedHomework(pool, userId) {
  const { rows } = await pool.query(
    'SELECT assignment_id, completed_at FROM homework_completed WHERE user_id = $1', [userId]);
  return rows;
}

export async function markHomeworkCompleted(pool, userId, assignmentId) {
  await pool.query(
    'INSERT INTO homework_completed (user_id, assignment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, assignmentId]);
  await pool.query(
    'UPDATE stats SET homework_done = homework_done + 1 WHERE user_id = $1', [userId]);
}

// ---------- teacher views ----------
// teacherId optional: when given, only students in that teacher's roster.
export async function getStudentsWithStats(pool, teacherId) {
  const sql = `SELECT u.id, u.username, u.display_name, u.stars, u.created_at,
            s.answered, s.correct, s.time_sec, s.best_streak, s.homework_done
     FROM users u LEFT JOIN stats s ON s.user_id = u.id
     WHERE u.role = 'student'
     ORDER BY u.display_name`;
  if (teacherId == null) {
    const { rows } = await pool.query(sql);
    return rows;
  }
  // plain JOIN (no correlated subquery — keeps the in-memory test DB happy)
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.display_name, u.stars, u.created_at,
            s.answered, s.correct, s.time_sec, s.best_streak, s.homework_done
     FROM teacher_students ts
     JOIN users u ON u.id = ts.student_id
     LEFT JOIN stats s ON s.user_id = u.id
     WHERE ts.teacher_id = $1 AND u.role = 'student'
     ORDER BY u.display_name`, [teacherId]);
  return rows;
}

// ---------- user administration (admin) ----------
export async function getAllUsers(pool) {
  const { rows } = await pool.query(
    'SELECT id, username, display_name, role, stars, created_at FROM users ORDER BY role, display_name');
  return rows;
}

export async function updatePassHash(pool, userId, passHash) {
  await pool.query('UPDATE users SET pass_hash = $2 WHERE id = $1', [userId, passHash]);
}

export async function deleteUser(pool, userId) {
  const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  return rowCount > 0;
}

export async function countByRole(pool, role) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM users WHERE role = $1', [role]);
  return rows[0].n;
}

// ---------- teacher rosters ----------
export async function getTeacherStudentPairs(pool) {
  const { rows } = await pool.query('SELECT teacher_id, student_id FROM teacher_students');
  return rows;
}

// Replace a teacher's whole roster with the given student ids.
// Caller validates that ids are existing students.
export async function setTeacherStudents(pool, teacherId, studentIds) {
  await pool.query('DELETE FROM teacher_students WHERE teacher_id = $1', [teacherId]);
  for (const sid of studentIds) {
    await pool.query(
      'INSERT INTO teacher_students (teacher_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [teacherId, sid]);
  }
}

export async function isTeacherOf(pool, teacherId, studentId) {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM teacher_students WHERE teacher_id = $1 AND student_id = $2',
    [teacherId, studentId]);
  return rowCount > 0;
}
