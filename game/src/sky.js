// The sky: gradient, sun, far mountain ridges with heading parallax, and
// the drifting clouds. One golden-morning style, shared with the terrain.
import { CONFIG } from './config.js';

function ridge(ctx, width, horizonY, offset, amplitude, color, seedPhase) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 2);
  for (let x = 0; x <= width; x += 16) {
    const t = (x + offset) * 0.006 + seedPhase;
    const y =
      horizonY -
      (Math.sin(t) * 0.5 + Math.sin(t * 2.7 + 1.3) * 0.3 + Math.sin(t * 6.1 + 4.1) * 0.2) * amplitude;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, horizonY + 2);
  ctx.closePath();
  ctx.fill();
}

export function drawSky(ctx, width, height, heading, time, palette, clouds, camera, focal) {
  const p = palette ?? CONFIG.palette;
  const horizonY = height * CONFIG.horizonFraction;
  // Sky gradient: deep blue above, warm gold at the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(0.55, p.skyMid);
  sky.addColorStop(1, p.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizonY + 2);

  // Sun: ahead and to the left, with a wide warm glow.
  const sunAngle = 0.6;
  const sunX = width / 2 + Math.sin(sunAngle - heading) * width * 0.62;
  const sunY = horizonY - height * 0.22;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 190);
  glow.addColorStop(0, p.sunGlow);
  glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 190, sunY - 190, 380, 380);
  ctx.fillStyle = p.sunCore;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();

  // Far ridges, sliding against the heading: the world turns under the sun.
  ridge(ctx, width, horizonY, heading * 900, height * 0.1, p.mountainFar, 0.7);
  ridge(ctx, width, horizonY, heading * 1500, height * 0.07, p.mountainNear, 3.1);

  // Haze band hugging the horizon so the terrain melts into the sky.
  const haze = ctx.createLinearGradient(0, horizonY - 46, 0, horizonY + 8);
  haze.addColorStop(0, 'rgba(255, 217, 160, 0)');
  haze.addColorStop(1, 'rgba(255, 217, 160, 0.5)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizonY - 46, width, 54);

  // Clouds, projected from the world so they sit in the scene, not pasted on.
  if (clouds && camera) {
    for (const cloud of clouds) {
      const projected = projectCloud(camera, cloud, width, height, focal);
      if (!projected) continue;
      drawCloudPuff(ctx, projected.x, projected.y, projected.size, cloud.puff, time, cloud.s, projected.alpha);
    }
  }
}

function projectCloud(camera, cloud, width, height, focal) {
  const dx = cloud.x - camera.x;
  const dy = cloud.y - camera.y;
  const ds = cloud.s - camera.s;
  const sinH = Math.sin(camera.heading);
  const cosH = Math.cos(camera.heading);
  const depth = ds * cosH + dx * sinH;
  if (depth < 8 || depth > 5200) return null;
  const lateral = dx * cosH - ds * sinH;
  const x = width / 2 + (lateral * focal) / depth;
  const y = height * CONFIG.horizonFraction - ((dy - camera.pitch * depth) * focal) / depth;
  if (x < -260 || x > width + 260 || y < -120 || y > height * 0.7) return null;
  // Near clouds shrink and fade instead of swallowing the frame.
  const size = Math.min(300, (cloud.size * focal) / depth);
  const alpha = Math.max(0.15, Math.min(0.85, (depth - 60) / 160));
  return { x, y, size, alpha };
}

function drawCloudPuff(ctx, x, y, size, puff, time, seed, alpha) {
  const drift = Math.sin(time * 0.14 + seed * 0.01) * size * 0.04;
  ctx.save();
  ctx.globalAlpha = alpha ?? 0.85;
  ctx.fillStyle = 'rgba(255, 252, 246, 0.92)';
  const s = Math.max(8, size);
  ctx.beginPath();
  ctx.ellipse(x + drift, y, s, s * 0.34 * puff, 0, 0, Math.PI * 2);
  ctx.ellipse(x - s * 0.55 + drift, y + s * 0.08, s * 0.62, s * 0.26 * puff, 0, 0, Math.PI * 2);
  ctx.ellipse(x + s * 0.55 + drift, y + s * 0.06, s * 0.66, s * 0.28 * puff, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(214, 228, 240, 0.55)';
  ctx.beginPath();
  ctx.ellipse(x + drift, y + s * 0.16, s * 0.9, s * 0.2 * puff, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
