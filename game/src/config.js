// MERAPI VECTOR (ELANG-7) — Volcano Chase Flight: tuning constants
// and the game's one visual style.
// Everything here is a plain number or colour so the rest of the code reads
// like the thing it does. Units: metres, seconds, radians, kilograms of fuel
// are abstract "units" the HUD shows as percent.
export const CONFIG = {
  // World: one island chain running north (+s), sea at y = 0.
  seaLevel: 0,
  worldSeed: 20261126,
  terrainAmplitude: 210,
  terrainBase: 55,
  // The airstrip lives on a flat shelf carved into the island.
  runwayStart: 5200,
  runwayLength: 900,
  runwayHalfWidth: 16,
  runwayHeading: 0,
  // Aircraft limits. Speeds are m/s; the HUD shows knots (1 m/s = 1.944 kt).
  minSpeed: 26,
  cruiseSpeed: 58,
  maxSpeed: 98,
  stallSpeed: 30,
  maxPitch: 0.42,
  maxBank: 1.05,
  pitchRate: 1.5,
  bankRate: 2.4,
  levelRate: 1.1,
  turnAuthority: 1.35,
  climbAuthority: 1.15,
  gearHeight: 2.2,
  // Fuel and damage: full throttle is fast and thirsty; gentle flying goes far.
  fuelCapacity: 100,
  fuelBurnIdle: 0.3,
  fuelBurnFull: 1.3,
  damageCrashThreshold: 100,
  // Rings, drops and scoring.
  ringRadius: 26,
  dropZoneRadius: 30,
  // Camera and view.
  fovVertical: 1.05,
  cameraHeight: 7.5,
  cameraBack: 16,
  horizonFraction: 0.44,
  // Palette: one golden-morning style across sky, terrain and the aircraft.
  palette: {
    skyTop: '#3f7fd4',
    skyMid: '#8fc4ef',
    skyHorizon: '#ffd9a0',
    sunCore: '#fff6d8',
    sunGlow: 'rgba(255, 214, 130, 0.55)',
    mountainFar: '#7d8fb8',
    mountainNear: '#5d7396',
    volcanoRock: '#7d6248',
    volcanoShade: '#5f5044',
    volcanoAsh: '#c9bba6',
    ashRock: '#776b5e',
    ashLight: '#97897a',
    grassLow: '#69a84f',
    grassHigh: '#4d8a44',
    forest: '#2f6b3a',
    rock: '#8a7a68',
    snow: '#f2f4f6',
    sand: '#e0c896',
    waterDeep: '#2b6cb0',
    waterShallow: '#63a4d6',
    fieldA: '#c9a959',
    fieldB: '#9db36a',
    runway: '#565b63',
    runwayEdge: '#f5f1e6',
    ring: '#ffb02e',
    ringGlow: 'rgba(255, 176, 46, 0.5)',
    aircraftCream: '#f6ead2',
    aircraftRed: '#c8442c',
    aircraftDark: '#3a3f46',
    glass: '#9fd8e8',
    hudGlass: 'rgba(10, 22, 34, 0.62)',
    hudGlassEdge: 'rgba(180, 230, 255, 0.5)',
    hudText: '#eaf7ff',
    hudAmber: '#ffc857',
    hudDanger: '#ff5a4e',
    hudGreen: '#7be495',
  },
  // Keys. Arrows and WASD steer; Shift/Ctrl work the throttle; Space acts.
  keys: {
    pitchUp: ['ArrowUp', 'KeyW'],
    pitchDown: ['ArrowDown', 'KeyS'],
    rollLeft: ['ArrowLeft', 'KeyA'],
    rollRight: ['ArrowRight', 'KeyD'],
    throttleUp: ['ShiftLeft', 'ShiftRight', 'PageUp'],
    throttleDown: ['ControlLeft', 'ControlRight', 'PageDown'],
    action: ['Space'],
    pause: ['KeyP', 'Escape'],
    mute: ['KeyM'],
    confirm: ['Enter'],
    restart: ['KeyR'],
  },
};

// Knots shown on the instruments, from the metres-per-second the model uses.
export function toKnots(ms) {
  return Math.round(ms * 1.944);
}

// Feet shown on the altimeter, from the metres the model uses.
export function toFeet(m) {
  return Math.round(m * 3.281);
}
