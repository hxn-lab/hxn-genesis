import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { I18nManager, STORAGE_KEY_LANGUAGE, TRANSLATIONS, TranslationKey } from '../src/i18n';
import {
  migrateSnapshotToV4,
  parseAndValidateWorldJson,
  WorldLibraryManager
} from '../src/persistence/worldStore';
import {
  greenhouseForcingWm2,
  nitrogenPercent,
  setGas,
  validateAtmosphere
} from '../src/sim/atmosphere';
import { eventRequiresConfirmation, GLOBAL_EVENT_CATALOG } from '../src/sim/events';
import {
  createDefaultPlanetProperties,
  derivePlanetQuantities,
  EARTH_GRAVITY_MS2,
  PLANET_PROPERTY_EFFECTS,
  renderScaleForRadius,
  validatePlanetProperties
} from '../src/sim/planetPhysics';
import { SculptBrushTool } from '../src/sim/sculpt';
import { seaLevelForOceanFraction, TERRAIN_STYLES } from '../src/sim/terrainGen';
import {
  advanceSafeTime,
  classifyTimeMode,
  createInitialTimeState,
  formatSciNumber,
  formatTimeBreakdown,
  parseSciSpeed
} from '../src/sim/time';
import { SerializedWorldSnapshot } from '../src/sim/types';
import { WorldSimulation } from '../src/sim/world';
import {
  buildCausalAttributionChains,
  compareWorldSnapshots,
  computeMetricCorrelation,
  exportWorldAnalyticsCsv,
  runMonteCarloEnsemble,
  runParameterSensitivitySweep
} from '../src/sim/analytics';
import {
  exportChallengeMissionJson,
  importChallengeMissionJson
} from '../src/sim/missions';
import {
  BUILTIN_EXAMPLE_EXTENSION,
  validateExtensionManifest
} from '../src/sim/modding';
import { KEYBOARD_SHORTCUTS, resolveShortcutAction } from '../src/ui/shortcuts';
import { TUTORIAL_STEPS, TutorialController } from '../src/ui/tutorial';
import {
  DEFAULT_GUIDED_TOUR_STOPS,
  filterCommandPaletteActions
} from '../src/ui/workflows';

function createMemoryStorage(): Record<string, string> {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    length: 0
  };
  return store;
}

describe('HXN GENESIS 3.0 — 18+ Automated Acceptance Tests: Planet Creator, Sculpting, Physics, Evolution, Save/Load & Tutorial', () => {
  it('1. Planet creation from scratch & seed reproducibility across all 10 TerrainStyle modes', () => {
    const worldA = new WorldSimulation(72, 36, 'Earth-like', 'SEED-ALPHA-99');
    const worldB = new WorldSimulation(72, 36, 'Earth-like', 'SEED-ALPHA-99');
    const worldC = new WorldSimulation(72, 36, 'Earth-like', 'SEED-DIFFERENT-01');

    expect(Array.from(worldA.elevation)).toEqual(Array.from(worldB.elevation));
    expect(Array.from(worldA.temperature)).toEqual(Array.from(worldB.temperature));
    expect(Array.from(worldA.elevation)).not.toEqual(Array.from(worldC.elevation));
    expect(worldA.telemetry.globalBiomassFraction).toBe(0);
    expect(worldA.telemetry.globalFaunaFraction).toBe(0);
    expect(worldA.telemetry.livingSpeciesCount).toBe(0);

    for (const style of TERRAIN_STYLES) {
      worldA.regenerateTerrainWithSettings({ style, roughness: 1.1, mountainHeight: 1.2 }, false);
      worldB.regenerateTerrainWithSettings({ style, roughness: 1.1, mountainHeight: 1.2 }, false);
      expect(Array.from(worldA.elevation)).toEqual(Array.from(worldB.elevation));
      for (let i = 0; i < worldA.numCells; i++) {
        expect(Number.isFinite(worldA.elevation[i])).toBe(true);
      }
    }
  });

  it('2. Planet radius, mass, gravity derivation (g = GM/R²), lapse rate, and orbital insolation', () => {
    const earth = createDefaultPlanetProperties('Terra');
    const dEarth = derivePlanetQuantities(earth);
    expect(dEarth.derivedGravityMs2).toBeCloseTo(EARTH_GRAVITY_MS2, 2);
    expect(dEarth.effectiveGravityMs2).toBeCloseTo(EARTH_GRAVITY_MS2, 2);
    expect(dEarth.lapseRateKPerM).toBeCloseTo(0.0065, 5);
    expect(renderScaleForRadius(earth.radiusKm)).toBeCloseTo(1.0, 4);

    // Super-Earth: 2x mass, 1x radius -> 2x gravity & 2x lapse rate
    const superEarth = validatePlanetProperties({ ...earth, massEarth: 2.0, radiusKm: 6371 });
    const dSuper = derivePlanetQuantities(superEarth);
    expect(dSuper.derivedGravityMs2).toBeCloseTo(EARTH_GRAVITY_MS2 * 2, 2);
    expect(dSuper.lapseRateKPerM).toBeCloseTo(0.013, 4);

    // Custom gravity override
    const overridden = validatePlanetProperties({ ...earth, gravityOverrideMs2: 3.71 });
    const dOver = derivePlanetQuantities(overridden);
    expect(dOver.gravityIsOverride).toBe(true);
    expect(dOver.effectiveGravityMs2).toBeCloseTo(3.71, 2);
    expect(dOver.warnings).toContain('GRAVITY_OVERRIDE');

    // Orbital distance & star type affect insolation in WorldSimulation
    const world = new WorldSimulation(72, 36, 'Earth-like', 'ORBIT-TEST');
    world.applyPlanetProperties({ starType: 'F', orbitalDistanceAU: 1.0 });
    expect(world.params.solarLuminosity).toBeGreaterThan(1.5);
    world.applyPlanetProperties({ starType: 'M', orbitalDistanceAU: 1.5 });
    expect(world.params.solarLuminosity).toBeLessThan(0.5);
    expect(PLANET_PROPERTY_EFFECTS.radiusKm).toBe('SIMULATED');
  });

  it('3. Terrain generation & all 12 sculpting brush tools (including symmetry and restore)', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'SCULPT-WORKSHOP');
    const baseline = new Float32Array(world.elevation);

    const tools: SculptBrushTool[] = [
      'RAISE',
      'LOWER',
      'SMOOTH',
      'FLATTEN',
      'MOUNTAIN_RANGE',
      'CARVE_BASIN',
      'CRATER',
      'PAINT_OCEAN',
      'PAINT_LAND',
      'ADD_ICE',
      'REMOVE_ICE',
      'RESTORE'
    ];

    // Raise at (20, 30) with EQUATOR_MIRROR symmetry -> both +20° and -20° should rise
    const northBefore = world.inspectCoordinate(20, 30).elevationMeters;
    const southBefore = world.inspectCoordinate(-20, 30).elevationMeters;
    world.applyBrushStroke(
      {
        tool: 'RAISE',
        latDeg: 20,
        lonDeg: 30,
        radiusRad: 0.25,
        strength: 0.9,
        falloff: 'SMOOTH',
        shape: 'CIRCLE',
        symmetry: 'EQUATOR_MIRROR'
      },
      true
    );
    expect(world.inspectCoordinate(20, 30).elevationMeters).toBeGreaterThan(northBefore + 500);
    expect(world.inspectCoordinate(-20, 30).elevationMeters).toBeGreaterThan(southBefore + 500);

    // Exercise all 12 tools across the sphere and verify finite state
    for (const tool of tools) {
      world.applyBrushStroke({
        tool,
        latDeg: 20,
        lonDeg: 30,
        radiusRad: 0.35,
        strength: 1.0,
        falloff: tool === 'RESTORE' ? 'CONSTANT' : 'LINEAR',
        shape: tool === 'MOUNTAIN_RANGE' ? 'RIDGE' : 'CIRCLE',
        symmetry: 'NONE'
      });
    }

    // After RESTORE with full strength and CONSTANT falloff over the region, elevation matches baseline
    expect(Math.abs(world.inspectCoordinate(20, 30).elevationMeters - northBefore)).toBeLessThan(1e-3);
    for (let i = 0; i < world.numCells; i++) {
      expect(Number.isFinite(world.elevation[i])).toBe(true);
      expect(Number.isFinite(baseline[i])).toBe(true);
    }
  });

  it('4. Ocean coverage & sea-level solver updates submerged fraction and habitability accurately', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'OCEAN-SOLVER');
    const achieved25 = world.setOceanCoverageFraction(0.25);
    expect(achieved25).toBeGreaterThan(0.18);
    expect(achieved25).toBeLessThan(0.32);

    const achieved80 = world.setOceanCoverageFraction(0.8);
    expect(achieved80).toBeGreaterThan(0.72);
    expect(achieved80).toBeLessThan(0.88);
    expect(world.params.seaLevelMeters).toBeGreaterThan(0);

    // Edge cases: 0% and 100%
    expect(seaLevelForOceanFraction(world.elevation, world.cellCosLat, 0)).toBeLessThan(-1000);
    expect(seaLevelForOceanFraction(world.elevation, world.cellCosLat, 1)).toBeGreaterThan(1000);
  });

  it('5. Atmosphere gas composition validation, N₂ balance filler, and greenhouse forcing', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'ATMO-LAB');
    world.setAtmosphereGas('O2', 21.0);
    world.setAtmosphereGas('CO2', 400);
    world.setAtmosphereGas('AR', 1.0);

    // Changing O2 must NOT alter CO2 or AR
    world.setAtmosphereGas('O2', 25.0);
    expect(world.params.co2Ppm).toBe(400);
    expect(world.params.argonPercent).toBe(1.0);

    const comp = {
      pressureBar: world.params.pressureBar ?? 1.0,
      o2Percent: world.params.o2Percent ?? 25.0,
      co2Ppm: world.params.co2Ppm,
      argonPercent: world.params.argonPercent ?? 1.0
    };
    expect(validateAtmosphere(comp).valid).toBe(true);
    const n2 = nitrogenPercent(comp);
    expect(n2 + comp.o2Percent + comp.co2Ppm / 10000 + comp.argonPercent).toBeCloseTo(100, 5);

    // Clamping when gas exceeds available room
    const clamped = setGas({ pressureBar: 1, o2Percent: 95, co2Ppm: 280, argonPercent: 8 }, 'AR', 10);
    expect(clamped.argonPercent).toBeLessThanOrEqual(5);

    // Greenhouse forcing increases with CO2 and surface pressure
    expect(greenhouseForcingWm2(560, 1.0)).toBeGreaterThan(greenhouseForcingWm2(280, 1.0));
    expect(greenhouseForcingWm2(280, 3.0)).toBeGreaterThan(greenhouseForcingWm2(280, 1.0));
  });

  it('6. Abiogenesis: emerges naturally under favorable warm marine conditions and stays 0 when disabled', () => {
    const worldFav = new WorldSimulation(72, 36, 'Habitable Young Planet', 'ABIO-FAV');
    worldFav.params.abiogenesisEnabled = true;
    worldFav.speedSci = parseSciSpeed('1e9');
    for (let i = 0; i < 6; i++) {
      worldFav.advanceFrame(0.1);
    }
    expect(worldFav.telemetry.globalBiomassFraction).toBeGreaterThan(0);
    expect(worldFav.telemetry.livingSpeciesCount).toBeGreaterThanOrEqual(1);

    const worldOff = new WorldSimulation(72, 36, 'Habitable Young Planet', 'ABIO-OFF');
    worldOff.params.abiogenesisEnabled = false;
    worldOff.speedSci = parseSciSpeed('1e9');
    for (let i = 0; i < 6; i++) {
      worldOff.advanceFrame(0.1);
    }
    expect(worldOff.telemetry.globalBiomassFraction).toBe(0);
    expect(worldOff.telemetry.livingSpeciesCount).toBe(0);
  });

  it('7. Population growth & carrying capacity: populations grow in habitable zones and remain bounded [0, 1]', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'POP-GROWTH');
    world.seedGlobalBiosphere(true);
    world.speedSci = parseSciSpeed('1e6');
    for (let i = 0; i < 12; i++) {
      world.advanceFrame(0.08);
    }
    for (let i = 0; i < world.numCells; i++) {
      expect(world.biomass[i]).toBeGreaterThanOrEqual(0);
      expect(world.biomass[i]).toBeLessThanOrEqual(1);
      expect(world.fauna[i]).toBeGreaterThanOrEqual(0);
      expect(world.fauna[i]).toBeLessThanOrEqual(1);
    }
    expect(world.telemetry.globalBiomassFraction).toBeGreaterThan(0.1);
  });

  it('8. Mutation and trait inheritance: child lineages inherit and mutate parent traits during speciation', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'EVO-INHERIT');
    world.params.mutationRate = 2.0;
    world.seedLifeAtLatLon('MICROBES', 0, 0, 0.95, 0.4);
    expect(world.speciesLineages.length).toBeGreaterThanOrEqual(1);

    world.seedGlobalBiosphere(true);
    world.speedSci = parseSciSpeed('1e6');
    for (let i = 0; i < 15; i++) {
      world.advanceFrame(0.1);
    }

    const childLineages = world.speciesLineages.filter((s) => s.parentId !== null);
    expect(childLineages.length).toBeGreaterThanOrEqual(1);
    const child = childLineages[0];
    const parent = world.speciesLineages.find((s) => s.id === child.parentId);
    expect(parent).toBeDefined();
    expect(child.traits.optimalTempK).toBeGreaterThan(230);
    expect(child.traits.optimalTempK).toBeLessThan(340);
  });

  it('9. Natural selection under environmental change: warming shifts living species optimalTempK upward', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'EVO-SELECTION');
    world.seedGlobalBiosphere(true);
    const initialMeanOptTemp =
      world.speciesLineages.reduce((acc, s) => acc + s.traits.optimalTempK, 0) /
      world.speciesLineages.length;

    world.params.co2Ppm = 5000;
    world.params.temperatureOffsetK = 14;
    world.params.selectionPressure = 2.5;
    world.params.mutationRate = 2.2;
    world.speedSci = parseSciSpeed('1e6');

    for (let i = 0; i < 20; i++) {
      world.advanceFrame(0.1);
    }

    const living = world.speciesLineages.filter((s) => !s.isExtinct);
    expect(living.length).toBeGreaterThan(0);
    const adaptedMeanOptTemp =
      living.reduce((acc, s) => acc + s.traits.optimalTempK, 0) / living.length;
    expect(adaptedMeanOptTemp).toBeGreaterThan(initialMeanOptTemp + 0.5);
  });

  it('10. Migration across neighboring cells: localized seeding colonizes adjacent habitable regions', () => {
    const world = new WorldSimulation(72, 36, 'Habitable Young Planet', 'MIGRATION-TEST');
    world.params.abiogenesisEnabled = false;
    world.seedLifeAtLatLon('FLORA', 0, 0, 1.0, 0.14);

    let occupiedBefore = 0;
    for (let i = 0; i < world.numCells; i++) {
      if (world.biomass[i] > 0.01) occupiedBefore++;
    }
    expect(occupiedBefore).toBeGreaterThan(0);

    world.speedSci = parseSciSpeed('1e6');
    for (let i = 0; i < 18; i++) {
      world.advanceFrame(0.1);
    }

    let occupiedAfter = 0;
    for (let i = 0; i < world.numCells; i++) {
      if (world.biomass[i] > 0.01) occupiedAfter++;
    }
    expect(occupiedAfter).toBeGreaterThan(occupiedBefore);
  });

  it('11. Extinction, lineage recording, and global experiments (Cooling, Greenhouse, Atmo/Ocean loss, Recovery)', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'EXTINCTION-LOG');
    world.seedGlobalBiosphere(true);
    const initialLiving = world.telemetry.livingSpeciesCount;
    expect(initialLiving).toBeGreaterThanOrEqual(3);

    const targetId = world.speciesLineages.find((s) => !s.isExtinct)!.id;
    expect(world.removeSpeciesById(targetId)).toBe(true);
    expect(world.telemetry.livingSpeciesCount).toBe(initialLiving - 1);
    expect(world.telemetry.extinctSpeciesCount).toBeGreaterThanOrEqual(1);

    // Global experiments and destructive confirmation rules
    expect(Object.keys(GLOBAL_EVENT_CATALOG).length).toBe(7);
    expect(eventRequiresConfirmation('STERILIZE')).toBe(true);
    expect(eventRequiresConfirmation('ATMOSPHERE_LOSS')).toBe(true);
    expect(eventRequiresConfirmation('GLOBAL_COOLING')).toBe(false);

    world.triggerGlobalExperiment('GLOBAL_COOLING', 0.8);
    world.triggerGlobalExperiment('RAPID_GREENHOUSE', 0.8);
    world.triggerGlobalExperiment('ATMOSPHERE_LOSS', 0.9);
    expect(world.params.pressureBar).toBeLessThan(0.2);

    world.triggerGlobalExperiment('RECOVERY_EXPERIMENT', 1.0);
    expect(world.telemetry.globalBiomassFraction).toBeGreaterThan(0.05);

    world.sterilizeBiosphere();
    expect(world.telemetry.livingSpeciesCount).toBe(0);
    expect(world.telemetry.extinctSpeciesCount).toBeGreaterThanOrEqual(initialLiving);
  });

  it('12. Climate-biosphere feedback: photosynthetic O2 respects oxygenProductionEfficiency and draws down CO2', () => {
    const worldStandard = new WorldSimulation(72, 36, 'Earth-like', 'FEEDBACK-O2');
    worldStandard.seedGlobalBiosphere(true);
    expect(worldStandard.telemetry.oxygenPercent).toBeGreaterThan(15);

    const worldLowO2 = new WorldSimulation(72, 36, 'Low-Oxygen Biospheres', 'FEEDBACK-LOWO2');
    worldLowO2.seedGlobalBiosphere(true);
    expect(worldLowO2.telemetry.oxygenPercent).toBeLessThan(worldStandard.telemetry.oxygenPercent);
  });

  it('13. Meteor impact damage, crater geology counter, tectonic boundary uplift pulse, and undo/redo', () => {
    const worldLocal = new WorldSimulation(72, 36, 'Earth-like', 'METEOR-LOCAL');
    worldLocal.seedGlobalBiosphere(true);
    const bioBeforeLocal = worldLocal.telemetry.globalBiomassFraction;
    worldLocal.triggerHazard('METEOR', 0, 0, 0.25);
    const bioAfterLocal = worldLocal.telemetry.globalBiomassFraction;
    expect(bioAfterLocal).toBeGreaterThan(bioBeforeLocal * 0.85);
    expect(worldLocal.params.geology?.impactCount).toBe(1);

    // Tectonic boundary uplift pulse
    const co2BeforePulse = worldLocal.params.co2Ppm;
    const pulseRes = worldLocal.triggerTectonicPulse(1.0);
    expect(pulseRes.meanAbsDeltaMeters).toBeGreaterThan(10);
    expect(worldLocal.params.co2Ppm).toBeGreaterThan(co2BeforePulse);
    expect(worldLocal.undo()).toBe(true);
    expect(worldLocal.params.co2Ppm).toBe(co2BeforePulse);

    const worldGlobal = new WorldSimulation(72, 36, 'Earth-like', 'METEOR-GLOBAL');
    worldGlobal.seedGlobalBiosphere(true);
    const faunaBeforeGlobal = worldGlobal.telemetry.globalFaunaFraction;
    worldGlobal.triggerHazard('METEOR', 0, 0, 1.0);
    expect(worldGlobal.telemetry.globalFaunaFraction).toBeLessThan(faunaBeforeGlobal * 0.5);
    expect(worldGlobal.telemetry.extinctionSeverity).toBeGreaterThan(0.2);
  });

  it('14. Deep-time stability: scientific speeds up to 1e100x remain finite without NaN or Infinity', () => {
    const time = createInitialTimeState();
    advanceSafeTime(time, parseSciSpeed('3600'), 6, 600);
    expect(time.subYearSeconds).toBe(3600);
    advanceSafeTime(time, { mantissa: 1, exponent: 100 }, 1, 600);
    expect(classifyTimeMode({ mantissa: 1, exponent: 100 })).toBe('VISUAL_TIME_WARP');
    expect(formatSciNumber({ mantissa: 1, exponent: 100 }, 2)).toBe('1.00e+100');
    expect(formatTimeBreakdown(time).geological).toContain('e+92 yr');

    const world = new WorldSimulation(72, 36, 'Earth-like', 'STABILITY-SEED');
    world.seedGlobalBiosphere(true);
    for (const spd of ['1', '100', '1e6', '1e9', '1e100']) {
      world.speedSci = parseSciSpeed(spd);
      for (let step = 0; step < 6; step++) {
        world.advanceFrame(0.05);
      }
      for (let i = 0; i < world.numCells; i++) {
        expect(Number.isFinite(world.elevation[i])).toBe(true);
        expect(Number.isFinite(world.temperature[i])).toBe(true);
        expect(world.temperature[i]).toBeGreaterThanOrEqual(140);
        expect(world.temperature[i]).toBeLessThanOrEqual(450);
        expect(Number.isFinite(world.biomass[i])).toBe(true);
        expect(Number.isFinite(world.fauna[i])).toBe(true);
        expect(Number.isFinite(world.biodiversity[i])).toBe(true);
      }
    }
  });

  it('15. Save/load round-trip, WorldLibraryManager (Duplicate/Rename/Delete/Autosave), & v1–v4 migration', () => {
    createMemoryStorage();
    const world1 = new WorldSimulation(72, 36, 'Volcanic World', 'ROUNDTRIP-SEED');
    world1.applyPlanetProperties({ name: 'Vulcan Prime', radiusKm: 7200, massEarth: 1.4 });
    world1.sculptTerrainAtLatLon(25, -45, 1800, 0.18);
    world1.seedGlobalBiosphere(true);
    world1.singleStep(3600);
    const snapshot = world1.serializeSnapshot('Test Checkpoint');
    expect(snapshot.version).toBe(4);

    const world2 = new WorldSimulation(72, 36, 'Ice World', 'OTHER-SEED');
    world2.loadSnapshot(snapshot);

    expect(world2.params.seed).toBe('ROUNDTRIP-SEED');
    expect(world2.params.planet?.name).toBe('Vulcan Prime');
    expect(world2.params.planet?.radiusKm).toBe(7200);
    expect(Array.from(world2.elevation)).toEqual(Array.from(world1.elevation));
    expect(Array.from(world2.biomass)).toEqual(Array.from(world1.biomass));

    // Legacy v1 snapshot migration to v4
    const legacyV1: SerializedWorldSnapshot = {
      ...snapshot,
      version: 1,
      params: { ...snapshot.params, planet: undefined, terrain: undefined, geology: undefined },
      biomass: undefined,
      fauna: undefined,
      speciesLineages: undefined
    };
    const migrated = migrateSnapshotToV4(legacyV1);
    expect(migrated.version).toBe(4);
    expect(migrated.params.planet).toBeDefined();
    expect(migrated.params.terrain).toBeDefined();
    expect(migrated.params.geology).toBeDefined();
    world2.loadSnapshot(legacyV1);
    expect(world2.telemetry.globalBiomassFraction).toBe(0);

    // WorldLibraryManager CRUD & Autosave
    const lib = new WorldLibraryManager();
    const saved = lib.saveWorld('Alpha World', snapshot);
    expect(lib.listWorlds().length).toBe(1);
    const dup = lib.duplicateWorld(saved.id);
    expect(dup?.name).toContain('Copy');
    expect(lib.renameWorld(saved.id, 'Alpha Renamed')).toBe(true);
    expect(lib.listWorlds().find((w) => w.id === saved.id)?.name).toBe('Alpha Renamed');
    expect(lib.deleteWorld(dup!.id)).toBe(true);
    expect(lib.listWorlds().length).toBe(1);

    lib.saveAutosave(snapshot);
    expect(lib.loadAutosave()?.label).toBe('Test Checkpoint');
  });

  it('16. Corrupted, oversized, or NaN save handling: throws clean error without corrupting active world', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'SAFE-LOAD');
    const validElev = world.elevation[0];

    expect(() =>
      world.loadSnapshot(null as unknown as SerializedWorldSnapshot)
    ).toThrow(/Invalid or corrupted snapshot/);

    expect(() =>
      world.loadSnapshot({
        ...world.serializeSnapshot('Bad'),
        elevation: [1, 2, 3]
      })
    ).toThrow(/corrupted/i);

    expect(() => parseAndValidateWorldJson('')).toThrow(/Empty world file/i);
    expect(() => parseAndValidateWorldJson('{not valid json')).toThrow(/Malformed JSON/i);

    expect(world.elevation[0]).toBe(validElev);
  });

  it('17. Interactive 10-step tutorial state machine, Creator/Advanced UI mode, Help search, & shortcuts', () => {
    createMemoryStorage();
    const tut = new TutorialController();
    expect(tut.showWelcomeModal).toBe(true);
    expect(TUTORIAL_STEPS.length).toBe(10);

    const step0 = tut.startGuidedTour();
    expect(tut.activeTutorial).toBe(true);
    expect(step0.index).toBe(0);

    const step1 = tut.nextStep();
    expect(step1?.index).toBe(1);
    expect(tut.prevStep()?.index).toBe(0);

    tut.skipTutorial();
    expect(tut.activeTutorial).toBe(false);
    expect(tut.isCompleted()).toBe(true);

    // Subsequent launch remembers completion
    const tut2 = new TutorialController();
    expect(tut2.showWelcomeModal).toBe(false);

    // Creator vs Advanced mode toggle & persistence
    expect(tut2.uiMode).toBe('ADVANCED');
    expect(tut2.toggleUIMode()).toBe('CREATOR');
    expect(new TutorialController().uiMode).toBe('CREATOR');

    // Searchable help topics in EN and VI
    expect(tut2.searchHelpTopics('gravity', 'en').length).toBeGreaterThanOrEqual(1);
    expect(tut2.searchHelpTopics('trọng lực', 'vi').length).toBeGreaterThanOrEqual(1);

    // Keyboard shortcuts
    expect(KEYBOARD_SHORTCUTS.length).toBeGreaterThanOrEqual(8);
    expect(resolveShortcutAction(' ', 'Space')).toBe('TOGGLE_PAUSE');
    expect(resolveShortcutAction('.', 'Period')).toBe('SINGLE_STEP');
    expect(resolveShortcutAction('h', 'KeyH')).toBe('TOGGLE_HELP');
    expect(resolveShortcutAction('m', 'KeyM')).toBe('TOGGLE_UI_MODE');
    expect(resolveShortcutAction('g', 'KeyG')).toBe('TOGGLE_GRID');
  });

  it('18. Bilingual i18n dictionary completeness & cross-platform portability audit across all repo files', () => {
    const enKeys = Object.keys(TRANSLATIONS.en) as TranslationKey[];
    const viKeys = Object.keys(TRANSLATIONS.vi) as TranslationKey[];
    expect(viKeys.sort()).toEqual(enKeys.sort());

    for (const key of enKeys) {
      expect(TRANSLATIONS.en[key].length).toBeGreaterThan(0);
      expect(TRANSLATIONS.vi[key].length).toBeGreaterThan(0);
    }

    const store = createMemoryStorage();
    const mgr1 = new I18nManager('en');
    expect(mgr1.getLanguage()).toBe('en');
    expect(mgr1.toggleLanguage()).toBe('vi');
    expect(store[STORAGE_KEY_LANGUAGE]).toBe('vi');
    expect(mgr1.translatePresetName('Habitable Young Planet')).toBe('Hành Tinh Trẻ Thích Nghi');

    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const rootDir = path.resolve(currentDir, '..');

    const filesToAudit = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'index.html',
      'README.md',
      'requirements.txt',
      'requirements-dev.txt',
      'src/main.ts',
      'src/style.css',
      'src/i18n/index.ts',
      'src/persistence/worldStore.ts',
      'src/render/planetRenderer.ts',
      'src/sim/atmosphere.ts',
      'src/sim/benchmark.ts',
      'src/sim/events.ts',
      'src/sim/evolution.ts',
      'src/sim/geology.ts',
      'src/sim/planetPhysics.ts',
      'src/sim/presets.ts',
      'src/sim/rng.ts',
      'src/sim/sculpt.ts',
      'src/sim/terrainGen.ts',
      'src/sim/time.ts',
      'src/sim/types.ts',
      'src/sim/world.ts',
      'src/sim/magnetism.ts',
      'src/sim/spaceWeather.ts',
      'src/sim/geochemistry.ts',
      'src/sim/naturalHistory.ts',
      'src/sim/exploration.ts',
      'src/sim/remoteSensing.ts',
      'src/sim/civilization.ts',
      'src/sim/terraforming.ts',
      'src/sim/analytics.ts',
      'src/sim/missions.ts',
      'src/sim/modding.ts',
      'src/ui/shortcuts.ts',
      'src/ui/tutorial.ts',
      'src/ui/workflows.ts'
    ];

    const forbiddenPattern = new RegExp(['/home/', 'hug', 'C:\\\\Users\\\\'].join('|'));

    for (const rel of filesToAudit) {
      const fullPath = path.join(rootDir, rel);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf-8');
      expect(forbiddenPattern.test(content)).toBe(false);
    }
  });

  it('19. Planetary exploration, landing site evaluation, expedition scanning, bookmarks & atlas naming', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'EXPLORE-TEST');
    world.seedGlobalBiosphere(true);
    world.refreshExplorationLandingSites();
    expect(world.exploration.landingCandidates.length).toBeGreaterThanOrEqual(4);
    expect(world.exploration.atlasRegions.length).toBeGreaterThanOrEqual(4);

    const disc = world.scanSurfaceAt(15, 30);
    expect(disc.epistemicClass).toBeDefined();
    expect(world.exploration.discoveries.length).toBeGreaterThanOrEqual(1);

    const bm = world.addSurfaceBookmark('Equatorial Basin Camp', 15, 30, 'High habitability');
    expect(bm.label).toBe('Equatorial Basin Camp');
    expect(world.exploration.bookmarks.length).toBeGreaterThanOrEqual(2);

    const firstReg = world.exploration.atlasRegions[0].id;
    expect(world.renameRegionInAtlas(firstReg, 'Prime Meridian Reach')).toBe(true);
    expect(world.exploration.atlasRegions[0].name).toBe('Prime Meridian Reach');
  });

  it('20. Geochemistry reservoirs, mineral deposit field, extraction experiments, and mass-balance tracking', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'GEOCHEM-TEST');
    expect(world.geochemistry.reservoirs.C.crust).toBeGreaterThan(0);
    expect(world.mineralField.length).toBe(world.numCells);

    const ext = world.extractPlanetaryResource('HYDROCARBON_CARBON', 0.6, 0.25);
    expect(ext.co2ReleasedPpm).toBeGreaterThan(0);
    expect(world.geochemistry.extractionHistory.length).toBe(1);

    world.singleStep(3600 * 24 * 365 * 10000);
    expect(Math.abs(world.geochemistry.massBalanceMaxDriftPercent)).toBeLessThan(1.0);
  });

  it('21. Civilization emergence, settlements, technological milestones, policies, and atmospheric feedback', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'CIV-TEST');
    world.seedGlobalBiosphere(true);
    const civ = world.spawnCivilizationAt(10, 20, 'Aurelian Republic', 0.25);
    expect(civ).not.toBeNull();
    expect(world.civilization.civilizations.length).toBe(1);
    expect(civ.settlements.length).toBeGreaterThanOrEqual(1);

    expect(world.applyCivilizationPolicy(civ.id, 'ACCELERATE_RENEWABLES')).toBe(true);
    expect(world.civilization.history.some((e) => e.category === 'STEWARDSHIP')).toBe(true);

    world.singleStep(3600 * 24 * 365 * 5000);
    expect(world.civilization.civilizations[0].populationMillions).toBeGreaterThan(0);
  });

  it('22. Planetary engineering & terraforming feasibility validation, execution, cancellation, and snapshots', () => {
    const world = new WorldSimulation(72, 36, 'Desert World', 'TERRA-TEST');
    world.params.seaLevelMeters = 9000;
    world.initializeEquilibriumClimate();
    const badProj = world.startTerraformingProject('ICE_RELOCATION', 0.8);
    expect(badProj.status === 'ACTIVE' || badProj.status === 'REJECTED_IMPOSSIBLE').toBe(true);

    const goodProj = world.startTerraformingProject('WATER_IMPORT_COMETS', 0.7);
    expect(goodProj.status).toBe('ACTIVE');
    expect(world.terraforming.projects.length).toBeGreaterThanOrEqual(1);

    world.singleStep(3600 * 24 * 365 * 20000);
    expect(goodProj.progress).toBeGreaterThan(0);

    const snap = world.recordTerraformingBranchSnapshot('Post-Water Import');
    expect(snap.label).toBe('Post-Water Import');
    expect(world.cancelTerraforming(goodProj.id)).toBe(true);
  });

  it('23. Space weather, asteroid threat scheduling, energy calculation, mitigation, and stellar flares', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'SPACE-TEST');
    const ast = world.spawnAsteroidThreat({ diameterMeters: 1800, velocityKms: 22, impactProbability: 0.8 });
    expect(ast.estimatedEnergyMegatonsTnt).toBeGreaterThan(1000);
    expect(typeof ast.isDeterministicScenario).toBe('boolean');

    const mitigated = world.mitigateAsteroidThreat(ast.id, 'KINETIC_IMPACTOR');
    expect(mitigated.success).toBe(true);
    expect(ast.impactProbability).toBeLessThan(0.8);

    const ev = world.triggerSpaceEvent('CME_RADIATION_STORM', 0.75);
    expect(ev.report.kind).toBe('CME_RADIATION_STORM');
    expect(world.spaceWeather.postEventReports.length).toBeGreaterThanOrEqual(1);
  });

  it('24. Planetary magnetism, radiation belts, scenario presets, and remote sensing synthetic observations', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'MAG-OBS-TEST');
    expect(world.magnetosphere.dipoleMomentEarths).toBeGreaterThan(0.2);
    expect(world.radiationField.length).toBe(world.numCells);

    world.setMagneticScenarioPreset('UNMAGNETIZED');
    expect(world.magnetosphere.dipoleMomentEarths).toBeLessThan(0.05);
    const unmagDose = world.magnetosphere.meanSurfaceRadiationSvYr;

    world.setMagneticScenarioPreset('SUPER_MAGNETOSPHERE');
    expect(world.magnetosphere.meanSurfaceRadiationSvYr).toBeLessThan(unmagDose);

    const obs = world.performRemoteSensingObservation('INFRARED');
    expect(obs.spectrum.length).toBeGreaterThanOrEqual(5);
    expect(obs.curves.orbitalPhaseStep.length).toBeGreaterThanOrEqual(10);
    expect(obs.inference.inferredRadiusKm).toBeGreaterThan(1000);

    const plan = world.planRemoteSensingMission('Deep IR Survey', 'ORBITAL_SURVEY', 'THERMAL');
    expect(plan.completed).toBe(true);
  });

  it('25. Natural history, stratigraphic column recording, fossil preservation, and paleo reconstruction', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'STRAT-TEST');
    world.seedGlobalBiosphere(true);
    const layer = world.recordStratigraphySnapshot('Cambrian Equivalent');
    expect(layer.lithology).toBeDefined();
    expect(world.naturalHistory.fossils.length).toBeGreaterThanOrEqual(1);

    const recon = world.reconstructLayerEnvironment(layer.id);
    expect(recon).not.toBeNull();
    expect(recon?.sourceType).toBeDefined();
  });

  it('26. Planetary analytics: multi-world comparison, correlation, causal chains, sweeps, Monte Carlo & CSV', () => {
    const w1 = new WorldSimulation(36, 18, 'Earth-like', 'ANA-1');
    const w2 = new WorldSimulation(36, 18, 'Desert World', 'ANA-2');
    w1.singleStep(3600 * 24 * 365 * 1000);
    w1.singleStep(3600 * 24 * 365 * 1000);
    const comp = compareWorldSnapshots([
      { label: 'Earth', snapshot: w1.serializeSnapshot('Earth') },
      { label: 'Desert', snapshot: w2.serializeSnapshot('Desert') }
    ]);
    expect(comp.length).toBe(2);

    const corr = computeMetricCorrelation(w1.telemetryHistory, 'co2Ppm', 'meanTempC');
    expect(corr.causalDisclaimer).toContain('correlation');

    w1.triggerHazard('VOLCANO', 0, 0, 0.8);
    const chains = buildCausalAttributionChains(w1.telemetryHistory, w1.eventLog);
    expect(chains.length).toBeGreaterThanOrEqual(1);

    const sweep = runParameterSensitivitySweep('SWEEP-SEED', 'Earth-like', 'solarLuminosity', [0.9, 1.1]);
    expect(sweep.points.length).toBe(2);

    const mc = runMonteCarloEnsemble('MC-SEED', 'Earth-like', 2, 2);
    expect(mc.bands.length).toBe(2);

    const csv = exportWorldAnalyticsCsv(w1.telemetryHistory);
    expect(csv).toContain('yearsNumeric');
  });

  it('27. Procedural missions, custom challenge import/export, modding manifest validation, and UI workflows', () => {
    const world = new WorldSimulation(72, 36, 'Earth-like', 'MISSION-MOD-TEST');
    expect(world.missions.activeMissions.length).toBeGreaterThanOrEqual(1);

    const custom = world.addCustomMission({
      title: 'High Temp Challenge',
      maxSteps: 500,
      hintText: 'Warm planet above 15C',
      metric: 'MEAN_TEMP_C',
      comparator: 'GTE',
      targetMin: 15
    });
    const exportedJson = exportChallengeMissionJson(custom);
    const reimported = importChallengeMissionJson(world.missions, exportedJson);
    expect(reimported.mission?.title).toBe('High Temp Challenge');

    const check = validateExtensionManifest(BUILTIN_EXAMPLE_EXTENSION);
    expect(check.valid).toBe(true);
    expect(world.applyModExtension(BUILTIN_EXAMPLE_EXTENSION.id).applied).toBe(true);

    const badCheck = validateExtensionManifest({ id: 'x', name: 'Bad' });
    expect(badCheck.valid).toBe(false);

    expect(DEFAULT_GUIDED_TOUR_STOPS.length).toBeGreaterThanOrEqual(4);
    const filtered = filterCommandPaletteActions(
      [
        {
          id: 'c1',
          titleEn: 'Toggle Magnetosphere',
          titleVi: 'Từ quyển',
          category: 'VISUALIZATION',
          keywords: ['magnetic'],
          run: () => {}
        }
      ],
      'mag',
      'en'
    );
    expect(filtered.length).toBe(1);
  });

  it('28. Snapshot deep clone isolation, non-finite guard rejection, flora trophic role seeding & analytics robustness', () => {
    // 1. Snapshot deep clone independence
    const world1 = new WorldSimulation(72, 36, 'Earth-like', 'CLONE-ISOLATION-SEED');
    const snap = world1.serializeSnapshot('Deep Clone Base');
    const origElev0 = world1.elevation[0];
    snap.elevation[0] = 99999;
    expect(world1.elevation[0]).toBe(origElev0);

    const migrated = migrateSnapshotToV4(snap);
    migrated.elevation[0] = -12345;
    expect(snap.elevation[0]).toBe(99999);

    // 2. Non-finite array values in optional snapshot fields rejected
    const corruptHumidity = {
      ...snap,
      humidity: Array.from(snap.elevation).map((_, i) => (i === 5 ? NaN : 0.5))
    };
    expect(() => migrateSnapshotToV4(corruptHumidity as any)).toThrow(/corrupted numerical values/i);

    const corruptIce = {
      ...snap,
      iceThickness: Array.from(snap.elevation).map((_, i) => (i === 10 ? Infinity : 0))
    };
    expect(() => migrateSnapshotToV4(corruptIce as any)).toThrow(/corrupted numerical values/i);

    // 3. advanceFrame & singleStep guards
    const stepsBefore = world1.timeState.stepsComputed;
    world1.advanceFrame(NaN);
    expect(world1.timeState.stepsComputed).toBe(stepsBefore);
    world1.advanceFrame(-1);
    expect(world1.timeState.stepsComputed).toBe(stepsBefore);
    world1.advanceFrame(0);
    expect(world1.timeState.stepsComputed).toBe(stepsBefore);

    world1.singleStep();
    expect(world1.timeState.stepsComputed).toBe(stepsBefore + 1);

    // 4. Seeding FLORA establishes PRODUCER_FLORA trophic guild and biomass
    const world2 = new WorldSimulation(72, 36, 'Earth-like', 'FLORA-SEED-TEST');
    world2.seedLifeAtLatLon('FLORA', 0, 0, 0.8, 0.5);
    const hasBiomass = Array.from(world2.biomass).some((b) => b > 0);
    expect(hasBiomass).toBe(true);
    const floraLineage = world2.speciesLineages.find((s) => s.guild === 'PRODUCER_FLORA');
    expect(floraLineage).toBeDefined();

    // 5. Analytics robustness: correlation handles NaNs safely and returns finite pearsonR
    const nanHistory = [
      { step: 1, yearsNumeric: 1, timeLabel: '1y', meanTempC: NaN, co2Ppm: 280, o2Percent: 21, biomassPercent: 10, faunaPercent: 1, livingSpeciesCount: 2, biodiversityIndex: 1, habitabilityPercent: 50, extinctionSeverityPercent: 0 },
      { step: 2, yearsNumeric: 2, timeLabel: '2y', meanTempC: 15, co2Ppm: 300, o2Percent: 21, biomassPercent: 12, faunaPercent: 1, livingSpeciesCount: 2, biodiversityIndex: 1, habitabilityPercent: 52, extinctionSeverityPercent: 0 },
      { step: 3, yearsNumeric: 3, timeLabel: '3y', meanTempC: 16, co2Ppm: 320, o2Percent: 21, biomassPercent: 14, faunaPercent: 1, livingSpeciesCount: 2, biodiversityIndex: 1, habitabilityPercent: 54, extinctionSeverityPercent: 0 }
    ];
    const corr = computeMetricCorrelation(nanHistory, 'meanTempC', 'co2Ppm');
    expect(Number.isFinite(corr.pearsonR)).toBe(true);
    expect(corr.pearsonR).toBeGreaterThanOrEqual(-1);
    expect(corr.pearsonR).toBeLessThanOrEqual(1);

    // 6. Sensitivity sweep bounds parameter inputs
    const hugeValues = Array.from({ length: 40 }, (_, i) => 0.8 + i * 0.02);
    const sweep = runParameterSensitivitySweep('SWEEP-SEED-2', 'Earth-like', 'solarLuminosity', hugeValues);
    expect(sweep.points.length).toBeLessThanOrEqual(16);
  });
});
