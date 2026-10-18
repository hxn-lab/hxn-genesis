import { Noise3D, SeededRNG } from './rng';

export type GeochemicalElement = 'C' | 'O' | 'N' | 'P' | 'S' | 'FE' | 'H2O';
export type ReservoirDomain = 'CRUST' | 'OCEAN' | 'ATMOSPHERE' | 'BIOSPHERE';

export interface ElementalReservoir {
  element: GeochemicalElement;
  unit: 'Gt';
  crust: number;
  ocean: number;
  atmosphere: number;
  biosphere: number;
  initialTotal: number;
}

export interface ExtractionExperimentResult {
  id: string;
  resourceType: 'IRON_ORE' | 'PHOSPHATE' | 'HYDROCARBON_CARBON' | 'SULFIDE_MINERAL';
  extractedGt: number;
  recycledFraction: number;
  co2ReleasedPpm: number;
  pollutionDelta: number;
  depletionPercent: number;
}

export interface GeochemistryState {
  enabled: boolean;
  reservoirs: Record<GeochemicalElement, ElementalReservoir>;
  weatheringRateGtYr: number;
  volcanicOutgassingGtYr: number;
  carbonBurialGtYr: number;
  nutrientLimitationFactor: number;
  cumulativeExtractedGt: number;
  environmentalPollutionIndex: number;
  massBalanceMaxDriftPercent: number;
  extractionHistory: ExtractionExperimentResult[];
  modelDisclaimer: 'SIMPLIFIED_BOX_RESERVOIR_MASS_BALANCE';
}

export function createDefaultGeochemistryState(): GeochemistryState {
  const make = (
    element: GeochemicalElement,
    crust: number,
    ocean: number,
    atmosphere: number,
    biosphere: number
  ): ElementalReservoir => ({
    element,
    unit: 'Gt',
    crust,
    ocean,
    atmosphere,
    biosphere,
    initialTotal: crust + ocean + atmosphere + biosphere
  });

  return {
    enabled: true,
    reservoirs: {
      C: make('C', 65000000, 38000, 850, 0),
      O: make('O', 120000000, 86000000, 1180000, 0),
      N: make('N', 1900000, 24000, 3860000, 0),
      P: make('P', 420000, 92, 0.05, 0),
      S: make('S', 18000000, 1280000, 4.8, 0),
      FE: make('FE', 95000000, 18, 0.02, 0),
      H2O: make('H2O', 220000000, 1380000000, 12900, 0)
    },
    weatheringRateGtYr: 0.28,
    volcanicOutgassingGtYr: 0.26,
    carbonBurialGtYr: 0.14,
    nutrientLimitationFactor: 1.0,
    cumulativeExtractedGt: 0,
    environmentalPollutionIndex: 0,
    massBalanceMaxDriftPercent: 0,
    extractionHistory: [],
    modelDisclaimer: 'SIMPLIFIED_BOX_RESERVOIR_MASS_BALANCE'
  };
}

function transferMass(
  res: ElementalReservoir,
  from: Exclude<keyof ElementalReservoir, 'element' | 'unit' | 'initialTotal'>,
  to: Exclude<keyof ElementalReservoir, 'element' | 'unit' | 'initialTotal'>,
  amountGt: number
): number {
  if (amountGt <= 0) return 0;
  const actual = Math.min(res[from], amountGt);
  res[from] -= actual;
  res[to] += actual;
  return actual;
}

export function stepGeochemistryReservoirs(
  state: GeochemistryState,
  dtYears: number,
  meanTempK: number,
  precipMmDay: number,
  volcanicActivity: number,
  globalBiomassFrac: number
): void {
  if (!state.enabled || dtYears <= 0) return;
  const clampedYears = Math.min(dtYears, 250000);

  const tempFactor = Math.exp(0.045 * ((meanTempK - 288.15) / 10));
  const runoffFactor = Math.max(0.05, precipMmDay / 2.4);
  state.weatheringRateGtYr = 0.25 * tempFactor * runoffFactor;
  state.volcanicOutgassingGtYr = 0.25 * Math.max(0, volcanicActivity * 5.0);
  state.carbonBurialGtYr = 0.12 + globalBiomassFrac * 0.45;

  const cRes = state.reservoirs.C;
  const pRes = state.reservoirs.P;
  const oRes = state.reservoirs.O;

  transferMass(cRes, 'crust', 'atmosphere', state.volcanicOutgassingGtYr * clampedYears * 0.01);
  transferMass(cRes, 'atmosphere', 'ocean', state.weatheringRateGtYr * clampedYears * 0.01);
  transferMass(cRes, 'ocean', 'crust', state.carbonBurialGtYr * clampedYears * 0.008);

  const targetBioC = globalBiomassFrac * 2400;
  if (targetBioC > cRes.biosphere) {
    transferMass(cRes, 'ocean', 'biosphere', Math.min(200, targetBioC - cRes.biosphere));
  } else if (targetBioC < cRes.biosphere) {
    transferMass(cRes, 'biosphere', 'ocean', cRes.biosphere - targetBioC);
  }

  transferMass(pRes, 'crust', 'ocean', state.weatheringRateGtYr * 0.004 * clampedYears * 0.01);
  transferMass(pRes, 'ocean', 'crust', 0.0008 * clampedYears * 0.01);
  transferMass(oRes, 'ocean', 'atmosphere', globalBiomassFrac * 0.15 * clampedYears * 0.01);

  state.nutrientLimitationFactor = Math.max(0.25, Math.min(1.5, pRes.ocean / 92));
  state.environmentalPollutionIndex = Math.max(
    0,
    state.environmentalPollutionIndex * Math.exp(-clampedYears * 0.002)
  );

  updateMassBalanceDiagnostics(state);
}

export function updateMassBalanceDiagnostics(state: GeochemistryState): number {
  let maxDrift = 0;
  for (const key of Object.keys(state.reservoirs) as GeochemicalElement[]) {
    const r = state.reservoirs[key];
    const currentTotal = r.crust + r.ocean + r.atmosphere + r.biosphere;
    const driftPct =
      r.initialTotal > 0 ? (Math.abs(currentTotal - r.initialTotal) / r.initialTotal) * 100 : 0;
    if (driftPct > maxDrift) maxDrift = driftPct;
  }
  state.massBalanceMaxDriftPercent = maxDrift;
  return maxDrift;
}

export function generateMineralDepositField(
  seed: string,
  numCells: number,
  cellNx: Float32Array,
  cellNy: Float32Array,
  cellNz: Float32Array,
  tectonicBoundaryField: Float32Array,
  elevation: Float32Array,
  outField: Float32Array
): void {
  const noise = new Noise3D(`${seed}-geochem-minerals`);
  for (let i = 0; i < numCells; i++) {
    const nx = cellNx[i];
    const ny = cellNy[i];
    const nz = cellNz[i];
    const vein = Math.max(0, noise.ridged(nx * 3.8, ny * 3.8, nz * 3.8, 3));
    const tecBoost = Math.abs(tectonicBoundaryField[i]) * 0.55;
    const highland = elevation[i] > 1200 ? 0.2 : 0.05;
    outField[i] = Math.max(0, Math.min(1, vein * 0.55 + tecBoost + highland));
  }
}

export function runResourceExtractionExperiment(
  state: GeochemistryState,
  mineralField: Float32Array,
  resourceType: ExtractionExperimentResult['resourceType'],
  intensityFraction: number,
  recyclingFraction = 0.25
): ExtractionExperimentResult {
  const s = Math.max(0.05, Math.min(1.0, intensityFraction));
  const rec = Math.max(0, Math.min(0.95, recyclingFraction));
  const netFactor = s * (1 - rec * 0.7);

  let meanDeposit = 0;
  for (let i = 0; i < mineralField.length; i++) {
    meanDeposit += mineralField[i];
    mineralField[i] = Math.max(0.02, mineralField[i] * (1 - netFactor * 0.22));
  }
  meanDeposit /= Math.max(1, mineralField.length);

  const extractedGt = Number((meanDeposit * 450 * s).toFixed(2));
  let co2ReleasedPpm = 0;
  let pollutionDelta = 0;

  if (resourceType === 'HYDROCARBON_CARBON') {
    transferMass(state.reservoirs.C, 'crust', 'atmosphere', extractedGt);
    co2ReleasedPpm = Math.round(extractedGt * 1.4);
    pollutionDelta = Number((0.18 * netFactor).toFixed(3));
  } else if (resourceType === 'PHOSPHATE') {
    transferMass(state.reservoirs.P, 'crust', 'ocean', extractedGt * 0.08);
    co2ReleasedPpm = Math.round(extractedGt * 0.15);
    pollutionDelta = Number((0.09 * netFactor).toFixed(3));
  } else if (resourceType === 'SULFIDE_MINERAL') {
    transferMass(state.reservoirs.S, 'crust', 'atmosphere', extractedGt * 0.12);
    co2ReleasedPpm = Math.round(extractedGt * 0.25);
    pollutionDelta = Number((0.22 * netFactor).toFixed(3));
  } else {
    transferMass(state.reservoirs.FE, 'crust', 'biosphere', extractedGt * 0.05);
    co2ReleasedPpm = Math.round(extractedGt * 0.2);
    pollutionDelta = Number((0.11 * netFactor).toFixed(3));
  }

  state.cumulativeExtractedGt = Number((state.cumulativeExtractedGt + extractedGt).toFixed(2));
  state.environmentalPollutionIndex = Math.min(1, state.environmentalPollutionIndex + pollutionDelta);
  updateMassBalanceDiagnostics(state);

  const result: ExtractionExperimentResult = {
    id: `EXT-${state.extractionHistory.length + 1}`,
    resourceType,
    extractedGt,
    recycledFraction: rec,
    co2ReleasedPpm,
    pollutionDelta,
    depletionPercent: Number((netFactor * 22).toFixed(1))
  };
  state.extractionHistory.unshift(result);
  if (state.extractionHistory.length > 15) state.extractionHistory.length = 15;
  return result;
}
