/**
 * Simplified Geology & Planetary Interior model for HXN GENESIS 3.0.
 *
 * Models internal heat, crust thickness, mantle convection activity, tectonic
 * boundary uplift/rifting (via a deterministic spherical Voronoi plate field),
 * volcanic outgassing, and cumulative impact crater count.
 *
 * Explicit scientific limitation: tectonic plates apply vertical boundary uplift
 * (orogeny) and rift subsidence in place; full horizontal continent advection
 * (Wilson cycle drift across the grid) is not simulated.
 */
import { SeededRNG } from './rng';
import { CellGeometry } from './terrainGen';

export interface GeologyParameters {
  /** Planetary internal radiogenic + primordial heat multiplier [0.1, 3.0] */
  internalHeat: number;
  /** Mean continental/oceanic crust thickness in km [5, 80] */
  crustThicknessKm: number;
  /** Mantle plume & convection activity [0.0, 3.0] */
  mantleActivity: number;
  /** Plate boundary tectonic uplift & rifting rate [0.0, 3.0] */
  tectonicActivity: number;
  /** Mean crustal age in Gyr [0.0, 10.0] */
  crustalAgeGyr: number;
  /** Cumulative major bolide / meteor impact count */
  impactCount: number;
}

export function createDefaultGeologyParameters(): GeologyParameters {
  return {
    internalHeat: 1.0,
    crustThicknessKm: 35,
    mantleActivity: 1.0,
    tectonicActivity: 1.0,
    crustalAgeGyr: 4.5,
    impactCount: 0
  };
}

export function validateGeologyParameters(input?: Partial<GeologyParameters> | null): GeologyParameters {
  const d = createDefaultGeologyParameters();
  const g = { ...d, ...(input || {}) };
  const clamp = (v: number, min: number, max: number) =>
    Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
  return {
    internalHeat: clamp(Number(g.internalHeat), 0.1, 3.0),
    crustThicknessKm: clamp(Number(g.crustThicknessKm), 5, 80),
    mantleActivity: clamp(Number(g.mantleActivity), 0, 3.0),
    tectonicActivity: clamp(Number(g.tectonicActivity), 0, 3.0),
    crustalAgeGyr: clamp(Number(g.crustalAgeGyr), 0, 10.0),
    impactCount: Math.max(0, Math.round(Number(g.impactCount) || 0))
  };
}

/**
 * Computes a deterministic tectonic boundary forcing field in [-1, +1] for each cell:
 * positive along convergent mountain-building sutures, negative along divergent rifts.
 */
export function computeTectonicBoundaryField(
  seed: string,
  geo: CellGeometry,
  plateCount = 9
): Float32Array {
  const rng = new SeededRNG(`${seed}-tectonic-plates`);
  const count = Math.max(4, Math.min(18, plateCount));
  const centers: Array<{ x: number; y: number; z: number; polarity: number }> = [];

  for (let p = 0; p < count; p++) {
    const z = rng.range(-1, 1);
    const t = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    centers.push({
      x: r * Math.cos(t),
      y: z,
      z: r * Math.sin(t),
      polarity: rng.next() < 0.62 ? 1 : -1 // 62% convergent, 38% divergent rift
    });
  }

  const out = new Float32Array(geo.numCells);
  for (let i = 0; i < geo.numCells; i++) {
    const nx = geo.cellNx[i];
    const ny = geo.cellNy[i];
    const nz = geo.cellNz[i];
    let best1 = -2;
    let best2 = -2;
    let p1 = 0;
    let p2 = 0;

    for (let p = 0; p < count; p++) {
      const c = centers[p];
      const dot = nx * c.x + ny * c.y + nz * c.z;
      if (dot > best1) {
        best2 = best1;
        p2 = p1;
        best1 = dot;
        p1 = p;
      } else if (dot > best2) {
        best2 = dot;
        p2 = p;
      }
    }

    const gap = Math.max(0, best1 - best2);
    const boundaryWeight = Math.exp(-gap / 0.045);
    const sign = centers[p1].polarity * centers[p2].polarity >= 0 ? 1 : -0.85;
    out[i] = boundaryWeight * sign;
  }

  return out;
}

/**
 * Applies a tectonic pulse (orogeny + rifting + volcanic CO₂ outgassing) to the crust.
 */
export function applyTectonicPulse(
  boundaryField: Float32Array,
  geology: GeologyParameters,
  elevation: Float32Array,
  baseElevation: Float32Array,
  terrainScale: number,
  impulseScale = 1.0
): { meanAbsDeltaMeters: number; co2OutgassedPpm: number } {
  const thicknessFactor = 35 / Math.max(10, geology.crustThicknessKm);
  const strength =
    geology.tectonicActivity *
    (0.5 + 0.5 * geology.mantleActivity) *
    (0.5 + 0.5 * geology.internalHeat) *
    thicknessFactor *
    impulseScale;

  let sumAbs = 0;
  const n = elevation.length;
  for (let i = 0; i < n; i++) {
    const delta = boundaryField[i] * 550 * strength;
    elevation[i] = Math.max(-11000, Math.min(12000, elevation[i] + delta));
    baseElevation[i] = elevation[i] / Math.max(0.1, terrainScale);
    sumAbs += Math.abs(delta);
  }

  const co2OutgassedPpm = Math.round(35 * geology.internalHeat * geology.mantleActivity * impulseScale);
  return {
    meanAbsDeltaMeters: n > 0 ? sumAbs / n : 0,
    co2OutgassedPpm
  };
}
