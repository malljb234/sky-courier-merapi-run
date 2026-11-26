// Particles and props: exhaust shimmer, ring bursts, crash fire, splash,
// speed streaks and the supply crate with its little parachute.
import { mulberry32 } from './random.js';

export function createParticles(seed) {
  return { list: [], rng: mulberry32(seed) };
}

export function spawnBurst(particles, sx, sy, count, colors, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = particles.rng() * Math.PI * 2;
    const v = speed * (0.3 + particles.rng() * 0.9);
    particles.list.push({
      x: sx,
      y: sy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 20,
      life: 0.5 + particles.rng() * 0.7,
      age: 0,
      size: 2 + particles.rng() * 5,
      color: colors[Math.floor(particles.rng() * colors.length)],
      gravity: 130,
    });
  }
}

export function spawnExhaust(particles, sx, sy) {
  particles.list.push({
    x: sx + (particles.rng() - 0.5) * 6,
    y: sy + (particles.rng() - 0.5) * 4,
    vx: (particles.rng() - 0.5) * 14,
    vy: 26 + particles.rng() * 22,
    life: 0.35 + particles.rng() * 0.3,
    age: 0,
    size: 2.5 + particles.rng() * 3.5,
    color: 'rgba(235, 240, 244, 0.5)',
    gravity: -30,
  });
}

export function stepParticles(particles, dt) {
  const alive = [];
  for (const p of particles.list) {
    p.age += dt;
    if (p.age >= p.life) continue;
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    alive.push(p);
  }
  particles.list = alive;
}

export function drawParticles(ctx, particles) {
  for (const p of particles.list) {
    const fade = 1 - p.age / p.life;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * fade + 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Speed streaks: faint lines rushing past the frame edges at high speed.
export function drawSpeedStreaks(ctx, width, height, speed, rng) {
  if (speed < 66) return;
  const strength = Math.min(1, (speed - 66) / 30);
  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.22 * strength})`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 10; i += 1) {
    const edge = rng();
    const x = edge < 0.5 ? rng() * width * 0.14 : width - rng() * width * 0.14;
    const y = rng() * height;
    const len = 26 + rng() * 40 * strength;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

// The supply crate: a wooden box under a small round parachute.
export function drawSupplyCrate(ctx, x, y, scale, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const sway = Math.sin(time * 2.2) * 3;
  // Shroud lines and canopy.
  ctx.strokeStyle = 'rgba(40, 44, 50, 0.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-8, -14);
  ctx.lineTo(-13, -30 + sway * 0.3);
  ctx.moveTo(8, -14);
  ctx.lineTo(13, -30 + sway * 0.3);
  ctx.moveTo(0, -14);
  ctx.lineTo(0, -32);
  ctx.stroke();
  ctx.fillStyle = '#e8ddc4';
  ctx.beginPath();
  ctx.arc(0, -30, 14, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(200, 68, 44, 0.85)';
  ctx.beginPath();
  ctx.arc(0, -30, 14, Math.PI * 1.15, Math.PI * 1.55);
  ctx.closePath();
  ctx.fill();
  // The box itself.
  ctx.fillStyle = '#9a6b3f';
  ctx.fillRect(-9, -14, 18, 14);
  ctx.strokeStyle = 'rgba(60, 40, 20, 0.6)';
  ctx.strokeRect(-9, -14, 18, 14);
  ctx.beginPath();
  ctx.moveTo(-9, -7);
  ctx.lineTo(9, -7);
  ctx.moveTo(0, -14);
  ctx.lineTo(0, 0);
  ctx.stroke();
  ctx.restore();
}
