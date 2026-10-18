/**
 * Procedural terrain generation for HXN GENESIS.
 *
 * All styles are deterministic functions of (seed, settings, cell normals). The
 * default `EARTH_CONTINENTS` style with neutral settings reproduces the original
 * v1–v2 generator bit-for-bit so existing seeds and saves keep their terrain.
 */
import { Noise3D, SeededRNG } from './rng';

export type TerrainStyle =
  | 'EARTH_CONTINENTS'
  | 'ARCHIPELAGO'
  | 'SUPERCONTINENT'
  | 'OCEAN_PLANET'
  | 'DESERT_PLANET'
  | 'ICE_WORLD'
  | 'VOLCANIC_WORLD'
  | 'CRATERED_WORLD'
  | 'ALIEN'
  | 'CUSTOM';

export const TERRAIN_STYLES: TerrainStyle[] = [
  'EARTH_CONTINENTS',
  'ARCHIPELAGO',
  'SUPERCONTINENT',
  'OCEAN_PLANET',
  'DESERT_PLANET',
  'ICE_WORLD',
  'VOLCANIC_WORLD',
  'CRATERED_WORLD',
  'ALIEN',
  'CUSTOM'
];

export interface TerrainSettings {
  style: TerrainStyle;
  /** Fine-scale relief multiplier [0, 2] */
  roughness: number;
  /** Mountain-belt height multiplier [0, 2] */
  mountainHeight: number;
  /** Continent feature size multiplier [0.5, 2] — larger = bigger continents */
  continentScale: number;
  /** Impact crater density [0, 1] */
  craterDensity: number;
  /** High-frequency detail scale multiplier [0.5, 2] */
  detailScale: number;
  /** Plateau / terracing strength [0, 1] */
  plateaus: number;
}

export const TERRAIN_SETTING_RANGES = {
  roughness: { min: 0, max: 2 },
  mountainHeight: { min: 0, max: 2 },
  continentScale: { min: 0.5, max: 2 },
  craterDensity: { min: 0, max: 1 },
  detailScale: { min: 0.5, max: 2 },
  plateaus: { min: 0, max: 1 }
} as const;

export function createDefaultTerrainSettings(style: TerrainStyle = 'EARTH_CONTINENTS'): TerrainSettings {
  const base: TerrainSettings = {
    style,
    roughness: 1,
    mountainHeight: 1,
    continentScale: 1,
    craterDensity: 0,
    detailScale: 1,
    plateaus: 0
  };
  if (style === 'CRATERED_WORLD') base.craterDensity = 0.85;
  if (style === 'VOLCANIC_WORLD') base.mountainHeight = 1.25;
  if (style === 'ALIEN') base.plateaus = 0.6;
  return base;
}

/** Suggested ocean coverage applied when a style is picked in the wizard. */
export const STYLE_OCEAN_COVERAGE: Record<TerrainStyle, number> = {
  EARTH_CONTINENTS: 0.68,
  ARCHIPELAGO: 0.82,
  SUPERCONTINENT: 0.62,
  OCEAN_PLANET: 0.96,
  DESERT_PLANET: 0.12,
  ICE_WORLD: 0.55,
  VOLCANIC_WORLD: 0.45,
  CRATERED_WORLD: 0.05,
  ALIEN: 0.5,
  CUSTOM: 0.65
};

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function validateTerrainSettings(input: Partial<TerrainSettings> | undefined | null): TerrainSettings {
  const style: TerrainStyle =
    input?.style && TERRAIN_STYLES.includes(input.style) ? input.style : 'EARTH_CONTINENTS';
  const d = createDefaultTerrainSettings(style);
  const s = { ...d, ...(input || {}), style };
  const r = TERRAIN_SETTING_RANGES;
  return {
    style,
    roughness: clamp(Number(s.roughness), r.roughness.min, r.roughness.max),
    mountainHeight: clamp(Number(s.mountainHeight), r.mountainHeight.min, r.mountainHeight.max),
    continentScale: clamp(Number(s.continentScale), r.continentScale.min, r.continentScale.max),
    craterDensity: clamp(Number(s.craterDensity), r.craterDensity.min, r.craterDensity.max),
    detailScale: clamp(Number(s.detailScale), r.detailScale.min, r.detailScale.max),
    plateaus: clamp(Number(s.plateaus), r.plateaus.min, r.plateaus.max)
  };
}

/**
 * Normalised crater profile for distance ratio t = d / r (t ≥ 0):
 * a parabolic bowl (−1 at the centre) with a raised rim near t = 1.
 */
export function craterProfile(t: number): number {
  if (t > 1.8) return 0;
  const bowl = t < 1 ? -(1 - t * t) : 0;
  const rim = 0.32 * Math.exp(-Math.pow((t - 1) / 0.28, 2));
  return bowl + rim;
}

export interface CellGeometry {
  numCells: number;
  cellNx: Float32Array;
  cellNy: Float32Array;
  cellNz: Float32Array;
}

/**
 * Writes procedural base elevation (metres, before global terrain scale) into `out`.
 */
export function generateTerrain(
  seed: string,
  settingsIn: TerrainSettings,
  geo: CellGeometry,
  out: Float32Array
): void {
  const s = validateTerrainSettings(settingsIn);
  const noiseContinent = new Noise3D(`${seed}-continent`);
  const noiseRidges = new Noise3D(`${seed}-ridges`);
  const noiseDetail = new Noise3D(`${seed}-detail`);
  const noiseWarp = s.style === 'ALIEN' ? new Noise3D(`${seed}-warp`) : null;

  // Seeded large-scale bias direction (supercontinent / desert basins)
  const dirRng = new SeededRNG(`${seed}-bias`);
  const bz = dirRng.range(-1, 1);
  const bt = dirRng.range(0, Math.PI * 2);
  const br = Math.sqrt(Math.max(0, 1 - bz * bz));
  const bias = { x: br * Math.cos(bt), y: bz, z: br * Math.sin(bt) };

  const contFreq = 1.45 / s.continentScale * (s.style === 'ARCHIPELAGO' ? 2.3 : 1);
  const ridgeFreq = 2.6;
  const detailFreq = 6.5 * s.detailScale;

  for (let i = 0; i < geo.numCells; i++) {
    let nx = geo.cellNx[i];
    let ny = geo.cellNy[i];
    let nz = geo.cellNz[i];

    if (noiseWarp) {
      const w = 0.45;
      const wx = noiseWarp.fbm(nx * 2.1 + 3.1, ny * 2.1, nz * 2.1, 3, 2.0, 0.5);
      const wy = noiseWarp.fbm(nx * 2.1, ny * 2.1 + 7.7, nz * 2.1, 3, 2.0, 0.5);
      const wz = noiseWarp.fbm(nx * 2.1, ny * 2.1, nz * 2.1 + 1.3, 3, 2.0, 0.5);
      nx += wx * w;
      ny += wy * w;
      nz += wz * w;
    }

    const cont = noiseContinent.fbm(nx * contFreq, ny * contFreq, nz * contFreq, 5, 2.02, 0.52);
    const ridge = noiseRidges.ridged(nx * ridgeFreq, ny * ridgeFreq, nz * ridgeFreq, 4, 2.15, 0.5);
    const detail = noiseDetail.fbm(nx * detailFreq, ny * detailFreq, nz * detailFreq, 4, 2.1, 0.48);

    let elev = cont * 4200;
    switch (s.style) {
      case 'ARCHIPELAGO':
        elev -= 900;
        break;
      case 'SUPERCONTINENT': {
        const d = geo.cellNx[i] * bias.x + geo.cellNy[i] * bias.y + geo.cellNz[i] * bias.z;
        elev = elev * 0.55 + (d - 0.15) * 4200;
        break;
      }
      case 'OCEAN_PLANET':
        elev = elev * 0.6 - 2400;
        break;
      case 'DESERT_PLANET':
        elev = Math.abs(elev) * 0.6 + 400;
        break;
      case 'ICE_WORLD':
        elev *= 1.05;
        break;
      case 'CRATERED_WORLD':
        elev *= 0.35;
        break;
      default:
        break;
    }

    if (elev > -400) {
      const landWeight = Math.min(1, (elev + 400) / 1800);
      elev += Math.pow(ridge, 1.7) * 4400 * landWeight * s.mountainHeight;
    } else {
      elev -= (1.0 - ridge) * 1800;
    }
    elev += detail * 650 * s.roughness;

    if (s.plateaus > 0) {
      const step = 900;
      const terraced = Math.round(elev / step) * step;
      elev = elev * (1 - s.plateaus) + terraced * s.plateaus;
    }

    out[i] = elev;
  }

  if (s.style === 'VOLCANIC_WORLD') {
    addVolcanoes(seed, geo, out, 22);
  }
  if (s.craterDensity > 0) {
    addCraters(seed, geo, out, Math.round(s.craterDensity * 140));
  }
}

function randomUnitVector(rng: SeededRNG): { x: number; y: number; z: number } {
  const z = rng.range(-1, 1);
  const t = rng.range(0, Math.PI * 2);
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return { x: r * Math.cos(t), y: z, z: r * Math.sin(t) };
}

function addCraters(seed: string, geo: CellGeometry, out: Float32Array, count: number): void {
  const rng = new SeededRNG(`${seed}-craters`);
  for (let c = 0; c < count; c++) {
    const v = randomUnitVector(rng);
    const radius = rng.range(0.025, 0.16);
    const depth = rng.range(600, 2600) * (radius / 0.1);
    const cosOuter = Math.cos(radius * 1.8);
    for (let i = 0; i < geo.numCells; i++) {
      const dot = geo.cellNx[i] * v.x + geo.cellNy[i] * v.y + geo.cellNz[i] * v.z;
      if (dot > cosOuter) {
        const d = Math.acos(Math.min(1, dot));
        out[i] += depth * craterProfile(d / radius);
      }
    }
  }
}

function addVolcanoes(seed: string, geo: CellGeometry, out: Float32Array, count: number): void {
  const rng = new SeededRNG(`${seed}-volcanoes`);
  for (let c = 0; c < count; c++) {
    const v = randomUnitVector(rng);
    const radius = rng.range(0.05, 0.14);
    const height = rng.range(1800, 5200);
    const cosR = Math.cos(radius * 1.6);
    for (let i = 0; i < geo.numCells; i++) {
      const dot = geo.cellNx[i] * v.x + geo.cellNy[i] * v.y + geo.cellNz[i] * v.z;
      if (dot > cosR) {
        const t = Math.acos(Math.min(1, dot)) / radius;
        const cone = Math.exp(-t * t * 1.6);
        const caldera = t < 0.18 ? -0.25 * (1 - t / 0.18) : 0;
        out[i] += height * (cone + caldera);
      }
    }
  }
}

/**
 * Returns the effective sea level (m) that floods the requested area fraction of the
 * planet, using cos(latitude) area weights. `fraction` is clamped to [0, 1].
 */
export function seaLevelForOceanFraction(
  elevation: Float32Array,
  areaWeights: Float32Array,
  fraction: number
): number {
  const n = elevation.length;
  const f = clamp(fraction, 0, 1);
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  order.sort((a, b) => elevation[a] - elevation[b]);

  let total = 0;
  for (let i = 0; i < n; i++) total += areaWeights[i];
  if (f <= 0) return elevation[order[0]] - 1;
  if (f >= 1) return elevation[order[n - 1]] + 1;

  const target = f * total;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    acc += areaWeights[order[k]];
    if (acc >= target) {
      const lo = elevation[order[k]];
      const hi = k + 1 < n ? elevation[order[k + 1]] : lo + 1;
      return (lo + hi) / 2;
    }
  }
  return elevation[order[n - 1]] + 1;
}
