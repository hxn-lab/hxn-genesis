import { SimParameters, TrophicGuild } from './types';

export const MOD_API_VERSION = '1.0.0';

export interface ModPlanetPresetDef {
  key: string;
  label: string;
  temperatureOffsetK: number;
  pressureBar: number;
  o2Percent: number;
  co2Ppm: number;
  seaLevelMeters: number;
}

export interface ModSpeciesTemplateDef {
  name: string;
  guild: TrophicGuild;
  isMarine: boolean;
  optimalTempK: number;
  stressResistance: number;
}

export interface ModEventRuleDef {
  id: string;
  title: string;
  description: string;
  tempOffsetDeltaK: number;
  co2DeltaPpm: number;
}

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  targetApiVersion: string;
  author: string;
  description: string;
  dependencies: string[];
  planetPresets?: ModPlanetPresetDef[];
  speciesTemplates?: ModSpeciesTemplateDef[];
  eventRules?: ModEventRuleDef[];
}

export interface RegisteredExtension {
  manifest: ExtensionManifest;
  enabled: boolean;
  status: 'VALID' | 'INCOMPATIBLE_API' | 'MISSING_DEPENDENCY' | 'SCHEMA_ERROR';
  errorMessage?: string;
}

export interface ModdingSystemState {
  apiVersion: string;
  extensions: RegisteredExtension[];
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export const BUILTIN_EXAMPLE_EXTENSION: ExtensionManifest = {
  id: 'ext.subsurface-europa-pack',
  name: 'Cryo-Ocean & Extremophile Pack',
  version: '1.0.0',
  targetApiVersion: '1.0.0',
  author: 'HXN Scientific Modding Team',
  description:
    'Adds a Tidally Heated Ice Moon preset, Radiotrophic Archaea species archetype, and Cryovolcanic Plume event.',
  dependencies: [],
  planetPresets: [
    {
      key: 'CRYO_TIDAL_MOON',
      label: 'Tidally Heated Cryo-Moon',
      temperatureOffsetK: -16,
      pressureBar: 0.65,
      o2Percent: 4.5,
      co2Ppm: 1400,
      seaLevelMeters: 850,
    },
  ],
  speciesTemplates: [
    {
      name: 'Radiotrophic Cryo-Archaea',
      guild: 'MICROBE_CHEMO',
      isMarine: true,
      optimalTempK: 266,
      stressResistance: 0.95,
    },
  ],
  eventRules: [
    {
      id: 'ev-cryo-plume-surge',
      title: 'Subsurface Cryovolcanic Plume Surge',
      description: 'Tidal flexing vents warm volatile-rich brines and CO2 into the atmosphere.',
      tempOffsetDeltaK: 3.5,
      co2DeltaPpm: 450,
    },
  ],
};

export function createDefaultModdingState(): ModdingSystemState {
  const state: ModdingSystemState = {
    apiVersion: MOD_API_VERSION,
    extensions: [],
  };
  registerExtensionManifest(state, BUILTIN_EXAMPLE_EXTENSION);
  return state;
}

export function validateExtensionManifest(
  manifest: unknown,
  installedIds: string[] = []
): { valid: boolean; status: RegisteredExtension['status']; error?: string; normalized?: ExtensionManifest } {
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, status: 'SCHEMA_ERROR', error: 'Manifest must be a valid JSON object.' };
  }
  const m = manifest as Record<string, unknown>;
  if (typeof m.id !== 'string' || !m.id.trim() || typeof m.name !== 'string' || typeof m.version !== 'string') {
    return { valid: false, status: 'SCHEMA_ERROR', error: 'Manifest requires string fields: id, name, and version.' };
  }
  if (typeof m.targetApiVersion !== 'string' || !m.targetApiVersion.startsWith('1.')) {
    return {
      valid: false,
      status: 'INCOMPATIBLE_API',
      error: `Incompatible targetApiVersion "${String(m.targetApiVersion)}". Expected 1.x.`,
    };
  }
  const deps = Array.isArray(m.dependencies) ? m.dependencies.filter((d): d is string => typeof d === 'string') : [];
  for (const dep of deps) {
    if (!installedIds.includes(dep)) {
      return {
        valid: false,
        status: 'MISSING_DEPENDENCY',
        error: `Missing required dependency extension "${dep}".`,
      };
    }
  }

  const normalized: ExtensionManifest = {
    id: m.id.trim(),
    name: m.name.trim(),
    version: m.version.trim(),
    targetApiVersion: m.targetApiVersion.trim(),
    author: typeof m.author === 'string' ? m.author : 'Community Author',
    description: typeof m.description === 'string' ? m.description : '',
    dependencies: deps,
    planetPresets: Array.isArray(m.planetPresets) ? (m.planetPresets as ModPlanetPresetDef[]) : [],
    speciesTemplates: Array.isArray(m.speciesTemplates) ? (m.speciesTemplates as ModSpeciesTemplateDef[]) : [],
    eventRules: Array.isArray(m.eventRules) ? (m.eventRules as ModEventRuleDef[]) : [],
  };

  return { valid: true, status: 'VALID', normalized };
}

export function registerExtensionManifest(
  state: ModdingSystemState,
  rawManifest: unknown
): RegisteredExtension {
  const installedIds = state.extensions
    .filter((e) => e.enabled && e.status === 'VALID')
    .map((e) => e.manifest.id);
  const check = validateExtensionManifest(rawManifest, installedIds);

  if (!check.valid || !check.normalized) {
    const fallbackManifest: ExtensionManifest = {
      id: (rawManifest as Record<string, unknown>)?.id
        ? String((rawManifest as Record<string, unknown>).id)
        : `invalid-${Date.now()}`,
      name: (rawManifest as Record<string, unknown>)?.name
        ? String((rawManifest as Record<string, unknown>).name)
        : 'Invalid Extension',
      version: '0.0.0',
      targetApiVersion: String((rawManifest as Record<string, unknown>)?.targetApiVersion ?? '0.0.0'),
      author: 'Unknown',
      description: check.error ?? 'Failed validation',
      dependencies: [],
    };
    const entry: RegisteredExtension = {
      manifest: fallbackManifest,
      enabled: false,
      status: check.status,
      errorMessage: check.error,
    };
    state.extensions.unshift(entry);
    return entry;
  }

  const existingIdx = state.extensions.findIndex((e) => e.manifest.id === check.normalized!.id);
  const entry: RegisteredExtension = {
    manifest: check.normalized,
    enabled: true,
    status: 'VALID',
  };
  if (existingIdx >= 0) {
    state.extensions[existingIdx] = entry;
  } else {
    state.extensions.push(entry);
  }
  return entry;
}

export function applyExtensionContentToParams(
  state: ModdingSystemState,
  params: SimParameters,
  extensionId: string
): { applied: boolean; summary: string } {
  const ext = state.extensions.find((e) => e.manifest.id === extensionId && e.status === 'VALID' && e.enabled);
  if (!ext) {
    return { applied: false, summary: 'Extension is not active or valid.' };
  }

  const parts: string[] = [];
  if (ext.manifest.planetPresets && ext.manifest.planetPresets.length > 0) {
    const p = ext.manifest.planetPresets[0];
    params.temperatureOffsetK = clamp(p.temperatureOffsetK, -40, 40);
    params.pressureBar = clamp(p.pressureBar, 0.006, 90);
    params.o2Percent = clamp(p.o2Percent, 0, 35);
    params.co2Ppm = clamp(p.co2Ppm, 50, 10000);
    params.seaLevelMeters = clamp(p.seaLevelMeters, -6000, 6000);
    parts.push(`preset "${p.label}"`);
  }

  if (ext.manifest.eventRules && ext.manifest.eventRules.length > 0) {
    const ev = ext.manifest.eventRules[0];
    params.temperatureOffsetK = clamp(params.temperatureOffsetK + ev.tempOffsetDeltaK, -40, 40);
    params.co2Ppm = clamp(params.co2Ppm + ev.co2DeltaPpm, 50, 10000);
    parts.push(`event "${ev.title}"`);
  }

  return {
    applied: true,
    summary: `Applied ${ext.manifest.name}: ${parts.join(', ') || 'registered templates'}.`,
  };
}
