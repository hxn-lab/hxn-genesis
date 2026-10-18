/**
 * HXN GENESIS — Population-Based Evolutionary & Ecological Engine
 *
 * Models species lineages with heritable quantitative traits, directional & stabilizing
 * environmental selection, constrained mutation, allopatric/ecological speciation,
 * trophic interactions (microbial chemoautotrophs, photosynthetic producers, herbivore
 * grazers, and apex predators), biodiversity indices (Shannon-Wiener H'), and extinction records.
 */

import { SeededRNG } from './rng';
import {
  BiomeClassification,
  SimParameters,
  SpeciesLineage,
  SpeciesTraits,
  TrophicGuild
} from './types';

const GENUS_PREFIXES: Record<TrophicGuild, string[]> = {
  MICROBE_CHEMO: ['Thermococcus', 'Pyrolobus', 'Methanopyrus', 'Aquifex', 'Halorubrum', 'Sulfolobus'],
  PRODUCER_FLORA: ['Cyanophora', 'Chloronema', 'Lepidodendron', 'Archaeopteris', 'Glossopteris', 'Pachypteris', 'Silvafolia'],
  HERBIVORE_GRAZER: ['Trilobitomorpha', 'Dickinsonia', 'Edaphosaurus', 'Lystrosaurus', 'Iguanacolossus', 'Pelagocaris'],
  APEX_PREDATOR: ['Anomalocaris', 'Dunkleosteus', 'Dimetrodon', 'Inostrancevia', 'Thalassodraco', 'Archonectes']
};

const SPECIES_EPITHETS = [
  'primordialis', 'thermophilus', 'pelagicus', 'borealis', 'australis', 'abyssalis',
  'robustus', 'viridis', 'solaris', 'glacialis', 'aridus', 'montanus', 'orientalis', 'imperialis'
];

export class EvolutionEngine {
  private rng: SeededRNG;
  private nextSpeciesSeq = 1;

  constructor(seed: string) {
    this.rng = new SeededRNG(`${seed}-evolution`);
  }

  public reseed(seed: string): void {
    this.rng = new SeededRNG(`${seed}-evolution`);
    this.nextSpeciesSeq = 1;
  }

  private generateBinomialName(guild: TrophicGuild, isMarine: boolean): string {
    const prefixes = GENUS_PREFIXES[guild];
    const genus = prefixes[this.rng.int(0, prefixes.length - 1)];
    const epithet = isMarine
      ? SPECIES_EPITHETS[this.rng.int(0, 5)]
      : SPECIES_EPITHETS[this.rng.int(4, SPECIES_EPITHETS.length - 1)];
    return `${genus} ${epithet}-${this.nextSpeciesSeq}`;
  }

  public deriveInnovations(guild: TrophicGuild, isMarine: boolean, traits: SpeciesTraits): string[] {
    const list: string[] = [];
    if (guild === 'MICROBE_CHEMO') {
      list.push('Chemosynthesis');
      if (traits.stressResistance > 0.7) list.push('Extremophile Heat Shock Proteins');
    }
    if (guild === 'PRODUCER_FLORA') {
      if (traits.oxygenYield > 0.4) list.push('Oxygenic Photosynthesis (PS-II)');
      if (!isMarine) list.push('Cuticle & Vascular Tissue');
      if (traits.waterRequirement < 0.25 && !isMarine) list.push('Xerophytic Water Retention');
    }
    if (guild === 'HERBIVORE_GRAZER' || guild === 'APEX_PREDATOR') {
      list.push('Aerobic Respiration');
      if (traits.dispersalCapability > 0.55) list.push(isMarine ? 'Pelagic Active Swimming' : 'Terrestrial Locomotion');
      if (traits.thermalBreadthK > 26) list.push('Endothermic Homeostasis');
    }
    if (guild === 'APEX_PREDATOR') {
      list.push('Macro-Predatory Dentition');
    }
    return list;
  }

  public createFounderSpecies(
    guild: TrophicGuild,
    isMarine: boolean,
    localTempK: number,
    localHumidity: number,
    originTimeYears: string,
    parentId: string | null = null
  ): SpeciesLineage {
    const id = `SP-${String(this.nextSpeciesSeq++).padStart(3, '0')}`;
    const traits: SpeciesTraits = {
      optimalTempK: Math.max(260, Math.min(325, localTempK + this.rng.range(-2, 2))),
      thermalBreadthK:
        guild === 'MICROBE_CHEMO' ? 28 :
        guild === 'PRODUCER_FLORA' ? 20 :
        guild === 'HERBIVORE_GRAZER' ? 18 : 16,
      waterRequirement: isMarine ? 0.0 : Math.max(0.12, Math.min(0.65, localHumidity * 0.7)),
      reproductionRate:
        guild === 'MICROBE_CHEMO' ? 1.35 :
        guild === 'PRODUCER_FLORA' ? 1.05 :
        guild === 'HERBIVORE_GRAZER' ? 0.78 : 0.48,
      energyEfficiency: this.rng.range(0.75, 1.05),
      dispersalCapability:
        guild === 'MICROBE_CHEMO' ? 0.65 :
        guild === 'PRODUCER_FLORA' ? 0.42 :
        guild === 'HERBIVORE_GRAZER' ? 0.62 : 0.74,
      stressResistance:
        guild === 'MICROBE_CHEMO' ? 0.85 :
        guild === 'PRODUCER_FLORA' ? 0.55 :
        guild === 'HERBIVORE_GRAZER' ? 0.45 : 0.4,
      oxygenYield:
        guild === 'MICROBE_CHEMO' ? 0.15 :
        guild === 'PRODUCER_FLORA' ? 0.95 : 0.0,
      minOxygenRequired:
        guild === 'MICROBE_CHEMO' ? 0.0 :
        guild === 'PRODUCER_FLORA' ? 0.0 :
        guild === 'HERBIVORE_GRAZER' ? 2.2 : 5.5
    };

    const name = this.generateBinomialName(guild, isMarine);
    return {
      id,
      name,
      parentId,
      guild,
      isMarine,
      originTimeYears,
      extinctTimeYears: null,
      isExtinct: false,
      traits,
      populationEstimate: 120,
      peakPopulation: 120,
      occupiedCells: 12,
      dominantBiome: isMarine ? 'MARINE_PHYTOPLANKTON_REEF' : 'TEMPERATE_GRASSLAND',
      geneticDivergence: 0,
      innovations: this.deriveInnovations(guild, isMarine, traits)
    };
  }

  /**
   * Computes species fitness [0, 1] for a given planetary environment.
   */
  public evaluateSpeciesFitness(
    sp: SpeciesLineage,
    meanHabitTempK: number,
    meanMoisture: number,
    oxygenPercent: number,
    oceanFraction: number,
    landFraction: number,
    globalBiomass: number,
    globalFauna: number,
    selectionPressure: number
  ): number {
    const tr = sp.traits;
    // 1. Habitat domain availability
    const domainFrac = sp.isMarine ? oceanFraction : landFraction;
    if (domainFrac < 0.02) return 0;

    // 2. Oxygen requirement gate
    if (oxygenPercent < tr.minOxygenRequired) {
      return 0;
    }

    // 3. Thermal performance curve (Gaussian-like bell curve)
    const tempDelta = Math.abs(meanHabitTempK - tr.optimalTempK);
    const effectiveBreadth = tr.thermalBreadthK / Math.max(0.3, Math.sqrt(selectionPressure));
    const thermalFit = Math.exp(-Math.pow(tempDelta / Math.max(4, effectiveBreadth), 2));

    // 4. Moisture / water suitability on land
    const waterFit = sp.isMarine
      ? 1.0
      : meanMoisture >= tr.waterRequirement
        ? 1.0
        : Math.max(0, meanMoisture / Math.max(0.05, tr.waterRequirement));

    // 5. Trophic food web dependency
    let trophicFit = 1.0;
    if (sp.guild === 'HERBIVORE_GRAZER') {
      trophicFit = Math.min(1.0, globalBiomass / 0.12);
    } else if (sp.guild === 'APEX_PREDATOR') {
      trophicFit = Math.min(1.0, globalFauna / 0.08);
    }

    return Math.max(0, Math.min(1.0, thermalFit * waterFit * trophicFit * tr.energyEfficiency));
  }

  /**
   * Advances all living lineages by `dtYears`, applying directional trait selection toward the
   * current climate, random bounded mutations, population carrying-capacity competition,
   * extinction checks, and adaptive speciation.
   */
  public stepEvolution(
    lineages: SpeciesLineage[],
    params: SimParameters,
    meanMarineTempK: number,
    meanLandTempK: number,
    meanLandHumidity: number,
    oceanFraction: number,
    globalBiomass: number,
    globalFauna: number,
    dtYears: number,
    currentEpochYearsStr: string,
    onEvent: (msg: string) => void
  ): void {
    const living = lineages.filter((s) => !s.isExtinct);
    if (living.length === 0) return;

    const mutRate = params.mutationRate ?? 1.0;
    const selPressure = params.selectionPressure ?? 1.0;
    const reproMult = params.reproductionMultiplier ?? 1.0;
    const extSuscept = params.extinctionSusceptibility ?? 1.0;
    const o2 = params.o2Percent ?? 0.1;
    const landFraction = Math.max(0, 1.0 - oceanFraction);

    // Normalized evolutionary step size in [0.06, 0.38] so evolution is observable in both coarse and deep time
    const evoStep = Math.min(0.38, Math.max(0.06, Math.log10(1 + Math.max(0.5, dtYears * 500)) * 0.08));

    for (const sp of living) {
      const envTempK = sp.isMarine ? meanMarineTempK : meanLandTempK;
      const fitness = this.evaluateSpeciesFitness(
        sp,
        envTempK,
        meanLandHumidity,
        o2,
        oceanFraction,
        landFraction,
        globalBiomass,
        globalFauna,
        selPressure
      );

      // Directional selection + bounded mutation on heritable traits
      if (mutRate > 0 && fitness > 0.01) {
        const adaptSpeed = Math.min(0.5, 0.18 * mutRate * selPressure * evoStep);
        const tempDiff = envTempK - sp.traits.optimalTempK;
        const tempShift = tempDiff * adaptSpeed + this.rng.range(-0.18, 0.18) * mutRate * evoStep;
        sp.traits.optimalTempK = Math.max(250, Math.min(340, sp.traits.optimalTempK + tempShift));

        if (!sp.isMarine) {
          const targetWater = Math.max(0.08, meanLandHumidity * 0.72);
          sp.traits.waterRequirement = Math.max(
            0.05,
            Math.min(0.85, sp.traits.waterRequirement + (targetWater - sp.traits.waterRequirement) * adaptSpeed)
          );
        }

        sp.traits.energyEfficiency = Math.max(
          0.4,
          Math.min(1.45, sp.traits.energyEfficiency + this.rng.range(-0.012, 0.022) * mutRate * evoStep)
        );
        sp.traits.stressResistance = Math.max(
          0.15,
          Math.min(0.98, sp.traits.stressResistance + this.rng.range(-0.008, 0.016) * mutRate * evoStep)
        );

        sp.geneticDivergence += (Math.abs(tempShift) * 0.06 + 0.035 * mutRate) * evoStep;
        sp.innovations = this.deriveInnovations(sp.guild, sp.isMarine, sp.traits);
      }

      // Carrying capacity & population dynamics
      const guildBaseCap =
        sp.guild === 'MICROBE_CHEMO' ? 4500 * globalBiomass :
        sp.guild === 'PRODUCER_FLORA' ? 8500 * globalBiomass :
        sp.guild === 'HERBIVORE_GRAZER' ? 3200 * globalFauna : 950 * globalFauna;

      const carryingCap = Math.max(0, guildBaseCap * fitness * (sp.isMarine ? oceanFraction : landFraction) * 2.2);
      const rGrowth = sp.traits.reproductionRate * reproMult * evoStep;

      if (fitness < 0.05 / Math.max(0.2, extSuscept)) {
        const decay = Math.min(0.85, 0.35 * extSuscept * (1.0 - sp.traits.stressResistance * 0.5));
        sp.populationEstimate = Math.floor(sp.populationEstimate * (1.0 - decay));
      } else {
        const nextPop = sp.populationEstimate + (carryingCap - sp.populationEstimate) * Math.min(0.65, rGrowth);
        sp.populationEstimate = Math.max(0, Math.round(nextPop));
      }

      if (sp.populationEstimate > sp.peakPopulation) {
        sp.peakPopulation = sp.populationEstimate;
      }

      sp.occupiedCells = Math.max(0, Math.round((sp.populationEstimate / 8500) * 1800));

      // Extinction check
      if (sp.populationEstimate < 5 || (globalBiomass < 0.0005 && sp.guild !== 'MICROBE_CHEMO')) {
        sp.populationEstimate = 0;
        sp.occupiedCells = 0;
        sp.isExtinct = true;
        sp.extinctTimeYears = currentEpochYearsStr;
        sp.causeOfExtinction = o2 < sp.traits.minOxygenRequired
          ? 'Hypoxia (Low O₂)'
          : Math.abs(envTempK - sp.traits.optimalTempK) > sp.traits.thermalBreadthK
            ? 'Thermal Climatic Stress'
            : 'Ecological Collapse / Habitat Loss';
        onEvent(`Species extinct: ${sp.name} (${sp.causeOfExtinction})`);
      }
    }

    // Speciation & Adaptive Radiation (bounded to max 24 living species for clean UI & performance)
    const activeLiving = lineages.filter((s) => !s.isExtinct);
    if (activeLiving.length > 0 && activeLiving.length < 24 && mutRate > 0.1) {
      for (const parent of activeLiving) {
        if (parent.geneticDivergence >= 0.22 && parent.populationEstimate > 120) {
          parent.geneticDivergence = 0.05;

          // Determine evolutionary grade transition or adaptive radiation
          let childGuild: TrophicGuild = parent.guild;
          let childMarine = parent.isMarine;

          if (parent.guild === 'MICROBE_CHEMO' && globalBiomass > 0.04) {
            childGuild = 'PRODUCER_FLORA';
          } else if (parent.guild === 'PRODUCER_FLORA' && parent.isMarine && landFraction > 0.12 && meanLandHumidity > 0.25) {
            // Land plant colonization!
            if (this.rng.next() < 0.55) childMarine = false;
          } else if (parent.guild === 'PRODUCER_FLORA' && o2 >= 2.5 && globalBiomass > 0.15) {
            if (this.rng.next() < 0.6) childGuild = 'HERBIVORE_GRAZER';
          } else if (parent.guild === 'HERBIVORE_GRAZER' && o2 >= 6.0 && globalFauna > 0.08) {
            if (this.rng.next() < 0.45) childGuild = 'APEX_PREDATOR';
          }

          const envTemp = childMarine ? meanMarineTempK : meanLandTempK;
          const daughter = this.createFounderSpecies(
            childGuild,
            childMarine,
            envTemp,
            meanLandHumidity,
            currentEpochYearsStr,
            parent.id
          );
          // Inherit parent thermal adaptation with slight divergence
          daughter.traits.optimalTempK = Math.max(
            255,
            Math.min(330, parent.traits.optimalTempK + this.rng.range(-3.5, 3.5))
          );
          daughter.dominantBiome = childMarine
            ? 'MARINE_PHYTOPLANKTON_REEF'
            : envTemp > 293
              ? 'TROPICAL_RAINFOREST'
              : 'TEMPERATE_GRASSLAND';

          lineages.push(daughter);
          onEvent(`Speciation: ${daughter.name} diverged from ${parent.name} (${daughter.guild})`);
          break;
        }
      }
    }
  }

  /**
   * Computes the Shannon-Wiener Diversity Index H' = -\sum p_i \ln(p_i) across living species,
   * scaled by habitat evenness. Returns 0 when fewer than 1 species exists.
   */
  public computeBiodiversityIndex(lineages: SpeciesLineage[]): number {
    const living = lineages.filter((s) => !s.isExtinct && s.populationEstimate > 0);
    if (living.length === 0) return 0;
    if (living.length === 1) return 0.35;

    let totalPop = 0;
    for (const s of living) totalPop += s.populationEstimate;
    if (totalPop <= 0) return 0;

    let shannon = 0;
    for (const s of living) {
      const p = s.populationEstimate / totalPop;
      if (p > 0) {
        shannon -= p * Math.log(p);
      }
    }
    return Number((shannon + Math.min(1.2, living.length * 0.08)).toFixed(3));
  }
}
