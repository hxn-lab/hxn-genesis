/**
 * HXN GENESIS — Coupled Planetary Environmental, Biosphere & Evolutionary Simulation Core
 *
 * Strictly independent of Three.js or DOM rendering.
 * Simulates an initially abiotic (lifeless) planetary environment on a spherical equirectangular
 * lat-lon grid with cosine-latitude area weighting, plus an emergent/seedable Biosphere and
 * heritable Species Lineage Evolution Engine.
 */

import { EvolutionEngine } from './evolution';
import {
  advanceSafeTime,
  classifyTimeMode,
  createInitialTimeState,
  formatSciNumber,
  formatTimeBreakdown,
  normalizeSci,
  SafeSimTimeState,
  scaleSciNumber,
  SciNumber,
  sciToNumber,
  SECONDS_PER_DAY,
  SECONDS_PER_YEAR
} from './time';
import { clonePreset } from './presets';
import {
  ActiveHazardEvent,
  BiomeClassification,
  CellInspection,
  GlobalTelemetry,
  PresetName,
  SerializedWorldSnapshot,
  SimEventLogEntry,
  SimParameters,
  SpeciesLineage,
  TelemetryHistoryPoint
} from './types';
import {
  derivePlanetQuantities,
  PlanetProperties,
  validatePlanetProperties
} from './planetPhysics';
import {
  clampPressure,
  greenhouseForcingWm2,
  setGas,
  TrackedGas
} from './atmosphere';
import {
  generateTerrain,
  seaLevelForOceanFraction,
  TerrainSettings,
  validateTerrainSettings
} from './terrainGen';
import { applySculptBrush, SculptBrushOptions } from './sculpt';
import {
  applyTectonicPulse,
  computeTectonicBoundaryField,
  GeologyParameters,
  validateGeologyParameters
} from './geology';
import { GlobalExperimentEventType } from './events';
import { migrateSnapshotToV4 } from '../persistence/worldStore';
import {
  applyMagneticPreset,
  computeCellRadiationField,
  createDefaultMagnetosphereState,
  MagneticScenarioPreset,
  MagnetosphereState,
  updateMagnetosphereState
} from './magnetism';
import {
  applyMitigationToThreat,
  createDefaultSpaceWeatherState,
  MitigationActionKind,
  SpaceEventKind,
  SpaceWeatherState,
  spawnApproachingAsteroid,
  stepSpaceWeatherQueue,
  triggerSpaceWeatherEvent
} from './spaceWeather';
import {
  createDefaultGeochemistryState,
  generateMineralDepositField,
  GeochemistryState,
  runResourceExtractionExperiment,
  stepGeochemistryReservoirs
} from './geochemistry';
import {
  createDefaultNaturalHistoryState,
  EnvironmentReconstruction,
  NaturalHistoryState,
  reconstructPastEnvironment,
  recordStratigraphicLayer
} from './naturalHistory';
import {
  addExplorationBookmark,
  createDefaultExplorationState,
  evaluateLandingSites,
  ExplorationDiscovery,
  ExplorationState,
  performExpeditionScanAt,
  renameAtlasRegion
} from './exploration';
import {
  createDefaultRemoteSensingState,
  MissionType,
  ObservingMode,
  RemoteSensingState,
  runSyntheticObservation,
  scheduleObservationMission
} from './remoteSensing';
import {
  applyCivilizationPolicyAction,
  CivilizationEntity,
  CivilizationState,
  createDefaultCivilizationState,
  spawnCivilizationEntity,
  stepCivilizationsState
} from './civilization';
import {
  cancelTerraformingProject,
  createDefaultTerraformingState,
  launchTerraformingProject,
  recordTerraformingBranch,
  stepTerraformingProjects,
  TerraformingInterventionKind,
  TerraformingProject,
  TerraformingState
} from './terraforming';
import {
  createCustomChallengeMission,
  createDefaultMissionSystemState,
  evaluateMissionsState,
  MissionSystemState
} from './missions';
import {
  applyExtensionContentToParams,
  createDefaultModdingState,
  ModdingSystemState,
  registerExtensionManifest
} from './modding';

export const SOLAR_CONSTANT_WM2 = 1361.0;
export const STEFAN_BOLTZMANN_SIGMA = 5.670374419e-8;
export const LAPSE_RATE_K_PER_M = 0.0065;
export const FREEZING_POINT_K = 273.15;
export const SEA_ICE_POINT_K = 271.35;

export class WorldSimulation {
  public readonly gridWidth: number;
  public readonly gridHeight: number;
  public readonly numCells: number;

  public params: SimParameters;
  public timeState: SafeSimTimeState;
  public speedSci: SciNumber;
  public paused: boolean;

  // Primary physical state fields on spherical grid (gridWidth x gridHeight)
  public generatedElevation: Float32Array;
  public baseElevation: Float32Array;
  public elevation: Float32Array;
  public tectonicBoundaryField: Float32Array;
  public temperature: Float32Array;
  public humidity: Float32Array;
  public precipitation: Float32Array;
  public windU: Float32Array;
  public windV: Float32Array;
  public iceThickness: Float32Array;
  public waterWaveAnomaly: Float32Array;
  public volcanicHeat: Float32Array;
  public sediment: Float32Array;

  // Biosphere & Evolution spatial fields
  public habitability: Float32Array;
  public biomass: Float32Array;
  public fauna: Float32Array;
  public biodiversity: Float32Array;
  public extinctionImpact: Float32Array;
  public radiationField: Float32Array;
  public mineralField: Float32Array;

  // Scratch buffers to avoid per-step allocations
  private tempNext: Float32Array;
  private humNext: Float32Array;
  private bioNext: Float32Array;
  private faunaNext: Float32Array;

  // Precomputed spherical coordinates per cell
  public readonly cellLatRad: Float32Array;
  public readonly cellLonRad: Float32Array;
  public readonly cellCosLat: Float32Array;
  public readonly cellSinLat: Float32Array;
  public readonly cellNx: Float32Array;
  public readonly cellNy: Float32Array;
  public readonly cellNz: Float32Array;
  private totalAreaWeight: number;

  public evolutionEngine: EvolutionEngine;
  public speciesLineages: SpeciesLineage[] = [];
  public telemetryHistory: TelemetryHistoryPoint[] = [];
  public activeHazards: ActiveHazardEvent[] = [];
  public eventLog: SimEventLogEntry[] = [];
  public telemetry: GlobalTelemetry;

  public magnetosphere: MagnetosphereState;
  public spaceWeather: SpaceWeatherState;
  public geochemistry: GeochemistryState;
  public naturalHistory: NaturalHistoryState;
  public exploration: ExplorationState;
  public remoteSensing: RemoteSensingState;
  public civilization: CivilizationState;
  public terraforming: TerraformingState;
  public missions: MissionSystemState;
  public modding: ModdingSystemState;

  private previousBiomassFraction = 0;

  private undoStack: SerializedWorldSnapshot[] = [];
  private redoStack: SerializedWorldSnapshot[] = [];
  private maxUndoDepth = 25;

  constructor(gridWidth = 144, gridHeight = 72, initialPreset: PresetName = 'Earth-like', customSeed?: string) {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.numCells = gridWidth * gridHeight;

    this.params = clonePreset(initialPreset, customSeed);
    this.timeState = createInitialTimeState();
    this.speedSci = { mantissa: 1, exponent: 0 };
    this.paused = false;

    this.generatedElevation = new Float32Array(this.numCells);
    this.baseElevation = new Float32Array(this.numCells);
    this.elevation = new Float32Array(this.numCells);
    this.tectonicBoundaryField = new Float32Array(this.numCells);
    this.temperature = new Float32Array(this.numCells);
    this.humidity = new Float32Array(this.numCells);
    this.precipitation = new Float32Array(this.numCells);
    this.windU = new Float32Array(this.numCells);
    this.windV = new Float32Array(this.numCells);
    this.iceThickness = new Float32Array(this.numCells);
    this.waterWaveAnomaly = new Float32Array(this.numCells);
    this.volcanicHeat = new Float32Array(this.numCells);
    this.sediment = new Float32Array(this.numCells);

    this.habitability = new Float32Array(this.numCells);
    this.biomass = new Float32Array(this.numCells);
    this.fauna = new Float32Array(this.numCells);
    this.biodiversity = new Float32Array(this.numCells);
    this.extinctionImpact = new Float32Array(this.numCells);
    this.radiationField = new Float32Array(this.numCells);
    this.mineralField = new Float32Array(this.numCells);

    this.tempNext = new Float32Array(this.numCells);
    this.humNext = new Float32Array(this.numCells);
    this.bioNext = new Float32Array(this.numCells);
    this.faunaNext = new Float32Array(this.numCells);

    this.cellLatRad = new Float32Array(this.numCells);
    this.cellLonRad = new Float32Array(this.numCells);
    this.cellCosLat = new Float32Array(this.numCells);
    this.cellSinLat = new Float32Array(this.numCells);
    this.cellNx = new Float32Array(this.numCells);
    this.cellNy = new Float32Array(this.numCells);
    this.cellNz = new Float32Array(this.numCells);

    this.totalAreaWeight = 0;
    for (let y = 0; y < gridHeight; y++) {
      const v = (y + 0.5) / gridHeight;
      const lat = (0.5 - v) * Math.PI;
      const cosLat = Math.max(0.02, Math.cos(lat));
      const sinLat = Math.sin(lat);

      for (let x = 0; x < gridWidth; x++) {
        const u = (x + 0.5) / gridWidth;
        const lon = (u - 0.5) * 2 * Math.PI;
        const idx = y * gridWidth + x;

        this.cellLatRad[idx] = lat;
        this.cellLonRad[idx] = lon;
        this.cellCosLat[idx] = cosLat;
        this.cellSinLat[idx] = sinLat;

        this.cellNx[idx] = cosLat * Math.cos(lon);
        this.cellNy[idx] = sinLat;
        this.cellNz[idx] = cosLat * Math.sin(lon);

        this.totalAreaWeight += cosLat;
      }
    }

    this.magnetosphere = createDefaultMagnetosphereState();
    this.spaceWeather = createDefaultSpaceWeatherState();
    this.geochemistry = createDefaultGeochemistryState();
    this.naturalHistory = createDefaultNaturalHistoryState();
    this.exploration = createDefaultExplorationState();
    this.remoteSensing = createDefaultRemoteSensingState();
    this.civilization = createDefaultCivilizationState();
    this.terraforming = createDefaultTerraformingState();
    this.missions = createDefaultMissionSystemState(this.params.seed);
    this.modding = createDefaultModdingState();

    this.evolutionEngine = new EvolutionEngine(this.params.seed);
    this.telemetry = this.createEmptyTelemetry();
    this.generateWorldFromSeed(this.params.seed);
  }

  private createEmptyTelemetry(): GlobalTelemetry {
    return {
      meanSurfaceTempK: 288,
      meanSurfaceTempC: 14.85,
      minSurfaceTempC: -50,
      maxSurfaceTempC: 45,
      oceanCoverageFraction: 0.7,
      iceCoverageFraction: 0.1,
      meanHumidity: 0.6,
      meanPrecipitationMmDay: 2.5,
      maxWindSpeedMs: 18,
      radiativeForcingWm2: 0,
      planetaryAlbedo: 0.3,
      outgoingLongwaveWm2: 240,
      absorbedSolarWm2: 240,
      netEnergyImbalanceWm2: 0,
      effectiveSeaLevelMeters: 0,
      volcanicAerosolOpticalDepth: 0,
      globalBiomassFraction: 0,
      globalFaunaFraction: 0,
      meanHabitability: 0.5,
      oxygenPercent: 0.1,
      livingSpeciesCount: 0,
      extinctSpeciesCount: 0,
      biodiversityIndex: 0,
      extinctionSeverity: 0,
      recoveryTrend: 0,
      activeTimeMode: 'REALTIME',
      lastStepStabilityNote: 'Stable (CFL < 0.5)'
    };
  }

  public logEvent(
    category: SimEventLogEntry['category'],
    message: string,
    latDeg?: number,
    lonDeg?: number
  ): void {
    const timeBreakdown = formatTimeBreakdown(this.timeState);
    this.eventLog.unshift({
      id: `${this.timeState.stepsComputed}-${this.eventLog.length}`,
      simTimeFormatted: `${timeBreakdown.years} (${timeBreakdown.seconds})`,
      category,
      message,
      latDeg,
      lonDeg
    });
    if (this.eventLog.length > 150) {
      this.eventLog.length = 150;
    }
  }

  public pushUndoState(label = 'User Action'): void {
    const snap = this.serializeSnapshot(label);
    this.undoStack.push(snap);
    if (this.undoStack.length > this.maxUndoDepth) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): boolean {
    const snap = this.undoStack.pop();
    if (!snap) return false;
    this.redoStack.push(this.serializeSnapshot('Redo Point'));
    this.loadSnapshot(snap, false);
    this.logEvent('SYSTEM', `Undid action: ${snap.label}`);
    return true;
  }

  public redo(): boolean {
    const snap = this.redoStack.pop();
    if (!snap) return false;
    this.undoStack.push(this.serializeSnapshot('Undo Point'));
    this.loadSnapshot(snap, false);
    this.logEvent('SYSTEM', `Redid action: ${snap.label}`);
    return true;
  }

  /**
   * Deterministically generates planetary crust, continents, ocean trenches,
   * mountain belts, and equilibrium initial climate fields from `seed`.
   * Standard presets start strictly abiotic (0% biomass, 0% fauna, 0 species),
   * while specialized evolutionary testbed presets ("Mass Extinction Testbed", "Isolated Evolution",
   * "Low-Oxygen Biospheres") initialize their documented starting biosphere.
   */
  public generateWorldFromSeed(seed: string): void {
    this.params.seed = seed;
    if (this.params.o2Percent === undefined) this.params.o2Percent = 0.1;
    if (this.params.pressureBar === undefined) this.params.pressureBar = 1.0;
    if (this.params.argonPercent === undefined) this.params.argonPercent = 0.934;
    this.params.planet = validatePlanetProperties(this.params.planet);
    this.params.terrain = validateTerrainSettings(this.params.terrain);
    this.params.geology = validateGeologyParameters(this.params.geology);
    if (this.params.oxygenProductionEfficiency === undefined) this.params.oxygenProductionEfficiency = 1.0;
    if (this.params.abiogenesisEnabled === undefined) this.params.abiogenesisEnabled = true;
    if (this.params.mutationRate === undefined) this.params.mutationRate = 1.0;
    if (this.params.selectionPressure === undefined) this.params.selectionPressure = 1.0;
    if (this.params.reproductionMultiplier === undefined) this.params.reproductionMultiplier = 1.0;
    if (this.params.extinctionSusceptibility === undefined) this.params.extinctionSusceptibility = 1.0;

    this.evolutionEngine.reseed(seed);
    this.speciesLineages = [];
    this.telemetryHistory = [];
    this.previousBiomassFraction = 0;

    const geo = {
      numCells: this.numCells,
      cellNx: this.cellNx,
      cellNy: this.cellNy,
      cellNz: this.cellNz
    };

    generateTerrain(seed, this.params.terrain, geo, this.baseElevation);
    this.tectonicBoundaryField = computeTectonicBoundaryField(seed, geo);

    for (let i = 0; i < this.numCells; i++) {
      this.generatedElevation[i] = this.baseElevation[i];
      this.elevation[i] = this.baseElevation[i] * this.params.terrainScale;
      this.sediment[i] = 0;
      this.waterWaveAnomaly[i] = 0;
      this.volcanicHeat[i] = 0;
      this.biomass[i] = 0;
      this.fauna[i] = 0;
      this.biodiversity[i] = 0;
      this.extinctionImpact[i] = 0;
    }

    this.activeHazards = [];
    this.magnetosphere = createDefaultMagnetosphereState();
    this.spaceWeather = createDefaultSpaceWeatherState();
    this.geochemistry = createDefaultGeochemistryState();
    this.naturalHistory = createDefaultNaturalHistoryState();
    this.exploration = createDefaultExplorationState();
    this.remoteSensing = createDefaultRemoteSensingState();
    this.civilization = createDefaultCivilizationState();
    this.terraforming = createDefaultTerraformingState();
    this.missions = createDefaultMissionSystemState(seed);
    if (!this.modding) {
      this.modding = createDefaultModdingState();
    }

    generateMineralDepositField(
      seed,
      this.numCells,
      this.cellNx,
      this.cellNy,
      this.cellNz,
      this.tectonicBoundaryField,
      this.volcanicHeat,
      this.mineralField
    );

    this.initializeEquilibriumClimate();
    this.syncMagnetosphereAndRadiation();
    this.computeHabitabilityField(this.params.seaLevelMeters);

    if (this.params.preset === 'Mass Extinction Testbed' || this.params.preset === 'Isolated Evolution') {
      this.seedScenarioBiosphere(true);
    } else if (this.params.preset === 'Low-Oxygen Biospheres') {
      this.seedScenarioBiosphere(false);
    }

    this.updateTelemetry('Initialized deterministic world from seed');
    this.refreshExplorationLandingSites();
    this.recordStratigraphySnapshot('Planetary Crust & Primary Atmosphere Formation');
    this.recordTelemetryHistoryPoint();
    this.logEvent('SYSTEM', `Generated world with seed "${seed}" (${this.params.preset})`);
  }

  private seedScenarioBiosphere(withFauna: boolean): void {
    for (let i = 0; i < this.numCells; i++) {
      const hab = this.habitability[i];
      if (hab > 0.18) {
        this.biomass[i] = Math.min(1.0, hab * 0.8);
        if (withFauna && hab > 0.32) {
          this.fauna[i] = Math.min(1.0, (hab - 0.22) * 0.65);
        }
      }
    }
    const f1 = this.evolutionEngine.createFounderSpecies('MICROBE_CHEMO', true, 292, 1.0, '0 yr');
    const f2 = this.evolutionEngine.createFounderSpecies('PRODUCER_FLORA', true, 290, 1.0, '0 yr', f1.id);
    this.speciesLineages.push(f1, f2);
    if (withFauna) {
      const f3 = this.evolutionEngine.createFounderSpecies('PRODUCER_FLORA', false, 291, 0.55, '0 yr', f2.id);
      const f4 = this.evolutionEngine.createFounderSpecies('HERBIVORE_GRAZER', false, 291, 0.55, '0 yr', f3.id);
      const f5 = this.evolutionEngine.createFounderSpecies('APEX_PREDATOR', false, 291, 0.55, '0 yr', f4.id);
      this.speciesLineages.push(f3, f4, f5);
    }
  }

  public getEffectiveLapseRate(): number {
    return this.params.planet ? derivePlanetQuantities(this.params.planet).lapseRateKPerM : LAPSE_RATE_K_PER_M;
  }

  public initializeEquilibriumClimate(): void {
    const co2Forcing = greenhouseForcingWm2(this.params.co2Ppm, this.params.pressureBar ?? 1.0);
    const solarDeltaK = (this.params.solarLuminosity - 1.0) * 58.0;
    const globalOffset = co2Forcing * 0.75 + solarDeltaK + this.params.temperatureOffsetK;
    const lapseRate = this.getEffectiveLapseRate();

    for (let i = 0; i < this.numCells; i++) {
      const cosLat = this.cellCosLat[i];
      const elev = this.elevation[i];
      const seaLevel = this.params.seaLevelMeters;
      const heightAboveSea = Math.max(0, elev - seaLevel);

      const baseLatTemp = 246.0 + 55.0 * Math.pow(cosLat, 1.35);
      const lapseCooling = heightAboveSea * lapseRate;
      const t = Math.max(150, Math.min(420, baseLatTemp + globalOffset - lapseCooling));
      this.temperature[i] = t;

      const isOcean = elev < seaLevel;
      const baseHum = isOcean ? 0.78 : 0.42;
      this.humidity[i] = Math.max(0, Math.min(1, baseHum * cosLat * this.params.humidityMultiplier));

      if (t < FREEZING_POINT_K) {
        const freezeDepth = (FREEZING_POINT_K - t) * 45.0;
        this.iceThickness[i] = Math.min(3500, freezeDepth * (0.4 + 0.6 * this.humidity[i]));
      } else {
        this.iceThickness[i] = 0;
      }

      this.precipitation[i] = this.humidity[i] * 3.2 * this.params.precipitationMultiplier;
    }

    this.updateAtmosphericWinds();
  }

  public computeHabitabilityField(effectiveSeaLevel: number): void {
    const livingSpeciesCount = this.speciesLineages.filter((s) => !s.isExtinct).length;
    for (let i = 0; i < this.numCells; i++) {
      const t = this.temperature[i];
      const ice = this.iceThickness[i];
      const elev = this.elevation[i];
      const isOcean = elev < effectiveSeaLevel;
      const volc = this.volcanicHeat[i];

      let tempSuitability = 0;
      if (t > 263.15 && t < 328.15) {
        const distFromOpt = Math.abs(t - 294.15);
        tempSuitability = Math.max(0, 1.0 - Math.pow(distFromOpt / 32.0, 2));
      }

      const icePenalty = Math.max(0, 1.0 - ice / 35.0);
      const lavaPenalty = volc > 40 ? Math.max(0, 1.0 - (volc - 40) / 100.0) : 1.0;

      let waterNutrientSuitability = 0;
      if (isOcean) {
        const depth = effectiveSeaLevel - elev;
        const photicBonus = Math.exp(-depth / 850.0);
        const ventBonus = volc > 0.5 && volc <= 40 ? 0.35 : 0;
        waterNutrientSuitability = Math.min(1.0, 0.38 + 0.62 * photicBonus + ventBonus);
      } else {
        const alt = elev - effectiveSeaLevel;
        const altFactor = Math.max(0, 1.0 - alt / 6000.0);
        const moistureFactor = Math.min(1.0, this.humidity[i] * 0.9 + this.precipitation[i] / 5.5);
        waterNutrientSuitability = moistureFactor * altFactor;
      }

      const hab = Math.max(
        0,
        Math.min(1, tempSuitability * waterNutrientSuitability * icePenalty * lavaPenalty)
      );
      this.habitability[i] = hab;

      // Update local spatial biodiversity score from local biomass + fauna + global lineage diversity
      const speciesFactor = Math.min(1.0, livingSpeciesCount / 6.0);
      this.biodiversity[i] = Math.min(
        1.0,
        (this.biomass[i] * 0.55 + this.fauna[i] * 0.45) * (0.4 + 0.6 * speciesFactor) * hab
      );
    }
  }

  public resetClimateOnly(): void {
    this.pushUndoState('Partial Reset (Climate & Hazards)');
    this.activeHazards = [];
    this.waterWaveAnomaly.fill(0);
    this.volcanicHeat.fill(0);
    this.extinctionImpact.fill(0);
    this.initializeEquilibriumClimate();
    this.computeHabitabilityField(this.params.seaLevelMeters);
    this.updateTelemetry('Climate reset to radiative equilibrium');
    this.logEvent('GOD_ACTION', 'Partial Reset: restored atmosphere, ocean waves, and ice to equilibrium.');
  }

  public fullReset(preset: PresetName = this.params.preset, seed = this.params.seed): void {
    this.pushUndoState('Full World Reset');
    this.params = clonePreset(preset, seed);
    this.timeState = createInitialTimeState();
    this.activeHazards = [];
    this.generateWorldFromSeed(this.params.seed);
    this.logEvent('GOD_ACTION', `Full World Reset to preset "${preset}" (seed: ${this.params.seed}).`);
  }

  public setTerrainScale(scale: number): void {
    this.params.terrainScale = Math.max(0.1, Math.min(3.0, scale));
    for (let i = 0; i < this.numCells; i++) {
      this.elevation[i] = this.baseElevation[i] * this.params.terrainScale - this.sediment[i];
    }
    this.updateTelemetry('Updated global terrain relief scale');
  }

  public sculptTerrainAtLatLon(
    latDeg: number,
    lonDeg: number,
    deltaMeters: number,
    radiusRad = 0.16
  ): void {
    const lat = (latDeg * Math.PI) / 180;
    const lon = (lonDeg * Math.PI) / 180;
    const tx = Math.cos(lat) * Math.cos(lon);
    const ty = Math.sin(lat);
    const tz = Math.cos(lat) * Math.sin(lon);
    const cosRadius = Math.cos(radiusRad);
    const lapseRate = this.getEffectiveLapseRate();

    for (let i = 0; i < this.numCells; i++) {
      const dot = this.cellNx[i] * tx + this.cellNy[i] * ty + this.cellNz[i] * tz;
      if (dot > cosRadius) {
        const distRad = Math.acos(Math.min(1, dot));
        const falloff = 0.5 * (1 + Math.cos((Math.PI * distRad) / radiusRad));
        const change = deltaMeters * falloff;
        this.elevation[i] = Math.max(-11000, Math.min(12000, this.elevation[i] + change));
        this.baseElevation[i] = this.elevation[i] / Math.max(0.1, this.params.terrainScale);

        if (this.elevation[i] > this.params.seaLevelMeters) {
          this.temperature[i] -= change * lapseRate * 0.5;
        }
      }
    }
    this.computeHabitabilityField(this.telemetry.effectiveSeaLevelMeters);
    this.updateTelemetry('Localized terrain sculpted');
  }

  /**
   * 3.0 Terrain & Cryosphere Sculpting Workshop: applies any of the 12 brush tools
   * with selectable falloff, shape, and longitudinal/equatorial symmetry.
   */
  public applyBrushStroke(opts: SculptBrushOptions, recordUndo = false): void {
    if (recordUndo) {
      this.pushUndoState(`Brush ${opts.tool}`);
    }
    applySculptBrush(
      {
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        numCells: this.numCells,
        cellNx: this.cellNx,
        cellNy: this.cellNy,
        cellNz: this.cellNz,
        elevation: this.elevation,
        baseElevation: this.baseElevation,
        generatedElevation: this.generatedElevation,
        iceThickness: this.iceThickness,
        temperature: this.temperature,
        seaLevelMeters: this.params.seaLevelMeters,
        terrainScale: this.params.terrainScale
      },
      opts
    );
    this.computeHabitabilityField(this.telemetry.effectiveSeaLevelMeters);
    this.updateTelemetry(`Applied ${opts.tool} brush`);
  }

  /**
   * Updates physical & orbital properties and optionally syncs stellar insolation (`solarLuminosity`).
   */
  public applyPlanetProperties(partial: Partial<PlanetProperties>, syncInsolation = true): void {
    this.params.planet = validatePlanetProperties({
      ...(this.params.planet || {}),
      ...partial
    });
    const derived = derivePlanetQuantities(this.params.planet);
    if (syncInsolation) {
      this.params.solarLuminosity = derived.simInsolation;
    }
    this.updateTelemetry('Updated planet physical & orbital parameters');
  }

  /**
   * Regenerates procedural terrain with updated TerrainSettings (style, roughness, mountainHeight, etc.).
   */
  public regenerateTerrainWithSettings(partial: Partial<TerrainSettings>, recordUndo = true): void {
    if (recordUndo) {
      this.pushUndoState('Regenerate Terrain Style');
    }
    this.params.terrain = validateTerrainSettings({
      ...(this.params.terrain || {}),
      ...partial
    });
    const geo = {
      numCells: this.numCells,
      cellNx: this.cellNx,
      cellNy: this.cellNy,
      cellNz: this.cellNz
    };
    generateTerrain(this.params.seed, this.params.terrain, geo, this.baseElevation);
    for (let i = 0; i < this.numCells; i++) {
      this.generatedElevation[i] = this.baseElevation[i];
      this.elevation[i] = this.baseElevation[i] * this.params.terrainScale;
      this.sediment[i] = 0;
    }
    this.initializeEquilibriumClimate();
    this.computeHabitabilityField(this.params.seaLevelMeters);
    this.updateTelemetry(`Regenerated terrain (${this.params.terrain.style})`);
    this.logEvent('GOD_ACTION', `Regenerated terrain with style ${this.params.terrain.style}.`);
  }

  /**
   * Solves and sets `seaLevelMeters` so the area-weighted ocean coverage matches `fraction` [0, 1].
   */
  public setOceanCoverageFraction(fraction: number, recordUndo = false): number {
    if (recordUndo) {
      this.pushUndoState('Adjust Ocean Coverage Target');
    }
    let meanIceMeters = 0;
    for (let i = 0; i < this.numCells; i++) {
      meanIceMeters += this.iceThickness[i] * this.cellCosLat[i];
    }
    meanIceMeters /= this.totalAreaWeight;
    const targetEffectiveSea = seaLevelForOceanFraction(this.elevation, this.cellCosLat, fraction);
    this.params.seaLevelMeters = Math.max(-9000, Math.min(9000, targetEffectiveSea + meanIceMeters * 0.35));
    this.computeHabitabilityField(targetEffectiveSea);
    this.updateTelemetry('Adjusted sea level for target ocean coverage');
    return this.telemetry.oceanCoverageFraction;
  }

  /**
   * Updates one tracked atmospheric gas (`O2`, `CO2`, `AR`) while keeping other tracked gases unchanged
   * and letting N2 absorb the balance.
   */
  public setAtmosphereGas(gas: TrackedGas, value: number): void {
    const next = setGas(
      {
        pressureBar: this.params.pressureBar ?? 1.0,
        o2Percent: this.params.o2Percent ?? 0.1,
        co2Ppm: this.params.co2Ppm,
        argonPercent: this.params.argonPercent ?? 0.934
      },
      gas,
      value
    );
    this.params.o2Percent = next.o2Percent;
    this.params.co2Ppm = next.co2Ppm;
    this.params.argonPercent = next.argonPercent;
    this.updateTelemetry(`Updated atmospheric ${gas}`);
  }

  public setSurfacePressure(pressureBar: number): void {
    this.params.pressureBar = clampPressure(pressureBar);
    this.updateTelemetry(`Updated surface pressure to ${this.params.pressureBar.toFixed(2)} bar`);
  }

  /**
   * Applies a geological tectonic uplift/rifting pulse along Voronoi plate boundaries.
   */
  public triggerTectonicPulse(impulseScale = 1.0): { meanAbsDeltaMeters: number; co2OutgassedPpm: number } {
    this.pushUndoState('Tectonic Pulse');
    this.params.geology = validateGeologyParameters(this.params.geology);
    const res = applyTectonicPulse(
      this.tectonicBoundaryField,
      this.params.geology,
      this.elevation,
      this.baseElevation,
      this.params.terrainScale,
      impulseScale
    );
    this.params.co2Ppm = Math.min(10000, this.params.co2Ppm + res.co2OutgassedPpm);
    this.computeHabitabilityField(this.telemetry.effectiveSeaLevelMeters);
    this.updateTelemetry('Applied tectonic plate boundary pulse');
    this.logEvent(
      'GOD_ACTION',
      `Tectonic Pulse: mean relief shift ${res.meanAbsDeltaMeters.toFixed(0)} m, outgassed +${res.co2OutgassedPpm} ppm CO2.`
    );
    return res;
  }

  /**
   * Executes a global environmental experiment (`GLOBAL_COOLING`, `RAPID_GREENHOUSE`,
   * `ATMOSPHERE_LOSS`, `OCEAN_LOSS`, `STERILIZE`, `SEED_GLOBAL_LIFE`, `RECOVERY_EXPERIMENT`).
   */
  public triggerGlobalExperiment(type: GlobalExperimentEventType, intensity = 0.85): void {
    const s = Math.max(0.1, Math.min(1.0, intensity));
    if (type === 'STERILIZE') {
      this.sterilizeBiosphere();
      return;
    }
    if (type === 'SEED_GLOBAL_LIFE') {
      this.seedGlobalBiosphere(true);
      return;
    }

    this.pushUndoState(`Global Event: ${type}`);

    if (type === 'GLOBAL_COOLING') {
      this.params.temperatureOffsetK = Math.max(-40, this.params.temperatureOffsetK - 14 * s);
      this.params.co2Ppm = Math.max(60, Math.round(this.params.co2Ppm * (1 - 0.45 * s)));
      for (let i = 0; i < this.numCells; i++) {
        this.temperature[i] = Math.max(150, this.temperature[i] - 12 * s);
        if (this.temperature[i] < FREEZING_POINT_K) {
          this.iceThickness[i] = Math.min(3800, this.iceThickness[i] + 380 * s);
        }
        this.biomass[i] *= Math.max(0.1, 1 - 0.35 * s);
        this.fauna[i] *= Math.max(0.05, 1 - 0.5 * s);
      }
      this.logEvent('CLIMATE', `Global Cooling Event triggered (-${(12 * s).toFixed(1)} °C impulse).`);
    } else if (type === 'RAPID_GREENHOUSE') {
      this.params.co2Ppm = Math.min(10000, Math.round(this.params.co2Ppm + 2400 * s));
      this.params.temperatureOffsetK = Math.min(40, this.params.temperatureOffsetK + 10 * s);
      for (let i = 0; i < this.numCells; i++) {
        this.temperature[i] = Math.min(440, this.temperature[i] + 11 * s);
        this.iceThickness[i] = Math.max(0, this.iceThickness[i] * (1 - 0.75 * s));
      }
      this.logEvent('CLIMATE', `Rapid Greenhouse Spike triggered (+${Math.round(2400 * s)} ppm CO2).`);
    } else if (type === 'ATMOSPHERE_LOSS') {
      this.params.pressureBar = clampPressure((this.params.pressureBar ?? 1.0) * 0.05);
      this.params.o2Percent = 0.02;
      this.params.co2Ppm = 90;
      this.params.humidityMultiplier = 0.1;
      for (let i = 0; i < this.numCells; i++) {
        this.humidity[i] *= 0.1;
        this.precipitation[i] *= 0.1;
        this.fauna[i] = 0;
        this.biomass[i] *= 0.05;
        this.extinctionImpact[i] = Math.min(1, this.extinctionImpact[i] + 0.9);
      }
      this.logEvent('HAZARD', 'Atmospheric Stripping: surface pressure and volatiles collapsed.');
    } else if (type === 'OCEAN_LOSS') {
      this.setOceanCoverageFraction(0.02, false);
      this.params.humidityMultiplier = 0.12;
      this.params.precipitationMultiplier = 0.12;
      for (let i = 0; i < this.numCells; i++) {
        this.humidity[i] *= 0.18;
        this.precipitation[i] *= 0.15;
        this.biomass[i] *= 0.12;
        this.fauna[i] *= 0.05;
        this.extinctionImpact[i] = Math.min(1, this.extinctionImpact[i] + 0.85);
      }
      this.logEvent('HAZARD', 'Global Ocean Loss: seas evaporated into arid basins.');
    } else if (type === 'RECOVERY_EXPERIMENT') {
      this.params.pressureBar = 1.0;
      this.params.co2Ppm = 320;
      this.params.temperatureOffsetK = 0;
      this.params.humidityMultiplier = 1.1;
      this.params.precipitationMultiplier = 1.1;
      this.extinctionImpact.fill(0);
      this.initializeEquilibriumClimate();
      this.seedGlobalBiosphere(true);
      this.logEvent('BIOSPHERE', 'Ecological Recovery Pulse: restored temperate climate and re-seeded habitats.');
    }

    this.computeHabitabilityField(this.telemetry.effectiveSeaLevelMeters);
    this.updateTelemetry(`Executed global experiment: ${type}`);
    this.recordTelemetryHistoryPoint();
  }

  /**
   * God Mode Biosphere Tool: Seeds local life (`MICROBES`, `FLORA`, `FAUNA`) at (latDeg, lonDeg)
   * and registers corresponding founder species lineages if none exist yet.
   */
  public seedLifeAtLatLon(
    kind: 'MICROBES' | 'FLORA' | 'FAUNA',
    latDeg: number,
    lonDeg: number,
    intensity = 0.85,
    radiusRad = 0.22
  ): void {
    this.pushUndoState(`Seed ${kind}`);
    const lat = (latDeg * Math.PI) / 180;
    const lon = (lonDeg * Math.PI) / 180;
    const tx = Math.cos(lat) * Math.cos(lon);
    const ty = Math.sin(lat);
    const tz = Math.cos(lat) * Math.sin(lon);
    const cosRadius = Math.cos(radiusRad);

    this.computeHabitabilityField(this.telemetry.effectiveSeaLevelMeters);
    const targetIdx = this.latLonToCellIndex(latDeg, lonDeg);
    const isTargetMarine = this.elevation[targetIdx] < this.telemetry.effectiveSeaLevelMeters;
    const localTempK = this.temperature[targetIdx];
    const localHum = this.humidity[targetIdx];
    const epochStr = formatTimeBreakdown(this.timeState).years;

    for (let i = 0; i < this.numCells; i++) {
      const dot = this.cellNx[i] * tx + this.cellNy[i] * ty + this.cellNz[i] * tz;
      if (dot > cosRadius) {
        const distRad = Math.acos(Math.min(1, dot));
        const falloff = 0.5 * (1 + Math.cos((Math.PI * distRad) / radiusRad));
        const hab = Math.max(0.18, this.habitability[i]);

        if (kind === 'MICROBES') {
          this.biomass[i] = Math.min(1.0, this.biomass[i] + 0.5 * intensity * falloff * hab);
        } else if (kind === 'FLORA') {
          this.biomass[i] = Math.min(1.0, this.biomass[i] + 0.85 * intensity * falloff * hab);
        } else if (kind === 'FAUNA') {
          this.biomass[i] = Math.max(this.biomass[i], 0.55 * intensity * falloff * hab);
          this.fauna[i] = Math.min(1.0, this.fauna[i] + 0.8 * intensity * falloff * hab);
          // Ensure sufficient local O2 for animal respiration when explicitly seeded in God Mode
          if ((this.params.o2Percent ?? 0.1) < 3.0) {
            this.params.o2Percent = 3.5;
          }
        }
      }
    }

    // Register founder species lineage in Evolution Engine
    const guild =
      kind === 'MICROBES' ? 'MICROBE_CHEMO' :
      kind === 'FLORA' ? 'PRODUCER_FLORA' : 'HERBIVORE_GRAZER';

    const existingSameGuild = this.speciesLineages.find(
      (s) => !s.isExtinct && s.guild === guild && s.isMarine === isTargetMarine
    );
    if (!existingSameGuild) {
      const parent = this.speciesLineages.find((s) => !s.isExtinct) || null;
      const founder = this.evolutionEngine.createFounderSpecies(
        guild,
        isTargetMarine,
        localTempK,
        localHum,
        epochStr,
        parent ? parent.id : null
      );
      founder.dominantBiome = this.classifyCellBiome(targetIdx);
      this.speciesLineages.push(founder);
      this.logEvent('EVOLUTION', `New founder lineage established: ${founder.name} (${founder.guild})`, latDeg, lonDeg);
    }

    this.updateTelemetry(`Seeded ${kind} at (${latDeg.toFixed(1)}°, ${lonDeg.toFixed(1)}°)`);
    this.recordTelemetryHistoryPoint();
    this.logEvent(
      'BIOSPHERE',
      `Seeded ${kind} at ${latDeg.toFixed(1)}°, ${lonDeg.toFixed(1)}°`,
      latDeg,
      lonDeg
    );
  }

  /**
   * God Mode: Removes / drives extinct a specific species lineage by ID.
   */
  public removeSpeciesById(speciesId: string): boolean {
    const sp = this.speciesLineages.find((s) => s.id === speciesId && !s.isExtinct);
    if (!sp) return false;
    this.pushUndoState(`Remove Species ${sp.name}`);
    sp.isExtinct = true;
    sp.populationEstimate = 0;
    sp.occupiedCells = 0;
    sp.extinctTimeYears = formatTimeBreakdown(this.timeState).years;
    sp.causeOfExtinction = 'Removed via God Mode Intervention';

    // Reduce global fauna or biomass proportionally if no other species of that guild remain
    const remainingProducers = this.speciesLineages.filter(
      (s) => !s.isExtinct && (s.guild === 'MICROBE_CHEMO' || s.guild === 'PRODUCER_FLORA')
    );
    const remainingConsumers = this.speciesLineages.filter(
      (s) => !s.isExtinct && (s.guild === 'HERBIVORE_GRAZER' || s.guild === 'APEX_PREDATOR')
    );

    if (remainingConsumers.length === 0) {
      for (let i = 0; i < this.numCells; i++) this.fauna[i] *= 0.1;
    }
    if (remainingProducers.length === 0) {
      for (let i = 0; i < this.numCells; i++) this.biomass[i] *= 0.1;
    }

    this.updateTelemetry(`Removed species ${sp.name}`);
    this.logEvent('EVOLUTION', `Removed species ${sp.name} via God Mode.`);
    return true;
  }

  /**
   * God Mode Biosphere Tool: Seeds life globally across all habitable regions of the planet.
   */
  public seedGlobalBiosphere(includeFauna = true): void {
    this.pushUndoState('Global Biosphere Bloom');
    this.computeHabitabilityField(this.telemetry.effectiveSeaLevelMeters);
    for (let i = 0; i < this.numCells; i++) {
      const hab = this.habitability[i];
      if (hab > 0.12) {
        this.biomass[i] = Math.min(1.0, Math.max(this.biomass[i], hab * 0.88));
        if (includeFauna && hab > 0.28) {
          this.fauna[i] = Math.min(1.0, Math.max(this.fauna[i], (hab - 0.2) * 0.75));
        }
      }
    }

    const epochStr = formatTimeBreakdown(this.timeState).years;
    const o2Eff = this.params.oxygenProductionEfficiency ?? 1.0;
    if (includeFauna && o2Eff > 0.25) {
      this.params.o2Percent = Math.max(this.params.o2Percent ?? 0.1, 18.5 * Math.min(1.2, o2Eff));
    }
    this.params.co2Ppm = Math.max(180, this.params.co2Ppm * 0.85);

    const baseTemp = this.telemetry.meanSurfaceTempK;
    const livingLineages = this.speciesLineages.filter((s) => !s.isExtinct);
    if (livingLineages.length === 0) {
      const m1 = this.evolutionEngine.createFounderSpecies('MICROBE_CHEMO', true, baseTemp, 1.0, epochStr);
      const p1 = this.evolutionEngine.createFounderSpecies('PRODUCER_FLORA', true, baseTemp, 1.0, epochStr, m1.id);
      const p2 = this.evolutionEngine.createFounderSpecies('PRODUCER_FLORA', false, baseTemp, 0.6, epochStr, p1.id);
      this.speciesLineages.push(m1, p1, p2);
      if (includeFauna) {
        const g1 = this.evolutionEngine.createFounderSpecies('HERBIVORE_GRAZER', false, baseTemp, 0.55, epochStr, p2.id);
        const a1 = this.evolutionEngine.createFounderSpecies('APEX_PREDATOR', false, baseTemp, 0.55, epochStr, g1.id);
        this.speciesLineages.push(g1, a1);
      }
    } else if (!livingLineages.some((s) => s.guild === 'PRODUCER_FLORA')) {
      const rootId = livingLineages[0].id;
      const p1 = this.evolutionEngine.createFounderSpecies('PRODUCER_FLORA', true, baseTemp, 1.0, epochStr, rootId);
      const p2 = this.evolutionEngine.createFounderSpecies('PRODUCER_FLORA', false, baseTemp, 0.6, epochStr, p1.id);
      this.speciesLineages.push(p1, p2);
      if (includeFauna) {
        const g1 = this.evolutionEngine.createFounderSpecies('HERBIVORE_GRAZER', false, baseTemp, 0.55, epochStr, p2.id);
        this.speciesLineages.push(g1);
      }
    }

    this.updateTelemetry('Global Biosphere seeded across habitable zones');
    this.recordTelemetryHistoryPoint();
    this.logEvent('BIOSPHERE', 'Global Biosphere Bloom: seeded flora and fauna across all habitable zones.');
  }

  /**
   * Sterilizes all living organisms on the planet, returning it to a strictly abiotic state.
   */
  public sterilizeBiosphere(): void {
    this.pushUndoState('Mass Extinction / Sterilize Planet');
    this.biomass.fill(0);
    this.fauna.fill(0);
    this.biodiversity.fill(0);
    this.extinctionImpact.fill(1.0);
    this.params.o2Percent = 0.1;

    const epochStr = formatTimeBreakdown(this.timeState).years;
    for (const sp of this.speciesLineages) {
      if (!sp.isExtinct) {
        sp.isExtinct = true;
        sp.populationEstimate = 0;
        sp.occupiedCells = 0;
        sp.extinctTimeYears = epochStr;
        sp.causeOfExtinction = 'Global Planetary Sterilization';
      }
    }

    this.telemetry.extinctionSeverity = 1.0;
    this.updateTelemetry('Biosphere sterilized (Abiotic state restored)');
    this.recordTelemetryHistoryPoint();
    this.logEvent('BIOSPHERE', 'Planet sterilized: all biomass, fauna, and species lineages wiped out.');
  }

  public triggerHazard(
    type: ActiveHazardEvent['type'],
    latDeg: number,
    lonDeg: number,
    intensity = 0.85
  ): ActiveHazardEvent {
    this.pushUndoState(`Trigger ${type}`);
    const clampedIntensity = Math.max(0.1, Math.min(1.0, intensity));
    const lat = (latDeg * Math.PI) / 180;
    const lon = (lonDeg * Math.PI) / 180;
    const tx = Math.cos(lat) * Math.cos(lon);
    const ty = Math.sin(lat);
    const tz = Math.cos(lat) * Math.sin(lon);

    const radiusRad =
      type === 'VOLCANO' ? 0.14 :
      type === 'EARTHQUAKE' ? 0.22 :
      type === 'TSUNAMI' ? 0.45 :
      type === 'STORM' ? 0.28 :
      type === 'FLOOD' ? 0.26 :
      type === 'METEOR' ? 0.18 + 0.28 * clampedIntensity : 0.32;

    const durationSeconds =
      type === 'VOLCANO' ? 86400 * 5 :
      type === 'EARTHQUAKE' ? 3600 * 6 :
      type === 'TSUNAMI' ? 3600 * 18 :
      type === 'STORM' ? 86400 * 4 :
      type === 'FLOOD' ? 86400 * 6 :
      type === 'METEOR' ? 86400 * 10 : 86400 * 12;

    const event: ActiveHazardEvent = {
      id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      latDeg,
      lonDeg,
      nx: tx,
      ny: ty,
      nz: tz,
      intensity: clampedIntensity,
      radiusRad,
      ageSeconds: 0,
      durationSeconds,
      waveRadiusRad: 0.03
    };

    this.activeHazards.push(event);
    const bioBefore = this.telemetry.globalBiomassFraction;

    for (let i = 0; i < this.numCells; i++) {
      const dot = this.cellNx[i] * tx + this.cellNy[i] * ty + this.cellNz[i] * tz;
      const distRad = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (distRad <= radiusRad) {
        const w = Math.cos((0.5 * Math.PI * distRad) / radiusRad);
        if (type === 'VOLCANO') {
          this.elevation[i] += 680 * clampedIntensity * Math.pow(w, 2);
          this.baseElevation[i] = this.elevation[i] / Math.max(0.1, this.params.terrainScale);
          this.volcanicHeat[i] += 450 * clampedIntensity * w;
          this.temperature[i] += 18 * clampedIntensity * w;
          this.iceThickness[i] = Math.max(0, this.iceThickness[i] - 400 * clampedIntensity * w);
          this.biomass[i] *= Math.max(0, 1.0 - 0.95 * clampedIntensity * w);
          this.fauna[i] *= Math.max(0, 1.0 - 0.98 * clampedIntensity * w);
          this.extinctionImpact[i] = Math.min(1.0, this.extinctionImpact[i] + 0.85 * clampedIntensity * w);
        } else if (type === 'METEOR') {
          const rRatio = distRad / radiusRad;
          const craterProfile =
            rRatio < 0.65
              ? -Math.cos((rRatio / 0.65) * (Math.PI / 2))
              : 0.35 * Math.sin(((rRatio - 0.65) / 0.35) * Math.PI);
          this.elevation[i] += 1800 * clampedIntensity * craterProfile;
          this.baseElevation[i] = this.elevation[i] / Math.max(0.1, this.params.terrainScale);
          this.volcanicHeat[i] += 600 * clampedIntensity * w;
          this.temperature[i] += 32 * clampedIntensity * w;
          this.biomass[i] *= Math.max(0, 1.0 - Math.min(1.0, 1.2 * clampedIntensity * w));
          this.fauna[i] *= Math.max(0, 1.0 - Math.min(1.0, 1.4 * clampedIntensity * w));
          this.extinctionImpact[i] = Math.min(1.0, this.extinctionImpact[i] + clampedIntensity * w);
        } else if (type === 'EARTHQUAKE') {
          const dLat = this.cellLatRad[i] - lat;
          const dLon = this.cellLonRad[i] - lon;
          const faultWave = Math.sin(dLat * 18 + dLon * 14);
          const displacement = 260 * clampedIntensity * w * faultWave;
          this.elevation[i] += displacement;
          this.baseElevation[i] = this.elevation[i] / Math.max(0.1, this.params.terrainScale);
          this.sediment[i] += Math.abs(displacement) * 0.15;
          this.fauna[i] *= Math.max(0, 1.0 - 0.35 * clampedIntensity * w);
          if (this.elevation[i] < this.params.seaLevelMeters) {
            this.waterWaveAnomaly[i] += 18 * clampedIntensity * w;
          }
        } else if (type === 'TSUNAMI') {
          if (this.elevation[i] < this.params.seaLevelMeters + 120) {
            this.waterWaveAnomaly[i] += 28 * clampedIntensity * w;
            this.fauna[i] *= Math.max(0, 1.0 - 0.3 * clampedIntensity * w);
          }
        } else if (type === 'STORM') {
          this.humidity[i] = Math.min(1.0, this.humidity[i] + 0.45 * clampedIntensity * w);
          this.precipitation[i] += 35.0 * clampedIntensity * w;
          this.waterWaveAnomaly[i] += 4.5 * clampedIntensity * w;
        } else if (type === 'FLOOD') {
          this.humidity[i] = Math.min(1.0, this.humidity[i] + 0.65 * clampedIntensity * w);
          this.precipitation[i] += 65.0 * clampedIntensity * w;
          this.waterWaveAnomaly[i] += 9.5 * clampedIntensity * w;
          this.sediment[i] += 12.0 * clampedIntensity * w;
          if (this.elevation[i] >= this.params.seaLevelMeters) {
            this.fauna[i] *= Math.max(0, 1.0 - 0.4 * clampedIntensity * w);
          }
        } else if (type === 'DROUGHT') {
          this.humidity[i] = Math.max(0.01, this.humidity[i] * (1.0 - 0.85 * clampedIntensity * w));
          this.precipitation[i] *= 1.0 - 0.9 * clampedIntensity * w;
          this.temperature[i] += 6.5 * clampedIntensity * w;
          this.biomass[i] *= Math.max(0, 1.0 - 0.55 * clampedIntensity * w);
          this.fauna[i] *= Math.max(0, 1.0 - 0.65 * clampedIntensity * w);
          this.extinctionImpact[i] = Math.min(1.0, this.extinctionImpact[i] + 0.45 * clampedIntensity * w);
        }
      }
    }

    if (type === 'VOLCANO') {
      this.params.co2Ppm = Math.min(10000, this.params.co2Ppm + Math.round(35 * clampedIntensity));
    } else if (type === 'METEOR') {
      if (this.params.geology) {
        this.params.geology.impactCount = (this.params.geology.impactCount || 0) + 1;
      }
      // Scale global impact shock proportionally to meteor intensity:
      // Small impacts (intensity <= 0.35) cause only regional damage;
      // Large bolides (intensity >= 0.75) cause global ejecta dust & mass extinction stress.
      this.params.co2Ppm = Math.min(10000, this.params.co2Ppm + Math.round(180 * Math.pow(clampedIntensity, 2)));
      const globalShock = Math.max(0, (clampedIntensity - 0.35) / 0.65);
      if (globalShock > 0) {
        const extSuscept = this.params.extinctionSusceptibility ?? 1.0;
        for (let i = 0; i < this.numCells; i++) {
          const faunaLoss = Math.min(0.92, globalShock * 0.72 * extSuscept);
          const bioLoss = Math.min(0.75, globalShock * 0.42 * extSuscept);
          this.fauna[i] *= 1.0 - faunaLoss;
          this.biomass[i] *= 1.0 - bioLoss;
          this.extinctionImpact[i] = Math.min(1.0, this.extinctionImpact[i] + globalShock * 0.65);
        }

        // Apply mortality to living species lineages based on stressResistance and guild
        const epochStr = formatTimeBreakdown(this.timeState).years;
        for (const sp of this.speciesLineages) {
          if (sp.isExtinct) continue;
          const guildVulnerability =
            sp.guild === 'APEX_PREDATOR' ? 1.35 :
            sp.guild === 'HERBIVORE_GRAZER' ? 1.15 :
            sp.guild === 'PRODUCER_FLORA' ? 0.75 : 0.35;
          const survivalFrac = Math.max(
            0,
            1.0 - globalShock * guildVulnerability * (1.1 - sp.traits.stressResistance * 0.6) * extSuscept
          );
          sp.populationEstimate = Math.floor(sp.populationEstimate * survivalFrac);
          if (sp.populationEstimate < 8) {
            sp.populationEstimate = 0;
            sp.occupiedCells = 0;
            sp.isExtinct = true;
            sp.extinctTimeYears = epochStr;
            sp.causeOfExtinction = 'Bolide Impact Mass Extinction';
            this.logEvent('EVOLUTION', `Lineage ${sp.name} perished in Meteor Impact Mass Extinction.`);
          }
        }
      }
    }

    if (type === 'EARTHQUAKE' || type === 'METEOR') {
      const cellIdx = this.latLonToCellIndex(latDeg, lonDeg);
      if (this.elevation[cellIdx] < this.params.seaLevelMeters) {
        this.activeHazards.push({
          ...event,
          id: `TSUNAMI-IMPACT-${Date.now()}`,
          type: 'TSUNAMI',
          radiusRad: 0.55,
          durationSeconds: 3600 * 16,
          waveRadiusRad: 0.04
        });
      }
    }

    this.computeHabitabilityField(this.telemetry.effectiveSeaLevelMeters);
    this.updateTelemetry(`Triggered ${type} at (${latDeg.toFixed(1)}°, ${lonDeg.toFixed(1)}°)`);
    if (bioBefore > 0.001) {
      const drop = Math.max(0, (bioBefore - this.telemetry.globalBiomassFraction) / bioBefore);
      this.telemetry.extinctionSeverity = Math.max(this.telemetry.extinctionSeverity, drop);
    }
    this.recordTelemetryHistoryPoint();
    this.logEvent(
      'HAZARD',
      `${type} triggered at ${latDeg.toFixed(1)}°, ${lonDeg.toFixed(1)}° (intensity ${(clampedIntensity * 100).toFixed(0)}%)`,
      latDeg,
      lonDeg
    );
    return event;
  }

  public applyGlobalIceImpulse(targetIceFraction: number): void {
    this.pushUndoState('Adjust Global Ice Coverage');
    const clamped = Math.max(0, Math.min(1, targetIceFraction));
    const thresholdSinLat = 1.0 - clamped;
    for (let i = 0; i < this.numCells; i++) {
      const absSin = Math.abs(this.cellSinLat[i]);
      if (absSin >= thresholdSinLat) {
        const factor = (absSin - thresholdSinLat) / Math.max(0.05, 1.0 - thresholdSinLat);
        this.iceThickness[i] = Math.max(this.iceThickness[i], 150 + factor * 1800);
        this.temperature[i] = Math.min(this.temperature[i], FREEZING_POINT_K - 2.0 - factor * 18.0);
        this.biomass[i] *= 0.1;
        this.fauna[i] = 0;
      } else {
        this.iceThickness[i] = 0;
        this.temperature[i] = Math.max(this.temperature[i], FREEZING_POINT_K + 2.0);
      }
    }
    this.computeHabitabilityField(this.telemetry.effectiveSeaLevelMeters);
    this.updateTelemetry('Modified planetary cryosphere coverage');
    this.logEvent('GOD_ACTION', `Adjusted global cryosphere target coverage to ${(clamped * 100).toFixed(0)}%.`);
  }

  private updateAtmosphericWinds(): void {
    const wMult = this.params.windIntensity;
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const i = y * this.gridWidth + x;
        const lat = this.cellLatRad[i];
        const sinLat = this.cellSinLat[i];

        const zonalPattern = -Math.cos(3.0 * lat) * 11.5 - Math.cos(lat) * 3.0;
        const meridionalPattern = -Math.sin(3.0 * lat) * 4.2 * (lat >= 0 ? 1 : -1);

        const xEast = (x + 1) % this.gridWidth;
        const ySouth = Math.min(this.gridHeight - 1, y + 1);
        const dTx = this.temperature[y * this.gridWidth + xEast] - this.temperature[i];
        const dTy = this.temperature[i] - this.temperature[ySouth * this.gridWidth + x];

        let u = (zonalPattern - dTx * 0.45) * wMult;
        let v = (meridionalPattern - dTy * 0.45 + sinLat * dTx * 0.2) * wMult;

        for (let h = 0; h < this.activeHazards.length; h++) {
          const haz = this.activeHazards[h];
          if (haz.type !== 'STORM') continue;
          const dot = this.cellNx[i] * haz.nx + this.cellNy[i] * haz.ny + this.cellNz[i] * haz.nz;
          const distRad = Math.acos(Math.max(-1, Math.min(1, dot)));
          if (distRad > 0.005 && distRad < haz.radiusRad) {
            const profile = Math.sin((Math.PI * distRad) / haz.radiusRad);
            const swirlSpeed = 38.0 * haz.intensity * profile;
            const dLon = this.cellLonRad[i] - (haz.lonDeg * Math.PI) / 180;
            const dLat = this.cellLatRad[i] - (haz.latDeg * Math.PI) / 180;
            const norm = Math.hypot(dLon, dLat) || 1;
            const hemiSign = lat >= 0 ? 1 : -1;
            u += (-dLat / norm) * swirlSpeed * hemiSign;
            v += (dLon / norm) * swirlSpeed * hemiSign;
          }
        }

        this.windU[i] = u;
        this.windV[i] = v;
      }
    }
  }

  public advanceFrame(realElapsedSeconds: number): void {
    if (this.paused || !Number.isFinite(realElapsedSeconds) || realElapsedSeconds <= 0) return;

    const clampedRealDt = Math.min(0.1, realElapsedSeconds);
    const deltaSimSecondsSci = scaleSciNumber(this.speedSci, clampedRealDt);
    this.stepBySimSecondsSci(deltaSimSecondsSci);
  }

  public singleStep(stepSeconds = 600): void {
    const safeStep = Number.isFinite(stepSeconds) && stepSeconds > 0 ? stepSeconds : 600;
    const dtSci = normalizeSci(safeStep, 0);
    this.stepBySimSecondsSci(dtSci);
  }

  public stepBySimSecondsSci(deltaSimSecondsSci: SciNumber): void {
    const mode = classifyTimeMode(this.speedSci);
    this.telemetry.activeTimeMode = mode;

    const nominalFineDt = 600;
    let actualSteps = 0;

    if (mode === 'REALTIME') {
      const dtSec = Math.min(3600, sciToNumber(deltaSimSecondsSci));
      this.integratePhysicalStep(dtSec, 'Fine Euler-CFL step (REALTIME)');
      actualSteps = 1;
    } else if (mode === 'FAST_FORWARD') {
      const totalSec = sciToNumber(deltaSimSecondsSci);
      const subSteps = Math.max(1, Math.min(12, Math.ceil(totalSec / nominalFineDt)));
      const subDt = totalSec / subSteps;
      for (let s = 0; s < subSteps; s++) {
        this.integratePhysicalStep(subDt, `Fast-Forward (${subSteps} substeps/frame)`);
      }
      actualSteps = subSteps;
    } else if (mode === 'COARSE_TIME') {
      const totalSec = sciToNumber(deltaSimSecondsSci);
      const subSteps = 6;
      const coarseDt = totalSec / subSteps;
      for (let s = 0; s < subSteps; s++) {
        this.integratePhysicalStep(coarseDt, 'Coarse-Time implicit-damped step (CFL clamped)');
      }
      actualSteps = subSteps;
    } else if (mode === 'ANALYTICAL_ADVANCE') {
      const totalSec = sciToNumber(deltaSimSecondsSci);
      this.integrateAnalyticalStep(
        totalSec,
        false,
        'Analytical radiative-cryosphere relaxation + secular erosion'
      );
      actualSteps = 1;
    } else {
      const effectiveSec = deltaSimSecondsSci.exponent > 20 ? 1e20 : sciToNumber(deltaSimSecondsSci);
      this.integrateAnalyticalStep(
        effectiveSec,
        true,
        `Visual Time Warp (${formatSciNumber(this.speedSci, 1)}x): asymptotic equilibrium & secular tectonic decay`
      );
      actualSteps = 1;
    }

    advanceSafeTime(this.timeState, deltaSimSecondsSci, actualSteps, nominalFineDt);
    this.updateSolarGeometry();

    const dtYears = Math.max(1e-4, sciToNumber(deltaSimSecondsSci) / SECONDS_PER_YEAR);
    this.advanceEvolutionaryStep(dtYears);
    this.advanceExtendedSubsystems(dtYears);

    this.updateTelemetry(this.telemetry.lastStepStabilityNote);
    if (this.timeState.stepsComputed % 8 === 0 || mode === 'ANALYTICAL_ADVANCE' || mode === 'VISUAL_TIME_WARP') {
      this.recordTelemetryHistoryPoint();
    }
  }

  private advanceEvolutionaryStep(dtYears: number): void {
    // Ensure founder species exist if biomass was seeded
    if (this.telemetry.globalBiomassFraction > 0.002 && this.speciesLineages.filter((s) => !s.isExtinct).length === 0) {
      const epochStr = formatTimeBreakdown(this.timeState).years;
      const founder = this.evolutionEngine.createFounderSpecies(
        'MICROBE_CHEMO',
        true,
        this.telemetry.meanSurfaceTempK,
        this.telemetry.meanHumidity,
        epochStr
      );
      this.speciesLineages.push(founder);
    }

    let sumMarineTemp = 0;
    let marineW = 0;
    let sumLandTemp = 0;
    let sumLandHum = 0;
    let landW = 0;
    const sea = this.telemetry.effectiveSeaLevelMeters;

    for (let i = 0; i < this.numCells; i++) {
      const w = this.cellCosLat[i];
      if (this.elevation[i] < sea) {
        sumMarineTemp += this.temperature[i] * w;
        marineW += w;
      } else {
        sumLandTemp += this.temperature[i] * w;
        sumLandHum += this.humidity[i] * w;
        landW += w;
      }
    }

    const meanMarineTempK = marineW > 0 ? sumMarineTemp / marineW : this.telemetry.meanSurfaceTempK;
    const meanLandTempK = landW > 0 ? sumLandTemp / landW : this.telemetry.meanSurfaceTempK;
    const meanLandHumidity = landW > 0 ? sumLandHum / landW : this.telemetry.meanHumidity;

    const epochStr = formatTimeBreakdown(this.timeState).years;
    this.evolutionEngine.stepEvolution(
      this.speciesLineages,
      this.params,
      meanMarineTempK,
      meanLandTempK,
      meanLandHumidity,
      this.telemetry.oceanCoverageFraction,
      this.telemetry.globalBiomassFraction,
      this.telemetry.globalFaunaFraction,
      dtYears,
      epochStr,
      (msg) => this.logEvent('EVOLUTION', msg)
    );
  }

  public recordTelemetryHistoryPoint(): void {
    const tb = formatTimeBreakdown(this.timeState);
    const yearsNum = sciToNumber(this.timeState.deepYears);
    const pt: TelemetryHistoryPoint = {
      step: this.timeState.stepsComputed,
      yearsNumeric: Number.isFinite(yearsNum) ? yearsNum : 1e100,
      timeLabel: tb.years,
      meanTempC: Number(this.telemetry.meanSurfaceTempC.toFixed(2)),
      co2Ppm: Math.round(this.params.co2Ppm),
      o2Percent: Number(this.telemetry.oxygenPercent.toFixed(2)),
      biomassPercent: Number((this.telemetry.globalBiomassFraction * 100).toFixed(2)),
      faunaPercent: Number((this.telemetry.globalFaunaFraction * 100).toFixed(2)),
      livingSpeciesCount: this.telemetry.livingSpeciesCount,
      biodiversityIndex: this.telemetry.biodiversityIndex,
      habitabilityPercent: Number((this.telemetry.meanHabitability * 100).toFixed(1)),
      extinctionSeverityPercent: Number((this.telemetry.extinctionSeverity * 100).toFixed(1))
    };
    this.telemetryHistory.push(pt);
    // Keep history bounded to 120 points to prevent unbounded memory growth
    if (this.telemetryHistory.length > 120) {
      this.telemetryHistory.shift();
    }
  }

  private updateSolarGeometry(): void {
    if (this.params.dayNightCycleEnabled) {
      const rotationSeconds = (this.params.planet?.rotationHours ?? 24) * 3600;
      const diurnalFrac = (this.timeState.subYearSeconds % rotationSeconds) / rotationSeconds;
      this.params.sunLongitudeRad = (0.5 - diurnalFrac) * 2 * Math.PI;
    }
    const yearFrac = this.timeState.subYearSeconds / SECONDS_PER_YEAR;
    const tiltRad = (this.params.axialTiltDeg * Math.PI) / 180;
    this.params.sunLatitudeRad = Math.sin(yearFrac * 2 * Math.PI) * tiltRad;
  }

  private integratePhysicalStep(dtSeconds: number, stabilityNote: string): void {
    const tauThermal = 86400 * 14;
    const alphaThermal = Math.min(0.35, dtSeconds / (tauThermal + dtSeconds));
    const alphaMoisture = Math.min(0.3, dtSeconds / (86400 * 4 + dtSeconds));

    const co2Forcing = greenhouseForcingWm2(this.params.co2Ppm, this.params.pressureBar ?? 1.0);
    const lapseRate = this.getEffectiveLapseRate();

    let activeVolcanoCount = 0;
    for (let h = 0; h < this.activeHazards.length; h++) {
      if (this.activeHazards[h].type === 'VOLCANO' || this.activeHazards[h].type === 'METEOR') {
        activeVolcanoCount++;
      }
    }
    const aerosolOpticalDepth = Math.min(0.45, this.params.volcanicActivity * 0.04 + activeVolcanoCount * 0.06);

    let meanIceMeters = 0;
    for (let i = 0; i < this.numCells; i++) {
      meanIceMeters += this.iceThickness[i] * this.cellCosLat[i];
    }
    meanIceMeters /= this.totalAreaWeight;
    const effectiveSeaLevel = this.params.seaLevelMeters - meanIceMeters * 0.35;

    this.updateAtmosphericWinds();
    this.computeHabitabilityField(effectiveSeaLevel);

    const sunLon = this.params.sunLongitudeRad;
    const sunLat = this.params.sunLatitudeRad;
    const sinSunLat = Math.sin(sunLat);
    const cosSunLat = Math.cos(sunLat);

    const diffCoeff = Math.min(0.16, 0.04 * (dtSeconds / 3600));
    const reproMult = this.params.reproductionMultiplier ?? 1.0;
    const bioRate = Math.min(0.28, (dtSeconds / (86400 * 16 + dtSeconds)) * reproMult);

    let netPhotosynthesisWeight = 0;
    let netRespirationWeight = 0;

    for (let y = 0; y < this.gridHeight; y++) {
      const yNorth = Math.max(0, y - 1);
      const ySouth = Math.min(this.gridHeight - 1, y + 1);

      for (let x = 0; x < this.gridWidth; x++) {
        const i = y * this.gridWidth + x;
        const xWest = (x - 1 + this.gridWidth) % this.gridWidth;
        const xEast = (x + 1) % this.gridWidth;

        const iN = yNorth * this.gridWidth + x;
        const iS = ySouth * this.gridWidth + x;
        const iW = y * this.gridWidth + xWest;
        const iE = y * this.gridWidth + xEast;

        const elev = this.elevation[i];
        const isOcean = elev < effectiveSeaLevel;
        const heightAboveSea = Math.max(0, elev - effectiveSeaLevel);
        const ice = this.iceThickness[i];
        const hum = this.humidity[i];
        const bio = this.biomass[i];
        const fau = this.fauna[i];
        const hab = this.habitability[i];

        // 1. Local surface + cloud albedo
        let baseAlbedo = isOcean ? 0.08 : 0.26 - bio * 0.12;
        if (ice > 0.1) {
          const iceFrac = Math.min(1, ice / 50.0);
          baseAlbedo = baseAlbedo * (1 - iceFrac) + 0.72 * iceFrac;
        }
        const cloudAlbedo = 0.22 * hum;
        const localAlbedo = Math.min(0.85, baseAlbedo + cloudAlbedo * (1 - baseAlbedo) + aerosolOpticalDepth * 0.25);

        // 2. Solar insolation
        const sinLat = this.cellSinLat[i];
        const cosLat = this.cellCosLat[i];
        const cosZenithDiurnal =
          sinLat * sinSunLat + cosLat * cosSunLat * Math.cos(this.cellLonRad[i] - sunLon);
        const diurnalFactor = Math.max(0, cosZenithDiurnal);
        const dailyMeanFactor = Math.max(0.05, 0.32 * cosLat + 0.18 * Math.max(0, sinLat * sinSunLat + cosLat * cosSunLat));
        const diurnalBlend = dtSeconds <= 7200 ? (isOcean ? 0.12 : 0.32) : 0.02;
        const insolationFactor = dailyMeanFactor * (1 - diurnalBlend) + diurnalFactor * diurnalBlend;

        const incomingSolar = SOLAR_CONSTANT_WM2 * this.params.solarLuminosity * insolationFactor;
        const absorbedSolar = incomingSolar * (1.0 - localAlbedo);

        // 3. Greenhouse trapping
        const waterVaporForcing = 18.0 * hum;
        const greenhouseEmissivity = Math.max(
          0.38,
          Math.min(0.92, 0.62 - (co2Forcing + waterVaporForcing) * 0.0042)
        );

        const geoFlux = this.volcanicHeat[i] + this.params.volcanicActivity * 1.2;
        const tRadEq =
          Math.pow((absorbedSolar + geoFlux + 65.0) / (STEFAN_BOLTZMANN_SIGMA * greenhouseEmissivity), 0.25) -
          heightAboveSea * lapseRate +
          this.params.temperatureOffsetK;

        // 4. Heat transport
        const neighborMeanT =
          0.25 * (this.temperature[iN] + this.temperature[iS] + this.temperature[iW] + this.temperature[iE]);
        const upwindX = this.windU[i] >= 0 ? this.temperature[iW] : this.temperature[iE];
        const upwindY = this.windV[i] >= 0 ? this.temperature[iS] : this.temperature[iN];
        const advWeight = Math.min(0.12, (Math.hypot(this.windU[i], this.windV[i]) / 45.0) * diffCoeff);

        let nextT =
          this.temperature[i] * (1 - alphaThermal - diffCoeff - advWeight) +
          tRadEq * alphaThermal +
          neighborMeanT * diffCoeff +
          0.5 * (upwindX + upwindY) * advWeight;

        nextT = Math.max(140, Math.min(450, nextT));
        this.tempNext[i] = nextT;

        // 5. Moisture evaporation + terrestrial plant evapotranspiration
        const tempC = nextT - FREEZING_POINT_K;
        const satFactor = Math.exp(Math.max(-2.5, Math.min(2.0, 0.055 * tempC)));
        const evapRate = isOcean && ice < 5.0
          ? (0.18 + 0.012 * Math.hypot(this.windU[i], this.windV[i])) * satFactor * this.params.humidityMultiplier
          : (0.03 * hum + 0.065 * bio * satFactor) * this.params.humidityMultiplier;

        const neighborMeanH =
          0.25 * (this.humidity[iN] + this.humidity[iS] + this.humidity[iW] + this.humidity[iE]);
        const upwindHX = this.windU[i] >= 0 ? this.humidity[iW] : this.humidity[iE];
        const upwindHY = this.windV[i] >= 0 ? this.humidity[iS] : this.humidity[iN];

        const slopeLift = Math.max(0, elev - 0.5 * (this.elevation[iW] + this.elevation[iS])) / 2500.0;
        const precipRateMmDay =
          Math.max(0, hum * (2.4 + slopeLift * 6.5) * this.params.precipitationMultiplier);
        this.precipitation[i] = precipRateMmDay;

        const precipSink = (precipRateMmDay / 28.0) * alphaMoisture;
        const nextH =
          hum * (1 - diffCoeff - advWeight) +
          neighborMeanH * diffCoeff +
          0.5 * (upwindHX + upwindHY) * advWeight +
          evapRate * alphaMoisture -
          precipSink;

        this.humNext[i] = Math.max(0.01, Math.min(1.0, nextH));

        // 6. Cryosphere
        const freezeThreshold = isOcean ? SEA_ICE_POINT_K : FREEZING_POINT_K;
        if (nextT < freezeThreshold) {
          const snowAccum = (precipRateMmDay * 0.002 + 0.015 * (freezeThreshold - nextT)) * (dtSeconds / 86400);
          this.iceThickness[i] = Math.min(3800, ice + snowAccum);
        } else if (ice > 0) {
          const melt = (0.08 * (nextT - freezeThreshold) + this.volcanicHeat[i] * 0.01) * (dtSeconds / 86400);
          this.iceThickness[i] = Math.max(0, ice - melt);
        }

        // 7. Biosphere logistic growth, spatial dispersal & mortality
        const maxNeighborBio = Math.max(this.biomass[iN], this.biomass[iS], this.biomass[iW], this.biomass[iE]);
        let nextBio = bio;
        if (bio > 0.001 || (maxNeighborBio > 0.14 && hab > 0.18)) {
          const seedInflux = maxNeighborBio > 0.14 ? 0.06 * maxNeighborBio * hab : 0;
          const co2Fertilization = Math.min(1.3, Math.max(0.2, Math.log(Math.max(30, this.params.co2Ppm) / 80) / 1.8));
          const carryingCap = Math.min(1.0, hab * co2Fertilization);
          if (carryingCap > 0.1) {
            const growth = (carryingCap - bio) * bioRate + seedInflux * bioRate;
            nextBio = Math.max(0, Math.min(1.0, bio + growth));
          } else {
            nextBio = Math.max(0, bio * (1.0 - 1.5 * bioRate));
          }
        }
        if (nextBio < 0.0005) nextBio = 0;
        this.bioNext[i] = nextBio;
        netPhotosynthesisWeight += nextBio * cosLat;

        // 8. Fauna population dynamics (requires biomass food web and atmospheric O2 >= 2.0%)
        const o2 = this.params.o2Percent ?? 0.1;
        const maxNeighborFauna = Math.max(this.fauna[iN], this.fauna[iS], this.fauna[iW], this.fauna[iE]);
        let nextFauna = fau;
        if (o2 >= 2.0 && (fau > 0.001 || (maxNeighborFauna > 0.15 && nextBio > 0.2 && hab > 0.22))) {
          const o2Factor = Math.min(1.0, (o2 - 1.5) / 12.0);
          const faunaCap = Math.min(1.0, nextBio * hab * o2Factor);
          const migration = maxNeighborFauna > 0.15 ? 0.07 * maxNeighborFauna * faunaCap : 0;
          if (faunaCap > 0.08) {
            nextFauna = Math.max(0, Math.min(1.0, fau + ((faunaCap - fau) + migration) * bioRate));
          } else {
            nextFauna = Math.max(0, fau * (1.0 - 2.0 * bioRate));
          }
        } else if (fau > 0) {
          nextFauna = Math.max(0, fau * (1.0 - 2.5 * bioRate));
        }
        if (nextFauna < 0.0005) nextFauna = 0;
        this.faunaNext[i] = nextFauna;
        netRespirationWeight += nextFauna * cosLat;

        // 9. Decay local volcanic heat, tsunami wave anomalies, and extinction impact scars
        this.volcanicHeat[i] *= Math.exp(-dtSeconds / (86400 * 3));
        this.waterWaveAnomaly[i] *= Math.exp(-dtSeconds / (3600 * 6));
        this.extinctionImpact[i] *= Math.exp(-dtSeconds / (86400 * 25));

        // 10. Fluvial & thermal erosion (vegetation roots reduce erosion by up to 60%)
        if (!isOcean && dtSeconds >= 3600) {
          const localRelief = elev - 0.25 * (this.elevation[iN] + this.elevation[iS] + this.elevation[iW] + this.elevation[iE]);
          if (Math.abs(localRelief) > 25) {
            const rootStabilization = 1.0 - 0.6 * nextBio;
            const erosionRate = 1e-9 * (1 + precipRateMmDay * 0.35) * rootStabilization * dtSeconds;
            const dE = Math.max(-15, Math.min(15, localRelief * Math.min(0.05, erosionRate)));
            this.elevation[i] -= dE;
            this.sediment[i] = Math.max(0, this.sediment[i] + dE);
          }
        }
      }
    }

    this.temperature.set(this.tempNext);
    this.humidity.set(this.humNext);
    this.biomass.set(this.bioNext);
    this.fauna.set(this.faunaNext);

    // 11. Biogeochemical O2 production/consumption & CO2 drawdown (respects oxygenProductionEfficiency)
    const meanBio = netPhotosynthesisWeight / this.totalAreaWeight;
    const meanFauna = netRespirationWeight / this.totalAreaWeight;
    const daysElapsed = dtSeconds / 86400;
    const o2Eff = this.params.oxygenProductionEfficiency ?? 1.0;

    if (meanBio > 0.0005 || (this.params.o2Percent ?? 0.1) > 0.12) {
      // Oxygen accumulates from gross photosynthesis * o2Eff minus fauna respiration and volcanic reducing gas sinks
      const grossO2Prod = meanBio * 26.0 * o2Eff;
      const o2Sink = meanFauna * 6.5 + this.params.volcanicActivity * 1.8;
      const eqO2 = Math.max(0.05, Math.min(34.0, 0.1 + grossO2Prod - o2Sink));
      const o2Relax = Math.min(0.08, daysElapsed * 0.0004);
      this.params.o2Percent = Math.max(
        0.01,
        Math.min(35.0, (this.params.o2Percent ?? 0.1) + (eqO2 - (this.params.o2Percent ?? 0.1)) * o2Relax)
      );
      this.params.co2Ppm = Math.max(
        110,
        this.params.co2Ppm - (meanBio * 0.025 * o2Eff - meanFauna * 0.01) * daysElapsed
      );
    }

    this.stepActiveHazards(dtSeconds, effectiveSeaLevel);
    this.telemetry.lastStepStabilityNote = stabilityNote;
  }

  private stepActiveHazards(dtSeconds: number, effectiveSeaLevel: number): void {
    for (let h = this.activeHazards.length - 1; h >= 0; h--) {
      const haz = this.activeHazards[h];
      haz.ageSeconds += dtSeconds;

      if (haz.type === 'TSUNAMI') {
        const angularSpeedRadPerSec = 200.0 / 6.371e6;
        haz.waveRadiusRad = (haz.waveRadiusRad || 0.04) + angularSpeedRadPerSec * dtSeconds;
        const ringWidth = 0.075;
        const r0 = haz.waveRadiusRad;

        if (r0 < Math.PI * 0.85) {
          for (let i = 0; i < this.numCells; i++) {
            const dot = this.cellNx[i] * haz.nx + this.cellNy[i] * haz.ny + this.cellNz[i] * haz.nz;
            const distRad = Math.acos(Math.max(-1, Math.min(1, dot)));
            const band = Math.abs(distRad - r0);
            if (band < ringWidth && this.elevation[i] < effectiveSeaLevel + 180) {
              const depth = Math.max(10, effectiveSeaLevel - this.elevation[i]);
              const shoaling = Math.min(2.2, Math.pow(2000 / depth, 0.25));
              const waveAmp =
                16.0 * haz.intensity * shoaling * Math.cos((0.5 * Math.PI * band) / ringWidth) *
                Math.max(0.15, 1.0 - r0 / (Math.PI * 0.85));
              this.waterWaveAnomaly[i] = Math.max(this.waterWaveAnomaly[i], waveAmp);
            }
          }
        }
      }

      if (haz.ageSeconds >= haz.durationSeconds) {
        this.activeHazards.splice(h, 1);
      }
    }
  }

  private integrateAnalyticalStep(
    equivalentSeconds: number,
    isVisualWarp: boolean,
    stabilityNote: string
  ): void {
    const deltaYears = equivalentSeconds / SECONDS_PER_YEAR;
    this.activeHazards = [];
    this.waterWaveAnomaly.fill(0);
    this.volcanicHeat.fill(0);

    const targetGeologicalCo2 = 220 + this.params.volcanicActivity * 320;
    const co2Decay = 1.0 - Math.exp(-Math.min(10, deltaYears / 2.5e5));
    this.params.co2Ppm = this.params.co2Ppm + (targetGeologicalCo2 - this.params.co2Ppm) * co2Decay * 0.25;

    const erosionRelax = 1.0 - Math.exp(-Math.min(4.0, deltaYears / 5.0e7));
    if (erosionRelax > 1e-6) {
      for (let i = 0; i < this.numCells; i++) {
        if (this.elevation[i] > this.params.seaLevelMeters) {
          const aboveSea = this.elevation[i] - this.params.seaLevelMeters;
          const rejuvenation = this.baseElevation[i] * this.params.terrainScale * Math.min(1, this.params.volcanicActivity * 0.45);
          const eroded = aboveSea * (1.0 - 0.35 * erosionRelax) + rejuvenation * 0.35 * erosionRelax;
          const diff = aboveSea - eroded;
          this.elevation[i] = this.params.seaLevelMeters + eroded;
          this.sediment[i] = Math.max(0, this.sediment[i] + diff * 0.5);
        }
      }
    }

    // Spontaneous Abiogenesis check over geological time when enabled
    if (this.params.abiogenesisEnabled && deltaYears >= 1.0 && this.telemetry.globalBiomassFraction < 0.001) {
      this.computeHabitabilityField(this.telemetry.effectiveSeaLevelMeters);
      let sparked = 0;
      let firstCellIdx = -1;
      for (let i = 0; i < this.numCells; i++) {
        const isOcean = this.elevation[i] < this.telemetry.effectiveSeaLevelMeters;
        if (isOcean && this.habitability[i] > 0.35 && sparked < 10) {
          this.biomass[i] = 0.48;
          if (firstCellIdx < 0) firstCellIdx = i;
          sparked++;
        }
      }
      if (sparked > 0 && firstCellIdx >= 0) {
        const epochStr = formatTimeBreakdown(this.timeState).years;
        const founder = this.evolutionEngine.createFounderSpecies(
          'MICROBE_CHEMO',
          true,
          this.temperature[firstCellIdx],
          1.0,
          epochStr
        );
        this.speciesLineages.push(founder);
        this.logEvent(
          'BIOSPHERE',
          `Spontaneous Abiogenesis: ${founder.name} emerged in warm marine basins!`
        );
      }
    }

    this.integratePhysicalStep(86400 * 30, stabilityNote);
    if (!isVisualWarp) {
      this.integratePhysicalStep(86400 * 30, stabilityNote);
    }
    this.telemetry.lastStepStabilityNote = stabilityNote;
  }

  public updateTelemetry(stabilityNote: string): GlobalTelemetry {
    let sumTempK = 0;
    let minTempK = Infinity;
    let maxTempK = -Infinity;
    let oceanWeight = 0;
    let iceWeight = 0;
    let sumHum = 0;
    let sumPrecip = 0;
    let maxWind = 0;
    let sumAbsorbedSolar = 0;
    let sumOLR = 0;
    let sumAlbedo = 0;
    let sumIceMeters = 0;
    let sumBio = 0;
    let sumFauna = 0;
    let sumHab = 0;
    let sumExtImpact = 0;

    const co2Forcing = greenhouseForcingWm2(this.params.co2Ppm, this.params.pressureBar ?? 1.0);

    for (let i = 0; i < this.numCells; i++) {
      const w = this.cellCosLat[i];
      sumIceMeters += this.iceThickness[i] * w;
    }
    const meanIceMeters = sumIceMeters / this.totalAreaWeight;
    const effectiveSeaLevel = this.params.seaLevelMeters - meanIceMeters * 0.35;

    this.computeHabitabilityField(effectiveSeaLevel);

    for (let i = 0; i < this.numCells; i++) {
      const w = this.cellCosLat[i];
      const t = this.temperature[i];
      const hum = this.humidity[i];
      const ice = this.iceThickness[i];
      const bio = this.biomass[i];
      const isOcean = this.elevation[i] < effectiveSeaLevel;

      sumTempK += t * w;
      if (t < minTempK) minTempK = t;
      if (t > maxTempK) maxTempK = t;

      if (isOcean) oceanWeight += w;
      if (ice > 5.0) iceWeight += w;

      sumHum += hum * w;
      sumPrecip += this.precipitation[i] * w;
      sumBio += bio * w;
      sumFauna += this.fauna[i] * w;
      sumHab += this.habitability[i] * w;
      sumExtImpact += this.extinctionImpact[i] * w;

      const windSpd = Math.hypot(this.windU[i], this.windV[i]);
      if (windSpd > maxWind) maxWind = windSpd;

      let alb = isOcean ? 0.08 : 0.26 - bio * 0.12;
      if (ice > 0.1) {
        const f = Math.min(1, ice / 50.0);
        alb = alb * (1 - f) + 0.72 * f;
      }
      alb = Math.min(0.85, alb + 0.22 * hum * (1 - alb));
      sumAlbedo += alb * w;

      const insol = SOLAR_CONSTANT_WM2 * this.params.solarLuminosity * 0.25 * (0.5 + 0.75 * w);
      sumAbsorbedSolar += insol * (1 - alb) * w;

      const ghEmissivity = Math.max(0.38, Math.min(0.92, 0.62 - (co2Forcing + 18 * hum) * 0.0042));
      sumOLR += STEFAN_BOLTZMANN_SIGMA * Math.pow(t, 4) * ghEmissivity * w;
    }

    const meanTempK = sumTempK / this.totalAreaWeight;
    const absorbedSolarWm2 = sumAbsorbedSolar / this.totalAreaWeight;
    const outgoingLongwaveWm2 = sumOLR / this.totalAreaWeight;
    const newBioFrac = sumBio / this.totalAreaWeight;
    const recoveryDelta = newBioFrac - this.previousBiomassFraction;
    this.previousBiomassFraction = newBioFrac;

    const livingCount = this.speciesLineages.filter((s) => !s.isExtinct).length;
    const extinctCount = this.speciesLineages.filter((s) => s.isExtinct).length;
    const biodivIdx = this.evolutionEngine.computeBiodiversityIndex(this.speciesLineages);

    this.telemetry = {
      meanSurfaceTempK: meanTempK,
      meanSurfaceTempC: meanTempK - FREEZING_POINT_K,
      minSurfaceTempC: minTempK - FREEZING_POINT_K,
      maxSurfaceTempC: maxTempK - FREEZING_POINT_K,
      oceanCoverageFraction: oceanWeight / this.totalAreaWeight,
      iceCoverageFraction: iceWeight / this.totalAreaWeight,
      meanHumidity: sumHum / this.totalAreaWeight,
      meanPrecipitationMmDay: sumPrecip / this.totalAreaWeight,
      maxWindSpeedMs: maxWind,
      radiativeForcingWm2: co2Forcing,
      planetaryAlbedo: sumAlbedo / this.totalAreaWeight,
      outgoingLongwaveWm2,
      absorbedSolarWm2,
      netEnergyImbalanceWm2: absorbedSolarWm2 - outgoingLongwaveWm2,
      effectiveSeaLevelMeters: effectiveSeaLevel,
      volcanicAerosolOpticalDepth: Math.min(0.45, this.params.volcanicActivity * 0.04),
      globalBiomassFraction: newBioFrac,
      globalFaunaFraction: sumFauna / this.totalAreaWeight,
      meanHabitability: sumHab / this.totalAreaWeight,
      oxygenPercent: this.params.o2Percent ?? 0.1,
      livingSpeciesCount: livingCount,
      extinctSpeciesCount: extinctCount,
      biodiversityIndex: biodivIdx,
      extinctionSeverity: sumExtImpact / this.totalAreaWeight,
      recoveryTrend: Math.max(-1, Math.min(1, recoveryDelta * 100)),
      activeTimeMode: classifyTimeMode(this.speedSci),
      lastStepStabilityNote: stabilityNote
    };
    return this.telemetry;
  }

  public latLonToCellIndex(latDeg: number, lonDeg: number): number {
    const v = 0.5 - Math.max(-90, Math.min(90, latDeg)) / 180.0;
    const normLon = (((lonDeg + 180) % 360) + 360) % 360 - 180;
    const u = normLon / 360.0 + 0.5;
    const y = Math.max(0, Math.min(this.gridHeight - 1, Math.floor(v * this.gridHeight)));
    const x = Math.max(0, Math.min(this.gridWidth - 1, Math.floor(u * this.gridWidth)));
    return y * this.gridWidth + x;
  }

  public sampleFieldBilinear(field: Float32Array, latRad: number, lonRad: number): number {
    const v = Math.max(0, Math.min(0.999999, 0.5 - latRad / Math.PI));
    let u = lonRad / (2 * Math.PI) + 0.5;
    u = ((u % 1) + 1) % 1;

    const fy = v * (this.gridHeight - 1);
    const fx = u * this.gridWidth;

    const y0 = Math.floor(fy);
    const y1 = Math.min(this.gridHeight - 1, y0 + 1);
    const ty = fy - y0;

    const x0 = Math.floor(fx) % this.gridWidth;
    const x1 = (x0 + 1) % this.gridWidth;
    const tx = fx - Math.floor(fx);

    const c00 = field[y0 * this.gridWidth + x0];
    const c10 = field[y0 * this.gridWidth + x1];
    const c01 = field[y1 * this.gridWidth + x0];
    const c11 = field[y1 * this.gridWidth + x1];

    const top = c00 + tx * (c10 - c00);
    const bot = c01 + tx * (c11 - c01);
    return top + ty * (bot - top);
  }

  public classifyCellBiome(idx: number): BiomeClassification {
    const elev = this.elevation[idx];
    const sea = this.telemetry.effectiveSeaLevelMeters;
    const isOcean = elev < sea;
    const ice = this.iceThickness[idx];
    const bio = this.biomass[idx];
    const tempC = this.temperature[idx] - FREEZING_POINT_K;
    const precip = this.precipitation[idx];
    const volc = this.volcanicHeat[idx];

    if (isOcean) {
      if (ice > 10) return 'POLAR_SEA_ICE';
      if (bio > 0.08) {
        return volc > 2.0 ? 'HYDROTHERMAL_VENT_MICROBES' : 'MARINE_PHYTOPLANKTON_REEF';
      }
      return 'ABIOTIC_OCEAN';
    }

    if (ice > 10) return 'GLACIAL_ICE_SHEET';
    if (bio < 0.05) return 'ABIOTIC_REGOLITH';

    if (tempC < 4.0) return 'TUNDRA_MOSS';
    if (precip < 1.2 || bio < 0.25) return 'ARID_DESERT_SCRUB';
    if (tempC < 14.0) return bio > 0.55 ? 'BOREAL_TAIGA_FOREST' : 'TEMPERATE_GRASSLAND';
    return bio > 0.6 && precip > 2.8 ? 'TROPICAL_RAINFOREST' : 'TEMPERATE_GRASSLAND';
  }

  public inspectCoordinate(latDeg: number, lonDeg: number): CellInspection {
    const idx = this.latLonToCellIndex(latDeg, lonDeg);
    const elev = this.elevation[idx];
    const sea = this.telemetry.effectiveSeaLevelMeters;
    const isOcean = elev < sea;
    const tempK = this.temperature[idx];
    const u = this.windU[idx];
    const v = this.windV[idx];
    const bio = this.biomass[idx];

    let dominantSpeciesName = 'None (Abiotic)';
    if (bio > 0.04) {
      const candidates = this.speciesLineages.filter((s) => !s.isExtinct && s.isMarine === isOcean);
      if (candidates.length > 0) {
        candidates.sort(
          (a, b) =>
            Math.abs(a.traits.optimalTempK - tempK) - Math.abs(b.traits.optimalTempK - tempK)
        );
        dominantSpeciesName = candidates[0].name;
      }
    }

    return {
      cellIndex: idx,
      latDeg: (this.cellLatRad[idx] * 180) / Math.PI,
      lonDeg: (this.cellLonRad[idx] * 180) / Math.PI,
      elevationMeters: elev,
      heightAboveSeaMeters: Math.max(0, elev - sea),
      waterDepthMeters: Math.max(0, sea - elev),
      isOcean,
      temperatureK: tempK,
      temperatureC: tempK - FREEZING_POINT_K,
      humidity: this.humidity[idx],
      precipitationMmDay: this.precipitation[idx],
      windU: u,
      windV: v,
      windSpeedMs: Math.hypot(u, v),
      iceThicknessMeters: this.iceThickness[idx],
      volcanicHeatWm2: this.volcanicHeat[idx],
      tsunamiWaveHeightMeters: this.waterWaveAnomaly[idx],
      regolithSedimentMeters: this.sediment[idx],
      habitability: this.habitability[idx],
      biomass: bio,
      fauna: this.fauna[idx],
      biodiversity: this.biodiversity[idx],
      extinctionImpact: this.extinctionImpact[idx],
      dominantSpeciesName,
      biome: this.classifyCellBiome(idx)
    };
  }

  public serializeSnapshot(label = 'Checkpoint'): SerializedWorldSnapshot {
    return {
      version: 4,
      label,
      createdAtIso: new Date().toISOString(),
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      params: {
        ...this.params,
        planet: this.params.planet ? { ...this.params.planet } : undefined,
        terrain: this.params.terrain ? { ...this.params.terrain } : undefined,
        geology: this.params.geology ? { ...this.params.geology } : undefined
      },
      timeState: {
        subYearSeconds: this.timeState.subYearSeconds,
        exactYears: this.timeState.exactYears,
        deepYears: { ...this.timeState.deepYears },
        totalSecondsSci: { ...this.timeState.totalSecondsSci },
        stepsComputed: this.timeState.stepsComputed,
        stepsSkippedSci: { ...this.timeState.stepsSkippedSci }
      },
      speedSci: { ...this.speedSci },
      paused: this.paused,
      elevation: Array.from(this.elevation),
      generatedElevation: Array.from(this.generatedElevation),
      temperature: Array.from(this.temperature),
      humidity: Array.from(this.humidity),
      precipitation: Array.from(this.precipitation),
      iceThickness: Array.from(this.iceThickness),
      waterWaveAnomaly: Array.from(this.waterWaveAnomaly),
      volcanicHeat: Array.from(this.volcanicHeat),
      sediment: Array.from(this.sediment),
      biomass: Array.from(this.biomass),
      fauna: Array.from(this.fauna),
      biodiversity: Array.from(this.biodiversity),
      extinctionImpact: Array.from(this.extinctionImpact),
      speciesLineages: this.speciesLineages.map((s) => ({
        ...s,
        traits: { ...s.traits },
        innovations: [...s.innovations]
      })),
      telemetryHistory: this.telemetryHistory.map((h) => ({ ...h })),
      activeHazards: this.activeHazards.map((h) => ({ ...h })),
      eventLog: this.eventLog.slice(0, 60).map((e) => ({ ...e })),
      magnetosphere: JSON.parse(JSON.stringify(this.magnetosphere)),
      spaceWeather: JSON.parse(JSON.stringify(this.spaceWeather)),
      geochemistry: JSON.parse(JSON.stringify(this.geochemistry)),
      naturalHistory: JSON.parse(JSON.stringify(this.naturalHistory)),
      exploration: JSON.parse(JSON.stringify(this.exploration)),
      remoteSensing: JSON.parse(JSON.stringify(this.remoteSensing)),
      civilization: JSON.parse(JSON.stringify(this.civilization)),
      terraforming: JSON.parse(JSON.stringify(this.terraforming)),
      missions: JSON.parse(JSON.stringify(this.missions)),
      modding: JSON.parse(JSON.stringify(this.modding))
    };
  }

  public loadSnapshot(rawSnap: SerializedWorldSnapshot, recordUndo = true): void {
    const snap = migrateSnapshotToV4(rawSnap);
    if (snap.gridWidth !== this.gridWidth || snap.gridHeight !== this.gridHeight) {
      throw new Error(`Snapshot grid dimensions (${snap.gridWidth}x${snap.gridHeight}) do not match active world (${this.gridWidth}x${this.gridHeight}).`);
    }

    if (recordUndo) {
      this.pushUndoState(`Before loading ${snap.label}`);
    }

    this.params = {
      o2Percent: 0.1,
      pressureBar: 1.0,
      argonPercent: 0.934,
      oxygenProductionEfficiency: 1.0,
      abiogenesisEnabled: true,
      mutationRate: 1.0,
      selectionPressure: 1.0,
      reproductionMultiplier: 1.0,
      extinctionSusceptibility: 1.0,
      ...snap.params,
      planet: validatePlanetProperties(snap.params.planet),
      terrain: validateTerrainSettings(snap.params.terrain),
      geology: validateGeologyParameters(snap.params.geology)
    };
    this.timeState = {
      subYearSeconds: Number(snap.timeState.subYearSeconds) || 0,
      exactYears: String(snap.timeState.exactYears || '0'),
      deepYears: { ...(snap.timeState.deepYears || { mantissa: 0, exponent: 0 }) },
      totalSecondsSci: { ...(snap.timeState.totalSecondsSci || { mantissa: 0, exponent: 0 }) },
      stepsComputed: Number(snap.timeState.stepsComputed) || 0,
      stepsSkippedSci: { ...(snap.timeState.stepsSkippedSci || { mantissa: 0, exponent: 0 }) }
    };
    this.speedSci = { ...(snap.speedSci || { mantissa: 1, exponent: 0 }) };
    this.paused = Boolean(snap.paused);

    this.elevation.set(snap.elevation);
    for (let i = 0; i < this.numCells; i++) {
      this.baseElevation[i] = (this.elevation[i] + (snap.sediment?.[i] || 0)) / Math.max(0.1, this.params.terrainScale);
    }
    if (snap.generatedElevation && snap.generatedElevation.length === this.numCells) {
      this.generatedElevation.set(snap.generatedElevation);
    } else {
      this.generatedElevation.set(this.baseElevation);
    }
    this.tectonicBoundaryField = computeTectonicBoundaryField(this.params.seed, {
      numCells: this.numCells,
      cellNx: this.cellNx,
      cellNy: this.cellNy,
      cellNz: this.cellNz
    });

    this.temperature.set(snap.temperature);
    this.humidity.set(snap.humidity);
    this.precipitation.set(snap.precipitation);
    this.iceThickness.set(snap.iceThickness);
    this.waterWaveAnomaly.set(snap.waterWaveAnomaly);
    this.volcanicHeat.set(snap.volcanicHeat);
    this.sediment.set(snap.sediment);

    if (snap.biomass && snap.biomass.length === this.numCells) {
      this.biomass.set(snap.biomass);
    } else {
      this.biomass.fill(0);
    }

    if (snap.fauna && snap.fauna.length === this.numCells) {
      this.fauna.set(snap.fauna);
    } else {
      this.fauna.fill(0);
    }

    if (snap.biodiversity && snap.biodiversity.length === this.numCells) {
      this.biodiversity.set(snap.biodiversity);
    } else {
      this.biodiversity.fill(0);
    }

    if (snap.extinctionImpact && snap.extinctionImpact.length === this.numCells) {
      this.extinctionImpact.set(snap.extinctionImpact);
    } else {
      this.extinctionImpact.fill(0);
    }

    this.speciesLineages = Array.isArray(snap.speciesLineages)
      ? snap.speciesLineages.map((s) => ({
          ...s,
          traits: { ...s.traits },
          innovations: [...(s.innovations || [])]
        }))
      : [];

    this.telemetryHistory = Array.isArray(snap.telemetryHistory)
      ? snap.telemetryHistory.map((h) => ({ ...h }))
      : [];

    this.activeHazards = Array.isArray(snap.activeHazards) ? snap.activeHazards.map((h) => ({ ...h })) : [];
    this.eventLog = Array.isArray(snap.eventLog) ? snap.eventLog.map((e) => ({ ...e })) : [];

    this.magnetosphere = snap.magnetosphere
      ? JSON.parse(JSON.stringify(snap.magnetosphere))
      : createDefaultMagnetosphereState();
    this.spaceWeather = snap.spaceWeather
      ? JSON.parse(JSON.stringify(snap.spaceWeather))
      : createDefaultSpaceWeatherState();
    this.geochemistry = snap.geochemistry
      ? JSON.parse(JSON.stringify(snap.geochemistry))
      : createDefaultGeochemistryState();
    this.naturalHistory = snap.naturalHistory
      ? JSON.parse(JSON.stringify(snap.naturalHistory))
      : createDefaultNaturalHistoryState();
    this.exploration = snap.exploration
      ? JSON.parse(JSON.stringify(snap.exploration))
      : createDefaultExplorationState();
    this.remoteSensing = snap.remoteSensing
      ? JSON.parse(JSON.stringify(snap.remoteSensing))
      : createDefaultRemoteSensingState();
    this.civilization = snap.civilization
      ? JSON.parse(JSON.stringify(snap.civilization))
      : createDefaultCivilizationState();
    this.terraforming = snap.terraforming
      ? JSON.parse(JSON.stringify(snap.terraforming))
      : createDefaultTerraformingState();
    this.missions = snap.missions
      ? JSON.parse(JSON.stringify(snap.missions))
      : createDefaultMissionSystemState(this.params.seed);
    this.modding = snap.modding
      ? JSON.parse(JSON.stringify(snap.modding))
      : createDefaultModdingState();

    generateMineralDepositField(
      this.params.seed,
      this.numCells,
      this.cellNx,
      this.cellNy,
      this.cellNz,
      this.tectonicBoundaryField,
      this.volcanicHeat,
      this.mineralField
    );
    this.syncMagnetosphereAndRadiation();
    this.updateAtmosphericWinds();
    this.computeHabitabilityField(this.params.seaLevelMeters);
    this.updateTelemetry('Restored world state from snapshot');
  }

  public syncMagnetosphereAndRadiation(): void {
    const p = this.params.planet;
    const g = this.params.geology;
    this.magnetosphere = updateMagnetosphereState(this.magnetosphere, {
      coreHeat: g?.internalHeat ?? 1.0,
      mantleActivity: g?.mantleActivity ?? 1.0,
      rotationHours: p?.rotationHours ?? 24,
      massEarth: p?.massEarth ?? 1.0,
      radiusKm: p?.radiusKm ?? 6371,
      pressureBar: this.params.pressureBar ?? 1.0,
      orbitalDistanceAU: p?.orbitalDistanceAU ?? 1.0,
      stellarActivityLevel: this.spaceWeather.stellarActivityMultiplier
    });
    computeCellRadiationField(
      this.magnetosphere,
      this.cellLatRad,
      this.elevation,
      this.params.seaLevelMeters,
      this.params.pressureBar ?? 1.0,
      this.radiationField
    );
  }

  public setMagneticScenarioPreset(preset: MagneticScenarioPreset): MagnetosphereState {
    this.magnetosphere = applyMagneticPreset(this.magnetosphere, preset);
    this.syncMagnetosphereAndRadiation();
    this.logEvent('GOD_ACTION', `Applied magnetic field preset: ${preset}`);
    return this.magnetosphere;
  }

  public advanceExtendedSubsystems(dtYears: number): void {
    const simTimeLabel = formatTimeBreakdown(this.timeState).years;

    stepTerraformingProjects(
      this.terraforming,
      this.params,
      this.telemetry,
      this.magnetosphere,
      dtYears
    );

    this.syncMagnetosphereAndRadiation();

    if (this.geochemistry.enabled) {
      stepGeochemistryReservoirs(
        this.geochemistry,
        dtYears,
        this.telemetry.meanSurfaceTempK,
        this.telemetry.meanPrecipitationMmDay,
        this.params.volcanicActivity,
        this.telemetry.globalBiomassFraction
      );
    }

    const impacted = stepSpaceWeatherQueue(
      this.spaceWeather,
      dtYears,
      this.params.seed,
      simTimeLabel
    );
    for (const imp of impacted) {
      this.triggerHazard('METEOR', imp.targetLatDeg, imp.targetLonDeg, Math.min(1.0, 0.35 + imp.diameterMeters / 4000));
      this.recordStratigraphySnapshot(`Asteroid Impact: ${imp.name}`);
    }

    const civDelta = stepCivilizationsState(this.civilization, {
      seed: this.params.seed,
      stepCount: this.timeState.stepsComputed,
      dtYears,
      simTimeLabel,
      params: this.params,
      telemetry: this.telemetry,
      speciesLineages: this.speciesLineages,
      habitability: this.habitability,
      elevation: this.elevation,
      cellLatRad: this.cellLatRad,
      cellLonRad: this.cellLonRad
    });
    if (civDelta.co2DeltaPpm > 0) {
      this.params.co2Ppm = Math.min(10000, this.params.co2Ppm + civDelta.co2DeltaPpm);
    }

    if (this.timeState.stepsComputed % 16 === 0 && dtYears >= 10) {
      this.recordStratigraphySnapshot();
    }

    const maxCivTech = this.civilization.civilizations.reduce(
      (max, c) => (c.active ? Math.max(max, c.techIndex) : max),
      0
    );
    evaluateMissionsState(this.missions, this.telemetry, this.timeState.stepsComputed, {
      maxCivTechIndex: maxCivTech,
      discoveryCount: this.exploration.discoveries.length
    });
  }

  public spawnAsteroidThreat(opts?: Parameters<typeof spawnApproachingAsteroid>[2]) {
    const obj = spawnApproachingAsteroid(this.spaceWeather, this.params.seed, opts);
    this.logEvent('HAZARD', `Detected approaching object ${obj.name} (${obj.diameterMeters} m, ${Math.round(obj.impactProbability * 100)}% risk).`);
    return obj;
  }

  public mitigateAsteroidThreat(threatId: string, method: MitigationActionKind) {
    const res = applyMitigationToThreat(this.spaceWeather, threatId, method);
    if (res.success) {
      this.logEvent('GOD_ACTION', res.note);
    }
    return res;
  }

  public triggerSpaceEvent(kind: Exclude<SpaceEventKind, 'ASTEROID_APPROACH'>, intensity = 1.0) {
    const simTimeLabel = formatTimeBreakdown(this.timeState).years;
    const res = triggerSpaceWeatherEvent(
      this.spaceWeather,
      kind,
      simTimeLabel,
      this.magnetosphere.dipoleMomentEarths,
      this.params.pressureBar ?? 1.0,
      intensity
    );
    this.params.pressureBar = Math.max(0.006, (this.params.pressureBar ?? 1.0) + res.pressureDeltaBar);
    this.params.solarLuminosity = Math.max(0.2, Math.min(2.5, this.params.solarLuminosity + res.luminosityMultiplierDelta));
    this.syncMagnetosphereAndRadiation();
    this.updateTelemetry(`Space weather event: ${kind}`);
    this.logEvent('HAZARD', res.report.summary);
    return res;
  }

  public extractPlanetaryResource(
    resourceType: 'IRON_ORE' | 'PHOSPHATE' | 'HYDROCARBON_CARBON' | 'SULFIDE_MINERAL',
    amountGt: number,
    recycledFraction = 0.25
  ) {
    const res = runResourceExtractionExperiment(
      this.geochemistry,
      this.mineralField,
      resourceType,
      amountGt,
      recycledFraction
    );
    if (res.co2ReleasedPpm > 0) {
      this.params.co2Ppm = Math.min(10000, this.params.co2Ppm + res.co2ReleasedPpm);
    }
    this.updateTelemetry(`Extracted ${resourceType}`);
    this.logEvent('GOD_ACTION', `Resource extraction (${resourceType}): ${res.extractedGt} Gt, +${res.co2ReleasedPpm} ppm CO2.`);
    return res;
  }

  public recordStratigraphySnapshot(eventMarker?: string) {
    const ageLabel = formatTimeBreakdown(this.timeState).years;
    return recordStratigraphicLayer(this.naturalHistory, {
      step: this.timeState.stepsComputed,
      ageYearsLabel: ageLabel,
      meanTempC: this.telemetry.meanSurfaceTempC,
      co2Ppm: this.params.co2Ppm,
      o2Percent: this.telemetry.oxygenPercent,
      oceanFraction: this.telemetry.oceanCoverageFraction,
      iceFraction: this.telemetry.iceCoverageFraction,
      volcanicActivity: this.params.volcanicActivity,
      eventMarker,
      candidateSpecies: this.speciesLineages.map((s) => ({
        id: s.id,
        name: s.name,
        guild: s.guild,
        dominantBiome: s.dominantBiome,
        isExtinct: s.isExtinct
      }))
    });
  }

  public reconstructLayerEnvironment(layerId: string, useApproximateProxy = false): EnvironmentReconstruction | null {
    return reconstructPastEnvironment(this.naturalHistory, layerId, useApproximateProxy);
  }

  public refreshExplorationLandingSites() {
    this.exploration.landingCandidates = evaluateLandingSites(
      this.gridWidth,
      this.gridHeight,
      this.elevation,
      this.temperature,
      this.habitability,
      this.radiationField,
      this.mineralField,
      this.params.seaLevelMeters
    );
    return this.exploration.landingCandidates;
  }

  public scanSurfaceAt(latDeg: number, lonDeg: number): ExplorationDiscovery {
    const idx = this.latLonToCellIndex(latDeg, lonDeg);
    const simTimeFormatted = formatTimeBreakdown(this.timeState).years;
    const disc = performExpeditionScanAt(this.exploration, {
      latDeg,
      lonDeg,
      simTimeFormatted,
      elevationMeters: this.elevation[idx],
      temperatureC: this.temperature[idx] - FREEZING_POINT_K,
      habitability: this.habitability[idx],
      biomass: this.biomass[idx],
      mineralRichness: this.mineralField[idx],
      hasFossils: this.naturalHistory.fossils.length > 0,
      impactCount: this.spaceWeather.postEventReports.filter((r) => r.kind === 'ASTEROID_APPROACH').length,
      biome: this.classifyCellBiome(idx)
    });
    this.logEvent('SYSTEM', `Expedition Discovery [${disc.epistemicClass}]: ${disc.title}`, latDeg, lonDeg);
    return disc;
  }

  public addSurfaceBookmark(label: string, latDeg: number, lonDeg: number, notes = '') {
    return addExplorationBookmark(this.exploration, label, latDeg, lonDeg, notes);
  }

  public renameRegionInAtlas(regionId: string, newName: string): boolean {
    return renameAtlasRegion(this.exploration, regionId, newName);
  }

  public performRemoteSensingObservation(mode?: ObservingMode) {
    if (mode) {
      this.remoteSensing.activeMode = mode;
    }
    const p = this.params.planet;
    return runSyntheticObservation(this.remoteSensing, this.params.seed, {
      radiusKm: p?.radiusKm ?? 6371,
      massEarth: p?.massEarth ?? 1.0,
      meanTempK: this.telemetry.meanSurfaceTempK,
      pressureBar: this.params.pressureBar ?? 1.0,
      o2Percent: this.telemetry.oxygenPercent,
      co2Ppm: this.params.co2Ppm,
      meanHumidity: this.telemetry.meanHumidity,
      albedo: this.telemetry.planetaryAlbedo,
      starType: p?.starType ?? 'G',
      orbitalDistanceAU: p?.orbitalDistanceAU ?? 1.0,
      globalBiomassFraction: this.telemetry.globalBiomassFraction
    });
  }

  public planRemoteSensingMission(name: string, missionType: MissionType, mode: ObservingMode) {
    this.performRemoteSensingObservation(mode);
    return scheduleObservationMission(this.remoteSensing, name, missionType, mode);
  }

  public spawnCivilizationAt(latDeg = 15, lonDeg = 20, customName?: string, initialTechIndex = 0.2): CivilizationEntity {
    const cellIndex = this.latLonToCellIndex(latDeg, lonDeg);
    const simTimeLabel = formatTimeBreakdown(this.timeState).years;
    const civ = spawnCivilizationEntity(this.civilization, {
      originType: 'EXPLICIT_INTERVENTION',
      cellIndex,
      latDeg,
      lonDeg,
      simTimeLabel,
      customName,
      initialTechIndex
    });
    this.logEvent('GOD_ACTION', `Spawned civilization "${civ.name}" at (${latDeg.toFixed(1)}°, ${lonDeg.toFixed(1)}°).`, latDeg, lonDeg);
    return civ;
  }

  public applyCivilizationPolicy(
    civId: string,
    policy: 'ECOLOGICAL_RESTORATION' | 'ACCELERATE_RENEWABLES' | 'DIPLOMATIC_ACCORD' | 'REVIVE_COLLAPSED'
  ): boolean {
    const simTimeLabel = formatTimeBreakdown(this.timeState).years;
    const ok = applyCivilizationPolicyAction(this.civilization, this.params, civId, policy, simTimeLabel);
    if (ok) {
      this.updateTelemetry(`Applied civilization policy: ${policy}`);
      this.logEvent('GOD_ACTION', `Civilization policy applied: ${policy}`);
    }
    return ok;
  }

  public startTerraformingProject(
    kind: TerraformingInterventionKind,
    intensity: number,
    durationYears = 100_000
  ): TerraformingProject {
    const proj = launchTerraformingProject(
      this.terraforming,
      this.params,
      this.telemetry,
      kind,
      intensity,
      durationYears
    );
    if (proj.status === 'ACTIVE') {
      this.logEvent('GOD_ACTION', `Started terraforming project: ${proj.title}`);
    }
    return proj;
  }

  public cancelTerraforming(projectId: string): boolean {
    return cancelTerraformingProject(this.terraforming, projectId);
  }

  public recordTerraformingBranchSnapshot(label: string) {
    const simTimeLabel = formatTimeBreakdown(this.timeState).years;
    return recordTerraformingBranch(this.terraforming, this.params, this.telemetry, label, simTimeLabel);
  }

  public addCustomMission(config: Parameters<typeof createCustomChallengeMission>[3]) {
    return createCustomChallengeMission(this.missions, this.params.seed, this.timeState.stepsComputed, config);
  }

  public registerModExtension(rawManifest: unknown) {
    return registerExtensionManifest(this.modding, rawManifest);
  }

  public applyModExtension(extensionId: string) {
    const res = applyExtensionContentToParams(this.modding, this.params, extensionId);
    if (res.applied) {
      this.initializeEquilibriumClimate();
      this.computeHabitabilityField(this.params.seaLevelMeters);
      this.updateTelemetry(res.summary);
      this.logEvent('GOD_ACTION', res.summary);
    }
    return res;
  }
}
