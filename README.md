# ∑ AlgebraAce

An interactive, IXL-inspired algebra learning website. Students practice randomly
generated algebra problems, climb an IXL-style **SmartScore (0–100)** on every
skill, and earn medals, badges, stars, and confetti celebrations along the way.

## Run it

No build step or server required — it's a pure static site:

```bash
# Option 1: just open the file
open index.html            # macOS
xdg-open index.html        # Linux

# Option 2: serve it (nicer URLs, same behavior)
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Features

### 📝 Daily homework (student view)
- A **new exercise set every day** (3 skills × 5 questions, auto-generated per date)
- Homework completes after answering the assigned **number of questions per skill**
  (wrong answers still count as answered) — SmartScore mastery is NOT required
- Skills with unfinished homework are tagged **📝 HW** on the Skills page, and
  clicking them routes straight into the homework session so every answer counts
- **Resume-able progress** — leave mid-homework and pick up where you left off
- Completing homework earns **+5 ⭐**, confetti, and homework badges
  (📝 Homework Hero, 🗓️ Steady Scholar, 🏫 Teacher's Favorite)
- "Due today" and "Coming up this week" views

### 🍎 Teacher accounts
- Choose **🎒 Student** or **🍎 Teacher** when signing up
- **Assign tab**: pick a student, a due date, any set of skills, and questions
  per skill — the assignment appears on the student's Homework page that day
- **Students tab**: per-student totals (SmartScore, skills mastered, accuracy,
  time, homework count, stars) with expandable topic breakdowns and
  per-assignment completion status (⬜ not started / ⏳ in progress / ✅ done)
- Assignments can be deleted; completion is tracked live as the student works

### 👤 User accounts & progress tracking
- Sign up / log in (accounts stored in the browser's `localStorage` — per-device demo accounts)
- Every question answered, SmartScore, streak, medal, badge, and minute practiced
  is saved to the student's account automatically
- **My Progress** dashboard: total SmartScore, skills mastered, accuracy, best
  streak, time practiced, and a per-skill breakdown

### 🧠 IXL-style SmartScore engine
- Each skill has a score from 0 to 100
- Big gains early, small gains and steep penalties in the **Challenge Zone (90+)**
- 100 = **mastery** 🥇

### 🏅 Rewards & encouragement (like IXL)
- **Medals per skill**: 🥉 bronze at 70, 🥈 silver at 90, 🥇 gold at 100
- **18 badges**: First Steps, Century Club, On Fire (5-streak), Algebra Royalty
  (master 8 skills), Star Collector, Homework Hero, and more
- **Stars** ⭐ earned for every medal and badge (shown in the top bar)
- **Confetti burst** + toast notifications on mastery
- Praise messages for correct answers, warm encouragement plus
  **step-by-step explanations** for wrong ones

### 📚 15 skills across 8 topics (infinitely generated questions)
| Topic | Skills |
|---|---|
| 🧮 Expressions | Evaluate expressions, combine like terms |
| ➕ One-step equations | Add/subtract, multiply/divide |
| 🔀 Multi-step equations | Two-step, variables on both sides |
| ⚖️ Inequalities | One-step, two-step (with sign-flip!) |
| 📈 Slope & linear functions | Slope from points, evaluate, y-intercept |
| 💪 Exponents | Product rule, power of a power, negative exponents |
| 🤝 Systems of equations | Solve 2×2 systems |
| 🎯 Quadratics & word problems | Factor x²+bx+c=0, linear word problems |

## Project structure

```
index.html        # app shell (auth, skills, practice, dashboard, awards screens)
css/styles.css    # all styling
js/skills.js      # skill definitions + random question generators + awards list
js/app.js         # accounts, SmartScore engine, practice flow, rewards, confetti
```

## Notes

- Accounts (students + teachers) and assignments are stored in the browser's
  `localStorage`, so **a teacher and their students must use the same
  browser/device** in this demo. To go multi-device, swap the `localStorage`
  layer in `js/app.js` (`loadUsers`/`saveUsers`/`loadAssignments`/
  `saveAssignments`) for a small backend — the data models are cleanly separated.
- Passwords are lightly hashed and stored only in your browser — this is a
  **local demo**, not production-grade auth.
- Tested: 3,000 generated questions per skill validated for correctness, plus a
  scripted end-to-end homework flow test (assign → start → answer → complete →
  teacher sees ✅).
