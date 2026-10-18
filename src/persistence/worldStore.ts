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

export const CURRENT_SNAPSHOT_VERSION = 4;
export const MAX_IMPORT_JSON_BYTES = 18 * 1024 * 1024; // 18 MB safety ceiling
export const STORAGE_KEY_WORLD_LIBRARY = 'hxn_genesis_worlds_v4';
export const STORAGE_KEY_AUTOSAVE = 'hxn_genesis_autosave_v4';

export interface SavedWorldEntry {
  id: string;
  name: string;
  updatedAtIso: string;
  isAutosave?: boolean;
  snapshot: SerializedWorldSnapshot;
}

/**
 * Migrates any v1, v2, v3, or v4 snapshot to v4, preserving all existing fields
 * and populating safe defaults for newly added 3.0 properties (`planet`, `terrain`,
 * `geology`, `pressureBar`, `argonPercent`).
 */
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
    timeState: snap.timeState,
    speedSci: snap.speedSci || { mantissa: 1, exponent: 0 },
    paused: Boolean(snap.paused),
    elevation: snap.elevation,
    temperature: snap.temperature,
    humidity: Array.isArray(snap.humidity) && snap.humidity.length === numCells ? snap.humidity : new Array(numCells).fill(0.5),
    precipitation: Array.isArray(snap.precipitation) && snap.precipitation.length === numCells ? snap.precipitation : new Array(numCells).fill(1.0),
    iceThickness: Array.isArray(snap.iceThickness) && snap.iceThickness.length === numCells ? snap.iceThickness : new Array(numCells).fill(0),
    waterWaveAnomaly: Array.isArray(snap.waterWaveAnomaly) && snap.waterWaveAnomaly.length === numCells ? snap.waterWaveAnomaly : new Array(numCells).fill(0),
    volcanicHeat: Array.isArray(snap.volcanicHeat) && snap.volcanicHeat.length === numCells ? snap.volcanicHeat : new Array(numCells).fill(0),
    sediment: Array.isArray(snap.sediment) && snap.sediment.length === numCells ? snap.sediment : new Array(numCells).fill(0),
    biomass: Array.isArray(snap.biomass) && snap.biomass.length === numCells ? snap.biomass : new Array(numCells).fill(0),
    fauna: Array.isArray(snap.fauna) && snap.fauna.length === numCells ? snap.fauna : new Array(numCells).fill(0),
    biodiversity: Array.isArray(snap.biodiversity) && snap.biodiversity.length === numCells ? snap.biodiversity : new Array(numCells).fill(0),
    extinctionImpact: Array.isArray(snap.extinctionImpact) && snap.extinctionImpact.length === numCells ? snap.extinctionImpact : new Array(numCells).fill(0),
    speciesLineages: Array.isArray(snap.speciesLineages) ? snap.speciesLineages : [],
    telemetryHistory: Array.isArray(snap.telemetryHistory) ? snap.telemetryHistory : [],
    activeHazards: Array.isArray(snap.activeHazards) ? snap.activeHazards : [],
    eventLog: Array.isArray(snap.eventLog) ? snap.eventLog : []
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
