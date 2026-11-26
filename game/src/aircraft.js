// The aircraft, drawn procedurally: a cream-and-red bush plane seen from
// behind and slightly above, as the chase camera sees it. No image files,
// no borrowed art: every line here is the game's own drawing.
import { CONFIG } from './config.js';

// Draw the aircraft centred at (cx, cy), banked by `bank` radians and
// pitched by `pitch`, at `scale` (1 = cruise size). `time` drives the
// strobe blink and the engine shimmer.
export function drawAircraft(ctx, cx, cy, bank, pitch, scale, time, palette) {
  const p = palette ?? CONFIG.palette;
  ctx.save();
  ctx.translate(cx, cy + pitch * 26);
  ctx.rotate(-bank * 0.55);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';

  // Soft shadow under the airframe, grounding it in the frame.
  ctx.fillStyle = 'rgba(20, 30, 44, 0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 26, 78, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main wings: long, slightly swept, red tips, cream inboard.
  drawWing(ctx, -1, p);
  drawWing(ctx, 1, p);

  // Tailplane and fin, behind the wing.
  ctx.fillStyle = p.aircraftCream;
  ctx.strokeStyle = 'rgba(60, 50, 40, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-34, -34);
  ctx.lineTo(34, -34);
  ctx.lineTo(26, -46);
  ctx.lineTo(-26, -46);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Fin with the red rudder.
  ctx.fillStyle = p.aircraftRed;
  ctx.beginPath();
  ctx.moveTo(-7, -44);
  ctx.lineTo(7, -44);
  ctx.lineTo(4, -72);
  ctx.lineTo(-4, -72);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.aircraftCream;
  ctx.beginPath();
  ctx.moveTo(-7, -44);
  ctx.lineTo(0, -44);
  ctx.lineTo(-1, -70);
  ctx.lineTo(-4, -70);
  ctx.closePath();
  ctx.fill();

  // Fuselage: a tapered body with a shaded belly and a lit spine.
  ctx.fillStyle = p.aircraftCream;
  ctx.beginPath();
  ctx.moveTo(0, -56);
  ctx.bezierCurveTo(13, -44, 16, -18, 13, 12);
  ctx.bezierCurveTo(11, 26, 6, 33, 0, 34);
  ctx.bezierCurveTo(-6, 33, -11, 26, -13, 12);
  ctx.bezierCurveTo(-16, -18, -13, -44, 0, -56);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 50, 40, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Belly shading and the red cheatline along the fuselage.
  ctx.fillStyle = 'rgba(120, 90, 60, 0.22)';
  ctx.beginPath();
  ctx.moveTo(-11, 8);
  ctx.bezierCurveTo(-6, 26, 6, 26, 11, 8);
  ctx.bezierCurveTo(8, 20, -8, 20, -11, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.aircraftRed;
  ctx.fillRect(-14, -30, 28, 5);
  // Cockpit glass: lit from the morning sun, with a bright catchlight.
  const glass = ctx.createLinearGradient(-9, -52, 9, -30);
  glass.addColorStop(0, '#d8f4ff');
  glass.addColorStop(0.5, p.glass);
  glass.addColorStop(1, '#5d93a8');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(0, -54);
  ctx.bezierCurveTo(9, -48, 10, -38, 7, -30);
  ctx.lineTo(-7, -30);
  ctx.bezierCurveTo(-10, -38, -9, -48, 0, -54);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.ellipse(-3, -46, 3.4, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Engine shimmer at the nose and the exhaust puffs.
  const shimmer = 0.5 + 0.5 * Math.sin(time * 31);
  ctx.fillStyle = `rgba(255, 220, 160, ${0.25 + 0.3 * shimmer})`;
  ctx.beginPath();
  ctx.ellipse(0, 34, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Navigation lights: red on the left tip, green on the right, white strobe.
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(-96, -6, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#37e08a';
  ctx.beginPath();
  ctx.arc(96, -6, 3.4, 0, Math.PI * 2);
  ctx.fill();
  if (Math.sin(time * 4) > 0.55) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(0, -74, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWing(ctx, side, p) {
  const s = side;
  ctx.fillStyle = p.aircraftCream;
  ctx.strokeStyle = 'rgba(60, 50, 40, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(8 * s, -22);
  ctx.lineTo(98 * s, -10);
  ctx.lineTo(100 * s, 2);
  ctx.lineTo(10 * s, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Red tip and the aileron line.
  ctx.fillStyle = p.aircraftRed;
  ctx.beginPath();
  ctx.moveTo(84 * s, -12);
  ctx.lineTo(98 * s, -10);
  ctx.lineTo(100 * s, 2);
  ctx.lineTo(86 * s, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 50, 40, 0.3)';
  ctx.beginPath();
  ctx.moveTo(16 * s, -19);
  ctx.lineTo(82 * s, -9);
  ctx.stroke();
}

// A soft ellipse where the aircraft's shadow falls on the ground below.
export function drawGroundShadow(ctx, x, y, radius, alpha) {
  ctx.fillStyle = `rgba(15, 25, 35, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
}
