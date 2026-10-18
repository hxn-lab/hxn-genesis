import { SeededRNG } from './rng';
import { SpeciesLineage, SimParameters, GlobalTelemetry } from './types';

export type TechMilestone =
  | 'AGRICULTURE'
  | 'METALLURGY'
  | 'INDUSTRY'
  | 'RENEWABLES'
  | 'SPACEFLIGHT';

export type DiplomacyStance = 'COOPERATIVE' | 'NEUTRAL' | 'COMPETITIVE' | 'CONFLICT';

export interface SettlementNode {
  id: string;
  name: string;
  cellIndex: number;
  latDeg: number;
  lonDeg: number;
  populationMillions: number;
  infrastructureLevel: number;
}

export interface CivilizationEntity {
  id: string;
  name: string;
  originSpeciesId: string;
  originType: 'EVOLUTIONARY_SCENARIO' | 'EXPLICIT_INTERVENTION';
  foundedTimeLabel: string;
  active: boolean;
  collapsed: boolean;
  populationMillions: number;
  territoryCells: number[];
  techIndex: number;
  unlockedMilestones: TechMilestone[];
  energyDemandEJPerYr: number;
  renewableShare: number;
  resourceExtractionRate: number;
  pollutionOutputPpmPerStep: number;
  culturalResilience: number;
  diplomacyStance: DiplomacyStance;
  ecologicalFootprintIndex: number;
  settlements: SettlementNode[];
}

export interface CivilizationHistoryEntry {
  id: string;
  simTimeLabel: string;
  civId: string;
  category: 'EMERGENCE' | 'TECH_MILESTONE' | 'EXPANSION' | 'DIPLOMACY' | 'COLLAPSE' | 'RECOVERY' | 'STEWARDSHIP';
  summary: string;
}

export interface CivilizationState {
  enabled: boolean;
  autoEmergenceEnabled: boolean;
  minEnergyEfficiencyThreshold: number;
  minDispersalThreshold: number;
  civilizations: CivilizationEntity[];
  history: CivilizationHistoryEntry[];
  globalEnergyUseEJPerYr: number;
  globalAnthropogenicCo2Ppm: number;
  globalEcologicalStewardship: number;
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function createDefaultCivilizationState(): CivilizationState {
  return {
    enabled: true,
    autoEmergenceEnabled: true,
    minEnergyEfficiencyThreshold: 0.72,
    minDispersalThreshold: 0.55,
    civilizations: [],
    history: [],
    globalEnergyUseEJPerYr: 0,
    globalAnthropogenicCo2Ppm: 0,
    globalEcologicalStewardship: 0,
  };
}

const CIV_NAME_ROOTS = [
  'Aurelian',
  'Veridian',
  'Solari',
  'Thalassian',
  'Zephyran',
  'Boreal',
  'Caelum',
  'Kora',
];

function evaluateMilestones(techIndex: number): TechMilestone[] {
  const list: TechMilestone[] = [];
  if (techIndex >= 0.12) list.push('AGRICULTURE');
  if (techIndex >= 0.28) list.push('METALLURGY');
  if (techIndex >= 0.50) list.push('INDUSTRY');
  if (techIndex >= 0.72) list.push('RENEWABLES');
  if (techIndex >= 0.90) list.push('SPACEFLIGHT');
  return list;
}

export function spawnCivilizationEntity(
  civState: CivilizationState,
  opts: {
    originType: 'EVOLUTIONARY_SCENARIO' | 'EXPLICIT_INTERVENTION';
    speciesId?: string;
    cellIndex: number;
    latDeg: number;
    lonDeg: number;
    simTimeLabel: string;
    customName?: string;
    initialTechIndex?: number;
  }
): CivilizationEntity {
  const idx = civState.civilizations.length + 1;
  const rootName = CIV_NAME_ROOTS[(idx - 1) % CIV_NAME_ROOTS.length];
  const name = opts.customName?.trim() || `${rootName} Concord ${idx}`;
  const techIndex = clamp(opts.initialTechIndex ?? 0.16, 0.05, 1);

  const entity: CivilizationEntity = {
    id: `CIV-${idx}`,
    name,
    originSpeciesId: opts.speciesId ?? 'SAPIENT-ROOT',
    originType: opts.originType,
    foundedTimeLabel: opts.simTimeLabel,
    active: true,
    collapsed: false,
    populationMillions: 25,
    territoryCells: [opts.cellIndex],
    techIndex,
    unlockedMilestones: evaluateMilestones(techIndex),
    energyDemandEJPerYr: 18,
    renewableShare: techIndex >= 0.72 ? 0.65 : 0.18,
    resourceExtractionRate: 0.12,
    pollutionOutputPpmPerStep: 4.5,
    culturalResilience: 0.72,
    diplomacyStance: 'COOPERATIVE',
    ecologicalFootprintIndex: 0.14,
    settlements: [
      {
        id: `SETTLE-${idx}-1`,
        name: `${rootName} Prime`,
        cellIndex: opts.cellIndex,
        latDeg: Number(opts.latDeg.toFixed(1)),
        lonDeg: Number(opts.lonDeg.toFixed(1)),
        populationMillions: 25,
        infrastructureLevel: 1,
      },
    ],
  };

  civState.civilizations.push(entity);
  civState.history.unshift({
    id: `CIV-HIST-${civState.history.length + 1}`,
    simTimeLabel: opts.simTimeLabel,
    civId: entity.id,
    category: 'EMERGENCE',
    summary: `${entity.name} emerged (${entity.originType}) at (${entity.settlements[0].latDeg}°, ${entity.settlements[0].lonDeg}°).`,
  });
  return entity;
}

export function stepCivilizationsState(
  civState: CivilizationState,
  context: {
    seed: string;
    stepCount: number;
    dtYears: number;
    simTimeLabel: string;
    params: SimParameters;
    telemetry: GlobalTelemetry;
    speciesLineages: SpeciesLineage[];
    habitability: Float32Array;
    elevation: Float32Array;
    cellLatRad: Float32Array;
    cellLonRad: Float32Array;
  }
): { co2DeltaPpm: number; biomassModification: number } {
  if (!civState.enabled) {
    return { co2DeltaPpm: 0, biomassModification: 0 };
  }

  const rng = new SeededRNG(`${context.seed}-civ-${context.stepCount}`);

  if (civState.autoEmergenceEnabled && civState.civilizations.length === 0) {
    const candidate = context.speciesLineages.find(
      (s) =>
        !s.isExtinct &&
        (s.guild === 'APEX_PREDATOR' || s.guild === 'HERBIVORE_GRAZER') &&
        s.traits.energyEfficiency >= civState.minEnergyEfficiencyThreshold &&
        s.traits.dispersalCapability >= civState.minDispersalThreshold &&
        s.populationEstimate >= 50
    );
    if (candidate) {
      let bestCell = 0;
      let bestHab = -1;
      for (let i = 0; i < context.habitability.length; i++) {
        if (context.elevation[i] > context.params.seaLevelMeters && context.habitability[i] > bestHab) {
          bestHab = context.habitability[i];
          bestCell = i;
        }
      }
      spawnCivilizationEntity(civState, {
        originType: 'EVOLUTIONARY_SCENARIO',
        speciesId: candidate.id,
        cellIndex: bestCell,
        latDeg: (context.cellLatRad[bestCell] * 180) / Math.PI,
        lonDeg: (context.cellLonRad[bestCell] * 180) / Math.PI,
        simTimeLabel: context.simTimeLabel,
      });
    }
  }

  const dtNorm = clamp(Math.log10(Math.max(10, context.dtYears + 10)) * 0.08, 0.02, 0.45);
  let totalEnergy = 0;
  let totalCo2Delta = 0;
  let totalStewardship = 0;
  let activeCount = 0;

  for (const civ of civState.civilizations) {
    if (!civ.active) continue;
    activeCount++;

    const primaryCell = civ.territoryCells[0] ?? 0;
    const localHab = context.habitability[primaryCell] ?? context.telemetry.meanHabitability;
    const thermalPenalty =
      context.telemetry.meanSurfaceTempC > 42 || context.telemetry.meanSurfaceTempC < -18 ? 0.45 : 0;
    const envStress = clamp(1 - localHab + thermalPenalty + context.telemetry.extinctionSeverity * 0.6, 0, 1.6);

    const prevCount = civ.unlockedMilestones.length;
    civ.techIndex = clamp(civ.techIndex + (0.06 * localHab + 0.02 * civ.culturalResilience) * dtNorm, 0.05, 1.0);
    civ.unlockedMilestones = evaluateMilestones(civ.techIndex);

    if (civ.unlockedMilestones.length > prevCount) {
      const latest = civ.unlockedMilestones[civ.unlockedMilestones.length - 1];
      civState.history.unshift({
        id: `CIV-HIST-${civState.history.length + 1}`,
        simTimeLabel: context.simTimeLabel,
        civId: civ.id,
        category: 'TECH_MILESTONE',
        summary: `${civ.name} unlocked ${latest}.`,
      });
    }

    if (civ.unlockedMilestones.includes('RENEWABLES')) {
      civ.renewableShare = clamp(civ.renewableShare + 0.14 * dtNorm, 0, 0.96);
    }

    const growthRate = (0.22 * localHab + 0.09 * civ.techIndex - 0.26 * envStress) * dtNorm;
    civ.populationMillions = Number(clamp(civ.populationMillions * (1 + growthRate), 0.5, 24000).toFixed(1));

    if (civ.populationMillions > civ.settlements.length * 380 && civ.settlements.length < 6) {
      const nextCell = (primaryCell + civ.settlements.length * 29) % context.habitability.length;
      if (!civ.territoryCells.includes(nextCell)) {
        civ.territoryCells.push(nextCell);
      }
      const latDeg = Number(((context.cellLatRad[nextCell] * 180) / Math.PI).toFixed(1));
      const lonDeg = Number(((context.cellLonRad[nextCell] * 180) / Math.PI).toFixed(1));
      civ.settlements.push({
        id: `${civ.id}-S-${civ.settlements.length + 1}`,
        name: `${civ.name.split(' ')[0]} Hub ${civ.settlements.length + 1}`,
        cellIndex: nextCell,
        latDeg,
        lonDeg,
        populationMillions: Number((civ.populationMillions * 0.18).toFixed(1)),
        infrastructureLevel: Math.round(1 + civ.techIndex * 4),
      });
    }

    civ.energyDemandEJPerYr = Number((civ.populationMillions * (0.14 + civ.techIndex * 0.65)).toFixed(1));
    const fossilShare = clamp(1 - civ.renewableShare, 0.04, 1);
    civ.resourceExtractionRate = Number(
      clamp((civ.energyDemandEJPerYr / 1000) * (0.45 + fossilShare * 0.55), 0.01, 2.5).toFixed(3)
    );
    civ.pollutionOutputPpmPerStep = Number((civ.energyDemandEJPerYr * fossilShare * 0.08 * dtNorm).toFixed(2));
    civ.ecologicalFootprintIndex = Number(
      clamp(civ.resourceExtractionRate * 0.45 + fossilShare * 0.35 - civ.renewableShare * 0.25, 0.02, 1).toFixed(3)
    );

    if (envStress > 0.95 && civ.culturalResilience < 0.55 && rng.next() < 0.45) {
      civ.collapsed = true;
      civ.active = false;
      civ.populationMillions = Math.max(1, Number((civ.populationMillions * 0.15).toFixed(1)));
      civState.history.unshift({
        id: `CIV-HIST-${civState.history.length + 1}`,
        simTimeLabel: context.simTimeLabel,
        civId: civ.id,
        category: 'COLLAPSE',
        summary: `${civ.name} experienced systemic collapse under ecological & climatic stress.`,
      });
      continue;
    }

    totalEnergy += civ.energyDemandEJPerYr;
    totalCo2Delta += civ.pollutionOutputPpmPerStep;
    totalStewardship += civ.renewableShare * civ.culturalResilience;
  }

  if (civState.civilizations.length >= 2) {
    const activeCivs = civState.civilizations.filter((c) => c.active);
    if (activeCivs.length >= 2) {
      const meanResilience =
        activeCivs.reduce((acc, c) => acc + c.culturalResilience, 0) / activeCivs.length;
      const stance: DiplomacyStance =
        meanResilience >= 0.68 ? 'COOPERATIVE' : meanResilience >= 0.48 ? 'NEUTRAL' : 'COMPETITIVE';
      for (const c of activeCivs) {
        c.diplomacyStance = stance;
      }
    }
  }

  civState.globalEnergyUseEJPerYr = Number(totalEnergy.toFixed(1));
  civState.globalAnthropogenicCo2Ppm = Number((civState.globalAnthropogenicCo2Ppm + totalCo2Delta).toFixed(2));
  civState.globalEcologicalStewardship = activeCount > 0 ? Number((totalStewardship / activeCount).toFixed(3)) : 0;

  return {
    co2DeltaPpm: totalCo2Delta,
    biomassModification: civState.globalEcologicalStewardship > 0.55 ? 0.01 : -0.005 * activeCount,
  };
}

export function applyCivilizationPolicyAction(
  civState: CivilizationState,
  params: SimParameters,
  civId: string,
  policy: 'ECOLOGICAL_RESTORATION' | 'ACCELERATE_RENEWABLES' | 'DIPLOMATIC_ACCORD' | 'REVIVE_COLLAPSED',
  simTimeLabel: string
): boolean {
  const civ = civState.civilizations.find((c) => c.id === civId) ?? civState.civilizations[0];
  if (!civ) return false;

  if (policy === 'ECOLOGICAL_RESTORATION') {
    civ.renewableShare = clamp(civ.renewableShare + 0.25, 0, 0.98);
    civ.ecologicalFootprintIndex = clamp(civ.ecologicalFootprintIndex - 0.2, 0.02, 1);
    params.co2Ppm = clamp(params.co2Ppm * 0.92, 50, 10000);
  } else if (policy === 'ACCELERATE_RENEWABLES') {
    civ.techIndex = clamp(civ.techIndex + 0.2, 0.05, 1);
    civ.unlockedMilestones = evaluateMilestones(civ.techIndex);
    civ.renewableShare = clamp(civ.renewableShare + 0.3, 0, 0.98);
  } else if (policy === 'DIPLOMATIC_ACCORD') {
    civ.diplomacyStance = 'COOPERATIVE';
    civ.culturalResilience = clamp(civ.culturalResilience + 0.18, 0.1, 1);
  } else if (policy === 'REVIVE_COLLAPSED') {
    civ.collapsed = false;
    civ.active = true;
    civ.populationMillions = Math.max(20, civ.populationMillions);
    civ.culturalResilience = clamp(civ.culturalResilience + 0.25, 0.2, 1);
  }

  civState.history.unshift({
    id: `CIV-HIST-${civState.history.length + 1}`,
    simTimeLabel,
    civId: civ.id,
    category: policy === 'REVIVE_COLLAPSED' ? 'RECOVERY' : 'STEWARDSHIP',
    summary: `Applied ${policy} to ${civ.name}.`,
  });
  return true;
}
