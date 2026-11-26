// Seeded randomness: the same seed always grows the same island, so a
// screenshot staged from a seed is the same frame every time it is taken.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A small integer hash: stable pseudo-random values on a lattice.
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Smooth value noise over the (x, s) plane, in [0, 1].
export function valueNoise2D(x, s, cell) {
  const gx = Math.floor(x / cell);
  const gs = Math.floor(s / cell);
  const fx = x / cell - gx;
  const fs = s / cell - gs;
  const a = hash2(gx, gs);
  const b = hash2(gx + 1, gs);
  const c = hash2(gx, gs + 1);
  const d = hash2(gx + 1, gs + 1);
  const top = a + (b - a) * smooth(fx);
  const bottom = c + (d - c) * smooth(fx);
  return top + (bottom - top) * smooth(fs);
}

// Fractal noise: a few octaves of value noise, still in roughly [0, 1].
export function fbm2D(x, s) {
  let total = 0;
  let amp = 0.55;
  let cell = 420;
  for (let octave = 0; octave < 4; octave += 1) {
    total += amp * valueNoise2D(x, s, cell);
    amp *= 0.5;
    cell *= 0.45;
  }
  return total;
}

// Pick one item from a list with a seeded roll, for dressing the world.
export function pickSeeded(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}
