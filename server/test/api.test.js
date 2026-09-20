// End-to-end API tests against an in-memory PostgreSQL (pg-mem).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { createApp } from '../src/app.js';
import { initSchema } from '../src/db.js';

let server, base;

before(async () => {
  const mem = newDb();
  const pgAdapter = mem.adapters.createPg();
  const pool = new pgAdapter.Pool();
  await initSchema(pool);
  const app = createApp(pool, 'test-secret');
  await new Promise(resolve => { server = app.listen(0, resolve); });
  base = `http://localhost:${server.address().port}`;
});

after(() => server.close());

async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json() };
}

let student, teacher;

test('signup validates input', async () => {
  let r = await api('POST', '/api/auth/signup', { body: { username: 'x', password: 'pw', role: 'student' } });
  assert.equal(r.status, 400);
  r = await api('POST', '/api/auth/signup', { body: { username: 'validuser', password: 'pw', role: 'wizard' } });
  assert.equal(r.status, 400);
});

test('student and teacher can sign up and log in', async () => {
  let r = await api('POST', '/api/auth/signup',
    { body: { username: 'stu1', displayName: 'Stu', password: 'pw123', role: 'student' } });
  assert.equal(r.status, 200);
  student = r.data;
  assert.equal(student.user.role, 'student');

  r = await api('POST', '/api/auth/signup',
    { body: { username: 'teach', displayName: 'Mrs Teach', password: 'pw123', role: 'teacher' } });
  teacher = r.data;
  assert.equal(teacher.user.role, 'teacher');

  r = await api('POST', '/api/auth/login', { body: { username: 'stu1', password: 'wrong' } });
  assert.equal(r.status, 401);
  r = await api('POST', '/api/auth/login', { body: { username: 'stu1', password: 'pw123' } });
  assert.equal(r.status, 200);

  r = await api('POST', '/api/auth/signup',
    { body: { username: 'stu1', displayName: 'Dup', password: 'pw123', role: 'student' } });
  assert.equal(r.status, 409, 'duplicate username rejected');
});

test('answering questions updates SmartScore, stats, and awards', async () => {
  let r = await api('POST', '/api/answers',
    { token: student.token, body: { skillId: 'B1', correct: true, streak: 1 } });
  assert.equal(r.status, 200);
  assert.ok(r.data.score > 0 && r.data.score <= 100, `score in range, got ${r.data.score}`);
  assert.ok(r.data.newAwards.some(a => a.id === 'first'), 'First Steps badge earned');
  assert.ok(r.data.stars >= 2, 'badge stars granted');

  // 12 more correct answers on B1 should reach at least bronze (70)
  for (let i = 0; i < 12; i++) {
    r = await api('POST', '/api/answers',
      { token: student.token, body: { skillId: 'B1', correct: true, streak: i + 2 } });
  }
  const me = await api('GET', '/api/me', { token: student.token });
  const b1 = me.data.skillProgress.find(p => p.skill_id === 'B1');
  assert.ok(b1.score >= 70, `B1 should be bronze+, got ${b1.score}`);
  assert.ok(b1.medals.includes('bronze'), 'bronze medal stored');
  assert.equal(me.data.stats.answered, 13);
  assert.equal(me.data.stats.correct, 13);
  assert.equal(me.data.stats.best_streak, 13);

  r = await api('POST', '/api/answers', { token: student.token, body: { skillId: 'XX', correct: true } });
  assert.equal(r.status, 400, 'unknown skill rejected');
});

test('score never goes below 0 on wrong answers', async () => {
  for (let i = 0; i < 5; i++) {
    const r = await api('POST', '/api/answers',
      { token: student.token, body: { skillId: 'D1', correct: false, streak: 0 } });
    assert.ok(r.data.score >= 0);
  }
});

test('teacher assigns homework; student completes at exactly N questions', async () => {
  const students = await api('GET', '/api/students', { token: teacher.token });
  assert.equal(students.status, 200);
  const stu = students.data.find(s => s.username === 'stu1');
  assert.ok(stu, 'teacher sees student');

  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  let r = await api('POST', '/api/assignments', {
    token: teacher.token,
    body: { studentId: stu.id, due: today, items: [{ skillId: 'A1', count: 10 }] }
  });
  assert.equal(r.status, 200);
  const assignmentId = r.data.id;

  // student fetches homework
  const hw = await api('GET', '/api/homework', { token: student.token });
  const a = hw.data.assignments.find(x => x.id === assignmentId);
  assert.equal(a.items[0].count, 10);
  assert.equal(a.done, 0);
  assert.equal(a.completed, false);

  // answer 10 questions (2 wrong) — completion must trigger exactly at #10
  let justCompletedAt = -1;
  for (let i = 1; i <= 12; i++) {
    r = await api('POST', '/api/answers', {
      token: student.token,
      body: { skillId: 'A1', correct: !(i === 3 || i === 7), streak: 1, assignmentId }
    });
    if (r.data.homework?.justCompleted) justCompletedAt = i;
  }
  assert.equal(justCompletedAt, 10, 'homework completed at exactly 10 answers');
  assert.ok(r.data.homework.done >= 10);

  // student + teacher both see completion
  const hw2 = await api('GET', '/api/homework', { token: student.token });
  assert.equal(hw2.data.assignments.find(x => x.id === assignmentId).completed, true);
  const list = await api('GET', '/api/assignments', { token: teacher.token });
  const row = list.data.find(x => x.id === assignmentId);
  assert.equal(row.completed, true);
  assert.ok(row.done >= 10);

  const me = await api('GET', '/api/me', { token: student.token });
  assert.equal(me.data.stats.homework_done, 1);
  assert.ok(me.data.awards.some(a => a.award_id === 'hw1'), 'Homework Hero badge');
});

test('daily homework: client-computed items tracked server-side', async () => {
  const today = new Date().toLocaleDateString('en-CA');
  const id = `daily-${today}`;
  const items = [{ skillId: 'C1', count: 2 }];
  for (let i = 0; i < 2; i++) {
    const r = await api('POST', '/api/answers', {
      token: student.token, body: { skillId: 'C1', correct: true, streak: 2, assignmentId: id, items }
    });
    if (i === 1) assert.equal(r.data.homework.justCompleted, true, 'daily completes at count');
  }
  const hw = await api('GET', '/api/homework', { token: student.token });
  assert.ok(hw.data.dailyCompleted.includes(id));
});

test('time tracking accumulates and awards stars over time', async () => {
  const r = await api('POST', '/api/time', { token: student.token, body: { seconds: 601 } });
  assert.equal(r.status, 200); // clamps to 600
  const me = await api('GET', '/api/me', { token: student.token });
  assert.equal(me.data.stats.time_sec, 600);
  assert.ok(me.data.awards.some(a => a.award_id === 'time10'), 'Dedicated badge at 10 min');
});

test('authorization rules', async () => {
  let r = await api('GET', '/api/me');
  assert.equal(r.status, 401);
  r = await api('GET', '/api/students', { token: student.token });
  assert.equal(r.status, 403, 'students cannot access teacher routes');
  r = await api('POST', '/api/assignments', { token: student.token, body: {} });
  assert.equal(r.status, 403);
});

test('teacher can delete own assignment only', async () => {
  const students = await api('GET', '/api/students', { token: teacher.token });
  const stu = students.data.find(s => s.username === 'stu1');
  const r = await api('POST', '/api/assignments', {
    token: teacher.token,
    body: { studentId: stu.id, due: '2030-01-01', items: [{ skillId: 'G1', count: 3 }] }
  });
  const id = r.data.id;
  const del = await api('DELETE', `/api/assignments/${id}`, { token: student.token });
  assert.equal(del.status, 403);
  const del2 = await api('DELETE', `/api/assignments/${id}`, { token: teacher.token });
  assert.equal(del2.status, 200);
});
