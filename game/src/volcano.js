// Mount Merapi: the volcano the whole operation is named for. A fixed
// stratovolcano beyond the airstrip, with a crater smoke plume that drifts
// on the morning wind. It is drawn from a real world position, so it sits
// in the scene with the terrain — the near ground paints over its foot —
// instead of pasted on the sky. The cone is a ridgeline silhouette in one
// style with the rest of the island: a warm sunlit flank, a cool shadow
// flank, erosion gullies running down from the crater, a pale ash cap,
// and a warm rim on the silhouette's lit edge.
import { groundHeight, project } from './terrain.js';

const VOLCANO = { x: -320, s: 7900, height: 540, footDrop: 260 };
const SMOKE_PUFFS = 6;

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function mixToward(rgb, targetHex, t) {
  const target = hexToRgb(targetHex);
  const mix = rgb.map((v, i) => Math.round(v + (target[i] - v) * t));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}

// Silhouette ridgeline: [lateral offset in metres, height above the base].
// A broad stratovolcano profile with a crater dip, not a triangle.
const RIDGE = [
  [-720, -260],
  [-470, 120],
  [-260, 300],
  [-90, 470],
  [-38, 522],
  [0, 505],
  [38, 522],
  [120, 460],
  [300, 290],
  [480, 110],
  [720, -260],
];

// Erosion gullies: [top offset, top height, bottom offset, half-width].
const GULLIES = [
  [-300, 330, -430, 26],
  [-160, 430, -230, 20],
  [170, 420, 250, 20],
  [320, 320, 450, 26],
];

function projectRidge(camera, width, height, focal, baseY) {
  const pts = [];
  for (const [dx, dy] of RIDGE) {
    const p = project(camera, VOLCANO.x + dx, baseY + dy, VOLCANO.s, width, height, focal);
    if (!p) return null;
    pts.push(p);
  }
  return pts;
}

// The crater smoke: soft grey puffs that rise from the crater and drift
// downwind (to the left, away from the morning sun), growing and fading
// as they age. Pure functions of `time`, so a staged screenshot is the
// same every run.
function drawCraterSmoke(ctx, crater, u, time) {
  for (let i = 0; i < SMOKE_PUFFS; i += 1) {
    const age = (time * 0.07 + i * 0.19) % 1;
    const dx = -age * 560 * u;
    const dy = -age * 520 * u;
    const r = (40 + age * 150) * u;
    const alpha = (1 - age) * 0.8;
    if (r < 3) continue;
    const x = crater.x + dx;
    const y = crater.y - 8 + dy;
    ctx.fillStyle = `rgba(214, 212, 210, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.ellipse(x - r * 0.5, y + r * 0.12, r * 0.6, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(250, 246, 238, ${alpha * 0.7})`;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.24, r * 0.55, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(148, 146, 160, ${alpha * 0.55})`;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.3, r * 0.85, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawVolcano(ctx, camera, width, height, focal, time, palette) {
  const baseY = groundHeight(VOLCANO.x, VOLCANO.s);
  const pts = projectRidge(camera, width, height, focal, baseY);
  if (!pts) return;
  const crater = pts[5];
  if (crater.depth < 400 || crater.depth > 9500) return;
  if (crater.x < -320 || crater.x > width + 320) return;

  const u = crater.scale;
  // Distance haze: the cone melts into the horizon colour, like the ridges.
  const haze = Math.pow(Math.min(1, crater.depth / 9000), 1.25) * 0.55;
  const sunRock = mixToward(hexToRgb(palette.volcanoRock), palette.skyHorizon, haze);
  const shadeRock = mixToward(hexToRgb(palette.volcanoShade), palette.skyHorizon, haze);
  const ashCap = mixToward(hexToRgb(palette.volcanoAsh), palette.skyHorizon, haze);

  // Shadow flank: the whole silhouette first.
  ctx.fillStyle = shadeRock;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();

  // Sunlit flank: the left half, bounded by the crater dip and the foot's
  // centre, so the light/shadow edge runs down the cone's front.
  const footCentre = { x: (pts[0].x + pts[pts.length - 1].x) / 2, y: (pts[0].y + pts[pts.length - 1].y) / 2 };
  ctx.fillStyle = sunRock;
  ctx.beginPath();
  ctx.moveTo(pts[4].x, pts[4].y);
  for (let i = 3; i >= 0; i -= 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineTo(footCentre.x, footCentre.y);
  ctx.lineTo(crater.x, crater.y);
  ctx.closePath();
  ctx.fill();

  // Erosion gullies: dark channels fanning down from the crater.
  ctx.fillStyle = 'rgba(40, 34, 30, 0.2)';
  for (const [topDx, topDy, botDx, halfW] of GULLIES) {
    const top = project(camera, VOLCANO.x + topDx, baseY + topDy, VOLCANO.s, width, height, focal);
    const bot = project(camera, VOLCANO.x + botDx, baseY - 40, VOLCANO.s, width, height, focal);
    if (!top || !bot) continue;
    const w = Math.max(2, halfW * u);
    ctx.beginPath();
    ctx.moveTo(top.x - w * 0.3, top.y);
    ctx.lineTo(top.x + w * 0.3, top.y);
    ctx.lineTo(bot.x + w, bot.y);
    ctx.lineTo(bot.x - w, bot.y);
    ctx.closePath();
    ctx.fill();
  }

  // Pale ash cap: a band under the crater rim.
  const cap = [
    pts[3],
    pts[4],
    crater,
    pts[6],
    pts[7],
    project(camera, VOLCANO.x + 70, baseY + 415, VOLCANO.s, width, height, focal),
    project(camera, VOLCANO.x - 70, baseY + 415, VOLCANO.s, width, height, focal),
  ];
  if (cap.every(Boolean)) {
    ctx.fillStyle = ashCap;
    ctx.beginPath();
    ctx.moveTo(cap[0].x, cap[0].y);
    for (let i = 1; i < cap.length; i += 1) ctx.lineTo(cap[i].x, cap[i].y);
    ctx.closePath();
    ctx.fill();
  }

  // Warm rim along the lit silhouette, anime-style: one clean lit edge.
  ctx.strokeStyle = 'rgba(255, 220, 160, 0.55)';
  ctx.lineWidth = Math.max(1.5, 14 * u);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i <= 4; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  // Crater mouth and its ember glow.
  const glow = ctx.createRadialGradient(crater.x, crater.y, 1, crater.x, crater.y, Math.max(6, 110 * u));
  glow.addColorStop(0, 'rgba(255, 130, 50, 0.4)');
  glow.addColorStop(1, 'rgba(255, 130, 50, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(crater.x, crater.y, Math.max(6, 110 * u), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(52, 44, 40, 0.85)';
  ctx.beginPath();
  ctx.ellipse(crater.x, crater.y, Math.max(2, 30 * u), Math.max(1, 9 * u), 0, 0, Math.PI * 2);
  ctx.fill();

  drawCraterSmoke(ctx, crater, u, time);
}
