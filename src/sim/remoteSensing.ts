import { SeededRNG } from './rng';

export type ObservingMode = 'VISIBLE' | 'INFRARED' | 'THERMAL' | 'RADAR';
export type MissionType = 'ORBITAL_SURVEY' | 'FLYBY_PROBE' | 'SURFACE_LANDER';

export interface SpectralBandSample {
  wavelengthUm: number;
  bandLabel: string;
  transmittanceOrReflectance: number;
  featureGas: 'O2_0.76UM' | 'H2O_1.4UM' | 'CO2_4.3UM' | 'O3_9.6UM' | 'CONTINUUM';
}

export interface TransitAndPhaseCurve {
  orbitalPhaseStep: number[];
  normalizedTransitFlux: number[];
  thermalPhaseFluxPpm: number[];
  transitDepthPpm: number;
  radialVelocitySemiAmplitudeMs: number;
}

export interface InferredPlanetProperties {
  inferredRadiusKm: number;
  actualRadiusKm: number;
  radiusUncertaintyKm: number;
  inferredTempK: number;
  actualTempK: number;
  tempUncertaintyK: number;
  inferredPressureBar: number;
  actualPressureBar: number;
  detectedGases: string[];
  biosignatureConfidence: number;
  observationLabel: 'SYNTHETIC_MODEL_OBSERVATION_NOT_REAL_TELESCOPE';
}

export interface RemoteSensingMission {
  id: string;
  name: string;
  missionType: MissionType;
  mode: ObservingMode;
  noisePpm: number;
  instrumentResolution: number;
  completed: boolean;
  summaryReport: string;
}

export interface RemoteSensingState {
  activeMode: ObservingMode;
  noiseLevelPpm: number;
  instrumentResolution: number;
  viewpointPhaseDeg: number;
  lastSpectrum: SpectralBandSample[];
  lastCurves: TransitAndPhaseCurve | null;
  lastInference: InferredPlanetProperties | null;
  plannedMissions: RemoteSensingMission[];
}

export function createDefaultRemoteSensingState(): RemoteSensingState {
  return {
    activeMode: 'VISIBLE',
    noiseLevelPpm: 35,
    instrumentResolution: 100,
    viewpointPhaseDeg: 45,
    lastSpectrum: [],
    lastCurves: null,
    lastInference: null,
    plannedMissions: []
  };
}

export function runSyntheticObservation(
  state: RemoteSensingState,
  seed: string,
  actual: {
    radiusKm: number;
    massEarth: number;
    meanTempK: number;
    pressureBar: number;
    o2Percent: number;
    co2Ppm: number;
    meanHumidity: number;
    albedo: number;
    starType: 'M' | 'K' | 'G' | 'F';
    orbitalDistanceAU: number;
    globalBiomassFraction: number;
  }
): {
  spectrum: SpectralBandSample[];
  curves: TransitAndPhaseCurve;
  inference: InferredPlanetProperties;
} {
  const rng = new SeededRNG(`${seed}-obs-${state.activeMode}-${state.noiseLevelPpm}-${state.instrumentResolution}`);
  const noiseScale = Math.max(0, state.noiseLevelPpm) / 10000;
  const resFactor = Math.max(10, Math.min(500, state.instrumentResolution)) / 100;

  const o2Depth = Math.min(0.65, (actual.o2Percent / 21) * 0.38 * Math.sqrt(actual.pressureBar));
  const h2oDepth = Math.min(0.7, actual.meanHumidity * 0.45 * Math.sqrt(actual.pressureBar));
  const co2Depth = Math.min(0.85, (Math.log(Math.max(10, actual.co2Ppm) / 50) / 6) * 0.55);
  const o3Depth = actual.o2Percent > 2.0 ? Math.min(0.55, (actual.o2Percent / 21) * 0.35) : 0.02;

  const jitter = () => ((rng.next() - 0.5) * 2 * noiseScale) / Math.sqrt(resFactor);

  const spectrum: SpectralBandSample[] = [
    {
      wavelengthUm: 0.55,
      bandLabel: 'Visible Continuum (0.55 μm)',
      transmittanceOrReflectance: Number(Math.max(0.02, Math.min(0.99, actual.albedo + jitter())).toFixed(3)),
      featureGas: 'CONTINUUM'
    },
    {
      wavelengthUm: 0.76,
      bandLabel: 'O₂ A-Band (0.76 μm)',
      transmittanceOrReflectance: Number(Math.max(0.02, Math.min(0.99, 1 - o2Depth + jitter())).toFixed(3)),
      featureGas: 'O2_0.76UM'
    },
    {
      wavelengthUm: 1.4,
      bandLabel: 'H₂O Near-IR (1.4 μm)',
      transmittanceOrReflectance: Number(Math.max(0.02, Math.min(0.99, 1 - h2oDepth + jitter())).toFixed(3)),
      featureGas: 'H2O_1.4UM'
    },
    {
      wavelengthUm: 4.3,
      bandLabel: 'CO₂ Fundamental (4.3 μm)',
      transmittanceOrReflectance: Number(Math.max(0.02, Math.min(0.99, 1 - co2Depth + jitter())).toFixed(3)),
      featureGas: 'CO2_4.3UM'
    },
    {
      wavelengthUm: 9.6,
      bandLabel: 'O₃ Thermal Band (9.6 μm)',
      transmittanceOrReflectance: Number(Math.max(0.02, Math.min(0.99, 1 - o3Depth + jitter())).toFixed(3)),
      featureGas: 'O3_9.6UM'
    }
  ];

  const starRadiusKm =
    actual.starType === 'M' ? 210000 :
    actual.starType === 'K' ? 520000 :
    actual.starType === 'F' ? 910000 : 696340;
  const starMassSolar =
    actual.starType === 'M' ? 0.25 :
    actual.starType === 'K' ? 0.75 :
    actual.starType === 'F' ? 1.35 : 1.0;

  const trueTransitDepthPpm = Math.pow(actual.radiusKm / starRadiusKm, 2) * 1e6;
  const noisyDepthPpm = Math.max(5, trueTransitDepthPpm * (1 + jitter() * 0.5));

  const orbitalPhaseStep: number[] = [];
  const normalizedTransitFlux: number[] = [];
  const thermalPhaseFluxPpm: number[] = [];

  for (let i = 0; i <= 20; i++) {
    const phase = i / 20;
    orbitalPhaseStep.push(Number(phase.toFixed(2)));
    const inTransit = Math.abs(phase - 0.5) < 0.08;
    const dip = inTransit ? noisyDepthPpm / 1e6 : 0;
    normalizedTransitFlux.push(Number((1 - dip + jitter() * 0.0002).toFixed(6)));
    const phaseIllum = 0.5 * (1 - Math.cos(phase * 2 * Math.PI));
    const thermalAmp = (actual.meanTempK / 288) * 45;
    thermalPhaseFluxPpm.push(Number((thermalAmp * (0.35 + 0.65 * phaseIllum) + jitter() * 10).toFixed(1)));
  }

  const rvSemiAmp =
    (0.0895 * actual.massEarth) /
    (Math.pow(starMassSolar, 2 / 3) * Math.sqrt(Math.max(0.05, actual.orbitalDistanceAU)));

  const curves: TransitAndPhaseCurve = {
    orbitalPhaseStep,
    normalizedTransitFlux,
    thermalPhaseFluxPpm,
    transitDepthPpm: Number(noisyDepthPpm.toFixed(1)),
    radialVelocitySemiAmplitudeMs: Number(rvSemiAmp.toFixed(3))
  };

  const inferredRadiusKm = Number((starRadiusKm * Math.sqrt(noisyDepthPpm / 1e6)).toFixed(0));
  const radiusUncertaintyKm = Math.max(25, Math.round((inferredRadiusKm * (state.noiseLevelPpm / 1000)) / Math.sqrt(resFactor)));

  const tempJitter = ((rng.next() - 0.5) * 6 * (state.noiseLevelPpm / 50)) / Math.sqrt(resFactor);
  const inferredTempK = Number((actual.meanTempK + tempJitter).toFixed(1));
  const tempUncertaintyK = Number(Math.max(0.8, (2.5 * (state.noiseLevelPpm / 50)) / Math.sqrt(resFactor)).toFixed(1));

  const inferredPressureBar = Number(Math.max(0.01, actual.pressureBar * (1 + jitter() * 2)).toFixed(2));

  const detectedGases: string[] = [];
  if (co2Depth > noiseScale * 1.5) detectedGases.push('CO₂');
  if (h2oDepth > noiseScale * 1.5) detectedGases.push('H₂O');
  if (o2Depth > noiseScale * 1.5) detectedGases.push('O₂');
  if (o3Depth > noiseScale * 1.5) detectedGases.push('O₃');

  const biosigConf =
    detectedGases.includes('O₂') && detectedGases.includes('H₂O') && actual.globalBiomassFraction > 0.05
      ? Number(Math.min(0.98, 0.55 + actual.globalBiomassFraction * 0.4).toFixed(2))
      : 0.05;

  const inference: InferredPlanetProperties = {
    inferredRadiusKm,
    actualRadiusKm: actual.radiusKm,
    radiusUncertaintyKm,
    inferredTempK,
    actualTempK: Number(actual.meanTempK.toFixed(1)),
    tempUncertaintyK,
    inferredPressureBar,
    actualPressureBar: Number(actual.pressureBar.toFixed(2)),
    detectedGases,
    biosignatureConfidence: biosigConf,
    observationLabel: 'SYNTHETIC_MODEL_OBSERVATION_NOT_REAL_TELESCOPE'
  };

  state.lastSpectrum = spectrum;
  state.lastCurves = curves;
  state.lastInference = inference;

  return { spectrum, curves, inference };
}

export function scheduleObservationMission(
  state: RemoteSensingState,
  name: string,
  missionType: MissionType,
  mode: ObservingMode
): RemoteSensingMission {
  const mission: RemoteSensingMission = {
    id: `OBS-M-${state.plannedMissions.length + 1}`,
    name: name.trim() || `${missionType} (${mode})`,
    missionType,
    mode,
    noisePpm: state.noiseLevelPpm,
    instrumentResolution: state.instrumentResolution,
    completed: true,
    summaryReport: `Completed synthetic ${mode} ${missionType} at R=${state.instrumentResolution}, noise=${state.noiseLevelPpm} ppm.`
  };
  state.plannedMissions.unshift(mission);
  if (state.plannedMissions.length > 12) state.plannedMissions.length = 12;
  return mission;
}
