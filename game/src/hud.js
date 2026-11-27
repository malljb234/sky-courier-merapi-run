// The HUD: lit glass instruments the pilot reads at a glance — airspeed
// and altitude dials, a heading tape, an artificial horizon, throttle,
// fuel and damage — plus the mission banner and the messages that tell
// the pilot what just happened. Drawn on the canvas so a screenshot
// shows exactly what the pilot sees.
import { CONFIG, toFeet, toKnots } from './config.js';

const FONT = '"Avenir Next", "Segoe UI", system-ui, sans-serif';
const MONO = '"SF Mono", "Cascadia Code", Consolas, monospace';

function glassPanel(ctx, x, y, w, h, radius, palette) {
  ctx.save();
  ctx.fillStyle = palette.hudGlass;
  ctx.strokeStyle = palette.hudGlassEdge;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function litNumber(ctx, text, x, y, size, color, align) {
  ctx.save();
  ctx.font = `700 ${size}px ${MONO}`;
  ctx.textAlign = align ?? 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function label(ctx, text, x, y, size, color, align) {
  ctx.save();
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.textAlign = align ?? 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(8, 16, 26, 0.65)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color ?? '#cfe9f7';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// One round dial: glowing ticks, a needle and a digital readout below.
function drawDial(ctx, cx, cy, radius, value, max, unit, palette, dangerAt) {
  glassPanel(ctx, cx - radius - 10, cy - radius - 10, radius * 2 + 20, radius * 2 + 34, 14, palette);
  ctx.save();
  ctx.translate(cx, cy);
  // Face: dark glass with a warm inner glow.
  const face = ctx.createRadialGradient(0, 0, 4, 0, 0, radius);
  face.addColorStop(0, 'rgba(30, 52, 70, 0.95)');
  face.addColorStop(1, 'rgba(8, 18, 28, 0.95)');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(180, 230, 255, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Ticks around the dial.
  for (let i = 0; i <= 10; i += 1) {
    const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const danger = dangerAt !== undefined && i / 10 >= dangerAt;
    ctx.strokeStyle = danger ? palette.hudDanger : 'rgba(220, 245, 255, 0.8)';
    ctx.lineWidth = danger ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (radius - 12), Math.sin(a) * (radius - 12));
    ctx.lineTo(Math.cos(a) * (radius - 5), Math.sin(a) * (radius - 5));
    ctx.stroke();
  }
  // Needle, lit amber.
  const frac = Math.max(0, Math.min(1, value / max));
  const needle = -Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = palette.hudAmber;
  ctx.lineWidth = 3;
  ctx.shadowColor = palette.hudAmber;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(-Math.cos(needle) * 8, -Math.sin(needle) * 8);
  ctx.lineTo(Math.cos(needle) * (radius - 14), Math.sin(needle) * (radius - 14));
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = palette.hudAmber;
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  litNumber(ctx, String(Math.round(value)), cx, cy + radius + 14, 17, palette.hudText);
  label(ctx, unit, cx, cy - radius - 22, 10, '#9fc6dd');
}

function drawHeadingTape(ctx, width, heading, palette) {
  const tapeW = 340;
  const x0 = width / 2 - tapeW / 2;
  const y = 18;
  glassPanel(ctx, x0, y, tapeW, 44, 10, palette);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y, tapeW, 44);
  ctx.clip();
  const deg = ((heading * 180) / Math.PI % 360) + 360;
  const pxPerDeg = 3.2;
  const centre = ((deg % 360) + 360) % 360;
  for (let d = -40; d <= 40; d += 5) {
    const hd = ((Math.round(centre / 5) * 5 + d) % 360 + 360) % 360;
    const dx = width / 2 + (d - (centre - Math.round(centre / 5) * 5)) * pxPerDeg;
    const major = hd % 30 === 0;
    ctx.strokeStyle = major ? 'rgba(230, 248, 255, 0.9)' : 'rgba(190, 220, 240, 0.45)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(dx, y + (major ? 8 : 16));
    ctx.lineTo(dx, y + 26);
    ctx.stroke();
    if (major) {
      const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      label(ctx, names[hd] ?? String(hd).padStart(3, '0'), dx, y + 36, 11, '#eaf7ff');
    }
  }
  ctx.restore();
  // Centre caret: the tape and its labels carry the heading.
  ctx.fillStyle = palette.hudAmber;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 6, y + 2);
  ctx.lineTo(width / 2 + 6, y + 2);
  ctx.lineTo(width / 2, y + 10);
  ctx.closePath();
  ctx.fill();
}

function drawArtificialHorizon(ctx, cx, cy, radius, pitch, bank, palette) {
  glassPanel(ctx, cx - radius - 8, cy - radius - 8, radius * 2 + 16, radius * 2 + 16, 12, palette);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-bank);
  const pitchPx = pitch * radius * 1.6;
  ctx.fillStyle = '#7db8dd';
  ctx.fillRect(-radius * 2, -radius * 2 + pitchPx, radius * 4, radius * 2);
  ctx.fillStyle = '#8a6b4a';
  ctx.fillRect(-radius * 2, pitchPx, radius * 4, radius * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius * 2, pitchPx);
  ctx.lineTo(radius * 2, pitchPx);
  ctx.stroke();
  ctx.restore();
  // Fixed wings: the aircraft symbol never moves, the world does.
  ctx.save();
  ctx.strokeStyle = palette.hudAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.55, cy);
  ctx.lineTo(cx - radius * 0.18, cy);
  ctx.moveTo(cx + radius * 0.18, cy);
  ctx.lineTo(cx + radius * 0.55, cy);
  ctx.stroke();
  ctx.fillStyle = palette.hudAmber;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBar(ctx, x, y, w, h, frac, color, palette, text) {
  glassPanel(ctx, x, y, w, h, 6, palette);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 4, Math.max(0, (w - 8) * Math.max(0, Math.min(1, frac))), h - 8, 4);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();
  if (text) label(ctx, text, x + w / 2, y + h / 2, 11, '#ffffff', 'center');
}

// The operation briefing panel: the op code, the callsign and the
// sortie's three objectives with their live progress, so the frame
// reads as a flown operation at a glance, not just a plane.
function drawOpsPanel(ctx, flight, state, palette) {
  const mission = state.mission;
  const objectives = mission.objectives ?? [];
  const x = 16;
  const y = 186;
  const w = 246;
  const h = 34 + objectives.length * 22 + 10;
  glassPanel(ctx, x, y, w, h, 10, palette);
  label(ctx, 'OP MERAPI VECTOR · OP-MV-07', x + w / 2, y + 16, 11, palette.hudAmber);
  label(ctx, `ELANG-7 · ${mission.name.toUpperCase()}`, x + w / 2, y + 32, 11, '#eaf7ff');
  const id = mission.id;
  const fuelText = `${Math.round(flight.fuel)}% FUEL`;
  const lives = [];
  if (id === 'rings') {
    lives.push(`${state.ringsPassed}/8`, '', fuelText);
  } else if (id === 'landing') {
    lives.push(flight.onGround ? 'ON GROUND' : 'AIRBORNE', '', fuelText);
  } else if (id === 'drop') {
    lives.push(`${state.zonesHit ?? 0}/3 ZONES`, `${state.cratesDropped}/3 CRATES`, fuelText);
  } else {
    lives.push(`${(flight.distanceFlown / 1000).toFixed(1)} KM`, '', fuelText);
  }
  const headlineDone =
    (id === 'rings' && state.ringsPassed >= 8) ||
    (id === 'drop' && (state.zonesHit ?? 0) >= 3) ||
    ((id === 'landing') && state.finished && !state.failed);
  objectives.forEach((objective, i) => {
    const rowY = y + 52 + i * 22;
    const done = i === 0 && headlineDone;
    label(ctx, done ? '✓' : '○', x + 14, rowY, 10, done ? palette.hudGreen : '#9fc6dd', 'left');
    label(ctx, objective, x + 28, rowY, 10, done ? palette.hudGreen : '#d7edf8', 'left');
    if (lives[i]) label(ctx, lives[i], x + w - 10, rowY, 10, palette.hudAmber, 'right');
  });
}

// The whole HUD for one frame.
export function drawHUD(ctx, width, height, flight, mission, status, palette, time) {
  const p = palette ?? CONFIG.palette;
  // Dials: airspeed left, altitude right, both lit.
  drawDial(ctx, 74, 108, 46, toKnots(flight.speed), 200, 'KT', p, 0.9);
  drawDial(ctx, width - 74, 108, 46, toFeet(flight.y), 2600, 'FT', p);
  // Heading tape across the top centre.
  drawHeadingTape(ctx, width, flight.heading, p);
  // Artificial horizon, bottom left.
  drawArtificialHorizon(ctx, 74, height - 78, 44, flight.pitch, flight.bank, p);
  // Throttle, fuel and damage, bottom right.
  const bx = width - 218;
  const by = height - 118;
  label(ctx, 'THR', bx - 8, by + 10, 10, '#9fc6dd', 'right');
  drawBar(ctx, bx, by, 190, 18, flight.throttle, p.hudGreen, p, `${Math.round(flight.throttle * 100)}%`);
  label(ctx, 'FUEL', bx - 8, by + 34, 10, '#9fc6dd', 'right');
  const fuelColor = flight.fuel < 20 ? p.hudDanger : p.hudAmber;
  drawBar(ctx, bx, by + 24, 190, 18, flight.fuel / CONFIG.fuelCapacity, fuelColor, p, `${Math.round(flight.fuel)}%`);
  label(ctx, 'DMG', bx - 8, by + 58, 10, '#9fc6dd', 'right');
  drawBar(ctx, bx, by + 48, 190, 18, flight.damage / 100, p.hudDanger, p, `${Math.round(flight.damage)}%`);
  label(ctx, 'GEAR ' + (flight.gearDown ? 'DOWN' : 'UP'), bx, by + 82, 11, flight.gearDown ? p.hudGreen : '#9fc6dd', 'left');
  // Vertical speed, under the altitude dial.
  const vs = Math.round(flight.verticalSpeed * 196.85);
  label(ctx, `V/S ${vs >= 0 ? '+' : ''}${vs} FPM`, width - 74, 196, 12, vs < -800 ? p.hudDanger : '#cfe9f7');

  // Operation briefing panel, left of the frame.
  if (mission && mission.mission) drawOpsPanel(ctx, flight, mission, p);

  // Mission banner: the goal, the progress, the score.
  if (mission && mission.mission) {
    const banner = mission.mission.banner;
    glassPanel(ctx, width / 2 - 210, 78, 420, 34, 10, p);
    label(ctx, banner, width / 2, 95, 14, '#ffffff');
    label(ctx, mission.progress, width / 2, 126, 12, p.hudAmber);
  }

  // Stall warning: flashing, impossible to miss.
  if (flight.stalled && Math.sin(time * 10) > -0.2) {
    litNumber(ctx, 'STALL', width / 2, height * 0.3, 30, p.hudDanger);
  }
  if (flight.fuel <= 0) {
    litNumber(ctx, 'FUEL EMPTY — GLIDE', width / 2, height * 0.3, 22, p.hudDanger);
  }

  // Centre status message, fading, on a dark pill so it stays readable
  // against bright cloud and sky.
  if (status && status.text && status.until > time) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, (status.until - time) / 0.6));
    ctx.font = `700 24px ${MONO}`;
    const tw = ctx.measureText(status.text).width;
    ctx.fillStyle = 'rgba(8, 18, 28, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - tw / 2 - 16, height * 0.24 - 20, tw + 32, 40, 10);
    ctx.fill();
    litNumber(ctx, status.text, width / 2, height * 0.24, 24, status.color ?? p.hudText);
    ctx.restore();
  }
}

// Big centred screen text for titles and debriefs (the game draws its own
// screens on the canvas, so they appear in screenshots exactly as played).
export function drawCentredPanel(ctx, width, height, lines, palette) {
  const p = palette ?? CONFIG.palette;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 18, 28, 0.55)';
  ctx.fillRect(0, 0, width, height);
  const panelW = Math.min(640, width - 80);
  const panelH = 60 + lines.length * 34;
  glassPanel(ctx, width / 2 - panelW / 2, height / 2 - panelH / 2, panelW, panelH, 16, p);
  lines.forEach((line, i) => {
    const y = height / 2 - panelH / 2 + 40 + i * 34;
    if (line.style === 'title') litNumber(ctx, line.text, width / 2, y, 30, p.hudAmber);
    else if (line.style === 'big') litNumber(ctx, line.text, width / 2, y, 22, p.hudText);
    else label(ctx, line.text, width / 2, y, 15, line.color ?? '#d7edf8');
  });
  ctx.restore();
}
