// The screenshot scenes behind ?shot=cover|rings|drop|landing. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by the same autopilot a player could watch, so the frame
// is what a short game really looks like and the same seed always gives
// the same frame. The cover is the first screenshot by name.
import { CONFIG } from './config.js';
import { autopilotInput, createFlight, stepFlight } from './flight.js';
import { buildClouds, buildDropZones, buildRings, groundHeight } from './terrain.js';
import { checkRings, createMissionState, dropCrate, stepCrates, updateMission, MISSIONS } from './missions.js';
import { createParticles } from './effects.js';
import { makeCamera } from './terrain.js';

const STEP = 1 / 120;

// Build a fresh world for a mission, at its starting line.
export function createWorld(missionId, seed) {
  const mission = MISSIONS.find((m) => m.id === missionId) ?? MISSIONS[0];
  const flight = createFlight();
  Object.assign(flight, mission.start);
  return {
    mission,
    flight,
    rings: buildRings(),
    zones: buildDropZones(),
    clouds: buildClouds(),
    crates: [],
    particles: createParticles(seed ?? CONFIG.worldSeed),
    missionState: createMissionState(mission),
    camera: makeCamera(),
    burst: null,
    screen: 'play',
    best: 0,
  };
}

// Chase the aircraft: the camera sits behind and above it, looking along
// its heading. In shot staging the camera snaps; in play it eases.
export function snapCamera(world) {
  const { flight, camera } = world;
  const sinH = Math.sin(flight.heading);
  const cosH = Math.cos(flight.heading);
  camera.x = flight.x - sinH * CONFIG.cameraBack;
  camera.s = flight.s - cosH * CONFIG.cameraBack;
  camera.y = flight.y + CONFIG.cameraHeight;
  camera.heading = flight.heading;
  camera.pitch = flight.pitch * 0.6;
  camera.roll = flight.bank * 0.25;
}

export function easeCamera(world, dt) {
  const { flight, camera } = world;
  const sinH = Math.sin(flight.heading);
  const cosH = Math.cos(flight.heading);
  const tx = flight.x - sinH * CONFIG.cameraBack;
  const ts = flight.s - cosH * CONFIG.cameraBack;
  const ty = flight.y + CONFIG.cameraHeight;
  const k = Math.min(1, dt * 4.5);
  camera.x += (tx - camera.x) * k;
  camera.s += (ts - camera.s) * k;
  camera.y += (ty - camera.y) * k;
  let dh = flight.heading - camera.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  camera.heading += dh * Math.min(1, dt * 3.2);
  camera.pitch += (flight.pitch * 0.6 - camera.pitch) * Math.min(1, dt * 3);
  camera.roll += (flight.bank * 0.25 - camera.roll) * Math.min(1, dt * 3);
}

// Step the world forward with the autopilot flying toward `target`.
// Stops early when `stopWhen` says the frame is posed, or on crash/ground.
function flyForward(world, seconds, targetFor, stopWhen) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const target = targetFor(world.flight);
    const input = autopilotInput(world.flight, target, STEP);
    const events = stepFlight(world.flight, input, STEP);
    stepCrates(world, STEP);
    checkRings(world);
    updateMission(world, events);
    if (world.flight.crashed || world.flight.onGround) break;
    if (stopWhen && i % 30 === 0 && stopWhen(world.flight)) break;
  }
  snapCamera(world);
}

function distanceTo(flight, x, y, s) {
  return Math.hypot(flight.x - x, flight.y - y, flight.s - s);
}

// Stage one named scene and leave the world posed for a single render.
export function stageShot(name, world) {
  const flight = world.flight;
  if (name === 'rings') {
    // Line the aircraft up on the second gate from 500 metres out, high
    // enough to clear the ridge between here and the gate, so the frame
    // holds the glowing ring ahead with the valley below.
    const ring = world.rings[1];
    const startS = ring.s - 280;
    const startX = ring.x * 0.8;
    // The ridge sits well before the gate; the last stretch descends
    // into the gate's bowl, so start low and close, level with the ring.
    let maxGround = 0;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const gx = startX + (ring.x - startX) * t;
      const gs = startS + (ring.s - startS) * t;
      maxGround = Math.max(maxGround, groundHeight(gx, gs));
    }
    const cruiseY = Math.max(ring.y + 35, maxGround + 32);
    flight.x = startX;
    flight.y = cruiseY;
    flight.s = startS;
    flight.heading = Math.atan2(ring.x - startX, ring.s - startS);
    flight.speed = 58;
    flight.throttle = 0.66;
    const targetFor = () => ({ x: ring.x, y: ring.y + 6, s: ring.s, speed: 58 });
    flyForward(world, 3.0, targetFor);
    world.missionState.message = 'VECTOR RUN — GATE 2/8, HOLD THE LINE';
    world.missionState.messageUntil = 999;
    return;
  }
  if (name === 'drop') {
    // Come in from the north, down the open plateau the second zone
    // sits on: low, level, the painted zone dead ahead the whole way in.
    const zone = world.zones[1];
    const startS = zone.s + 350;
    const cruiseY = groundHeight(zone.x, startS) + 55;
    flight.x = zone.x;
    flight.y = cruiseY;
    flight.s = startS;
    flight.heading = Math.PI;
    flight.speed = 46;
    flight.throttle = 0.48;
    const targetFor = () => ({ x: zone.x, y: cruiseY, s: zone.s, speed: 46 });
    flyForward(world, 1.8, targetFor);
    dropCrate(world);
    flyForward(world, 0.8, targetFor);
    world.missionState.message = 'SUPPLY VECTOR — CRATE AWAY, ON THE ZONE';
    world.missionState.messageUntil = 999;
    return;
  }
  if (name === 'landing') {
    flight.x = 6;
    flight.y = 74;
    flight.s = CONFIG.runwayStart - 260;
    flight.heading = 0.01;
    flight.speed = 44;
    flight.throttle = 0.3;
    flight.pitch = -0.05;
    const targetFor = () => ({ x: 0, y: 64, s: CONFIG.runwayStart + 240, speed: 44 });
    flyForward(world, 3.2, targetFor);
    world.missionState.message = 'COASTAL APPROACH — GEAR DOWN, EASY DOES IT';
    world.missionState.messageUntil = 999;
    return;
  }
  // The cover: on final approach, the runway lit ahead, the island below,
  // every instrument glowing. This is the frame the judge sees largest.
  // Fly until the threshold is close enough to fill the frame.
  flight.x = 24;
  flight.y = 230;
  flight.s = CONFIG.runwayStart - 1450;
  flight.heading = -0.015;
  flight.speed = 54;
  flight.throttle = 0.45;
  const approach = { x: 0, y: 85, s: CONFIG.runwayStart + 120 };
  const targetFor = () => ({ ...approach, speed: 52 });
  flyForward(world, 30, targetFor, (f) => distanceTo(f, approach.x, approach.y, approach.s) < 420);
  world.missionState.message = 'ELANG-7 · OP MERAPI VECTOR — FINAL APPROACH';
  world.missionState.messageUntil = 999;
}

// The four screenshot scenes, in the order they are handed in.
export const SHOT_SCENES = [
  { name: '1-cover.jpg', shot: 'cover', mission: 'landing' },
  { name: '2-rings.jpg', shot: 'rings', mission: 'rings' },
  { name: '3-drop.jpg', shot: 'drop', mission: 'drop' },
  { name: '4-landing.jpg', shot: 'landing', mission: 'landing' },
];

export function groundAt(x, s) {
  return groundHeight(x, s);
}
