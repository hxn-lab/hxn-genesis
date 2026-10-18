import { SeededRNG } from './rng';
import { GlobalTelemetry } from './types';

export type ObjectiveMetricKey =
  | 'HABITABILITY_PERCENT'
  | 'MEAN_TEMP_C'
  | 'O2_PERCENT'
  | 'OCEAN_PERCENT'
  | 'LIVING_SPECIES_COUNT'
  | 'CIVILIZATION_TECH_INDEX'
  | 'DISCOVERY_COUNT';

export interface MissionObjective {
  id: string;
  description: string;
  metric: ObjectiveMetricKey;
  comparator: 'GTE' | 'LTE' | 'BETWEEN';
  targetMin: number;
  targetMax?: number;
  currentValue: number;
  completed: boolean;
}

export interface PlanetaryMission {
  id: string;
  title: string;
  category:
    | 'HABITABILITY_RESCUE'
    | 'TERRAFORMING_CHALLENGE'
    | 'BIOSPHERE_GENESIS'
    | 'ASTEROID_DEFENSE'
    | 'CUSTOM_CHALLENGE';
  seed: string;
  maxSteps: number;
  startStep: number;
  hintText: string;
  objectives: MissionObjective[];
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED_TIMEOUT';
  score: number;
}

export interface MissionAchievement {
  id: string;
  title: string;
  unlockedAtStep: number;
}

export interface MissionSystemState {
  activeMissions: PlanetaryMission[];
  achievements: MissionAchievement[];
  totalScore: number;
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function createDefaultMissionSystemState(seed: string): MissionSystemState {
  const defaultMission = generateProceduralMission(seed, 0);
  return {
    activeMissions: [defaultMission],
    achievements: [],
    totalScore: 0,
  };
}

export function generateProceduralMission(seed: string, currentStep: number): PlanetaryMission {
  const rng = new SeededRNG(`mission-${seed}-${currentStep}`);
  const templates: Array<{
    category: PlanetaryMission['category'];
    title: string;
    hintText: string;
    objectives: Omit<MissionObjective, 'currentValue' | 'completed'>[];
  }> = [
    {
      category: 'HABITABILITY_RESCUE',
      title: 'Temperate Biosphere Stabilization',
      hintText: 'Balance greenhouse gases and ocean inventory to sustain temperate surface conditions.',
      objectives: [
        {
          id: 'obj-hab',
          description: 'Achieve Habitability >= 55%',
          metric: 'HABITABILITY_PERCENT',
          comparator: 'GTE',
          targetMin: 55,
        },
        {
          id: 'obj-temp',
          description: 'Maintain Mean Temp between 2 °C and 30 °C',
          metric: 'MEAN_TEMP_C',
          comparator: 'BETWEEN',
          targetMin: 2,
          targetMax: 30,
        },
      ],
    },
    {
      category: 'BIOSPHERE_GENESIS',
      title: 'Great Oxygenation & Adaptive Radiation',
      hintText: 'Seed microbial and photosynthetic lineages to oxygenate the atmosphere and diversify clades.',
      objectives: [
        {
          id: 'obj-o2',
          description: 'Raise Atmospheric O2 >= 12%',
          metric: 'O2_PERCENT',
          comparator: 'GTE',
          targetMin: 12,
        },
        {
          id: 'obj-species',
          description: 'Sustain at least 3 living species lineages',
          metric: 'LIVING_SPECIES_COUNT',
          comparator: 'GTE',
          targetMin: 3,
        },
      ],
    },
    {
      category: 'TERRAFORMING_CHALLENGE',
      title: 'Hydrological & Frontier Survey',
      hintText: 'Maintain open oceans and conduct planetary surface discoveries.',
      objectives: [
        {
          id: 'obj-ocean',
          description: 'Keep Ocean Coverage between 35% and 85%',
          metric: 'OCEAN_PERCENT',
          comparator: 'BETWEEN',
          targetMin: 35,
          targetMax: 85,
        },
        {
          id: 'obj-disc',
          description: 'Catalog at least 1 surface discovery',
          metric: 'DISCOVERY_COUNT',
          comparator: 'GTE',
          targetMin: 1,
        },
      ],
    },
  ];

  const chosen = templates[rng.int(0, templates.length - 1)];
  return {
    id: `MISSION-${seed}-${currentStep}`,
    title: chosen.title,
    category: chosen.category,
    seed,
    maxSteps: 5000,
    startStep: currentStep,
    hintText: chosen.hintText,
    objectives: chosen.objectives.map((o) => ({
      ...o,
      currentValue: 0,
      completed: false,
    })),
    status: 'ACTIVE',
    score: 0,
  };
}

export function evaluateMissionsState(
  missionState: MissionSystemState,
  telemetry: GlobalTelemetry,
  currentStep: number,
  extraMetrics: {
    maxCivTechIndex: number;
    discoveryCount: number;
  }
): void {
  const readMetric = (key: ObjectiveMetricKey): number => {
    switch (key) {
      case 'HABITABILITY_PERCENT':
        return telemetry.meanHabitability * 100;
      case 'MEAN_TEMP_C':
        return telemetry.meanSurfaceTempC;
      case 'O2_PERCENT':
        return telemetry.oxygenPercent;
      case 'OCEAN_PERCENT':
        return telemetry.oceanCoverageFraction * 100;
      case 'LIVING_SPECIES_COUNT':
        return telemetry.livingSpeciesCount;
      case 'CIVILIZATION_TECH_INDEX':
        return extraMetrics.maxCivTechIndex;
      case 'DISCOVERY_COUNT':
        return extraMetrics.discoveryCount;
    }
  };

  for (const m of missionState.activeMissions) {
    if (m.status !== 'ACTIVE') continue;

    let allDone = true;
    for (const obj of m.objectives) {
      const val = readMetric(obj.metric);
      obj.currentValue = Number(val.toFixed(2));
      if (obj.comparator === 'GTE') {
        obj.completed = val >= obj.targetMin;
      } else if (obj.comparator === 'LTE') {
        obj.completed = val <= obj.targetMin;
      } else {
        obj.completed = val >= obj.targetMin && val <= (obj.targetMax ?? obj.targetMin + 50);
      }
      if (!obj.completed) allDone = false;
    }

    if (allDone) {
      m.status = 'COMPLETED';
      m.score = 250 * m.objectives.length;
      missionState.totalScore += m.score;
      missionState.achievements.unshift({
        id: `ACH-${m.id}`,
        title: `Completed: ${m.title}`,
        unlockedAtStep: currentStep,
      });
    } else if (currentStep - m.startStep > m.maxSteps) {
      m.status = 'FAILED_TIMEOUT';
    }
  }
}

export function createCustomChallengeMission(
  missionState: MissionSystemState,
  seed: string,
  currentStep: number,
  config: {
    title: string;
    maxSteps: number;
    hintText: string;
    metric: ObjectiveMetricKey;
    comparator: 'GTE' | 'LTE' | 'BETWEEN';
    targetMin: number;
    targetMax?: number;
  }
): PlanetaryMission {
  const mission: PlanetaryMission = {
    id: `CUSTOM-${missionState.activeMissions.length + 1}-${currentStep}`,
    title: config.title.trim() || 'Custom Planetary Challenge',
    category: 'CUSTOM_CHALLENGE',
    seed,
    maxSteps: clamp(config.maxSteps, 10, 100000),
    startStep: currentStep,
    hintText: config.hintText.trim() || 'Adjust planetary parameters to reach the target range.',
    objectives: [
      {
        id: 'obj-custom-1',
        description: `${config.metric} ${config.comparator} ${config.targetMin}${config.targetMax !== undefined ? `..${config.targetMax}` : ''}`,
        metric: config.metric,
        comparator: config.comparator,
        targetMin: config.targetMin,
        targetMax: config.targetMax,
        currentValue: 0,
        completed: false,
      },
    ],
    status: 'ACTIVE',
    score: 0,
  };
  missionState.activeMissions.unshift(mission);
  return mission;
}

export function exportChallengeMissionJson(mission: PlanetaryMission): string {
  return JSON.stringify(mission, null, 2);
}

export function importChallengeMissionJson(
  missionState: MissionSystemState,
  rawJson: string
): { ok: boolean; error?: string; mission?: PlanetaryMission } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    return {
      ok: false,
      error: `Invalid mission JSON syntax: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Mission payload must be a JSON object.' };
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.title !== 'string' || !Array.isArray(obj.objectives) || obj.objectives.length === 0) {
    return { ok: false, error: 'Mission JSON is missing required fields: title and non-empty objectives array.' };
  }
  const mission: PlanetaryMission = {
    id: typeof obj.id === 'string' ? obj.id : `IMPORTED-${Date.now()}`,
    title: obj.title,
    category: 'CUSTOM_CHALLENGE',
    seed: typeof obj.seed === 'string' ? obj.seed : 'imported-seed',
    maxSteps: typeof obj.maxSteps === 'number' ? clamp(obj.maxSteps, 10, 100000) : 5000,
    startStep: typeof obj.startStep === 'number' ? obj.startStep : 0,
    hintText: typeof obj.hintText === 'string' ? obj.hintText : 'Imported challenge scenario.',
    objectives: obj.objectives.map((item: Record<string, unknown>, idx: number) => ({
      id: typeof item.id === 'string' ? item.id : `obj-${idx + 1}`,
      description: typeof item.description === 'string' ? item.description : 'Custom objective',
      metric: (typeof item.metric === 'string' ? item.metric : 'HABITABILITY_PERCENT') as ObjectiveMetricKey,
      comparator: item.comparator === 'LTE' || item.comparator === 'BETWEEN' ? item.comparator : 'GTE',
      targetMin: typeof item.targetMin === 'number' ? item.targetMin : 50,
      targetMax: typeof item.targetMax === 'number' ? item.targetMax : undefined,
      currentValue: 0,
      completed: false,
    })),
    status: 'ACTIVE',
    score: 0,
  };
  missionState.activeMissions.unshift(mission);
  return { ok: true, mission };
}
