// The flight model: an arcade model with real discipline in it. Throttle
// sets the speed the aircraft wants; pitch trades speed for height; bank
// turns the aircraft; below flying speed the wing stops flying. Fuel burns
// fastest at full throttle, and damage comes only from hitting things hard.
import { CONFIG } from './config.js';
import { groundHeight, onRunway } from './terrain.js';

export function createFlight() {
  return {
    x: 0,
    y: 150,
    s: 0,
    heading: 0,
    pitch: 0,
    bank: 0,
    speed: 52,
    verticalSpeed: 0,
    throttle: 0.55,
    fuel: CONFIG.fuelCapacity,
    damage: 0,
    gearDown: true,
    flaps: 0,
    stalled: false,
    onGround: false,
    crashed: false,
    crashReason: '',
    landed: false,
    touchdownQuality: 0,
    distanceFlown: 0,
    time: 0,
  };
}

// One fixed step of flight. `input` carries pitch/roll/throttle axes in
// [-1, 1] plus the action edge. Returns event flags for the game to score.
export function stepFlight(flight, input, dt) {
  const events = { touchedDown: false, crashed: false, ringGraze: false };
  if (flight.crashed || flight.onGround) return events;
  const c = CONFIG;

  // Throttle: the lever moves at a fixed rate; empty tanks cut the engine.
  flight.throttle = Math.max(0, Math.min(1, flight.throttle + input.throttle * dt * 0.7));
  const thrust = flight.fuel > 0 ? flight.throttle : 0;

  // Speed chases the throttle's equilibrium, drag growing with the square.
  const equilibrium = 18 + thrust * (c.maxSpeed - 18);
  const drag = 0.55 + (flight.flaps > 0 ? 0.25 : 0);
  flight.speed += (equilibrium - flight.speed) * drag * dt;
  flight.speed = Math.max(8, Math.min(c.maxSpeed + 12, flight.speed));

  // Pitch and bank answer the stick, with authority that grows with speed.
  const authority = Math.min(1, flight.speed / 55);
  const pitchTarget = Math.max(-c.maxPitch, Math.min(c.maxPitch, input.pitch * c.maxPitch));
  const pitchRate = c.pitchRate * (0.35 + 0.65 * authority);
  flight.pitch += Math.max(-pitchRate * dt, Math.min(pitchRate * dt, pitchTarget - flight.pitch));
  const bankTarget = Math.max(-c.maxBank, Math.min(c.maxBank, input.roll * c.maxBank));
  const bankRate = c.bankRate * (0.4 + 0.6 * authority);
  if (Math.abs(input.roll) > 0.05) {
    flight.bank += Math.max(-bankRate * dt, Math.min(bankRate * dt, bankTarget - flight.bank));
  } else {
    // Hands off: the wings level themselves, gently.
    const toward = Math.max(-c.levelRate * dt, Math.min(c.levelRate * dt, -flight.bank));
    flight.bank += toward;
  }

  // The stall: too slow and the nose drops, the wing buffets, height is lost.
  flight.stalled = flight.speed < c.stallSpeed && flight.y > groundHeight(flight.x, flight.s) + 4;
  if (flight.stalled) {
    flight.pitch = Math.max(flight.pitch - 0.5 * dt, -0.3);
  }

  // Turning: bank rolls the lift sideways, so heading follows the bank.
  const turnRate = -flight.bank * c.turnAuthority * (9.81 / Math.max(30, flight.speed));
  flight.heading += turnRate * dt;

  // Climbing: pitch trades speed for height; the climb is capped by power.
  const climbTarget = Math.sin(flight.pitch) * flight.speed * c.climbAuthority;
  const climbRate = flight.stalled ? -14 : 3.0;
  flight.verticalSpeed += Math.max(-climbRate * dt, Math.min(climbRate * dt, climbTarget - flight.verticalSpeed));

  // Move through the world.
  const forward = flight.speed * dt;
  flight.s += Math.cos(flight.heading) * forward;
  flight.x += Math.sin(flight.heading) * forward;
  flight.y += flight.verticalSpeed * dt;
  flight.distanceFlown += forward;
  flight.time += dt;

  // Fuel: gentle cruise sips, full throttle gulps.
  const burn = c.fuelBurnIdle + thrust * thrust * (c.fuelBurnFull - c.fuelBurnIdle);
  flight.fuel = Math.max(0, flight.fuel - burn * dt);

  // Ground contact: the runway forgives a gentle arrival, nothing else does.
  const ground = groundHeight(flight.x, flight.s);
  if (flight.y - ground <= c.gearHeight) {
    const sink = -flight.verticalSpeed;
    const aligned = Math.abs(flight.heading - c.runwayHeading) < 0.22 && Math.abs(flight.bank) < 0.3;
    if (onRunway(flight.x, flight.s) && sink < 6 && flight.speed < 62 && aligned) {
      flight.onGround = true;
      flight.landed = true;
      flight.y = ground + c.gearHeight;
      flight.touchdownQuality = Math.max(0, 100 - sink * 14 - Math.abs(flight.bank) * 20);
      events.touchedDown = true;
    } else if (sink < 1.2 && flight.speed < 40 && ground < 4) {
      // A soft ditching on the water: the aircraft floats, the sortie ends.
      flight.onGround = true;
      flight.y = ground + c.gearHeight;
      flight.touchdownQuality = 30;
      events.touchedDown = true;
    } else {
      flight.crashed = true;
      flight.crashReason = sink > 9 ? 'hard impact' : 'terrain strike';
      flight.damage = 100;
      events.crashed = true;
    }
  }
  return events;
}

// Rollout after a landing: the aircraft slows along the runway.
export function stepRollout(flight, dt) {
  flight.speed = Math.max(0, flight.speed - 14 * dt);
  flight.s += Math.cos(flight.heading) * flight.speed * dt;
  flight.x += Math.sin(flight.heading) * flight.speed * dt;
  flight.time += dt;
  if (flight.speed < 2) flight.speed = 0;
}

// A simple autopilot for the screenshot scenes and the attract mode: steer
// toward a point, hold a height and a speed, bank gently into the turns.
export function autopilotInput(flight, target, dt) {
  const dx = target.x - flight.x;
  const ds = target.s - flight.s;
  const wantHeading = Math.atan2(dx, ds);
  let headingError = wantHeading - flight.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  const roll = Math.max(-1, Math.min(1, -headingError * 2.2));
  const heightError = target.y - flight.y;
  // Glidepath control: ask for a descent rate the wing can actually hold,
  // and pitch to hold that rate, so approaches flare instead of diving.
  const wantVS = Math.max(-7, Math.min(4, heightError * 0.22));
  const vsError = wantVS - flight.verticalSpeed;
  const pitch = Math.max(-1, Math.min(1, vsError * 0.14 + 0.02));
  const speedError = (target.speed ?? CONFIG.cruiseSpeed) - flight.speed;
  const throttle = Math.max(-1, Math.min(1, speedError * 0.06));
  return { pitch, roll, throttle, action: false };
}
