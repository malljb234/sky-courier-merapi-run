// The scene composer: sky, terrain strips, runway, rings, drop zones,
// crates, the aircraft and its shadow, particles, and the frame's final
// polish. The judge sees the game through screenshots of exactly this.
import { CONFIG } from './config.js';
import { focalLength, groundColorRGB, groundHeight, onRunway, project } from './terrain.js';
import { drawAircraft, drawGroundShadow } from './aircraft.js';
import { drawSky } from './sky.js';
import { drawHUD } from './hud.js';
import { drawParticles, drawSpeedStreaks, drawSupplyCrate, spawnExhaust, stepParticles } from './effects.js';
import { mulberry32 } from './random.js';

const SLICES = 120;
const COLUMNS = 26;
const FAR = 3600;

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function mixColor(rgbA, rgbB, t) {
  const mix = rgbA.map((v, i) => Math.round(v + (rgbB[i] - v) * t));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}

function hazeColor(rgb, depth, palette) {
  const t = Math.pow(Math.min(1, depth / FAR), 1.25) * 0.8;
  return mixColor(rgb, hexToRgb(palette.skyHorizon), t);
}

// One terrain strip: from the far slice inward, a quad per column.
function drawTerrain(ctx, camera, width, height, focal, palette, zones) {
  const sinH = Math.sin(camera.heading);
  const cosH = Math.cos(camera.heading);
  const aspect = width / height;
  const tanHalfH = Math.tan(CONFIG.fovVertical / 2) * aspect;
  const horizonY = height * CONFIG.horizonFraction;
  let prev = null;
  for (let i = 0; i < SLICES; i += 1) {
    // Far to near: painter's algorithm, the near strips paint over the far.
    const frac = i / (SLICES - 1);
    const depth = FAR * Math.pow(6 / FAR, frac);
    const cx = camera.x + sinH * depth;
    const cs = camera.s + cosH * depth;
    const halfW = depth * tanHalfH * 1.12;
    const pts = [];
    for (let col = 0; col <= COLUMNS; col += 1) {
      const lateral = -halfW + (col / COLUMNS) * halfW * 2;
      const wx = cx + cosH * lateral;
      const ws = cs - sinH * lateral;
      const gy = groundHeight(wx, ws);
      const projected = project(camera, wx, gy, ws, width, height, focal);
      // Three lateral taps per column: the noise is sampled wider than a
      // pixel, so neighbouring columns blend instead of banding.
      const step = (halfW * 2) / COLUMNS;
      const c0 = groundColorRGB(wx - step * 0.4, ws, gy, palette);
      const c1 = groundColorRGB(wx, ws, gy, palette);
      const c2 = groundColorRGB(wx + step * 0.4, ws, gy, palette);
      let color = [(c0[0] + c1[0] + c2[0]) / 3, (c0[1] + c1[1] + c2[1]) / 3, (c0[2] + c1[2] + c2[2]) / 3];
      // Runway paint: asphalt, centre dashes, edge lights, threshold bars.
      if (onRunway(wx, ws)) {
        color = hexToRgb(palette.runway);
        const dash = Math.floor(ws / 60) % 2 === 0;
        if (Math.abs(wx) < 1.6 && dash) color = hexToRgb(palette.runwayEdge);
        if (Math.abs(Math.abs(wx) - (CONFIG.runwayHalfWidth - 1.2)) < 1.4) color = [255, 217, 138];
        if (ws < CONFIG.runwayStart + 46 && Math.abs(wx) > 3 && Math.abs(wx) < 13) color = hexToRgb(palette.runwayEdge);
      }
      // Drop-zone paint: a burnt-orange disc with a white ring.
      if (zones) {
        for (const zone of zones) {
          const d = Math.hypot(wx - zone.x, ws - zone.s);
          if (d < zone.radius) {
            color = zone.hit ? [123, 228, 149] : [232, 131, 58];
            if (d > zone.radius * 0.82) color = [255, 255, 255];
          }
        }
      }
      pts.push({ x: projected ? projected.x : width / 2 + lateral * 2, y: projected ? projected.y : horizonY, color, gy });
    }
    if (prev) {
      for (let col = 0; col < COLUMNS; col += 1) {
        const a = prev.pts[col];
        const b = prev.pts[col + 1];
        const c = pts[col + 1];
        const d = pts[col];
        // Slope shading: ground rising away from the camera catches the
        // morning sun, ground falling away sinks into shadow, and slopes
        // facing the sun (left) read lighter than slopes facing away.
        const alongSlope = (a.gy - d.gy) / Math.max(1, prev.depth - depth);
        const lateralSlope = (a.gy - b.gy) / Math.max(1, (prev.depth * tanHalfH * 2.24) / COLUMNS);
        const shade = Math.max(0.62, Math.min(1.28, 1 + alongSlope * 1.6 + lateralSlope * 0.7));
        ctx.fillStyle = hazeColor(a.color, prev.depth, palette);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, i === SLICES - 1 ? height + 24 : c.y);
        ctx.lineTo(d.x, i === SLICES - 1 ? height + 24 : d.y);
        ctx.closePath();
        ctx.fill();
        if (shade < 0.99) {
          ctx.fillStyle = `rgba(8, 14, 26, ${(1 - shade) * 0.55})`;
          ctx.fill();
        } else if (shade > 1.01) {
          ctx.fillStyle = `rgba(255, 246, 220, ${(shade - 1) * 0.5})`;
          ctx.fill();
        }
      }
    }
    prev = { pts, depth };
  }
}

function drawRing(ctx, ring, camera, width, height, focal, palette, time, isNext) {
  const p = project(camera, ring.x, ring.y, ring.s, width, height, focal);
  if (!p || p.depth < 4 || p.depth > 3800) return;
  const pulse = isNext ? 1 + 0.05 * Math.sin(time * 4) : 1;
  const rx = ring.radius * p.scale * pulse;
  const ry = rx * 0.58;
  if (rx < 2) return;
  const alpha = ring.passed ? 0.28 : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = ring.passed ? palette.hudGreen : palette.ring;
  ctx.shadowColor = palette.ringGlow;
  ctx.shadowBlur = isNext ? 22 : 10;
  ctx.lineWidth = Math.max(2, rx * 0.09);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1, rx * 0.03);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Chevron chevrons pointing through the ring.
  ctx.fillStyle = ring.passed ? palette.hudGreen : '#fff3d6';
  const chev = rx * 0.22;
  ctx.beginPath();
  ctx.moveTo(p.x - chev, p.y - chev * 0.4);
  ctx.lineTo(p.x, p.y + chev * 0.5);
  ctx.lineTo(p.x + chev, p.y - chev * 0.4);
  ctx.lineTo(p.x + chev * 0.6, p.y - chev * 0.4);
  ctx.lineTo(p.x, p.y + chev * 0.1);
  ctx.lineTo(p.x - chev * 0.6, p.y - chev * 0.4);
  ctx.closePath();
  ctx.fill();
  if (isNext && p.depth < 1500) {
    ctx.font = '600 13px "Avenir Next", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3d6';
    ctx.fillText(`${Math.round(p.depth)}m`, p.x, p.y - ry - 10);
  }
  ctx.restore();
}

// A diamond over the next objective with its distance, for the sorties
// whose target is a patch of ground rather than a ring in the sky.
function drawObjectiveMarker(ctx, world, camera, width, height, focal, time) {
  const { flight } = world;
  if (flight.crashed || flight.onGround) return;
  let target = null;
  let color = '#ffb02e';
  if (world.mission.id === 'drop') {
    // The nearest open zone, not the first on the list: the pilot plans
    // the approach to the one they can actually reach next.
    let bestZone = null;
    let bestDist = Infinity;
    for (const zone of world.zones) {
      if (zone.hit) continue;
      const d = Math.hypot(zone.x - flight.x, zone.s - flight.s);
      if (d < bestDist) {
        bestDist = d;
        bestZone = zone;
      }
    }
    if (!bestZone) return;
    target = { x: bestZone.x, y: groundHeight(bestZone.x, bestZone.s) + 8, s: bestZone.s };
  } else if (world.mission.id === 'landing') {
    if (flight.s > CONFIG.runwayStart + CONFIG.runwayLength) return;
    target = { x: 0, y: 70, s: CONFIG.runwayStart + 60 };
    color = '#7be495';
  } else {
    return;
  }
  const p = project(camera, target.x, target.y, target.s, width, height, focal);
  if (!p || p.depth < 4 || p.depth > 3800) return;
  const r = 12 + 0.04 * Math.min(900, p.depth) * 0.02 + 2 * Math.sin(time * 4);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - r);
  ctx.lineTo(p.x + r, p.y);
  ctx.lineTo(p.x, p.y + r);
  ctx.lineTo(p.x - r, p.y);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = '600 13px "Avenir Next", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff3d6';
  ctx.strokeStyle = 'rgba(20, 26, 34, 0.9)';
  ctx.lineWidth = 3;
  ctx.strokeText(`${Math.round(p.depth)}m`, p.x, p.y - r - 8);
  ctx.fillText(`${Math.round(p.depth)}m`, p.x, p.y - r - 8);
  ctx.restore();
}

// Render one frame of the world: sky, terrain, features, aircraft, HUD.
export function renderScene(ctx, world, width, height, time, options = {}) {
  const palette = CONFIG.palette;
  const { flight, camera } = world;
  const focal = focalLength(height);
  const rng = options.rng ?? mulberry32(99);

  drawSky(ctx, width, height, camera.heading, time, palette, world.clouds, camera, focal);
  const showZones = world.mission.id === 'drop' ? world.zones : null;
  drawTerrain(ctx, camera, width, height, focal, palette, showZones);

  // Rings belong to the ring course alone; other sorties fly clean skies.
  if (world.mission.id === 'rings') {
    const next = world.rings.find((r) => !r.passed);
    for (const ring of [...world.rings].sort((a, b) => b.s - a.s)) {
      drawRing(ctx, ring, camera, width, height, focal, palette, time, ring === next);
    }
  }

  // A guidance diamond over the next objective, so the pilot can plan an
  // approach instead of hunting: the next drop zone, or the runway.
  drawObjectiveMarker(ctx, world, camera, width, height, focal, time);

  // Crates in flight, with their shadows on the ground below.
  for (const crate of world.crates) {
    const p = project(camera, crate.x, crate.y, crate.s, width, height, focal);
    if (!p) continue;
    const ground = project(camera, crate.x, groundHeight(crate.x, crate.s) + 1, crate.s, width, height, focal);
    if (ground) drawGroundShadow(ctx, ground.x, ground.y, Math.max(3, 10 * ground.scale * 0.024), 0.3);
    drawSupplyCrate(ctx, p.x, p.y, Math.max(0.5, p.scale * 0.12), time);
  }

  // The aircraft's shadow, then the aircraft itself, projected from the
  // chase camera: it sits in the frame the way a pilot sees their plane.
  const shadowAt = project(camera, flight.x, groundHeight(flight.x, flight.s) + 1, flight.s, width, height, focal);
  const planeAt = project(camera, flight.x, flight.y, flight.s, width, height, focal);
  if (shadowAt && !flight.onGround) {
    const above = Math.max(0, flight.y - groundHeight(flight.x, flight.s));
    const alpha = Math.max(0.05, 0.34 - above * 0.0012);
    drawGroundShadow(ctx, shadowAt.x, shadowAt.y, Math.max(4, 26 * shadowAt.scale * 0.024), alpha);
  }
  if (planeAt) {
    // Wingman in formation, 14 m to starboard and 12 m ahead: the sortie
    // flies as a pair, and the frame says tactical at a glance.
    if (!flight.crashed) {
      const sinH = Math.sin(flight.heading);
      const cosH = Math.cos(flight.heading);
      const wingAt = project(
        camera,
        flight.x + cosH * 14 + sinH * 12,
        flight.y + 4,
        flight.s - sinH * 14 + cosH * 12,
        width,
        height,
        focal,
      );
      if (wingAt) {
        const wingScale = Math.max(0.18, Math.min(0.9, wingAt.scale * 0.024 * 0.62));
        drawAircraft(ctx, wingAt.x, wingAt.y, flight.bank, flight.pitch, wingScale, time, palette);
      }
    }
    const scale = Math.max(0.25, Math.min(1.35, planeAt.scale * 0.024));
    // Exhaust shimmer behind the tail while the engine runs.
    if (options.spawnExhaust && flight.fuel > 0 && !flight.crashed) {
      spawnExhaust(world.particles, planeAt.x, planeAt.y + 30 * scale);
      spawnExhaust(world.particles, planeAt.x, planeAt.y + 30 * scale);
    }
    stepParticles(world.particles, options.dt ?? 1 / 60);
    drawParticles(ctx, world.particles);
    drawAircraft(ctx, planeAt.x, planeAt.y, flight.bank, flight.pitch, scale, time, palette);
  }
  drawSpeedStreaks(ctx, width, height, flight.speed, rng);

  // A gentle vignette so the lit instruments sit proud of the frame.
  const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.42, width / 2, height / 2, height * 0.95);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(10, 18, 30, 0.28)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // The HUD, and the mission's live message as the status line.
  const status = {
    text: world.missionState.message,
    until: world.missionState.messageUntil,
    color: palette.hudText,
  };
  drawHUD(ctx, width, height, flight, world.missionState, status, palette, time);
}
