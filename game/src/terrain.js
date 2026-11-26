// The island: heightfield terrain, the airstrip shelf, ring gates, drop
// zones and the clouds. All of it is grown from the seeded noise in
// random.js, so the world is the same on every run of the same seed.
import { CONFIG } from './config.js';
import { fbm2D, mulberry32, valueNoise2D } from './random.js';

// The river's centreline at track position s: the valley the ring course
// follows, so gates sit over low ground and the line between them flies.
export function riverXAt(s) {
  return Math.sin(s * 0.0016) * 90 + Math.sin(s * 0.00043 + 2.1) * 60;
}

// Height of the ground at world (x, s), in metres above the sea.
export function groundHeight(x, s) {
  const { terrainBase, terrainAmplitude, runwayStart, runwayLength, runwayHalfWidth } = CONFIG;
  // The island rises out of the sea along the track and falls away sideways.
  const along = Math.min(1, Math.max(0, s / 1400));
  const falloff = Math.max(0, 1 - Math.abs(x) / 620);
  let h = terrainBase * along + terrainAmplitude * fbm2D(x * 0.6 + 40, s * 0.6) * falloff;
  // A river valley winds down the middle: low, flat ground the rings follow.
  const riverX = riverXAt(s);
  const riverD = Math.abs(x - riverX);
  if (riverD < 70) h = Math.min(h, 14 + riverD * 0.35);
  // The approach corridor: the valley opens out toward the airstrip so the
  // runway reads clearly from final approach, mountains rising beyond it.
  const corridorS = smoothWindow(s, runwayStart - 2300, runwayStart - 900, runwayStart + 1500, runwayStart + 2300);
  const corridorX = 1 - smoothWindow(Math.abs(x), 240, 320, 520, 640);
  const corridorWeight = corridorS * corridorX;
  if (corridorWeight > 0) {
    const corridorH = 62 + Math.max(0, (Math.abs(x) - 40) / 260) * 90;
    h = h * (1 - corridorWeight) + Math.min(h, corridorH) * corridorWeight;
  }
  // The airstrip shelf: flat ground, exactly level, for the runway.
  if (s > runwayStart - 160 && s < runwayStart + runwayLength + 160 && Math.abs(x) < runwayHalfWidth + 40) {
    const edge = Math.min(1, Math.min(Math.abs(x) - runwayHalfWidth, 40) / 40);
    const shelf = 62;
    h = shelf * (1 - Math.max(0, edge)) + h * Math.max(0, edge);
    if (Math.abs(x) <= runwayHalfWidth + 6 && s > runwayStart - 40 && s < runwayStart + runwayLength + 40) h = shelf;
  }
  // The sea: past the island's flanks the ground sinks below the water.
  const sea = smoothWindow(Math.abs(x), 430, 520, 900, 1100);
  h = h * (1 - sea) + -8 * sea;
  if (h < -8) h = -8;
  return h;
}

// 1 inside [a, b], feathering to 0 at the outer edges. Used for the
// corridor and the sea so neither has a hard cliff at its boundary.
function smoothWindow(v, a, b, c, d) {
  if (v <= a || v >= d) return 0;
  if (v >= b && v <= c) return 1;
  if (v < b) return (v - a) / (b - a);
  return (d - v) / (d - c);
}

// True when the point is on the runway pavement.
export function onRunway(x, s) {
  const { runwayStart, runwayLength, runwayHalfWidth } = CONFIG;
  return s >= runwayStart && s <= runwayStart + runwayLength && Math.abs(x) <= runwayHalfWidth;
}

// True when the point is on the flat shelf around the runway.
export function onRunwayShelf(x, s) {
  const { runwayStart, runwayLength, runwayHalfWidth } = CONFIG;
  return (
    s >= runwayStart - 60 &&
    s <= runwayStart + runwayLength + 60 &&
    Math.abs(x) <= runwayHalfWidth + 26
  );
}

// Colour of the ground at (x, s, h): grass, forest, rock, snow, sand, fields.
export function groundColorRGB(x, s, h, palette) {
  const n = valueNoise2D(x * 1.7 + 900, s * 1.7, 90);
  const field = valueNoise2D(x * 0.35 + 31, s * 0.35, 260);
  let hex;
  if (h < 2) hex = n > 0.5 ? palette.waterShallow : palette.waterDeep;
  else if (h < 7) hex = palette.sand;
  else if (field > 0.62 && h < 90 && Math.abs(x) < 420) hex = n > 0.5 ? palette.fieldA : palette.fieldB;
  else if (h > 205) hex = palette.snow;
  else if (h > 150) hex = palette.rock;
  else if (n > 0.58) hex = palette.forest;
  else hex = n > 0.3 ? palette.grassLow : palette.grassHigh;
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

export function groundColor(x, s, h, palette) {
  const rgb = groundColorRGB(x, s, h, palette);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

// A camera: position, heading and pitch, and the project() that turns a
// world point into screen pixels for the chase view.
export function makeCamera() {
  return { x: 0, y: 90, s: 0, heading: 0, pitch: 0, roll: 0 };
}

// Project world (x, y, s) into screen space. Returns null behind the camera.
export function project(camera, x, y, s, width, height, focal) {
  const dx = x - camera.x;
  const dy = y - camera.y;
  const ds = s - camera.s;
  const sinH = Math.sin(camera.heading);
  const cosH = Math.cos(camera.heading);
  const depth = ds * cosH + dx * sinH;
  if (depth < 2) return null;
  const lateral = dx * cosH - ds * sinH;
  const sx = width / 2 + (lateral * focal) / depth;
  const sy = height * CONFIG.horizonFraction - ((dy - camera.pitch * depth) * focal) / depth;
  return { x: sx, y: sy, depth, scale: focal / depth };
}

// Focal length in pixels for a canvas of this height and the game's FOV.
export function focalLength(height) {
  return height / 2 / Math.tan(CONFIG.fovVertical / 2);
}

// The ring gates of the ring course: a winding line of glowing rings the
// pilot threads in order. Positions are fixed by seed, never random per run.
export function buildRings() {
  const rings = [];
  const rng = mulberry32(CONFIG.worldSeed + 7);
  let s = 700;
  for (let i = 0; i < 8; i += 1) {
    // Gates hug the river valley, wandering a little either side of its
    // centreline, so the line from one gate to the next stays over low
    // ground a pilot can actually fly.
    const x = riverXAt(s) + (rng() - 0.5) * 70;
    const y = groundHeight(x, s) + 55 + rng() * 30;
    rings.push({ x, y, s, radius: CONFIG.ringRadius, passed: false, index: i });
    s += 620 + rng() * 260;
  }
  return rings;
}

// The drop zones of the supply mission: painted circles on flat ground.
export function buildDropZones() {
  const zones = [];
  const spots = [
    { x: -120, s: 2400 },
    { x: 140, s: 3900 },
    { x: -60, s: 5200 },
  ];
  for (const spot of spots) {
    zones.push({
      x: spot.x,
      s: spot.s,
      y: groundHeight(spot.x, spot.s),
      radius: CONFIG.dropZoneRadius,
      hit: false,
    });
  }
  return zones;
}

// Clouds: soft billboards floating over the island, placed by seed.
export function buildClouds() {
  const rng = mulberry32(CONFIG.worldSeed + 21);
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: (rng() - 0.5) * 900,
      y: 230 + rng() * 150,
      s: 300 + rng() * 7800,
      size: 50 + rng() * 70,
      puff: 0.6 + rng() * 0.7,
    });
  }
  return clouds;
}
