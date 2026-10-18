import { BiomeClassification } from './types';

export type DiscoveryCategory =
  | 'GEOLOGICAL_FORMATION'
  | 'IMPACT_STRUCTURE'
  | 'MINERAL_DEPOSIT'
  | 'FOSSIL_SITE'
  | 'BIOSIGNATURE';

export type EpistemicClass = 'SYNTHETIC_OBSERVATION' | 'GENERATED_DISCOVERY';

export interface LandingSiteCandidate {
  id: string;
  name: string;
  latDeg: number;
  lonDeg: number;
  cellIndex: number;
  slopeMetersPerCell: number;
  elevationMeters: number;
  temperatureC: number;
  radiationIndex: number;
  habitability: number;
  safetyScore: number;
  scienceScore: number;
}

export interface ExplorationDiscovery {
  id: string;
  title: string;
  category: DiscoveryCategory;
  epistemicClass: 'SYNTHETIC_OBSERVATION' | 'GENERATED_DISCOVERY';
  latDeg: number;
  lonDeg: number;
  simTimeFormatted: string;
  observationSummary: string;
  evidenceData: string;
}

export interface ExplorationBookmark {
  id: string;
  label: string;
  latDeg: number;
  lonDeg: number;
  notes: string;
}

export interface AtlasRegionEntry {
  id: string;
  name: string;
  centerLatDeg: number;
  centerLonDeg: number;
  dominantBiome: BiomeClassification;
  meanElevationMeters: number;
  discovered: boolean;
  discoveryCount: number;
}

export interface ExplorationMission {
  id: string;
  title: string;
  objectiveDescription: string;
  requiredMinSafetyScore: number;
  requiredMinHabitability: number;
  targetCategory: DiscoveryCategory;
  completed: boolean;
}

export interface ExplorationState {
  expeditionActive: boolean;
  roverLatDeg: number;
  roverLonDeg: number;
  cameraSpeedMultiplier: number;
  landingCandidates: LandingSiteCandidate[];
  discoveries: ExplorationDiscovery[];
  bookmarks: ExplorationBookmark[];
  atlasRegions: AtlasRegionEntry[];
  missions: ExplorationMission[];
}

export function createDefaultExplorationState(): ExplorationState {
  return {
    expeditionActive: false,
    roverLatDeg: 12.5,
    roverLonDeg: 24.0,
    cameraSpeedMultiplier: 1.0,
    landingCandidates: [],
    discoveries: [],
    bookmarks: [
      { id: 'BM-1', label: 'Prime Meridian Basin', latDeg: 0, lonDeg: 0, notes: 'Equatorial reference datum' }
    ],
    atlasRegions: [
      {
        id: 'REG-NORTH',
        name: 'Boreal Polar Highlands',
        centerLatDeg: 68,
        centerLonDeg: 0,
        dominantBiome: 'GLACIAL_ICE_SHEET',
        meanElevationMeters: 800,
        discovered: false,
        discoveryCount: 0
      },
      {
        id: 'REG-EQ-WEST',
        name: 'Hesperian Equatorial Shelf',
        centerLatDeg: 5,
        centerLonDeg: -75,
        dominantBiome: 'ABIOTIC_OCEAN',
        meanElevationMeters: -450,
        discovered: false,
        discoveryCount: 0
      },
      {
        id: 'REG-EQ-EAST',
        name: 'Aurora Continental Craton',
        centerLatDeg: 14,
        centerLonDeg: 55,
        dominantBiome: 'ABIOTIC_REGOLITH',
        meanElevationMeters: 1250,
        discovered: false,
        discoveryCount: 0
      },
      {
        id: 'REG-SOUTH',
        name: 'Austral Cryo-Basin',
        centerLatDeg: -65,
        centerLonDeg: 120,
        dominantBiome: 'POLAR_SEA_ICE',
        meanElevationMeters: -900,
        discovered: false,
        discoveryCount: 0
      }
    ],
    missions: [
      {
        id: 'EXP-M1',
        title: 'Hydrothermal & Biosignature Survey',
        objectiveDescription: 'Land in a safe habitable zone and catalog a BIOSIGNATURE discovery.',
        requiredMinSafetyScore: 0.45,
        requiredMinHabitability: 0.25,
        targetCategory: 'BIOSIGNATURE',
        completed: false
      },
      {
        id: 'EXP-M2',
        title: 'Crustal Mineral Reconnaissance',
        objectiveDescription: 'Survey highland regolith and catalog a MINERAL_DEPOSIT discovery.',
        requiredMinSafetyScore: 0.35,
        requiredMinHabitability: 0.0,
        targetCategory: 'MINERAL_DEPOSIT',
        completed: false
      }
    ]
  };
}

export function evaluateLandingSites(
  gridWidth: number,
  gridHeight: number,
  elevation: Float32Array,
  temperature: Float32Array,
  habitability: Float32Array,
  radiationField: Float32Array,
  mineralField: Float32Array,
  seaLevelMeters: number,
  maxCount = 6
): LandingSiteCandidate[] {
  const candidates: LandingSiteCandidate[] = [];
  const stepY = Math.max(2, Math.floor(gridHeight / 8));
  const stepX = Math.max(3, Math.floor(gridWidth / 12));

  for (let y = stepY; y < gridHeight - stepY; y += stepY) {
    for (let x = 0; x < gridWidth; x += stepX) {
      const idx = y * gridWidth + x;
      const elev = elevation[idx];
      if (elev < seaLevelMeters - 150) continue;

      const xEast = (x + 1) % gridWidth;
      const ySouth = Math.min(gridHeight - 1, y + 1);
      const slope = Math.hypot(
        elevation[y * gridWidth + xEast] - elev,
        elevation[ySouth * gridWidth + x] - elev
      );
      const tempC = temperature[idx] - 273.15;
      const rad = radiationField[idx] ?? 0.05;
      const hab = habitability[idx];
      const minScore = mineralField[idx] ?? 0.2;

      const slopeSafety = Math.max(0, 1 - slope / 1400);
      const thermalSafety = Math.max(0, 1 - Math.abs(tempC - 15) / 85);
      const radSafety = Math.max(0, 1 - rad * 0.9);
      const safetyScore = Number((slopeSafety * 0.45 + thermalSafety * 0.35 + radSafety * 0.2).toFixed(2));
      const scienceScore = Number(Math.min(1, hab * 0.55 + minScore * 0.45).toFixed(2));

      const latDeg = Number((90 - ((y + 0.5) / gridHeight) * 180).toFixed(1));
      const lonDeg = Number((((x + 0.5) / gridWidth) * 360 - 180).toFixed(1));

      candidates.push({
        id: `SITE-${y}-${x}`,
        name: `Landing Zone (${latDeg}°, ${lonDeg}°)`,
        latDeg,
        lonDeg,
        cellIndex: idx,
        slopeMetersPerCell: Math.round(slope),
        elevationMeters: Math.round(elev),
        temperatureC: Number(tempC.toFixed(1)),
        radiationIndex: Number(rad.toFixed(2)),
        habitability: Number(hab.toFixed(2)),
        safetyScore,
        scienceScore
      });
    }
  }

  candidates.sort((a, b) => b.safetyScore * 0.55 + b.scienceScore * 0.45 - (a.safetyScore * 0.55 + a.scienceScore * 0.45));
  return candidates.slice(0, maxCount);
}

export function performExpeditionScanAt(
  state: ExplorationState,
  opts: {
    latDeg: number;
    lonDeg: number;
    simTimeFormatted: string;
    elevationMeters: number;
    temperatureC: number;
    habitability: number;
    biomass: number;
    mineralRichness: number;
    hasFossils: boolean;
    impactCount: number;
    biome: BiomeClassification;
  }
): ExplorationDiscovery {
  state.expeditionActive = true;
  state.roverLatDeg = opts.latDeg;
  state.roverLonDeg = opts.lonDeg;

  let category: DiscoveryCategory = 'GEOLOGICAL_FORMATION';
  let epistemicClass: ExplorationDiscovery['epistemicClass'] = 'SYNTHETIC_OBSERVATION';
  let title = `Stratified Outcrop at (${opts.latDeg.toFixed(1)}°, ${opts.lonDeg.toFixed(1)}°)`;
  let summary = `Measured surface elevation ${Math.round(opts.elevationMeters)} m and thermal regime ${opts.temperatureC.toFixed(1)} °C.`;
  let evidence = `Biome=${opts.biome} | T=${opts.temperatureC.toFixed(1)}°C | Hab=${(opts.habitability * 100).toFixed(0)}%`;

  if (opts.biomass > 0.08) {
    category = 'BIOSIGNATURE';
    epistemicClass = 'SYNTHETIC_OBSERVATION';
    title = `Active Biotic Mat & Pigment Signature (${opts.latDeg.toFixed(1)}°, ${opts.lonDeg.toFixed(1)}°)`;
    summary = `Detected organic metabolic activity and photosynthetic/chemosynthetic pigment absorption.`;
    evidence = `Biomass=${(opts.biomass * 100).toFixed(1)}% | Habitability=${(opts.habitability * 100).toFixed(0)}%`;
  } else if (opts.hasFossils) {
    category = 'FOSSIL_SITE';
    epistemicClass = 'GENERATED_DISCOVERY';
    title = `Fossiliferous Sedimentary Bed (${opts.latDeg.toFixed(1)}°, ${opts.lonDeg.toFixed(1)}°)`;
    summary = `Excavated mineralized micro- and macro-fossils preserved in lithified strata.`;
    evidence = `Paleo-horizon fossil assemblage verified in local core sample`;
  } else if (opts.mineralRichness > 0.52) {
    category = 'MINERAL_DEPOSIT';
    epistemicClass = 'GENERATED_DISCOVERY';
    title = `Hydrothermal Ore Vein (${opts.latDeg.toFixed(1)}°, ${opts.lonDeg.toFixed(1)}°)`;
    summary = `High-grade iron-sulfide and phosphate mineral enrichment along crustal fracture.`;
    evidence = `Mineral Richness Index=${(opts.mineralRichness * 100).toFixed(0)}%`;
  } else if (opts.impactCount > 0 && opts.elevationMeters < -200) {
    category = 'IMPACT_STRUCTURE';
    epistemicClass = 'GENERATED_DISCOVERY';
    title = `Shocked Quartz Impact Breccia (${opts.latDeg.toFixed(1)}°, ${opts.lonDeg.toFixed(1)}°)`;
    summary = `Identified shatter cones and impact melt sheet from past bolide collision.`;
    evidence = `Recorded planetary impacts=${opts.impactCount}`;
  }

  const discovery: ExplorationDiscovery = {
    id: `DISC-${state.discoveries.length + 1}`,
    title,
    category,
    epistemicClass,
    latDeg: opts.latDeg,
    lonDeg: opts.lonDeg,
    simTimeFormatted: opts.simTimeFormatted,
    observationSummary: summary,
    evidenceData: evidence
  };

  state.discoveries.unshift(discovery);
  if (state.discoveries.length > 30) state.discoveries.length = 30;

  let nearestReg = state.atlasRegions[0];
  let bestDist = Infinity;
  for (const reg of state.atlasRegions) {
    const d = Math.hypot(reg.centerLatDeg - opts.latDeg, reg.centerLonDeg - opts.lonDeg);
    if (d < bestDist) {
      bestDist = d;
      nearestReg = reg;
    }
  }
  if (nearestReg) {
    nearestReg.discovered = true;
    nearestReg.discoveryCount++;
    nearestReg.dominantBiome = opts.biome;
    nearestReg.meanElevationMeters = Math.round(opts.elevationMeters);
  }

  for (const m of state.missions) {
    if (!m.completed && m.targetCategory === category && opts.habitability >= m.requiredMinHabitability) {
      m.completed = true;
    }
  }

  return discovery;
}

export function addExplorationBookmark(
  state: ExplorationState,
  label: string,
  latDeg: number,
  lonDeg: number,
  notes = ''
): ExplorationBookmark {
  const bm: ExplorationBookmark = {
    id: `BM-${state.bookmarks.length + 1}-${Date.now()}`,
    label: label.trim() || `Marker (${latDeg.toFixed(1)}°, ${lonDeg.toFixed(1)}°)`,
    latDeg,
    lonDeg,
    notes
  };
  state.bookmarks.unshift(bm);
  return bm;
}

export function renameAtlasRegion(state: ExplorationState, regionId: string, newName: string): boolean {
  const reg = state.atlasRegions.find((r) => r.id === regionId);
  if (!reg || !newName.trim()) return false;
  reg.name = newName.trim();
  return true;
}
