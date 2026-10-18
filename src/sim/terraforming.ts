import { SimParameters, GlobalTelemetry } from './types';
import { MagnetosphereState } from './magnetism';

export type TerraformingInterventionKind =
  | 'ATMOSPHERE_PROCESSING'
  | 'GREENHOUSE_GAS_ADJUSTMENT'
  | 'ALBEDO_MODIFICATION'
  | 'ORBITAL_MIRROR_ARRAY'
  | 'CONTROLLED_HEATING_COOLING'
  | 'WATER_IMPORT_COMETS'
  | 'ICE_RELOCATION'
  | 'MAGNETIC_SHIELD_GENERATOR';

export interface TerraformingMetricsSnapshot {
  meanTempC: number;
  pressureBar: number;
  o2Percent: number;
  co2Ppm: number;
  oceanFraction: number;
  habitability: number;
  extinctionStress: number;
}

export interface TerraformingProject {
  id: string;
  kind: TerraformingInterventionKind;
  title: string;
  intensity: number;
  durationYears: number;
  elapsedYears: number;
  progress: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'REJECTED_IMPOSSIBLE';
  energyRequirementEJ: number;
  mineralCostGt: number;
  expectedSideEffects: string[];
  uncertaintyPct: number;
  rejectionReason?: string;
  beforeMetrics: TerraformingMetricsSnapshot;
  afterMetrics?: TerraformingMetricsSnapshot;
}

export interface TerraformingBranchComparison {
  branchId: string;
  label: string;
  simTimeLabel: string;
  baselineMetrics: TerraformingMetricsSnapshot;
  currentMetrics: TerraformingMetricsSnapshot;
}

export interface TerraformingState {
  projects: TerraformingProject[];
  branches: TerraformingBranchComparison[];
  orbitalMirrorLuminosityFactor: number;
  artificialMagneticDipoleEarths: number;
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function createDefaultTerraformingState(): TerraformingState {
  return {
    projects: [],
    branches: [],
    orbitalMirrorLuminosityFactor: 1.0,
    artificialMagneticDipoleEarths: 0,
  };
}

export function captureTerraformingMetrics(
  params: SimParameters,
  telemetry: GlobalTelemetry
): TerraformingMetricsSnapshot {
  return {
    meanTempC: Number(telemetry.meanSurfaceTempC.toFixed(2)),
    pressureBar: Number((params.pressureBar ?? 1.0).toFixed(3)),
    o2Percent: Number(telemetry.oxygenPercent.toFixed(2)),
    co2Ppm: Number(params.co2Ppm.toFixed(1)),
    oceanFraction: Number(telemetry.oceanCoverageFraction.toFixed(3)),
    habitability: Number(telemetry.meanHabitability.toFixed(3)),
    extinctionStress: Number(telemetry.extinctionSeverity.toFixed(3)),
  };
}

export function validateTerraformingFeasibility(
  params: SimParameters,
  telemetry: GlobalTelemetry,
  kind: TerraformingInterventionKind,
  intensity: number
): { valid: boolean; reason?: string } {
  if (!Number.isFinite(intensity) || intensity < -2.0 || intensity > 2.0 || Math.abs(intensity) < 0.01) {
    return {
      valid: false,
      reason: 'Intervention intensity must be non-zero and bounded within [-2.0, +2.0] physical limits.',
    };
  }
  if (kind === 'ICE_RELOCATION' && telemetry.iceCoverageFraction < 0.005 && params.seaLevelMeters < -5000) {
    return {
      valid: false,
      reason: 'Cannot relocate surface ice on a desiccated planet with near-zero cryosphere inventory.',
    };
  }
  if (kind === 'ATMOSPHERE_PROCESSING' && (params.pressureBar ?? 1.0) <= 0.008 && intensity < 0) {
    return {
      valid: false,
      reason: 'Cannot scrub atmospheric mass when surface pressure is already near vacuum.',
    };
  }
  return { valid: true };
}

export function launchTerraformingProject(
  state: TerraformingState,
  params: SimParameters,
  telemetry: GlobalTelemetry,
  kind: TerraformingInterventionKind,
  intensity: number,
  durationYears = 100_000
): TerraformingProject {
  const baseline = captureTerraformingMetrics(params, telemetry);
  const check = validateTerraformingFeasibility(params, telemetry, kind, intensity);
  const absInt = Math.abs(intensity);

  const sideEffectsMap: Record<TerraformingInterventionKind, string[]> = {
    ATMOSPHERE_PROCESSING: ['Transient barometric wind shear', 'Shifted Rayleigh optical depth'],
    GREENHOUSE_GAS_ADJUSTMENT: ['Ocean carbonate acidification shift', 'Rapid radiative forcing transient'],
    ALBEDO_MODIFICATION: ['Regional convective precipitation shift', 'Surface aerosol deposition'],
    ORBITAL_MIRROR_ARRAY: ['Altered diurnal insolation profile', 'Thermal shock to polar ecosystems'],
    CONTROLLED_HEATING_COOLING: ['Permafrost destabilization risk', 'Deep ocean thermal lag'],
    WATER_IMPORT_COMETS: ['Localized volatile delivery shockwaves', 'Coastline inundation of lowland habitats'],
    ICE_RELOCATION: ['Salinity dilution in equatorial basins', 'Isostatic crustal rebound'],
    MAGNETIC_SHIELD_GENERATOR: ['L1 station power upkeep demand', 'Reduced upper-atmosphere sputtering'],
  };

  const project: TerraformingProject = {
    id: `TF-${state.projects.length + 1}`,
    kind,
    title: `${kind.replace(/_/g, ' ')} (${intensity >= 0 ? '+' : ''}${intensity.toFixed(2)})`,
    intensity,
    durationYears: Math.max(100, durationYears),
    elapsedYears: 0,
    progress: 0,
    status: check.valid ? 'ACTIVE' : 'REJECTED_IMPOSSIBLE',
    energyRequirementEJ: Number((absInt * 420).toFixed(1)),
    mineralCostGt: Number((absInt * 85).toFixed(1)),
    expectedSideEffects: sideEffectsMap[kind],
    uncertaintyPct: Number(clamp(8 + absInt * 14, 5, 45).toFixed(1)),
    rejectionReason: check.reason,
    beforeMetrics: baseline,
  };

  state.projects.unshift(project);
  return project;
}

export function stepTerraformingProjects(
  state: TerraformingState,
  params: SimParameters,
  telemetry: GlobalTelemetry,
  magnetosphere: MagnetosphereState,
  dtYears: number
): void {
  const effectiveDtYears = Math.max(100, dtYears);
  for (const proj of state.projects) {
    if (proj.status !== 'ACTIVE') continue;

    const remaining = Math.max(0, proj.durationYears - proj.elapsedYears);
    const stepYears = Math.min(effectiveDtYears, remaining);
    const stepFrac = clamp(stepYears / proj.durationYears, 0.01, 1);

    proj.elapsedYears += stepYears;
    proj.progress = clamp(proj.elapsedYears / proj.durationYears, 0, 1);
    const delta = proj.intensity * stepFrac;

    switch (proj.kind) {
      case 'ATMOSPHERE_PROCESSING':
        params.pressureBar = clamp((params.pressureBar ?? 1.0) + delta * 0.65, 0.006, 90);
        params.o2Percent = clamp((params.o2Percent ?? 21) + Math.max(0, delta) * 6.5, 0, 35);
        break;
      case 'GREENHOUSE_GAS_ADJUSTMENT':
        params.co2Ppm = clamp(params.co2Ppm + delta * 1200, 50, 10000);
        break;
      case 'ALBEDO_MODIFICATION':
        params.temperatureOffsetK = clamp(params.temperatureOffsetK - delta * 6.0, -40, 40);
        break;
      case 'ORBITAL_MIRROR_ARRAY':
        state.orbitalMirrorLuminosityFactor = clamp(state.orbitalMirrorLuminosityFactor + delta * 0.2, 0.5, 1.8);
        params.solarLuminosity = clamp(params.solarLuminosity + delta * 0.18, 0.2, 2.5);
        break;
      case 'CONTROLLED_HEATING_COOLING':
        params.temperatureOffsetK = clamp(params.temperatureOffsetK + delta * 10.0, -40, 40);
        break;
      case 'WATER_IMPORT_COMETS':
        params.seaLevelMeters = clamp(params.seaLevelMeters + Math.max(0, delta) * 900, -6000, 6000);
        params.humidityMultiplier = clamp(params.humidityMultiplier + Math.max(0, delta) * 0.25, 0, 3);
        break;
      case 'ICE_RELOCATION':
        params.seaLevelMeters = clamp(params.seaLevelMeters + Math.abs(delta) * 350, -6000, 6000);
        params.temperatureOffsetK = clamp(params.temperatureOffsetK + delta * 3.0, -40, 40);
        break;
      case 'MAGNETIC_SHIELD_GENERATOR':
        state.artificialMagneticDipoleEarths = clamp(
          state.artificialMagneticDipoleEarths + Math.max(0, delta) * 1.2,
          0,
          6
        );
        magnetosphere.enabled = true;
        magnetosphere.customOverrideEarths = clamp(
          (magnetosphere.customOverrideEarths ?? magnetosphere.dipoleMomentEarths) + Math.max(0, delta) * 1.2,
          0.5,
          8
        );
        break;
    }

    if (proj.progress >= 0.999) {
      proj.progress = 1;
      proj.status = 'COMPLETED';
      proj.afterMetrics = captureTerraformingMetrics(params, telemetry);
    }
  }
}

export function cancelTerraformingProject(state: TerraformingState, projectId: string): boolean {
  const proj = state.projects.find((p) => p.id === projectId);
  if (!proj || proj.status !== 'ACTIVE') return false;
  proj.status = 'CANCELLED';
  return true;
}

export function recordTerraformingBranch(
  state: TerraformingState,
  params: SimParameters,
  telemetry: GlobalTelemetry,
  label: string,
  simTimeLabel: string
): TerraformingBranchComparison {
  const current = captureTerraformingMetrics(params, telemetry);
  const branch: TerraformingBranchComparison = {
    branchId: `BRANCH-${state.branches.length + 1}`,
    label: label.trim() || `Branch ${state.branches.length + 1}`,
    simTimeLabel,
    baselineMetrics: state.projects[0]?.beforeMetrics ?? current,
    currentMetrics: current,
  };
  state.branches.unshift(branch);
  return branch;
}
