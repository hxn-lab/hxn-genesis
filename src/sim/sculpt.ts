/**
 * Brush-based spherical terrain and cryosphere sculpting engine for HXN GENESIS 3.0.
 *
 * Uses 3D unit-normal dot products on the sphere so all brushes are completely
 * seamless across the ±180° longitude boundary and free of polar singularities.
 */
import { LAPSE_RATE_K_PER_M } from './planetPhysics';
import { craterProfile } from './terrainGen';

export type SculptBrushTool =
  | 'RAISE'
  | 'LOWER'
  | 'SMOOTH'
  | 'FLATTEN'
  | 'MOUNTAIN_RANGE'
  | 'CARVE_BASIN'
  | 'CRATER'
  | 'PAINT_OCEAN'
  | 'PAINT_LAND'
  | 'ADD_ICE'
  | 'REMOVE_ICE'
  | 'RESTORE';

export type BrushFalloff = 'SMOOTH' | 'LINEAR' | 'CONSTANT';
export type BrushShape = 'CIRCLE' | 'RING' | 'RIDGE';
export type BrushSymmetry = 'NONE' | 'LONGITUDE_MIRROR' | 'EQUATOR_MIRROR';

export interface SculptBrushOptions {
  tool: SculptBrushTool;
  latDeg: number;
  lonDeg: number;
  /** Angular radius in radians [0.02, 0.8] */
  radiusRad: number;
  /** Normalised brush intensity [0.05, 1.0] */
  strength: number;
  falloff?: BrushFalloff;
  shape?: BrushShape;
  symmetry?: BrushSymmetry;
  /** Optional ridge azimuth in radians for RIDGE shape */
  azimuthRad?: number;
}

export interface SculptTargetArrays {
  gridWidth: number;
  gridHeight: number;
  numCells: number;
  cellNx: Float32Array;
  cellNy: Float32Array;
  cellNz: Float32Array;
  elevation: Float32Array;
  baseElevation: Float32Array;
  generatedElevation: Float32Array;
  iceThickness: Float32Array;
  temperature: Float32Array;
  seaLevelMeters: number;
  terrainScale: number;
}

export function evaluateFalloff(t: number, falloff: BrushFalloff, shape: BrushShape): number {
  if (t > 1) return 0;
  if (shape === 'RING') {
    return Math.exp(-Math.pow((t - 0.72) / 0.22, 2));
  }
  if (falloff === 'CONSTANT') return 1;
  if (falloff === 'LINEAR') return Math.max(0, 1 - t);
  // SMOOTH cosine bell
  return 0.5 * (1 + Math.cos(Math.PI * t));
}

function strokeCenters(latDeg: number, lonDeg: number, symmetry: BrushSymmetry): Array<{ latDeg: number; lonDeg: number }> {
  const pts = [{ latDeg, lonDeg }];
  if (symmetry === 'LONGITUDE_MIRROR') {
    const mirrorLon = -lonDeg;
    if (Math.abs(mirrorLon - lonDeg) > 1e-3) {
      pts.push({ latDeg, lonDeg: mirrorLon });
    }
  } else if (symmetry === 'EQUATOR_MIRROR') {
    if (Math.abs(latDeg) > 1e-3) {
      pts.push({ latDeg: -latDeg, lonDeg });
    }
  }
  return pts;
}

/**
 * Applies a deterministic spherical brush stroke to `target`.
 */
export function applySculptBrush(target: SculptTargetArrays, opts: SculptBrushOptions): void {
  const falloffMode: BrushFalloff = opts.falloff ?? 'SMOOTH';
  const shapeMode: BrushShape = opts.shape ?? 'CIRCLE';
  const symmetryMode: BrushSymmetry = opts.symmetry ?? 'NONE';
  const radiusRad = Math.max(0.02, Math.min(0.85, opts.radiusRad));
  const strength = Math.max(0.05, Math.min(1.0, opts.strength));
  const azimuth = opts.azimuthRad ?? 0.45;

  const centers = strokeCenters(opts.latDeg, opts.lonDeg, symmetryMode);

  // Pre-snapshot elevation for SMOOTH / FLATTEN so order of cell traversal never biases the result
  const elevSnapshot =
    opts.tool === 'SMOOTH' || opts.tool === 'FLATTEN' ? new Float32Array(target.elevation) : null;

  for (const c of centers) {
    const lat = (c.latDeg * Math.PI) / 180;
    const lon = (c.lonDeg * Math.PI) / 180;
    const tx = Math.cos(lat) * Math.cos(lon);
    const ty = Math.sin(lat);
    const tz = Math.cos(lat) * Math.sin(lon);

    // Local tangent basis (east, north) for anisotropic RIDGE shape
    const eastX = -Math.sin(lon);
    const eastY = 0;
    const eastZ = Math.cos(lon);
    const northX = -Math.sin(lat) * Math.cos(lon);
    const northY = Math.cos(lat);
    const northZ = -Math.sin(lat) * Math.sin(lon);
    const dirCos = Math.cos(azimuth);
    const dirSin = Math.sin(azimuth);

    const effectiveOuterRad = opts.tool === 'CRATER' ? radiusRad * 1.8 : radiusRad;
    const cosOuter = Math.cos(Math.min(Math.PI, effectiveOuterRad));

    // Compute target flatten elevation at stroke center if FLATTEN
    let flattenElev = target.seaLevelMeters;
    if (opts.tool === 'FLATTEN' && elevSnapshot) {
      let bestDot = -2;
      for (let i = 0; i < target.numCells; i++) {
        const d = target.cellNx[i] * tx + target.cellNy[i] * ty + target.cellNz[i] * tz;
        if (d > bestDot) {
          bestDot = d;
          flattenElev = elevSnapshot[i];
        }
      }
    }

    for (let i = 0; i < target.numCells; i++) {
      const nx = target.cellNx[i];
      const ny = target.cellNy[i];
      const nz = target.cellNz[i];
      const dot = nx * tx + ny * ty + nz * tz;
      if (dot <= cosOuter) continue;

      const distRad = Math.acos(Math.min(1, Math.max(-1, dot)));
      let normDist = distRad / radiusRad;

      if (shapeMode === 'RIDGE') {
        const dx = nx - tx;
        const dy = ny - ty;
        const dz = nz - tz;
        const localE = dx * eastX + dy * eastY + dz * eastZ;
        const localN = dx * northX + dy * northY + dz * northZ;
        const along = localE * dirCos + localN * dirSin;
        const across = -localE * dirSin + localN * dirCos;
        normDist = Math.hypot(along / radiusRad, (across / radiusRad) * 2.6);
      }

      if (opts.tool !== 'CRATER' && normDist > 1) continue;

      const weight = evaluateFalloff(Math.min(1, normDist), falloffMode, shapeMode) * strength;
      const oldElev = target.elevation[i];
      let newElev = oldElev;

      switch (opts.tool) {
        case 'RAISE':
          newElev = oldElev + 1400 * weight;
          break;
        case 'LOWER':
          newElev = oldElev - 1400 * weight;
          break;
        case 'MOUNTAIN_RANGE': {
          const ridgePeak = Math.pow(Math.max(0, 1 - normDist), 1.5);
          newElev = oldElev + 2400 * strength * ridgePeak;
          break;
        }
        case 'CARVE_BASIN':
          newElev = oldElev - 2100 * weight;
          break;
        case 'CRATER': {
          const prof = craterProfile(distRad / radiusRad);
          newElev = oldElev + 2000 * strength * prof;
          break;
        }
        case 'PAINT_OCEAN': {
          const targetOceanFloor = target.seaLevelMeters - 1600 * strength;
          if (oldElev > targetOceanFloor) {
            newElev = oldElev + (targetOceanFloor - oldElev) * Math.min(1, weight * 1.15);
          }
          break;
        }
        case 'PAINT_LAND': {
          const targetLandHeight = target.seaLevelMeters + 650 * strength;
          if (oldElev < targetLandHeight) {
            newElev = oldElev + (targetLandHeight - oldElev) * Math.min(1, weight * 1.15);
          }
          break;
        }
        case 'FLATTEN':
          newElev = oldElev + (flattenElev - oldElev) * Math.min(1, weight * 0.85);
          break;
        case 'SMOOTH': {
          if (elevSnapshot) {
            const gw = target.gridWidth;
            const gh = target.gridHeight;
            const y = Math.floor(i / gw);
            const x = i % gw;
            const yN = Math.max(0, y - 1);
            const yS = Math.min(gh - 1, y + 1);
            const xW = (x - 1 + gw) % gw;
            const xE = (x + 1) % gw;
            const avg =
              0.2 *
              (elevSnapshot[i] +
                elevSnapshot[yN * gw + x] +
                elevSnapshot[yS * gw + x] +
                elevSnapshot[y * gw + xW] +
                elevSnapshot[y * gw + xE]);
            newElev = oldElev + (avg - oldElev) * Math.min(1, weight * 0.9);
          }
          break;
        }
        case 'ADD_ICE':
          target.iceThickness[i] = Math.min(3800, target.iceThickness[i] + 450 * weight);
          break;
        case 'REMOVE_ICE':
          target.iceThickness[i] = Math.max(0, target.iceThickness[i] - 600 * weight);
          break;
        case 'RESTORE': {
          const pristine = target.generatedElevation[i] * target.terrainScale;
          newElev = oldElev + (pristine - oldElev) * Math.min(1, weight);
          break;
        }
      }

      if (newElev !== oldElev) {
        const clamped = Math.max(-11000, Math.min(12000, newElev));
        const delta = clamped - oldElev;
        target.elevation[i] = clamped;
        target.baseElevation[i] = clamped / Math.max(0.1, target.terrainScale);
        if (clamped > target.seaLevelMeters) {
          target.temperature[i] -= delta * LAPSE_RATE_K_PER_M * 0.5;
        }
      }
    }
  }
}
