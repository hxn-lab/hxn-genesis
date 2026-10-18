import { TelemetryHistoryPoint, SimEventLogEntry, PresetName } from './types';
import { WorldSimulation } from './world';

export type AnalyticsMetricKey =
  | 'meanTempC'
  | 'co2Ppm'
  | 'o2Percent'
  | 'biomassPercent'
  | 'faunaPercent'
  | 'livingSpeciesCount'
  | 'biodiversityIndex'
  | 'habitabilityPercent'
  | 'extinctionSeverityPercent';

export interface CorrelationReport {
  metricX: AnalyticsMetricKey;
  metricY: AnalyticsMetricKey;
  sampleCount: number;
  pearsonR: number;
  strengthLabel: 'STRONG_POSITIVE' | 'MODERATE_POSITIVE' | 'WEAK_OR_NONE' | 'MODERATE_NEGATIVE' | 'STRONG_NEGATIVE';
  causalDisclaimer: string;
}

export interface CausalEventChainNode {
  id: string;
  simTimeFormatted: string;
  category: string;
  triggerMessage: string;
  attributedTempDeltaC: number;
  attributedHabitabilityDeltaPct: number;
  attributedBiomassDeltaPct: number;
  downstreamEffects: string[];
}

export interface SensitivityPoint {
  parameterValue: number;
  meanTempC: number;
  habitabilityPercent: number;
  oceanPercent: number;
  livingSpeciesCount: number;
}

export interface SensitivitySweepResult {
  parameterName: 'solarLuminosity' | 'co2Ppm' | 'seaLevelMeters' | 'volcanicActivity';
  points: SensitivityPoint[];
}

export interface MonteCarloBandPoint {
  stepIndex: number;
  meanHabitabilityPct: number;
  p10HabitabilityPct: number;
  p90HabitabilityPct: number;
  meanTempC: number;
  p10TempC: number;
  p90TempC: number;
}

export interface MonteCarloEnsembleResult {
  runs: number;
  stepsPerRun: number;
  survivalProbability: number;
  bands: MonteCarloBandPoint[];
}

export function computeMetricCorrelation(
  history: TelemetryHistoryPoint[],
  metricX: AnalyticsMetricKey,
  metricY: AnalyticsMetricKey
): CorrelationReport {
  const n = history.length;
  const disclaimer =
    'Statistical correlation measures historical co-variation only and does not prove direct physical causation without controlled perturbation.';
  if (n < 2) {
    return {
      metricX,
      metricY,
      sampleCount: n,
      pearsonR: 0,
      strengthLabel: 'WEAK_OR_NONE',
      causalDisclaimer: disclaimer,
    };
  }

  const xs = history.map((h) => Number(h[metricX] ?? 0));
  const ys = history.map((h) => Number(h[metricY] ?? 0));
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const denom = Math.sqrt(denX * denY);
  const r = denom > 1e-12 ? Math.max(-1, Math.min(1, num / denom)) : 0;

  let strengthLabel: CorrelationReport['strengthLabel'] = 'WEAK_OR_NONE';
  if (r >= 0.7) strengthLabel = 'STRONG_POSITIVE';
  else if (r >= 0.35) strengthLabel = 'MODERATE_POSITIVE';
  else if (r <= -0.7) strengthLabel = 'STRONG_NEGATIVE';
  else if (r <= -0.35) strengthLabel = 'MODERATE_NEGATIVE';

  return {
    metricX,
    metricY,
    sampleCount: n,
    pearsonR: Number(r.toFixed(4)),
    strengthLabel,
    causalDisclaimer: disclaimer,
  };
}

export function buildCausalAttributionChains(
  history: TelemetryHistoryPoint[],
  eventLog: SimEventLogEntry[]
): CausalEventChainNode[] {
  const chains: CausalEventChainNode[] = [];
  const prev = history.length >= 2 ? history[0] : null;
  const latest = history.length >= 1 ? history[history.length - 1] : null;

  for (const ev of eventLog.slice(0, 12)) {
    const dTemp = prev && latest ? Number((latest.meanTempC - prev.meanTempC).toFixed(2)) : 0;
    const dHab = prev && latest ? Number((latest.habitabilityPercent - prev.habitabilityPercent).toFixed(1)) : 0;
    const dBio = prev && latest ? Number((latest.biomassPercent - prev.biomassPercent).toFixed(1)) : 0;

    const downstream: string[] = [];
    if (Math.abs(dTemp) > 0.8) downstream.push(`Thermal forcing shift (${dTemp >= 0 ? '+' : ''}${dTemp} °C)`);
    if (Math.abs(dHab) > 2.0) downstream.push(`Habitability regime delta (${dHab >= 0 ? '+' : ''}${dHab}%)`);
    if (Math.abs(dBio) > 2.0) downstream.push(`Biosphere coverage delta (${dBio >= 0 ? '+' : ''}${dBio}%)`);
    if (downstream.length === 0) downstream.push('Perturbation buffered by atmosphere-ocean thermal inertia');

    chains.push({
      id: `CAUSAL-${ev.id}`,
      simTimeFormatted: ev.simTimeFormatted,
      category: ev.category,
      triggerMessage: ev.message,
      attributedTempDeltaC: dTemp,
      attributedHabitabilityDeltaPct: dHab,
      attributedBiomassDeltaPct: dBio,
      downstreamEffects: downstream,
    });
  }

  return chains;
}

export function runParameterSensitivitySweep(
  seed: string,
  preset: PresetName,
  parameterName: SensitivitySweepResult['parameterName'],
  values: number[]
): SensitivitySweepResult {
  const points: SensitivityPoint[] = [];

  for (const val of values) {
    const sim = new WorldSimulation(36, 18, preset, seed);
    sim.params[parameterName] = val;
    sim.singleStep(3600 * 24 * 365 * 5000);
    points.push({
      parameterValue: Number(val.toFixed(3)),
      meanTempC: Number(sim.telemetry.meanSurfaceTempC.toFixed(2)),
      habitabilityPercent: Number((sim.telemetry.meanHabitability * 100).toFixed(1)),
      oceanPercent: Number((sim.telemetry.oceanCoverageFraction * 100).toFixed(1)),
      livingSpeciesCount: sim.telemetry.livingSpeciesCount,
    });
  }

  return { parameterName, points };
}

export function runMonteCarloEnsemble(
  baseSeed: string,
  preset: PresetName = 'Earth-like',
  runs = 4,
  stepsPerRun = 5
): MonteCarloEnsembleResult {
  const safeRuns = Math.max(2, Math.min(10, runs));
  const safeSteps = Math.max(2, Math.min(10, stepsPerRun));
  const habSeries: number[][] = [];
  const tempSeries: number[][] = [];
  let survived = 0;

  for (let r = 0; r < safeRuns; r++) {
    const sim = new WorldSimulation(36, 18, preset, `${baseSeed}-mc-${r}`);
    const habs: number[] = [];
    const temps: number[] = [];
    for (let s = 0; s < safeSteps; s++) {
      sim.singleStep(3600 * 24 * 365 * 25000);
      habs.push(sim.telemetry.meanHabitability * 100);
      temps.push(sim.telemetry.meanSurfaceTempC);
    }
    if (sim.telemetry.meanHabitability >= 0.35 || sim.telemetry.livingSpeciesCount > 0) {
      survived++;
    }
    habSeries.push(habs);
    tempSeries.push(temps);
  }

  const bands: MonteCarloBandPoint[] = [];
  for (let s = 0; s < safeSteps; s++) {
    const colHab = habSeries.map((arr) => arr[s]).sort((a, b) => a - b);
    const colTemp = tempSeries.map((arr) => arr[s]).sort((a, b) => a - b);
    const meanHab = colHab.reduce((a, b) => a + b, 0) / safeRuns;
    const meanTemp = colTemp.reduce((a, b) => a + b, 0) / safeRuns;
    const lowIdx = Math.floor((safeRuns - 1) * 0.1);
    const highIdx = Math.ceil((safeRuns - 1) * 0.9);

    bands.push({
      stepIndex: s + 1,
      meanHabitabilityPct: Number(meanHab.toFixed(1)),
      p10HabitabilityPct: Number(colHab[lowIdx].toFixed(1)),
      p90HabitabilityPct: Number(colHab[highIdx].toFixed(1)),
      meanTempC: Number(meanTemp.toFixed(2)),
      p10TempC: Number(colTemp[lowIdx].toFixed(2)),
      p90TempC: Number(colTemp[highIdx].toFixed(2)),
    });
  }

  return {
    runs: safeRuns,
    stepsPerRun: safeSteps,
    survivalProbability: Number((survived / safeRuns).toFixed(3)),
    bands,
  };
}

export function exportWorldAnalyticsCsv(history: TelemetryHistoryPoint[]): string {
  const headers = [
    'step',
    'yearsNumeric',
    'meanTempC',
    'co2Ppm',
    'o2Percent',
    'biomassPercent',
    'faunaPercent',
    'livingSpeciesCount',
    'biodiversityIndex',
    'habitabilityPercent',
    'extinctionSeverityPercent',
  ];
  const rows = history.map((h) =>
    [
      h.step,
      h.yearsNumeric.toFixed(2),
      h.meanTempC.toFixed(2),
      h.co2Ppm.toFixed(1),
      h.o2Percent.toFixed(2),
      h.biomassPercent.toFixed(2),
      h.faunaPercent.toFixed(2),
      h.livingSpeciesCount,
      h.biodiversityIndex.toFixed(3),
      h.habitabilityPercent.toFixed(1),
      h.extinctionSeverityPercent.toFixed(1),
    ].join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export function compareWorldSnapshots(
  items: { label: string; snapshot: { params: { co2Ppm: number; solarLuminosity: number; seaLevelMeters: number }; speciesLineages?: { isExtinct: boolean }[] } }[]
) {
  return items.map((item) => ({
    label: item.label,
    co2Ppm: item.snapshot.params.co2Ppm,
    solarLuminosity: item.snapshot.params.solarLuminosity,
    seaLevelMeters: item.snapshot.params.seaLevelMeters,
    livingSpeciesCount: (item.snapshot.speciesLineages ?? []).filter((s) => !s.isExtinct).length,
  }));
}

