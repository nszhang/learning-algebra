-- AlgebraAce schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  username     TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  pass_hash    TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
  stars        INT  NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stats (
  user_id       INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  answered      INT NOT NULL DEFAULT 0,
  correct       INT NOT NULL DEFAULT 0,
  time_sec      INT NOT NULL DEFAULT 0,
  best_streak   INT NOT NULL DEFAULT 0,
  homework_done INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS skill_progress (
  user_id  INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  score    INT  NOT NULL DEFAULT 0,
  answered INT  NOT NULL DEFAULT 0,
  correct  INT  NOT NULL DEFAULT 0,
  medals   JSONB NOT NULL DEFAULT '[]',
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS awards (
  user_id   INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  award_id  TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, award_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id         TEXT PRIMARY KEY,
  teacher_id INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due        DATE NOT NULL,
  items      JSONB NOT NULL,           -- [{ skillId, count }]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Homework progress. assignment_id also covers client-computed daily sets
-- ('daily-YYYY-MM-DD'), which live only as progress rows.
CREATE TABLE IF NOT EXISTS homework_progress (
  user_id       INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id TEXT NOT NULL,
  skill_id      TEXT NOT NULL,
  done          INT  NOT NULL DEFAULT 0,
  correct       INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, assignment_id, skill_id)
);

CREATE TABLE IF NOT EXISTS homework_completed (
  user_id       INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id TEXT NOT NULL,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, assignment_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_student ON assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_hw_progress_user ON homework_progress(user_id);
