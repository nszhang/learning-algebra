import { useEffect, useRef } from 'react';

const COLORS = ['#4f46e5', '#f59e0b', '#16a34a', '#ec4899', '#06b6d4', '#f97316'];

export default function Confetti({ tick }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!tick) return;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
    const parts = Array.from({ length: 180 }, () => ({
      x: window.innerWidth / 2 + ri(-120, 120),
      y: window.innerHeight * 0.3,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 13 - 4,
      w: ri(6, 12), h: ri(8, 16),
      color: COLORS[ri(0, COLORS.length - 1)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3
    }));
    let frames = 0, raf;
    (function tickFrame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (++frames < 160) raf = requestAnimationFrame(tickFrame);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    })();
    return () => cancelAnimationFrame(raf);
  }, [tick]);

  return <canvas id="confetti-canvas" ref={ref} />;
}
