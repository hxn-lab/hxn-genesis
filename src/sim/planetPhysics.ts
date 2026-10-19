/**
 * Planet physical properties for the HXN GENESIS creator.
 *
 * Internal unit system: SI for derived quantities (m/s², km/s, g/cm³), with
 * user-facing inputs in Earth-relative or astronomical units (km, Earth masses,
 * hours, AU, Gyr). Every field is tagged with how it influences the model so the
 * UI never presents a decorative value as if it were simulated.
 */

export type StarType = 'M' | 'K' | 'G' | 'F';

export interface PlanetProperties {
  name: string;
  description: string;
  radiusKm: number;
  massEarth: number;
  rotationHours: number;
  orbitalDistanceAU: number;
  eccentricity: number;
  starType: StarType;
  systemAgeGyr: number;
  moonCount: number;
  /** Optional artistic gravity override (m/s²). `null` = physically derived from mass and radius. */
  gravityOverrideMs2: number | null;
}

/** How a planet property feeds into the simulation. */
export type PropertyEffect = 'SIMULATED' | 'DERIVED' | 'VISUAL' | 'INFORMATIONAL';

export const PLANET_PROPERTY_EFFECTS: Record<keyof PlanetProperties, PropertyEffect> = {
  name: 'INFORMATIONAL',
  description: 'INFORMATIONAL',
  radiusKm: 'SIMULATED', // drives gravity (→ lapse rate) and the rendered globe scale
  massEarth: 'SIMULATED', // drives gravity (→ lapse rate)
  rotationHours: 'SIMULATED', // drives the length of the diurnal cycle
  orbitalDistanceAU: 'SIMULATED', // drives insolation (S/S₀)
  eccentricity: 'SIMULATED', // annual-mean insolation factor 1/√(1−e²); no orbital phase modelled
  starType: 'SIMULATED', // stellar luminosity → insolation
  systemAgeGyr: 'INFORMATIONAL',
  moonCount: 'VISUAL',
  gravityOverrideMs2: 'SIMULATED'
};

export const EARTH_RADIUS_KM = 6371;
export const EARTH_GRAVITY_MS2 = 9.80665;
export const EARTH_DENSITY_GCM3 = 5.514;
export const EARTH_ESCAPE_KMS = 11.186;
export const DRY_ADIABATIC_EARTH_ENV_LAPSE = 0.0065; // K/m environmental lapse rate at 1 g
export const LAPSE_RATE_K_PER_M = DRY_ADIABATIC_EARTH_ENV_LAPSE;

/** Main-sequence luminosity relative to the Sun (representative values). */
export const STAR_LUMINOSITY: Record<StarType, number> = {
  M: 0.04,
  K: 0.35,
  G: 1.0,
  F: 2.6
};

export const PLANET_PROPERTY_RANGES = {
  radiusKm: { min: 1500, max: 16000 },
  massEarth: { min: 0.02, max: 12 },
  rotationHours: { min: 4, max: 240 },
  orbitalDistanceAU: { min: 0.05, max: 5 },
  eccentricity: { min: 0, max: 0.6 },
  systemAgeGyr: { min: 0.05, max: 12 },
  moonCount: { min: 0, max: 4 },
  gravityOverrideMs2: { min: 0.5, max: 40 }
} as const;

/** The simulator's insolation multiplier is clamped to this range. */
export const SIM_INSOLATION_RANGE = { min: 0.2, max: 2.5 } as const;

export function createDefaultPlanetProperties(name = 'Genesis Prime'): PlanetProperties {
  return {
    name,
    description: '',
    radiusKm: EARTH_RADIUS_KM,
    massEarth: 1,
    rotationHours: 24,
    orbitalDistanceAU: 1,
    eccentricity: 0.0167,
    starType: 'G',
    systemAgeGyr: 4.5,
    moonCount: 1,
    gravityOverrideMs2: null
  };
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/** Returns a sanitized copy; unknown/missing fields fall back to Earth defaults. */
export function validatePlanetProperties(input: Partial<PlanetProperties> | undefined | null): PlanetProperties {
  const d = createDefaultPlanetProperties();
  const p = { ...d, ...(input || {}) };
  const r = PLANET_PROPERTY_RANGES;
  const starType: StarType = (['M', 'K', 'G', 'F'] as const).includes(p.starType as StarType)
    ? (p.starType as StarType)
    : 'G';
  return {
    name: String(p.name ?? d.name).slice(0, 80) || d.name,
    description: String(p.description ?? '').slice(0, 500),
    radiusKm: clamp(Number(p.radiusKm), r.radiusKm.min, r.radiusKm.max),
    massEarth: clamp(Number(p.massEarth), r.massEarth.min, r.massEarth.max),
    rotationHours: clamp(Number(p.rotationHours), r.rotationHours.min, r.rotationHours.max),
    orbitalDistanceAU: clamp(Number(p.orbitalDistanceAU), r.orbitalDistanceAU.min, r.orbitalDistanceAU.max),
    eccentricity: clamp(Number(p.eccentricity), r.eccentricity.min, r.eccentricity.max),
    starType,
    systemAgeGyr: clamp(Number(p.systemAgeGyr), r.systemAgeGyr.min, r.systemAgeGyr.max),
    moonCount: Math.round(clamp(Number(p.moonCount), r.moonCount.min, r.moonCount.max)),
    gravityOverrideMs2:
      p.gravityOverrideMs2 === null || p.gravityOverrideMs2 === undefined
        ? null
        : clamp(Number(p.gravityOverrideMs2), r.gravityOverrideMs2.min, r.gravityOverrideMs2.max)
  };
}

export interface DerivedPlanetQuantities {
  /** Physically derived surface gravity g = GM/R² (m/s²). */
  derivedGravityMs2: number;
  /** Gravity actually used by the model (override if set). */
  effectiveGravityMs2: number;
  gravityIsOverride: boolean;
  densityGcm3: number;
  escapeVelocityKms: number;
  diameterKm: number;
  /** Raw insolation relative to Earth S₀ before simulator clamping. */
  insolationRelative: number;
  /** Insolation passed to the climate model after clamping. */
  simInsolation: number;
  insolationClamped: boolean;
  /** Environmental lapse rate scaled with gravity (K/m). */
  lapseRateKPerM: number;
  /** Advisory warnings (e.g. implausible density). */
  warnings: Array<'DENSITY_LOW' | 'DENSITY_HIGH' | 'INSOLATION_CLAMPED' | 'GRAVITY_OVERRIDE'>;
}

export function derivePlanetQuantities(input: PlanetProperties): DerivedPlanetQuantities {
  const p = validatePlanetProperties(input);
  const rRel = p.radiusKm / EARTH_RADIUS_KM;
  const derivedGravity = (EARTH_GRAVITY_MS2 * p.massEarth) / (rRel * rRel);
  const effectiveGravity = p.gravityOverrideMs2 ?? derivedGravity;
  const density = (EARTH_DENSITY_GCM3 * p.massEarth) / (rRel * rRel * rRel);
  const escape = EARTH_ESCAPE_KMS * Math.sqrt(p.massEarth / rRel);
  const insolation =
    (STAR_LUMINOSITY[p.starType] / (p.orbitalDistanceAU * p.orbitalDistanceAU)) /
    Math.sqrt(1 - p.eccentricity * p.eccentricity);
  const simInsolation = clamp(insolation, SIM_INSOLATION_RANGE.min, SIM_INSOLATION_RANGE.max);
  const lapse = clamp((DRY_ADIABATIC_EARTH_ENV_LAPSE * effectiveGravity) / EARTH_GRAVITY_MS2, 0.0015, 0.025);

  const warnings: DerivedPlanetQuantities['warnings'] = [];
  if (density < 0.7) warnings.push('DENSITY_LOW');
  if (density > 15) warnings.push('DENSITY_HIGH');
  if (Math.abs(simInsolation - insolation) > 1e-9) warnings.push('INSOLATION_CLAMPED');
  if (p.gravityOverrideMs2 !== null) warnings.push('GRAVITY_OVERRIDE');

  return {
    derivedGravityMs2: derivedGravity,
    effectiveGravityMs2: effectiveGravity,
    gravityIsOverride: p.gravityOverrideMs2 !== null,
    densityGcm3: density,
    escapeVelocityKms: escape,
    diameterKm: p.radiusKm * 2,
    insolationRelative: insolation,
    simInsolation,
    insolationClamped: warnings.includes('INSOLATION_CLAMPED'),
    lapseRateKPerM: lapse,
    warnings
  };
}

/** Mass that keeps Earth's bulk density for a given radius (helper for "keep density" edits). */
export function massForEarthDensity(radiusKm: number): number {
  const rRel = radiusKm / EARTH_RADIUS_KM;
  return rRel * rRel * rRel;
}

/** Renderer scale factor for a radius (compressed so small/giant planets stay viewable). */
export function renderScaleForRadius(radiusKm: number): number {
  return clamp(Math.pow(radiusKm / EARTH_RADIUS_KM, 0.5), 0.55, 1.6);
}
