// Award definitions. check(ctx) receives:
//   { stats: {answered, correct, time_sec, best_streak, homework_done},
//     mastered: number, totalScore: number, stars: number }
export const AWARDS = [
  { id: 'first',    emoji: '🌱', name: 'First Steps',      desc: 'Answer your very first question.',         check: c => c.stats.answered >= 1 },
  { id: 'q10',      emoji: '✏️', name: 'Warming Up',       desc: 'Answer 10 questions.',                      check: c => c.stats.answered >= 10 },
  { id: 'q50',      emoji: '📚', name: 'Bookworm',         desc: 'Answer 50 questions.',                      check: c => c.stats.answered >= 50 },
  { id: 'q100',     emoji: '💯', name: 'Century Club',     desc: 'Answer 100 questions.',                     check: c => c.stats.answered >= 100 },
  { id: 'q250',     emoji: '🚀', name: 'Unstoppable',      desc: 'Answer 250 questions.',                     check: c => c.stats.answered >= 250 },
  { id: 'c25',      emoji: '🎯', name: 'Sharpshooter',     desc: 'Get 25 questions correct.',                 check: c => c.stats.correct >= 25 },
  { id: 'c100',     emoji: '🏹', name: 'Eagle Eye',        desc: 'Get 100 questions correct.',                check: c => c.stats.correct >= 100 },
  { id: 'streak5',  emoji: '🔥', name: 'On Fire',          desc: 'Get 5 correct in a row.',                   check: c => c.stats.best_streak >= 5 },
  { id: 'streak10', emoji: '⚡', name: 'Lightning Mind',   desc: 'Get 10 correct in a row.',                  check: c => c.stats.best_streak >= 10 },
  { id: 'master1',  emoji: '🥇', name: 'First Mastery',    desc: 'Reach a SmartScore of 100 on any skill.',   check: c => c.mastered >= 1 },
  { id: 'master3',  emoji: '🏅', name: 'Triple Crown',     desc: 'Master 3 skills (SmartScore 100).',         check: c => c.mastered >= 3 },
  { id: 'master8',  emoji: '👑', name: 'Algebra Royalty',  desc: 'Master 8 skills (SmartScore 100).',         check: c => c.mastered >= 8 },
  { id: 'score300', emoji: '📈', name: 'Rising Star',      desc: 'Reach a total SmartScore of 300.',          check: c => c.totalScore >= 300 },
  { id: 'score800', emoji: '🌟', name: 'Score Superstar',  desc: 'Reach a total SmartScore of 800.',          check: c => c.totalScore >= 800 },
  { id: 'time10',   emoji: '⏰', name: 'Dedicated',        desc: 'Practice for 10 total minutes.',            check: c => c.stats.time_sec >= 600 },
  { id: 'time30',   emoji: '🕰️', name: 'Marathoner',       desc: 'Practice for 30 total minutes.',            check: c => c.stats.time_sec >= 1800 },
  { id: 'stars10',  emoji: '⭐', name: 'Star Collector',   desc: 'Earn 10 stars.',                            check: c => c.stars >= 10 },
  { id: 'stars25',  emoji: '💫', name: 'Superstar',        desc: 'Earn 25 stars.',                            check: c => c.stars >= 25 },
  { id: 'hw1',      emoji: '📝', name: 'Homework Hero',    desc: 'Complete your first homework assignment.',  check: c => c.stats.homework_done >= 1 },
  { id: 'hw5',      emoji: '🗓️', name: 'Steady Scholar',   desc: 'Complete 5 homework assignments.',          check: c => c.stats.homework_done >= 5 },
  { id: 'hw10',     emoji: '🏫', name: "Teacher's Favorite", desc: 'Complete 10 homework assignments.',       check: c => c.stats.homework_done >= 10 }
];

// public metadata (no check functions) for the client's awards page
export const AWARD_META = AWARDS.map(({ id, emoji, name, desc }) => ({ id, emoji, name, desc }));
