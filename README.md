# ∑ AlgebraAce

An interactive, IXL-inspired algebra learning platform. Students practice
randomly generated algebra problems, climb an IXL-style **SmartScore (0–100)**
on every skill, complete daily and teacher-assigned homework, and earn medals,
badges, and stars. Teachers assign exercises and track per-student progress.

**Stack:** React 18 + Vite · Node.js + Express · PostgreSQL (JWT auth, bcrypt)

## Quick start

```bash
# 1. install dependencies
npm run setup

# 2. start PostgreSQL (Docker)
npm run db                       # docker compose up -d db

# 3. run the API server (http://localhost:3001)
npm run dev:server

# 4. in another terminal, run the React dev server (http://localhost:5173)
npm run dev:client               # proxies /api → :3001
```

Open **http://localhost:5173** and sign up as a student and/or teacher.

### Production mode

```bash
npm run build                    # builds client → client/dist
npm start                        # Express serves API + built client on :3001
```

Configuration via environment variables: `DATABASE_URL`
(default `postgres://postgres:postgres@localhost:5432/algebraace`),
`JWT_SECRET`, `PORT`, and `PGSSL=true` if your Postgres requires SSL
(also auto-detected from `sslmode=require` in `DATABASE_URL`).

## 🐳 Docker

The root `Dockerfile` builds the whole app into one image (multi-stage:
React build → server deps → runtime). The server auto-applies the schema
on startup.

```bash
# whole stack (Postgres + app) in one command → http://localhost:3001
docker compose up --build app

# or build/run the image against your own database
docker build -t algebraace .
docker run -p 3001:3001 \
  -e DATABASE_URL=postgres://user:pass@host:5432/algebraace \
  -e JWT_SECRET=some-long-random-secret \
  algebraace
```

## ☁️ Deploying

- **Render** (easiest): the repo includes `render.yaml` — in the Render
  dashboard choose *New → Blueprint* and point it at this repo. It provisions
  the Docker web service + a managed PostgreSQL, wires `DATABASE_URL`,
  generates `JWT_SECRET`, and uses `/api/health` for health checks.
- **Railway / Fly.io / any container host**: deploy the root `Dockerfile`,
  attach a PostgreSQL database, and set `DATABASE_URL` + `JWT_SECRET`
  (+ `PGSSL=true` if the provider requires SSL).

### Tests

```bash
npm test                         # 9 end-to-end API tests (pg-mem, no DB needed)
```

Covers: auth + validation, SmartScore updates, medals/stars/badges,
homework completing at exactly the assigned question count, daily homework,
time tracking, and teacher/student authorization rules.

## Features

### 🎒 Students
- **15 skills across 8 algebra topics** — expressions, equations, inequalities,
  slope & linear functions, exponents, systems, quadratics, word problems —
  with infinitely generated questions and step-by-step explanations
- **IXL-style SmartScore (0–100)** per skill, computed server-side: fast gains
  early, steep penalties in the Challenge Zone (90+), mastery at 100
- **Rewards**: 🥉70 / 🥈90 / 🥇100 medals, 21 badges, stars, confetti
- **Daily homework**: a fresh auto-generated set every day (3 skills × 5
  questions), resume-able, completes at the assigned question count
- **My Progress dashboard** and **Awards** gallery

### 🍎 Teachers
- Assign exercises: student, due date, any skills, questions per skill
- Track every student: totals, per-topic breakdowns, and per-assignment
  status (⬜ not started / ⏳ in progress / ✅ done), updated live

## Project structure

```
docker-compose.yml        # PostgreSQL 16
server/
  src/index.js            # entrypoint (pg Pool, static serving)
  src/app.js              # Express app + all routes
  src/db.js               # data access layer (all SQL)
  src/schema.sql          # tables: users, stats, skill_progress, awards,
                          #   assignments, homework_progress, homework_completed
  src/scoring.js          # SmartScore engine
  src/awards.js           # badge definitions + checks
  test/api.test.js        # E2E API tests on pg-mem
client/
  src/App.jsx             # shell, routing, toasts
  src/api.js              # fetch wrapper w/ JWT
  src/skills.js           # question generators (shared topic catalog)
  src/homework.js         # daily-set computation + homework helpers
  src/components/         # Auth, SkillsPage, PracticePage, HomeworkPage,
                          # DashboardPage, AwardsPage, TeacherStudents,
                          # TeacherAssign, Confetti, Medallion
legacy-static/            # original no-backend prototype (kept for reference)
```

## API overview

| Endpoint | Description |
|---|---|
| `POST /api/auth/signup` `/login` | JWT auth (roles: student, teacher) |
| `GET /api/me` | profile, stats, skill progress, awards |
| `POST /api/answers` | record an answer → SmartScore, medals, stars, homework progress, badges |
| `POST /api/time` | accumulate practice time |
| `GET /api/homework` | student's assignments + daily progress |
| `GET /api/students` | (teacher) all students with progress |
| `POST/GET/DELETE /api/assignments` | (teacher) manage assignments |
| `GET /api/meta/awards` | badge catalog for the awards page |
| `GET /api/health` | health check (DB connectivity) for deploy platforms |

## Notes

- Question generation happens client-side; the server owns all
  scoring/progress accounting. A future hardening step is server-issued
  question sessions so answers are verified server-side.
- The legacy static prototype (localStorage-based) is preserved in
  `legacy-static/` — open `legacy-static/index.html` to compare.
