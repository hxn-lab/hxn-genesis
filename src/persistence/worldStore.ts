/**
 * World Management, Persistence, Versioned Migrations & Safe Import/Export for HXN GENESIS 3.0.
 *
 * Supports:
 * - New world, Save, Save As, Load, Duplicate, Rename, Delete
 * - Autosave with status tracking
 * - Versioned migrations (v1 / v2 / v3 -> v4) without dropping fields
 * - Validation and size limits on imported JSON files to protect against malformed or oversized inputs
 */
import { createDefaultGeologyParameters, validateGeologyParameters } from '../sim/geology';
import { createDefaultPlanetProperties, validatePlanetProperties } from '../sim/planetPhysics';
import { createDefaultTerrainSettings, validateTerrainSettings } from '../sim/terrainGen';
import { SerializedWorldSnapshot } from '../sim/types';
import { createDefaultMagnetosphereState } from '../sim/magnetism';
import { createDefaultSpaceWeatherState } from '../sim/spaceWeather';
import { createDefaultGeochemistryState } from '../sim/geochemistry';
import { createDefaultNaturalHistoryState } from '../sim/naturalHistory';
import { createDefaultExplorationState } from '../sim/exploration';
import { createDefaultRemoteSensingState } from '../sim/remoteSensing';
import { createDefaultCivilizationState } from '../sim/civilization';
import { createDefaultTerraformingState } from '../sim/terraforming';
import { createDefaultMissionSystemState } from '../sim/missions';
import { createDefaultModdingState } from '../sim/modding';

export const CURRENT_SNAPSHOT_VERSION = 4;
export const MAX_IMPORT_JSON_BYTES = 18 * 1024 * 1024;
export const STORAGE_KEY_WORLD_LIBRARY = 'hxn_genesis_worlds_v4';
export const STORAGE_KEY_AUTOSAVE = 'hxn_genesis_autosave_v4';

export interface SavedWorldEntry {
  id: string;
  name: string;
  updatedAtIso: string;
  isAutosave?: boolean;
  snapshot: SerializedWorldSnapshot;
}

export function migrateSnapshotToV4(raw: unknown): SerializedWorldSnapshot {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid or corrupted snapshot structure: expected a JSON object.');
  }
  const snap = raw as Partial<SerializedWorldSnapshot>;
  if (!snap.params || typeof snap.params !== 'object' || !snap.timeState || !Array.isArray(snap.elevation)) {
    throw new Error('Invalid or corrupted snapshot structure: missing required fields.');
  }
  const gw = Number(snap.gridWidth);
  const gh = Number(snap.gridHeight);
  if (!Number.isInteger(gw) || !Number.isInteger(gh) || gw <= 0 || gh <= 0) {
    throw new Error('Invalid or corrupted snapshot grid dimensions.');
  }
  const numCells = gw * gh;
  if (snap.elevation.length !== numCells || !Array.isArray(snap.temperature) || snap.temperature.length !== numCells) {
    throw new Error('Corrupted snapshot array lengths do not match grid cell count.');
  }

  const elevation = new Array<number>(numCells);
  const temperature = new Array<number>(numCells);
  for (let i = 0; i < numCells; i++) {
    const elVal = Number(snap.elevation[i]);
    const tVal = Number(snap.temperature[i]);
    if (!Number.isFinite(elVal) || !Number.isFinite(tVal)) {
      throw new Error('Corrupted numerical values (NaN/Infinity) detected in snapshot arrays.');
    }
    elevation[i] = elVal;
    temperature[i] = tVal;
  }

  const validateOrCloneArray = (
    rawArr: unknown,
    fallbackVal: number,
    fieldLabel: string
  ): number[] => {
    if (!Array.isArray(rawArr) || rawArr.length !== numCells) {
      return new Array(numCells).fill(fallbackVal);
    }
    const cloned = new Array<number>(numCells);
    for (let i = 0; i < numCells; i++) {
      const v = Number(rawArr[i]);
      if (!Number.isFinite(v)) {
        throw new Error(`Corrupted numerical values (NaN/Infinity) detected in snapshot array: ${fieldLabel}`);
      }
      cloned[i] = v;
    }
    return cloned;
  };

  const migratedParams = {
    o2Percent: 0.1,
    pressureBar: 1.0,
    argonPercent: 0.93,
    oxygenProductionEfficiency: 1.0,
    abiogenesisEnabled: true,
    mutationRate: 1.0,
    selectionPressure: 1.0,
    reproductionMultiplier: 1.0,
    extinctionSusceptibility: 1.0,
    ...snap.params,
    planet: validatePlanetProperties(snap.params.planet ?? createDefaultPlanetProperties(snap.label || 'Genesis World')),
    terrain: validateTerrainSettings(snap.params.terrain ?? createDefaultTerrainSettings('EARTH_CONTINENTS')),
    geology: validateGeologyParameters(snap.params.geology ?? createDefaultGeologyParameters())
  };

  return {
    ...snap,
    version: CURRENT_SNAPSHOT_VERSION,
    label: String(snap.label || migratedParams.planet.name || 'Saved World'),
    createdAtIso: String(snap.createdAtIso || new Date().toISOString()),
    gridWidth: gw,
    gridHeight: gh,
    params: migratedParams,
    timeState: { ...snap.timeState },
    speedSci: snap.speedSci ? { ...snap.speedSci } : { mantissa: 1, exponent: 0 },
    paused: Boolean(snap.paused),
    elevation,
    generatedElevation: Array.isArray(snap.generatedElevation) && snap.generatedElevation.length === numCells
      ? validateOrCloneArray(snap.generatedElevation, 0, 'generatedElevation')
      : undefined,
    temperature,
    humidity: validateOrCloneArray(snap.humidity, 0.5, 'humidity'),
    precipitation: validateOrCloneArray(snap.precipitation, 1.0, 'precipitation'),
    iceThickness: validateOrCloneArray(snap.iceThickness, 0, 'iceThickness'),
    waterWaveAnomaly: validateOrCloneArray(snap.waterWaveAnomaly, 0, 'waterWaveAnomaly'),
    volcanicHeat: validateOrCloneArray(snap.volcanicHeat, 0, 'volcanicHeat'),
    sediment: validateOrCloneArray(snap.sediment, 0, 'sediment'),
    biomass: validateOrCloneArray(snap.biomass, 0, 'biomass'),
    fauna: validateOrCloneArray(snap.fauna, 0, 'fauna'),
    biodiversity: validateOrCloneArray(snap.biodiversity, 0, 'biodiversity'),
    extinctionImpact: validateOrCloneArray(snap.extinctionImpact, 0, 'extinctionImpact'),
    speciesLineages: Array.isArray(snap.speciesLineages)
      ? snap.speciesLineages.map((s) => ({ ...s, traits: { ...s.traits }, innovations: [...(s.innovations || [])] }))
      : [],
    telemetryHistory: Array.isArray(snap.telemetryHistory) ? snap.telemetryHistory.map((h) => ({ ...h })) : [],
    activeHazards: Array.isArray(snap.activeHazards) ? snap.activeHazards.map((h) => ({ ...h })) : [],
    eventLog: Array.isArray(snap.eventLog) ? snap.eventLog.map((e) => ({ ...e })) : [],
    magnetosphere: snap.magnetosphere ? JSON.parse(JSON.stringify(snap.magnetosphere)) : createDefaultMagnetosphereState(),
    spaceWeather: snap.spaceWeather ? JSON.parse(JSON.stringify(snap.spaceWeather)) : createDefaultSpaceWeatherState(),
    geochemistry: snap.geochemistry ? JSON.parse(JSON.stringify(snap.geochemistry)) : createDefaultGeochemistryState(),
    naturalHistory: snap.naturalHistory ? JSON.parse(JSON.stringify(snap.naturalHistory)) : createDefaultNaturalHistoryState(),
    exploration: snap.exploration ? JSON.parse(JSON.stringify(snap.exploration)) : createDefaultExplorationState(),
    remoteSensing: snap.remoteSensing ? JSON.parse(JSON.stringify(snap.remoteSensing)) : createDefaultRemoteSensingState(),
    civilization: snap.civilization ? JSON.parse(JSON.stringify(snap.civilization)) : createDefaultCivilizationState(),
    terraforming: snap.terraforming ? JSON.parse(JSON.stringify(snap.terraforming)) : createDefaultTerraformingState(),
    missions: snap.missions ? JSON.parse(JSON.stringify(snap.missions)) : createDefaultMissionSystemState(migratedParams.seed),
    modding: snap.modding ? JSON.parse(JSON.stringify(snap.modding)) : createDefaultModdingState()
  };
}

/**
 * Parses and validates raw JSON text for world import, enforcing byte-size limits
 * and finite-number array checks.
 */
export function parseAndValidateWorldJson(jsonText: string): SerializedWorldSnapshot {
  if (typeof jsonText !== 'string' || jsonText.trim().length === 0) {
    throw new Error('Empty world file.');
  }
  if (jsonText.length > MAX_IMPORT_JSON_BYTES) {
    throw new Error(`World file exceeds maximum allowed size (${Math.round(MAX_IMPORT_JSON_BYTES / (1024 * 1024))} MB).`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Malformed JSON file: ${(err as Error).message}`);
  }
  const migrated = migrateSnapshotToV4(parsed);
  for (let i = 0; i < migrated.elevation.length; i++) {
    if (!Number.isFinite(migrated.elevation[i]) || !Number.isFinite(migrated.temperature[i])) {
      throw new Error('Corrupted numerical values (NaN/Infinity) detected in snapshot arrays.');
    }
  }
  return migrated;
}

export class WorldLibraryManager {
  private entries: SavedWorldEntry[] = [];
  private lastAutosaveIso: string | null = null;

  constructor() {
    this.loadFromStorage();
  }

  public listWorlds(): SavedWorldEntry[] {
    return [...this.entries];
  }

  public getLastAutosaveIso(): string | null {
    return this.lastAutosaveIso;
  }

  public saveWorld(name: string, snapshot: SerializedWorldSnapshot, existingId?: string): SavedWorldEntry {
    const cleanName = name.trim() || snapshot.params.planet?.name || snapshot.label || 'Untitled World';
    const clonedSnap = migrateSnapshotToV4(JSON.parse(JSON.stringify({ ...snapshot, label: cleanName })));
    const nowIso = new Date().toISOString();

    if (existingId) {
      const idx = this.entries.findIndex((e) => e.id === existingId);
      if (idx >= 0) {
        this.entries[idx] = {
          ...this.entries[idx],
          name: cleanName,
          updatedAtIso: nowIso,
          snapshot: clonedSnap
        };
        this.persistToStorage();
        return this.entries[idx];
      }
    }

    const entry: SavedWorldEntry = {
      id: `world-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name: cleanName,
      updatedAtIso: nowIso,
      snapshot: clonedSnap
    };
    this.entries.unshift(entry);
    if (this.entries.length > 15) {
      this.entries.length = 15;
    }
    this.persistToStorage();
    return entry;
  }

  public duplicateWorld(id: string): SavedWorldEntry | null {
    const src = this.entries.find((e) => e.id === id);
    if (!src) return null;
    const copyName = `${src.name} (Copy)`;
    return this.saveWorld(copyName, src.snapshot);
  }

  public renameWorld(id: string, newName: string): boolean {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return false;
    const clean = newName.trim();
    if (!clean) return false;
    entry.name = clean;
    entry.snapshot.label = clean;
    if (entry.snapshot.params.planet) {
      entry.snapshot.params.planet.name = clean;
    }
    entry.updatedAtIso = new Date().toISOString();
    this.persistToStorage();
    return true;
  }

  public deleteWorld(id: string): boolean {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx < 0) return false;
    this.entries.splice(idx, 1);
    this.persistToStorage();
    return true;
  }

  public saveAutosave(snapshot: SerializedWorldSnapshot): string {
    const nowIso = new Date().toISOString();
    this.lastAutosaveIso = nowIso;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          STORAGE_KEY_AUTOSAVE,
          JSON.stringify({ updatedAtIso: nowIso, snapshot })
        );
      }
    } catch {
      // Ignore storage quota limits
    }
    return nowIso;
  }

  public loadAutosave(): SerializedWorldSnapshot | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY_AUTOSAVE);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return migrateSnapshotToV4(parsed.snapshot ?? parsed);
      }
    } catch {
      return null;
    }
    return null;
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY_WORLD_LIBRARY);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            const validEntries: SavedWorldEntry[] = [];
            for (const item of arr) {
              try {
                const snap = migrateSnapshotToV4(item.snapshot ?? item);
                validEntries.push({
                  id: String(item.id || `world-${validEntries.length}`),
                  name: String(item.name || snap.label || 'Saved World'),
                  updatedAtIso: String(item.updatedAtIso || snap.createdAtIso || new Date().toISOString()),
                  snapshot: snap
                });
              } catch {
                // Skip individual corrupted entries gracefully without crashing
              }
            }
            this.entries = validEntries;
          }
        }
      }
    } catch {
      this.entries = [];
    }
  }

  private persistToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_WORLD_LIBRARY, JSON.stringify(this.entries.slice(0, 8)));
      }
    } catch {
      // Ignore quota errors
    }
  }
}
