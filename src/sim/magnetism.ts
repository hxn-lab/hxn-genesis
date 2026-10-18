export type MagneticScenarioPreset = 'UNMAGNETIZED' | 'WEAK_FIELD' | 'EARTH_LIKE' | 'SUPER_MAGNETOSPHERE';

export interface MagnetosphereState {
  enabled: boolean;
  dipoleMomentEarths: number;
  customOverrideEarths: number | null;
  solarWindDynamicPressureNpa: number;
  magnetopauseRadiusRe: number;
  surfaceEquatorialGauss: number;
  polarCapBoundaryLatDeg: number;
  meanSurfaceRadiationSvYr: number;
  atmosphericEscapeRiskIndex: number;
  habitabilityShieldingFactor: number;
  mutationBoostFactor: number;
  modelDisclaimer: 'SIMPLIFIED_DIPOLE_PRESSURE_BALANCE_NOT_MHD';
}

export interface MagnetosphereInputs {
  coreHeat: number;
  mantleActivity: number;
  rotationHours: number;
  massEarth: number;
  radiusKm: number;
  pressureBar: number;
  orbitalDistanceAU: number;
  stellarActivityLevel?: number;
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function createDefaultMagnetosphereState(): MagnetosphereState {
  return {
    enabled: true,
    dipoleMomentEarths: 1.0,
    customOverrideEarths: null,
    solarWindDynamicPressureNpa: 2.0,
    magnetopauseRadiusRe: 10.2,
    surfaceEquatorialGauss: 0.31,
    polarCapBoundaryLatDeg: 71.5,
    meanSurfaceRadiationSvYr: 0.0024,
    atmosphericEscapeRiskIndex: 0.08,
    habitabilityShieldingFactor: 0.98,
    mutationBoostFactor: 1.0,
    modelDisclaimer: 'SIMPLIFIED_DIPOLE_PRESSURE_BALANCE_NOT_MHD'
  };
}

export function deriveDipoleMomentEarths(inp: MagnetosphereInputs): number {
  const rotFactor = clamp(24 / Math.max(4, inp.rotationHours), 0.1, 3.0);
  const coreDynamo = Math.max(0, inp.coreHeat * 0.65 + inp.mantleActivity * 0.35);
  const massFactor = Math.pow(clamp(inp.massEarth, 0.05, 12), 0.55);
  return clamp(coreDynamo * Math.sqrt(rotFactor) * massFactor, 0, 8.0);
}

export function updateMagnetosphereState(
  state: MagnetosphereState,
  inp: MagnetosphereInputs
): MagnetosphereState {
  if (!state.enabled) {
    return {
      ...state,
      dipoleMomentEarths: 0,
      magnetopauseRadiusRe: 1.0,
      surfaceEquatorialGauss: 0,
      polarCapBoundaryLatDeg: 0,
      meanSurfaceRadiationSvYr: 0.18,
      atmosphericEscapeRiskIndex: 0.72,
      habitabilityShieldingFactor: 0.75,
      mutationBoostFactor: 1.35,
      modelDisclaimer: 'SIMPLIFIED_DIPOLE_PRESSURE_BALANCE_NOT_MHD'
    };
  }

  const derivedDipole = deriveDipoleMomentEarths(inp);
  const effectiveDipole =
    state.customOverrideEarths !== null && Number.isFinite(state.customOverrideEarths)
      ? clamp(state.customOverrideEarths, 0, 10)
      : derivedDipole;

  const distAU = clamp(inp.orbitalDistanceAU, 0.1, 5.0);
  const starAct = clamp(inp.stellarActivityLevel ?? 1.0, 0.2, 50.0);
  const pSwNpa = clamp((2.0 * starAct) / (distAU * distAU), 0.05, 250.0);

  const rRel = clamp(inp.radiusKm / 6371, 0.25, 3.0);
  const bEqGauss = (0.31 * effectiveDipole) / Math.pow(rRel, 3);

  const mpRe =
    effectiveDipole <= 0.001
      ? 1.0
      : clamp(10.2 * Math.pow(effectiveDipole, 1 / 3) * Math.pow(2.0 / pSwNpa, 1 / 6), 1.0, 28.0);

  const cosLambda = mpRe <= 1.02 ? 1.0 : Math.sqrt(1.0 / mpRe);
  const polarLatDeg = (Math.acos(clamp(cosLambda, 0, 1)) * 180) / Math.PI;

  const atmoColumnShield = Math.exp(-clamp(inp.pressureBar, 0, 20) * 1.45);
  const magShield = 1.0 / (1.0 + effectiveDipole * 4.5);
  const rawRadSvYr = clamp(starAct * (0.45 * magShield + 0.08) * (0.15 + 0.85 * atmoColumnShield), 0.0005, 8.0);

  const escapeRisk = clamp(
    (pSwNpa / 4.0) * (1.0 / (1.0 + effectiveDipole * 5.0)) * (1.0 / Math.max(0.2, inp.massEarth)),
    0.01,
    1.0
  );

  const habFactor = clamp(1.0 - Math.max(0, rawRadSvYr - 0.01) * 0.35, 0.35, 1.0);
  const mutBoost = clamp(1.0 + rawRadSvYr * 1.2, 1.0, 2.8);

  return {
    ...state,
    dipoleMomentEarths: effectiveDipole,
    solarWindDynamicPressureNpa: pSwNpa,
    magnetopauseRadiusRe: mpRe,
    surfaceEquatorialGauss: bEqGauss,
    polarCapBoundaryLatDeg: polarLatDeg,
    meanSurfaceRadiationSvYr: rawRadSvYr,
    atmosphericEscapeRiskIndex: escapeRisk,
    habitabilityShieldingFactor: habFactor,
    mutationBoostFactor: mutBoost,
    modelDisclaimer: 'SIMPLIFIED_DIPOLE_PRESSURE_BALANCE_NOT_MHD'
  };
}

export function applyMagneticPreset(
  state: MagnetosphereState,
  preset: MagneticScenarioPreset,
  inp?: MagnetosphereInputs
): MagnetosphereState {
  const next = { ...state, enabled: true };
  if (preset === 'UNMAGNETIZED') {
    next.customOverrideEarths = 0;
  } else if (preset === 'WEAK_FIELD') {
    next.customOverrideEarths = 0.15;
  } else if (preset === 'EARTH_LIKE') {
    next.customOverrideEarths = 1.0;
  } else {
    next.customOverrideEarths = 3.5;
  }
  return inp ? updateMagnetosphereState(next, inp) : next;
}

export function computeCellRadiationField(
  state: MagnetosphereState,
  cellSinLat: Float32Array,
  elevation: Float32Array,
  seaLevelMeters: number,
  pressureBar: number,
  outField: Float32Array
): void {
  const baseRad = state.meanSurfaceRadiationSvYr;
  const polarBoundarySin = Math.sin((state.polarCapBoundaryLatDeg * Math.PI) / 180);
  const atmoAtten = Math.exp(-clamp(pressureBar, 0, 15) * 0.65);

  for (let i = 0; i < cellSinLat.length; i++) {
    const absSin = Math.abs(cellSinLat[i]);
    const polarCuspBoost =
      state.dipoleMomentEarths > 0.05 && absSin >= polarBoundarySin
        ? 1.65
        : 0.75 + 0.5 * absSin;
    const altKm = Math.max(0, (elevation[i] - seaLevelMeters) / 1000);
    const altFactor = 1.0 + Math.min(2.5, altKm * 0.18);
    outField[i] = clamp(baseRad * polarCuspBoost * altFactor * (0.4 + 0.6 * atmoAtten) * 4.5, 0, 1);
  }
}
