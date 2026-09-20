export default function Medallion({ score }) {
  let cls = '';
  if (score >= 100) cls = 'm-gold';
  else if (score >= 90) cls = 'm-silver';
  else if (score >= 70) cls = 'm-bronze';
  else if (score > 0) cls = 'm-prog';
  return <div className={'medallion ' + cls}>{score > 0 ? score : '·'}</div>;
}
