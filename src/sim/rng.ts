/**
 * Deterministic PRNG (Mulberry32 + FNV-1a string hash) and 3D Simplex/Value-Gradient Noise
 * Ensures identical procedural planet terrain & weather patterns across runs for a given seed.
 */

export function hashSeed(seedStr: string | number): number {
  const str = String(seedStr);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

export class SeededRNG {
  private state: number;

  constructor(seed: string | number) {
    this.state = hashSeed(seed);
  }

  /** Returns float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns float in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns integer in [min, max] */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}

/**
 * Fast, deterministic 3D Gradient Noise + FBM + Ridged Multifractal for spherical planet generation
 */
export class Noise3D {
  private perm: Uint8Array;
  private grad3: Float32Array;

  constructor(seed: string | number) {
    const rng = new SeededRNG(seed);
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }

    const gradients = [
      1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
      1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
      0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
      1, 1, 0, 0, -1, 1, -1, 1, 0, 0, -1, -1
    ];
    this.grad3 = new Float32Array(gradients);
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number, z: number): number {
    const h = (hash & 15) * 3;
    return this.grad3[h] * x + this.grad3[h + 1] * y + this.grad3[h + 2] * z;
  }

  /** Evaluates 3D Perlin noise in roughly [-1, 1] */
  sample(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);

    const p = this.perm;
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    return this.lerp(
      w,
      this.lerp(
        v,
        this.lerp(u, this.grad(p[AA], x, y, z), this.grad(p[BA], x - 1, y, z)),
        this.lerp(u, this.grad(p[AB], x, y - 1, z), this.grad(p[BB], x - 1, y - 1, z))
      ),
      this.lerp(
        v,
        this.lerp(u, this.grad(p[AA + 1], x, y, z - 1), this.grad(p[BA + 1], x - 1, y, z - 1)),
        this.lerp(u, this.grad(p[AB + 1], x, y - 1, z - 1), this.grad(p[BB + 1], x - 1, y - 1, z - 1))
      )
    );
  }

  /** Fractional Brownian Motion in [-1, 1] */
  fbm(x: number, y: number, z: number, octaves = 5, lacunarity = 2.05, gain = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.sample(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return total / maxValue;
  }

  /** Ridged multifractal noise for sharp mountain ranges & tectonic ridges in [0, 1] */
  ridged(x: number, y: number, z: number, octaves = 4, lacunarity = 2.1, gain = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let weight = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      let signal = 1.0 - Math.abs(this.sample(x * frequency, y * frequency, z * frequency));
      signal *= signal;
      signal *= weight;
      weight = Math.min(1, Math.max(0, signal * 2.0));
      total += signal * amplitude;
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return total / maxValue;
  }
}
