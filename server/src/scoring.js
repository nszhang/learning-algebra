// SmartScore engine (IXL-style): fast gains early, small gains and steep
// penalties near mastery. Server-side so scores can't be forged by the client.

const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export function scoreDelta(score, correct) {
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

export function nextScore(score, correct) {
  let s = Math.max(0, Math.min(100, score + scoreDelta(score, correct)));
  if (correct && s >= 98) s = 100;
  return s;
}

export function medalFor(score) {
  if (score >= 100) return { id: 'gold',   emoji: '🥇', stars: 3, label: 'Gold medal — MASTERED!' };
  if (score >= 90)  return { id: 'silver', emoji: '🥈', stars: 2, label: 'Silver medal — Challenge Zone reached!' };
  if (score >= 70)  return { id: 'bronze', emoji: '🥉', stars: 1, label: 'Bronze medal — keep climbing!' };
  return null;
}
