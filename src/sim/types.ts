import { SafeSimTimeState, SciNumber, TimeExecutionMode } from './time';
import { PlanetProperties } from './planetPhysics';
import { TerrainSettings } from './terrainGen';
import { GeologyParameters } from './geology';

export type PresetName =
  | 'Earth-like'
  | 'Ice World'
  | 'Desert World'
  | 'Ocean World'
  | 'Volcanic World'
  | 'Habitable Young Planet'
  | 'Rapid Greenhouse'
  | 'Glaciation & Recovery'
  | 'Mass Extinction Testbed'
  | 'Isolated Evolution'
  | 'Low-Oxygen Biospheres'
  | 'Custom';

export type VisualQualityPreset = 'Low' | 'Medium' | 'High';

export interface SimParameters {
  /** Deterministic seed string */
  seed: string;
  /** Active preset name */
  preset: PresetName;
  /** Sea level offset in meters relative to datum [-6000, +6000] */
  seaLevelMeters: number;
  /** Global terrain elevation multiplier [0.1, 3.0] */
  terrainScale: number;
  /** Atmospheric CO2 concentration in ppmv [50, 10000] */
  co2Ppm: number;
  /** Atmospheric O2 concentration in percent [0, 35] — starts low on abiotic world, rises via photosynthesis */
  o2Percent?: number;
  /** Total surface atmospheric pressure in bar [0.006, 90] (default 1.0 bar) */
  pressureBar?: number;
  /** Atmospheric Argon concentration in percent [0, 10] (default 0.934%) */
  argonPercent?: number;
  /** Planet physical & orbital properties (radius, mass, rotation, star type, etc.) */
  planet?: PlanetProperties;
  /** Procedural terrain style & roughness/continent parameters */
  terrain?: TerrainSettings;
  /** Planetary interior & tectonic parameters */
  geology?: GeologyParameters;
  /** Maximum oxygen production efficiency multiplier (for Low-Oxygen scenario) [0.0, 2.0] */
  oxygenProductionEfficiency?: number;
  /** Whether spontaneous Abiogenesis at hydrothermal vents / warm shallow basins is enabled */
  abiogenesisEnabled?: boolean;
  /** Evolutionary mutation rate multiplier [0.0, 5.0] */
  mutationRate?: number;
  /** Environmental selection pressure intensity [0.1, 3.0] */
  selectionPressure?: number;
  /** Reproduction / intrinsic growth rate multiplier [0.2, 3.0] */
  reproductionMultiplier?: number;
  /** Extinction susceptibility multiplier [0.2, 3.0] */
  extinctionSusceptibility?: number;
  /** Solar luminosity / insolation multiplier relative to Earth S0=1361 W/m^2 [0.2, 2.5] */
  solarLuminosity: number;
  /** Axial tilt (obliquity) in degrees [0, 60] */
  axialTiltDeg: number;
  /** Global temperature manual forcing offset in Kelvin [-40, +40] */
  temperatureOffsetK: number;
  /** Global atmospheric moisture / humidity capacity multiplier [0.0, 3.0] */
  humidityMultiplier: number;
  /** Global wind circulation intensity multiplier [0.0, 4.0] */
  windIntensity: number;
  /** Global precipitation efficiency multiplier [0.0, 3.0] */
  precipitationMultiplier: number;
  /** Volcanic outgassing and geothermal flux activity [0.0, 5.0] */
  volcanicActivity: number;
  /** Day-night cycle enabled */
  dayNightCycleEnabled: boolean;
  /** Sub-solar longitude in radians (updated automatically when dayNightCycleEnabled) */
  sunLongitudeRad: number;
  /** Sub-solar latitude in radians (seasonal declination) */
  sunLatitudeRad: number;
}

export type TrophicGuild = 'MICROBE_CHEMO' | 'PRODUCER_FLORA' | 'HERBIVORE_GRAZER' | 'APEX_PREDATOR';

export interface SpeciesTraits {
  /** Optimal temperature in Kelvin [255, 330] */
  optimalTempK: number;
  /** Thermal tolerance half-width in Kelvin [8, 45] */
  thermalBreadthK: number;
  /** Minimum moisture / humidity requirement [0.02, 0.85] (0 for marine species) */
  waterRequirement: number;
  /** Intrinsic reproduction / growth rate [0.1, 2.0] */
  reproductionRate: number;
  /** Metabolic & photosynthetic energy efficiency [0.2, 1.5] */
  energyEfficiency: number;
  /** Dispersal / migration capability across neighboring cells [0.05, 1.0] */
  dispersalCapability: number;
  /** Resistance to environmental stress, volcanic heat, and impact winter [0.1, 1.0] */
  stressResistance: number;
  /** Oxygen production factor [0.0, 1.5] (positive for photosynthetic producers, 0 for consumers) */
  oxygenYield: number;
  /** Minimum atmospheric O2 percent required for survival [0.0, 12.0] */
  minOxygenRequired: number;
}

export interface SpeciesLineage {
  id: string;
  name: string;
  parentId: string | null;
  guild: TrophicGuild;
  isMarine: boolean;
  originTimeYears: string;
  extinctTimeYears: string | null;
  isExtinct: boolean;
  causeOfExtinction?: string;
  traits: SpeciesTraits;
  /** Estimated global population count (aggregate planetary units, e.g. millions of organisms/colonies) */
  populationEstimate: number;
  /** Peak historical population estimate */
  peakPopulation: number;
  /** Number of grid cells currently inhabited */
  occupiedCells: number;
  /** Primary biome where this species currently thrives */
  dominantBiome: BiomeClassification;
  /** Cumulative genetic divergence score from ancestor [0, 1+] */
  geneticDivergence: number;
  /** Notable evolutionary innovations unlocked by trait thresholds */
  innovations: string[];
}

export interface TelemetryHistoryPoint {
  step: number;
  yearsNumeric: number;
  timeLabel: string;
  meanTempC: number;
  co2Ppm: number;
  o2Percent: number;
  biomassPercent: number;
  faunaPercent: number;
  livingSpeciesCount: number;
  biodiversityIndex: number;
  habitabilityPercent: number;
  extinctionSeverityPercent: number;
}

export interface ActiveHazardEvent {
  id: string;
  type: 'VOLCANO' | 'EARTHQUAKE' | 'TSUNAMI' | 'STORM' | 'DROUGHT' | 'FLOOD' | 'METEOR';
  latDeg: number;
  lonDeg: number;
  nx: number;
  ny: number;
  nz: number;
  intensity: number;       // [0.1, 1.0]
  radiusRad: number;       // Angular radius on sphere
  ageSeconds: number;      // Elapsed lifetime of event
  durationSeconds: number; // Total physical duration
  waveRadiusRad?: number;  // Current expanding wavefront radius for Tsunami / Seismic ring
}

export interface SimEventLogEntry {
  id: string;
  simTimeFormatted: string;
  category: 'GOD_ACTION' | 'HAZARD' | 'CLIMATE' | 'BIOSPHERE' | 'EVOLUTION' | 'TIME' | 'SYSTEM';
  message: string;
  latDeg?: number;
  lonDeg?: number;
}

export interface GlobalTelemetry {
  meanSurfaceTempK: number;
  meanSurfaceTempC: number;
  minSurfaceTempC: number;
  maxSurfaceTempC: number;
  oceanCoverageFraction: number;
  iceCoverageFraction: number;
  meanHumidity: number;
  meanPrecipitationMmDay: number;
  maxWindSpeedMs: number;
  radiativeForcingWm2: number;
  planetaryAlbedo: number;
  outgoingLongwaveWm2: number;
  absorbedSolarWm2: number;
  netEnergyImbalanceWm2: number;
  effectiveSeaLevelMeters: number;
  volcanicAerosolOpticalDepth: number;
  /** Global photosynthetic + microbial biomass coverage fraction [0, 1] */
  globalBiomassFraction: number;
  /** Global fauna / complex ecosystem coverage fraction [0, 1] */
  globalFaunaFraction: number;
  /** Global mean habitability index [0, 1] */
  meanHabitability: number;
  /** Atmospheric O2 percentage [0, 35] */
  oxygenPercent: number;
  /** Number of currently living species lineages */
  livingSpeciesCount: number;
  /** Number of extinct lineages recorded */
  extinctSpeciesCount: number;
  /** Shannon-Wiener / Simpson composite planetary biodiversity index [0, 5.0] */
  biodiversityIndex: number;
  /** Recent extinction severity [0, 1] */
  extinctionSeverity: number;
  /** Biosphere recovery rate trend [-1, +1] */
  recoveryTrend: number;
  activeTimeMode: TimeExecutionMode;
  lastStepStabilityNote: string;
}

export type BiomeClassification =
  | 'ABIOTIC_OCEAN'
  | 'POLAR_SEA_ICE'
  | 'HYDROTHERMAL_VENT_MICROBES'
  | 'MARINE_PHYTOPLANKTON_REEF'
  | 'GLACIAL_ICE_SHEET'
  | 'ABIOTIC_REGOLITH'
  | 'ARID_DESERT_SCRUB'
  | 'TUNDRA_MOSS'
  | 'TEMPERATE_GRASSLAND'
  | 'BOREAL_TAIGA_FOREST'
  | 'TROPICAL_RAINFOREST';

export interface CellInspection {
  cellIndex: number;
  latDeg: number;
  lonDeg: number;
  elevationMeters: number;
  heightAboveSeaMeters: number;
  waterDepthMeters: number;
  isOcean: boolean;
  temperatureK: number;
  temperatureC: number;
  humidity: number;
  precipitationMmDay: number;
  windU: number;
  windV: number;
  windSpeedMs: number;
  iceThicknessMeters: number;
  volcanicHeatWm2: number;
  tsunamiWaveHeightMeters: number;
  regolithSedimentMeters: number;
  /** Local habitability suitability [0, 1] */
  habitability: number;
  /** Local primary producer biomass (microbes / phytoplankton / terrestrial flora) [0, 1] */
  biomass: number;
  /** Local heterotrophic fauna density (marine / terrestrial animals) [0, 1] */
  fauna: number;
  /** Local species richness / biodiversity score [0, 1] */
  biodiversity: number;
  /** Local catastrophe / extinction impact scar intensity [0, 1] */
  extinctionImpact: number;
  /** Dominant living species name at this cell, if any */
  dominantSpeciesName: string;
  /** Ecological biome classification */
  biome: BiomeClassification;
}

export interface SerializedWorldSnapshot {
  version: number;
  label: string;
  createdAtIso: string;
  gridWidth: number;
  gridHeight: number;
  params: SimParameters;
  timeState: SafeSimTimeState;
  speedSci: SciNumber;
  paused: boolean;
  elevation: number[];
  generatedElevation?: number[];
  temperature: number[];
  humidity: number[];
  precipitation: number[];
  iceThickness: number[];
  waterWaveAnomaly: number[];
  volcanicHeat: number[];
  sediment: number[];
  biomass?: number[];
  fauna?: number[];
  biodiversity?: number[];
  extinctionImpact?: number[];
  speciesLineages?: SpeciesLineage[];
  telemetryHistory?: TelemetryHistoryPoint[];
  activeHazards: ActiveHazardEvent[];
  eventLog: SimEventLogEntry[];
}
