// The three sorties and free flight of OPERATION MERAPI VECTOR
// (OP-MV-07, callsign ELANG-7): what the pilot is asked to do, how
// each one is scored, and what ends it. The flight model stays in
// flight.js; this file only owns the objectives.
import { CONFIG } from './config.js';
import { groundHeight } from './terrain.js';

export const OPERATION = {
  name: 'OPERATION MERAPI VECTOR',
  code: 'OP-MV-07',
  callsign: 'ELANG-7',
  title: 'MERAPI VECTOR (ELANG-7) — 3D Tactical Flight Simulator',
};

export const MISSIONS = [
  {
    id: 'rings',
    name: 'Vector Run',
    tagline: 'Thread all 8 gates down the river valley before the fuel runs dry.',
    objectives: ['THREAD 8 GATES', 'HOLD A CLEAN LINE', 'FINISH WITH FUEL'],
    start: { x: 0, y: 150, s: 0, heading: 0, speed: 52, throttle: 0.55 },
    banner: 'OP MERAPI VECTOR — VECTOR RUN · thread the gates in order',
  },
  {
    id: 'landing',
    name: 'Coastal Approach',
    tagline: 'Bring Elang-7 home: a gentle touchdown on the mountain airstrip.',
    objectives: ['FLY THE FINAL', 'TOUCH DOWN GENTLY', 'STAY ON THE STRIP'],
    start: { x: 40, y: 220, s: 3600, heading: 0, speed: 56, throttle: 0.42 },
    banner: 'OP MERAPI VECTOR — COASTAL APPROACH · land on the strip, gently',
  },
  {
    id: 'drop',
    name: 'Supply Vector',
    tagline: 'Drop three crates onto the painted zones. Low and slow wins.',
    objectives: ['HIT 3 PAINTED ZONES', 'DROP LOW AND SLOW', '3 CRATES ONLY'],
    start: { x: 0, y: 230, s: 1200, heading: 0, speed: 50, throttle: 0.5 },
    banner: 'OP MERAPI VECTOR — SUPPLY VECTOR · Space drops a crate over each zone',
  },
  {
    id: 'free',
    name: 'Island Patrol',
    tagline: 'No orders. Just the island, the morning and the fuel you carry.',
    objectives: ['PATROL THE ISLAND', 'WATCH THE FUEL', 'LAND WHEN READY'],
    start: { x: 0, y: 210, s: 0, heading: 0, speed: 52, throttle: 0.55 },
    banner: 'OP MERAPI VECTOR — ISLAND PATROL · explore the island',
  },
];

// Fresh per-sortie state: rings, zones, crates, score and the debrief.
export function createMissionState(mission) {
  return {
    mission,
    score: 0,
    scoreLines: [],
    ringsPassed: 0,
    cratesDropped: 0,
    cratesResolved: 0,
    zonesHit: 0,
    finished: false,
    failed: false,
    finishReason: '',
    message: '',
    messageUntil: 0,
  };
}

function say(state, text, time, hold = 2.6) {
  state.message = text;
  state.messageUntil = time + hold;
}

function addScore(state, points, line) {
  state.score += points;
  state.scoreLines.push(line);
}

// Drop one crate from the aircraft. It falls straight down the sky.
export function dropCrate(world) {
  const { flight, missionState } = world;
  if (missionState.cratesDropped >= 3 || flight.crashed || flight.onGround) return false;
  world.crates.push({ x: flight.x, y: flight.y - 3, s: flight.s, vy: 0, resolved: false });
  missionState.cratesDropped += 1;
  say(missionState, `CRATE AWAY — ${3 - missionState.cratesDropped} LEFT`, flight.time, 1.6);
  return true;
}

// Advance the crates: they fall, and each one is scored where it lands.
export function stepCrates(world, dt) {
  for (const crate of world.crates) {
    if (crate.resolved) continue;
    crate.vy = Math.min(46, crate.vy + 22 * dt);
    crate.y -= crate.vy * dt;
    const ground = groundHeight(crate.x, crate.s);
    if (crate.y <= ground + 1) {
      crate.y = ground + 1;
      crate.resolved = true;
      const state = world.missionState;
      state.cratesResolved += 1;
      let best = null;
      let bestDist = Infinity;
      for (const zone of world.zones) {
        const d = Math.hypot(crate.x - zone.x, crate.s - zone.s);
        if (d < bestDist) {
          bestDist = d;
          best = zone;
        }
      }
      if (best && bestDist <= best.radius && !best.hit) {
        best.hit = true;
        state.zonesHit += 1;
        const points = Math.round(420 - bestDist * 6);
        addScore(state, points, `Crate on target (+${points})`);
        say(state, `ON TARGET! +${points}`, world.flight.time);
      } else {
        say(state, 'CRATE MISSED THE ZONE', world.flight.time);
      }
    }
  }
}

// Check the next ring: passing through its disc scores, in order.
export function checkRings(world) {
  const { flight, rings, missionState } = world;
  if (missionState.mission.id !== 'rings') return;
  const next = rings.find((r) => !r.passed);
  if (!next) return;
  const d = Math.hypot(flight.x - next.x, flight.y - next.y, flight.s - next.s);
  if (d < next.radius * 0.92) {
    next.passed = true;
    missionState.ringsPassed += 1;
    const bonus = Math.round(Math.max(0, flight.speed - 40) * 3);
    addScore(missionState, 250 + bonus, `Ring ${missionState.ringsPassed}/8 (+${250 + bonus})`);
    say(missionState, `RING ${missionState.ringsPassed}/8!`, flight.time, 1.8);
    world.burst = { x: next.x, y: next.y, s: next.s, at: flight.time };
  }
}

// Mission progress text for the HUD banner, and the end conditions.
export function updateMission(world, events) {
  const { flight, missionState } = world;
  const id = missionState.mission.id;
  if (missionState.finished) return;

  // The progress line is always defined, even on the step the sortie ends.
  if (id === 'rings') {
    missionState.progress = `GATES ${missionState.ringsPassed}/8 · SCORE ${missionState.score}`;
  } else if (id === 'landing') {
    missionState.progress = `LAND ON THE RUNWAY · SCORE ${missionState.score}`;
  } else if (id === 'drop') {
    const hits = world.zones.filter((z) => z.hit).length;
    missionState.progress = `ZONES HIT ${hits}/3 · CRATES ${missionState.cratesDropped}/3 · SCORE ${missionState.score}`;
  } else {
    missionState.progress = `DISTANCE ${(flight.distanceFlown / 1000).toFixed(1)} KM · SCORE ${missionState.score}`;
  }

  if (events.crashed) {
    missionState.failed = true;
    missionState.finished = true;
    missionState.finishReason = `Crashed — ${flight.crashReason}. The island keeps its secrets.`;
    return;
  }
  if (flight.fuel <= 0 && flight.onGround) {
    missionState.failed = true;
    missionState.finished = true;
    missionState.finishReason = 'Out of fuel, down in the field. The sortie ends here.';
    return;
  }

  if (id === 'rings') {
    if (missionState.ringsPassed >= 8) {
      const fuelBonus = Math.round(flight.fuel * 4);
      addScore(missionState, fuelBonus, `Fuel remaining (+${fuelBonus})`);
      missionState.finished = true;
      missionState.finishReason = 'All eight rings threaded. A clean run down the valley.';
    }
  } else if (id === 'landing') {
    if (events.touchedDown) {
      const points = Math.round(flight.touchdownQuality * 6);
      addScore(missionState, points, `Touchdown quality ${Math.round(flight.touchdownQuality)}% (+${points})`);
      const fuelBonus = Math.round(flight.fuel * 3);
      addScore(missionState, fuelBonus, `Fuel remaining (+${fuelBonus})`);
      missionState.finished = true;
      missionState.finishReason = 'Wheels on the strip. The island welcomes Elang-7 home.';
    } else if (flight.s > CONFIG.runwayStart + CONFIG.runwayLength + 700) {
      say(missionState, 'PAST THE RUNWAY — GO AROUND AND TRY AGAIN', flight.time, 3);
    }
  } else if (id === 'drop') {
    const hits = world.zones.filter((z) => z.hit).length;
    if (missionState.cratesResolved >= 3) {
      const fuelBonus = Math.round(flight.fuel * 3);
      addScore(missionState, fuelBonus, `Fuel remaining (+${fuelBonus})`);
      missionState.finished = true;
      missionState.finishReason =
        hits === 3 ? 'Every crate home. The villages eat tonight.' : `${hits}/3 zones hit. The island thanks you anyway.`;
    }
  } else {
    if (flight.onGround) {
      missionState.finished = true;
      missionState.finishReason = 'Down safe after a fine wander over the island.';
    }
  }
}
