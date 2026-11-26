// Sky Courier: Merapi Run — boot, the screen state machine, the fixed-step
// loop, and the screenshot mode. The game plays with keyboard and mouse,
// runs offline from its own files, and needs no network request.
import { CONFIG } from './config.js';
import { stepFlight, stepRollout } from './flight.js';
import { createWorld, easeCamera, snapCamera, stageShot, SHOT_SCENES } from './shots.js';
import { autopilotInput } from './flight.js';
import { checkRings, dropCrate, stepCrates, updateMission, MISSIONS } from './missions.js';
import { renderScene } from './render.js';
import { drawCentredPanel } from './hud.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { spawnBurst } from './effects.js';

const STEP = 1 / 120;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function canvasSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

// ---- Screenshot mode: ?shot=cover&seed=1 stages one frame and stops. ----
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  const scene = SHOT_SCENES.find((s) => s.shot === shotName) ?? SHOT_SCENES[0];
  const world = createWorld(scene.mission, CONFIG.worldSeed);
  stageShot(scene.shot, world);
  const { width, height } = canvasSize();
  renderScene(ctx, world, width, height, 4.2, { dt: STEP, spawnExhaust: true });
  if (statusEl) statusEl.textContent = `Screenshot scene ${scene.shot} staged.`;
  // No loop: the frame on screen is the screenshot.
} else {
  runGame();
}

function runGame() {
  const input = new Input(canvas);
  const audio = new GameAudio();
  let world = createWorld('rings', CONFIG.worldSeed);
  let screen = 'title';
  let selected = 0;
  let lastNav = 0;
  let accumulator = 0;
  let last = performance.now();
  let elapsed = 0;
  let best = loadBest();

  // The title screen's backdrop: the autopilot flies the ring course
  // behind the menu, so the game is already flying when the pilot arrives.
  function stepAttract(dt) {
    const { flight } = world;
    if (flight.crashed || flight.onGround || world.missionState.finished) {
      world = createWorld('rings', CONFIG.worldSeed);
      snapCamera(world);
      return;
    }
    const next = world.rings.find((r) => !r.passed) ?? world.rings[0];
    const inputAxes = autopilotInput(flight, { x: next.x, y: next.y, s: next.s, speed: 58 }, dt);
    const events = stepFlight(flight, inputAxes, dt);
    checkRings(world);
    updateMission(world, events);
    easeCamera(world, dt);
  }

  function loadBest() {
    try {
      return JSON.parse(localStorage.getItem('sky-courier-best') ?? '{}');
    } catch {
      return {};
    }
  }
  function saveBest() {
    try {
      localStorage.setItem('sky-courier-best', JSON.stringify(best));
    } catch {
      /* storage may be unavailable; the game plays on without it */
    }
  }

  function startMission(index) {
    world = createWorld(MISSIONS[index].id, CONFIG.worldSeed);
    snapCamera(world);
    screen = 'briefing';
  }

  function beginFlight() {
    screen = 'play';
    snapCamera(world);
    audio.ensure();
  }

  function finishFlight() {
    const state = world.missionState;
    const key = state.mission.id;
    if (!state.failed && (!best[key] || state.score > best[key])) {
      best[key] = state.score;
      saveBest();
    }
    screen = 'debrief';
  }

  function titleLines() {
    const lines = [
      { text: 'SKY COURIER', style: 'title' },
      { text: 'Merapi Run — a morning over the island', style: 'big' },
      { text: 'Arrows / WASD steer · Shift / Ctrl throttle · Space acts · P pauses · M mutes', color: '#9fc6dd' },
      { text: '', style: 'plain' },
    ];
    MISSIONS.forEach((m, i) => {
      const mark = i === selected ? '▸ ' : '  ';
      const bestText = best[m.id] ? `   best ${best[m.id]}` : '';
      lines.push({ text: `${mark}${i + 1}. ${m.name} — ${m.tagline}${bestText}`, color: i === selected ? '#ffc857' : '#d7edf8' });
    });
    lines.push({ text: '', style: 'plain' });
    lines.push({ text: 'Press 1–4 or Enter to fly the selected sortie', color: '#9fc6dd' });
    return lines;
  }

  function briefingLines() {
    const m = world.mission;
    return [
      { text: m.name.toUpperCase(), style: 'title' },
      { text: m.tagline, style: 'big' },
      { text: 'Fly gentle: full throttle drinks the fuel, and the island is not forgiving.', color: '#9fc6dd' },
      { text: '', style: 'plain' },
      { text: 'Press Enter or click to take off', color: '#ffc857' },
    ];
  }

  function debriefLines() {
    const state = world.missionState;
    const lines = [
      { text: state.failed ? 'SORTIE FAILED' : 'SORTIE COMPLETE', style: 'title' },
      { text: state.finishReason, style: 'big' },
      { text: `SCORE ${state.score}`, color: '#ffc857' },
    ];
    for (const line of state.scoreLines.slice(-5)) lines.push({ text: line, color: '#d7edf8' });
    lines.push({ text: '', style: 'plain' });
    lines.push({ text: 'Enter: back to the hangar · R: fly it again', color: '#9fc6dd' });
    return lines;
  }

  function stepWorld(dt) {
    const { flight } = world;
    const axes = input.axes(performance.now());
    flight.throttle = Math.max(0, Math.min(1, flight.throttle + input.consumeWheel() * 0.08));
    if (input.consume('action') && world.missionState.mission.id === 'drop') {
      if (dropCrate(world)) audio.chime();
    }
    let events = { touchedDown: false, crashed: false };
    if (flight.onGround) {
      stepRollout(flight, dt);
    } else {
      events = stepFlight(flight, { pitch: axes.pitch, roll: axes.roll, throttle: axes.throttle, action: false }, dt);
    }
    stepCrates(world, dt);
    const ringsBefore = world.missionState.ringsPassed;
    checkRings(world);
    if (world.missionState.ringsPassed > ringsBefore) audio.chime();
    if (world.burst) {
      const p = world.burst;
      world.burst = null;
      // Burst at the ring's screen position next render; keep it simple: centre flash.
      spawnBurst(world.particles, canvasSize().width / 2, canvasSize().height * 0.45, 26, ['#ffb02e', '#fff3d6', '#7be495'], 190);
    }
    updateMission(world, events);
    if (events.touchedDown) audio.thud();
    if (events.crashed) {
      audio.crash();
      spawnBurst(world.particles, canvasSize().width / 2, canvasSize().height * 0.55, 60, ['#ff5a4e', '#ffb02e', '#3a3f46'], 260);
    }
    if (world.missionState.finished) finishFlight();
    easeCamera(world, dt);
  }

  function frame(now) {
    const dtReal = Math.min(0.1, (now - last) / 1000);
    last = now;
    elapsed += dtReal;
    const { width, height } = canvasSize();

    if (input.consume('mute')) {
      audio.ensure();
      const muted = audio.toggleMute();
      if (statusEl) statusEl.textContent = muted ? 'Sound off.' : 'Sound on.';
    }
    if (screen === 'title') {
      if (input.consume('confirm')) startMission(selected);
      for (let i = 0; i < MISSIONS.length; i += 1) {
        if (input.keys.has(`Digit${i + 1}`) || input.keys.has(`Numpad${i + 1}`)) startMission(i);
      }
      if (now - lastNav > 180) {
        if (input.keys.has('ArrowDown')) {
          selected = Math.min(MISSIONS.length - 1, selected + 1);
          lastNav = now;
        }
        if (input.keys.has('ArrowUp')) {
          selected = Math.max(0, selected - 1);
          lastNav = now;
        }
      }
      // Attract mode: the autopilot flies the valley behind the title.
      accumulator += dtReal;
      while (accumulator >= STEP) {
        stepAttract(STEP);
        accumulator -= STEP;
      }
      renderScene(ctx, world, width, height, elapsed, { dt: STEP, spawnExhaust: true });
      drawCentredPanel(ctx, width, height, titleLines(), CONFIG.palette);
    } else if (screen === 'briefing') {
      renderScene(ctx, world, width, height, elapsed, { dt: STEP });
      drawCentredPanel(ctx, width, height, briefingLines(), CONFIG.palette);
      if (input.consume('confirm') || input.consume('action')) beginFlight();
    } else if (screen === 'play') {
      if (input.consume('pause')) {
        screen = 'paused';
      } else {
        accumulator += dtReal;
        while (accumulator >= STEP) {
          stepWorld(STEP);
          accumulator -= STEP;
          if (screen !== 'play') break;
        }
        audio.update(world.flight.throttle, world.flight.speed, !world.flight.crashed);
      }
      renderScene(ctx, world, width, height, elapsed, { dt: STEP, spawnExhaust: true });
    } else if (screen === 'paused') {
      renderScene(ctx, world, width, height, elapsed, { dt: STEP });
      drawCentredPanel(
        ctx,
        width,
        height,
        [
          { text: 'PAUSED', style: 'title' },
          { text: 'P or Enter: keep flying · R: restart the sortie', color: '#d7edf8' },
        ],
        CONFIG.palette,
      );
      if (input.consume('pause') || input.consume('confirm')) screen = 'play';
      if (input.consume('restart')) startMission(MISSIONS.indexOf(world.mission));
    } else if (screen === 'debrief') {
      renderScene(ctx, world, width, height, elapsed, { dt: STEP });
      drawCentredPanel(ctx, width, height, debriefLines(), CONFIG.palette);
      if (input.consume('confirm')) screen = 'title';
      if (input.consume('restart')) startMission(MISSIONS.indexOf(world.mission));
    }
    if (statusEl) {
      const state = world.missionState;
      statusEl.textContent = `${state.mission.name}. Score ${state.score}. ${state.finished ? state.finishReason : state.progress ?? ''}`;
    }
    requestAnimationFrame(frame);
  }

  snapCamera(world);
  requestAnimationFrame(frame);
}
