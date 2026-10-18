import { SeededRNG } from './rng';

export type SpaceEventKind =
  | 'ASTEROID_APPROACH'
  | 'STELLAR_FLARE'
  | 'CME_RADIATION_STORM'
  | 'TIDAL_PERTURBATION'
  | 'LUMINOSITY_SHIFT';

export type MitigationActionKind = 'KINETIC_IMPACTOR' | 'GRAVITY_TRACTOR' | 'MAGNETIC_SHIELD_BOOST';

export interface ApproachingObject {
  id: string;
  name: string;
  kind: SpaceEventKind;
  isDeterministicScenario: boolean;
  diameterMeters: number;
  velocityKms: number;
  impactProbability: number;
  estimatedEnergyMegatonsTnt: number;
  warningYearsRemaining: number;
  targetLatDeg: number;
  targetLonDeg: number;
  deflected: boolean;
  resolved: boolean;
  outcomeNote: string;
}

export interface SpaceWeatherReport {
  id: string;
  simTimeFormatted: string;
  kind: SpaceEventKind;
  isDeterministic: boolean;
  summary: string;
  energyMtOrFlux: number;
  atmosphericLossBar: number;
  radiationSpikeSvYr: number;
}

export interface SpaceWeatherState {
  stellarActivityMultiplier: number;
  cumulativeAtmoErodedBar: number;
  tidalHeatingFactor: number;
  upcomingQueue: ApproachingObject[];
  postEventReports: SpaceWeatherReport[];
}

export function createDefaultSpaceWeatherState(): SpaceWeatherState {
  return {
    stellarActivityMultiplier: 1.0,
    cumulativeAtmoErodedBar: 0,
    tidalHeatingFactor: 1.0,
    upcomingQueue: [],
    postEventReports: []
  };
}

export function estimateAsteroidEnergyMegatons(diameterMeters: number, velocityKms: number, densityKgM3 = 3000): number {
  const r = Math.max(1, diameterMeters) * 0.5;
  const volume = (4 / 3) * Math.PI * r * r * r;
  const massKg = volume * densityKgM3;
  const vMs = Math.max(1, velocityKms) * 1000;
  const joules = 0.5 * massKg * vMs * vMs;
  return joules / 4.184e15;
}

export function spawnApproachingAsteroid(
  state: SpaceWeatherState,
  seed: string,
  opts?: Partial<{
    name: string;
    diameterMeters: number;
    velocityKms: number;
    impactProbability: number;
    warningYears: number;
    targetLatDeg: number;
    targetLonDeg: number;
    isDeterministicScenario: boolean;
  }>
): ApproachingObject {
  const rng = new SeededRNG(`${seed}-neo-${state.upcomingQueue.length}-${state.postEventReports.length}`);
  const diameter = opts?.diameterMeters ?? Math.round(150 + rng.next() * 4800);
  const velocity = opts?.velocityKms ?? Number((14 + rng.next() * 28).toFixed(1));
  const prob = opts?.impactProbability ?? Number(Math.min(1, Math.max(0.05, 0.25 + rng.next() * 0.7)).toFixed(2));
  const energyMt = estimateAsteroidEnergyMegatons(diameter, velocity);

  const obj: ApproachingObject = {
    id: `NEO-${state.upcomingQueue.length + state.postEventReports.length + 1}`,
    name: opts?.name ?? ` Minor Body ${100 + state.upcomingQueue.length + state.postEventReports.length}`,
    kind: 'ASTEROID_APPROACH',
    isDeterministicScenario: opts?.isDeterministicScenario ?? false,
    diameterMeters: diameter,
    velocityKms: velocity,
    impactProbability: prob,
    estimatedEnergyMegatonsTnt: energyMt,
    warningYearsRemaining: opts?.warningYears ?? Number((2 + rng.next() * 25).toFixed(1)),
    targetLatDeg: opts?.targetLatDeg ?? Number(((rng.next() - 0.5) * 140).toFixed(1)),
    targetLonDeg: opts?.targetLonDeg ?? Number(((rng.next() - 0.5) * 340).toFixed(1)),
    deflected: false,
    resolved: false,
    outcomeNote: 'Approaching planetary orbital corridor'
  };
  state.upcomingQueue.unshift(obj);
  if (state.upcomingQueue.length > 12) state.upcomingQueue.length = 12;
  return obj;
}

export function applyMitigationToThreat(
  state: SpaceWeatherState,
  threatId: string,
  method: MitigationActionKind
): { success: boolean; updatedProbability: number; note: string } {
  const item = state.upcomingQueue.find((q) => q.id === threatId && !q.resolved);
  if (!item) {
    return { success: false, updatedProbability: 0, note: 'Threat not found or already resolved' };
  }
  const warningBonus = Math.min(1.5, Math.max(0.25, item.warningYearsRemaining / 5.0));
  const reduction =
    method === 'KINETIC_IMPACTOR'
      ? 0.65 * warningBonus
      : method === 'GRAVITY_TRACTOR'
        ? 0.85 * warningBonus
        : 0.35;

  item.impactProbability = Math.max(0, Number((item.impactProbability * (1 - Math.min(0.98, reduction))).toFixed(3)));
  if (item.impactProbability < 0.05) {
    item.deflected = true;
    item.resolved = true;
    item.outcomeNote = `Successfully deflected via ${method}`;
  } else {
    item.outcomeNote = `Mitigation (${method}) reduced impact risk to ${(item.impactProbability * 100).toFixed(1)}%`;
  }
  return {
    success: true,
    updatedProbability: item.impactProbability,
    note: item.outcomeNote
  };
}

export function triggerSpaceWeatherEvent(
  state: SpaceWeatherState,
  kind: Exclude<SpaceEventKind, 'ASTEROID_APPROACH'>,
  simTimeFormatted: string,
  dipoleMomentEarths: number,
  currentPressureBar: number,
  intensity = 1.0
): {
  pressureDeltaBar: number;
  luminosityMultiplierDelta: number;
  radiationSpikeSvYr: number;
  tidalFactor: number;
  report: SpaceWeatherReport;
} {
  const s = Math.max(0.1, Math.min(3.0, intensity));
  const shield = 1.0 / (1.0 + Math.max(0, dipoleMomentEarths) * 3.5);
  let pressureDeltaBar = 0;
  let luminosityMultiplierDelta = 0;
  let radiationSpikeSvYr = 0;
  let summary = '';

  if (kind === 'STELLAR_FLARE') {
    radiationSpikeSvYr = 0.25 * s * shield;
    pressureDeltaBar = -Math.min(currentPressureBar * 0.03, 0.008 * s * shield);
    state.stellarActivityMultiplier = Math.min(15, state.stellarActivityMultiplier + 1.5 * s);
    summary = `Stellar X-class superflare increased UV/X-ray flux and eroded ${Math.abs(pressureDeltaBar).toFixed(4)} bar.`;
  } else if (kind === 'CME_RADIATION_STORM') {
    radiationSpikeSvYr = 0.65 * s * shield;
    pressureDeltaBar = -Math.min(currentPressureBar * 0.08, 0.025 * s * shield);
    state.stellarActivityMultiplier = Math.min(25, state.stellarActivityMultiplier + 3.0 * s);
    summary = `Coronal Mass Ejection compressed magnetopause and stripped ${Math.abs(pressureDeltaBar).toFixed(4)} bar.`;
  } else if (kind === 'TIDAL_PERTURBATION') {
    state.tidalHeatingFactor = Number((1.0 + 0.85 * s).toFixed(2));
    summary = `Gravitational tidal perturbation elevated interior mantle & coastal tidal forcing (${state.tidalHeatingFactor}x).`;
  } else {
    luminosityMultiplierDelta = 0.06 * s;
    summary = `Secular stellar evolution shifted main-sequence luminosity by +${(luminosityMultiplierDelta * 100).toFixed(1)}%.`;
  }

  state.cumulativeAtmoErodedBar += Math.abs(pressureDeltaBar);

  const report: SpaceWeatherReport = {
    id: `SW-${Date.now()}-${state.postEventReports.length + 1}`,
    simTimeFormatted,
    kind,
    isDeterministic: true,
    summary,
    energyMtOrFlux: Number((s * 100).toFixed(1)),
    atmosphericLossBar: Math.abs(pressureDeltaBar),
    radiationSpikeSvYr
  };
  state.postEventReports.unshift(report);
  if (state.postEventReports.length > 20) state.postEventReports.length = 20;

  return {
    pressureDeltaBar,
    luminosityMultiplierDelta,
    radiationSpikeSvYr,
    tidalFactor: state.tidalHeatingFactor,
    report
  };
}

export function stepSpaceWeatherQueue(
  state: SpaceWeatherState,
  dtYears: number,
  seed: string,
  simTimeFormatted: string
): ApproachingObject[] {
  const impacted: ApproachingObject[] = [];
  const rng = new SeededRNG(`${seed}-sw-step-${state.postEventReports.length}`);
  state.stellarActivityMultiplier = Math.max(1.0, 1.0 + (state.stellarActivityMultiplier - 1.0) * Math.exp(-dtYears / 50));

  for (const obj of state.upcomingQueue) {
    if (obj.resolved) continue;
    obj.warningYearsRemaining = Number(Math.max(0, obj.warningYearsRemaining - Math.max(0.05, dtYears)).toFixed(2));
    if (obj.warningYearsRemaining <= 0) {
      obj.resolved = true;
      const hit = obj.isDeterministicScenario ? !obj.deflected && obj.impactProbability > 0.05 : rng.next() < obj.impactProbability;
      if (hit && !obj.deflected) {
        obj.outcomeNote = `Impacted surface (${obj.estimatedEnergyMegatonsTnt.toFixed(0)} MT TNT) at (${obj.targetLatDeg}°, ${obj.targetLonDeg}°)`;
        impacted.push(obj);
        state.postEventReports.unshift({
          id: `SW-IMP-${state.postEventReports.length + 1}`,
          simTimeFormatted,
          kind: 'ASTEROID_APPROACH',
          isDeterministic: obj.isDeterministicScenario,
          summary: `${obj.name} impacted (${obj.estimatedEnergyMegatonsTnt.toFixed(0)} MT TNT).`,
          energyMtOrFlux: Number(obj.estimatedEnergyMegatonsTnt.toFixed(1)),
          atmosphericLossBar: 0.002,
          radiationSpikeSvYr: 0
        });
      } else {
        obj.outcomeNote = obj.deflected ? 'Safely deflected past planetary corridor' : 'Missed planet on hyperbolic flyby';
      }
    }
  }
  return impacted;
}

