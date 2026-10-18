import { BiomeClassification } from './types';

export interface StratigraphicLayer {
  id: string;
  depthMetersFromTop: number;
  thicknessMeters: number;
  ageYearsLabel: string;
  stepRecorded: number;
  lithology: 'BASALT_ASH' | 'CARBONATE_LIMESTONE' | 'GLACIAL_TILL' | 'SANDSTONE_SHALE' | 'IMPACT_EJECTA_CLAY';
  meanTempCAtDeposition: number;
  co2PpmAtDeposition: number;
  o2PercentAtDeposition: number;
  oceanFractionAtDeposition: number;
  preservedFossilIds: string[];
  eventMarker?: string;
}

export interface FossilSpecimen {
  id: string;
  speciesId: string;
  speciesName: string;
  guild: string;
  layerId: string;
  latDeg: number;
  lonDeg: number;
  biomeAtBurial: BiomeClassification;
  ageYearsLabel: string;
  preservationQuality: number;
  isExtinctionHorizonTaxon: boolean;
}

export interface EnvironmentReconstruction {
  layerId: string;
  ageYearsLabel: string;
  reconstructedTempC: number;
  reconstructedCo2Ppm: number;
  reconstructedO2Percent: number;
  dominantLithology: StratigraphicLayer['lithology'];
  fossilCount: number;
  sourceType: 'STORED_HISTORICAL_STATE' | 'APPROXIMATE_STRATIGRAPHIC_RECONSTRUCTION';
  confidenceRangeTempC: [number, number];
}

export interface NaturalHistoryState {
  layers: StratigraphicLayer[];
  fossils: FossilSpecimen[];
  extinctionEventsCount: number;
  speciationEventsCount: number;
}

export function createDefaultNaturalHistoryState(): NaturalHistoryState {
  return {
    layers: [],
    fossils: [],
    extinctionEventsCount: 0,
    speciationEventsCount: 0
  };
}

export function recordStratigraphicLayer(
  state: NaturalHistoryState,
  opts: {
    step: number;
    ageYearsLabel: string;
    meanTempC: number;
    co2Ppm: number;
    o2Percent: number;
    oceanFraction: number;
    iceFraction: number;
    volcanicActivity: number;
    eventMarker?: string;
    candidateSpecies?: Array<{
      id: string;
      name: string;
      guild: string;
      dominantBiome: BiomeClassification;
      isExtinct: boolean;
    }>;
  }
): StratigraphicLayer {
  let lithology: StratigraphicLayer['lithology'] = 'SANDSTONE_SHALE';
  if (opts.eventMarker && /meteor|bolide|impact/i.test(opts.eventMarker)) {
    lithology = 'IMPACT_EJECTA_CLAY';
  } else if (opts.volcanicActivity > 1.2 || (opts.eventMarker && /volcan|tectonic/i.test(opts.eventMarker))) {
    lithology = 'BASALT_ASH';
  } else if (opts.iceFraction > 0.35) {
    lithology = 'GLACIAL_TILL';
  } else if (opts.oceanFraction > 0.55) {
    lithology = 'CARBONATE_LIMESTONE';
  }

  const thickness = Number((12 + opts.oceanFraction * 25 + opts.volcanicActivity * 8).toFixed(1));
  for (const existing of state.layers) {
    existing.depthMetersFromTop = Number((existing.depthMetersFromTop + thickness).toFixed(1));
  }

  const layerId = `STRAT-${state.layers.length + 1}`;
  const preservedIds: string[] = [];

  if (opts.candidateSpecies && opts.candidateSpecies.length > 0) {
    const sample = opts.candidateSpecies.slice(0, 3);
    sample.forEach((sp, idx) => {
      const fid = `FOSSIL-${state.fossils.length + 1}`;
      preservedIds.push(fid);
      state.fossils.unshift({
        id: fid,
        speciesId: sp.id,
        speciesName: sp.name,
        guild: sp.guild,
        layerId,
        latDeg: (idx - 1) * 18,
        lonDeg: idx * 45 - 30,
        biomeAtBurial: sp.dominantBiome,
        ageYearsLabel: opts.ageYearsLabel,
        preservationQuality: Number(Math.min(0.98, 0.45 + opts.oceanFraction * 0.45).toFixed(2)),
        isExtinctionHorizonTaxon: Boolean(opts.eventMarker && /extinction|steriliz|meteor/i.test(opts.eventMarker))
      });
    });
    if (state.fossils.length > 60) state.fossils.length = 60;
  }

  const layer: StratigraphicLayer = {
    id: layerId,
    depthMetersFromTop: 0,
    thicknessMeters: thickness,
    ageYearsLabel: opts.ageYearsLabel,
    stepRecorded: opts.step,
    lithology,
    meanTempCAtDeposition: Number(opts.meanTempC.toFixed(2)),
    co2PpmAtDeposition: Math.round(opts.co2Ppm),
    o2PercentAtDeposition: Number(opts.o2Percent.toFixed(2)),
    oceanFractionAtDeposition: Number(opts.oceanFraction.toFixed(3)),
    preservedFossilIds: preservedIds,
    eventMarker: opts.eventMarker
  };

  state.layers.unshift(layer);
  if (state.layers.length > 32) state.layers.length = 32;
  return layer;
}

export function reconstructPastEnvironment(
  state: NaturalHistoryState,
  layerId: string,
  useApproximateProxy = false
): EnvironmentReconstruction | null {
  const layer = state.layers.find((l) => l.id === layerId);
  if (!layer) return null;

  if (!useApproximateProxy) {
    return {
      layerId: layer.id,
      ageYearsLabel: layer.ageYearsLabel,
      reconstructedTempC: layer.meanTempCAtDeposition,
      reconstructedCo2Ppm: layer.co2PpmAtDeposition,
      reconstructedO2Percent: layer.o2PercentAtDeposition,
      dominantLithology: layer.lithology,
      fossilCount: layer.preservedFossilIds.length,
      sourceType: 'STORED_HISTORICAL_STATE',
      confidenceRangeTempC: [layer.meanTempCAtDeposition, layer.meanTempCAtDeposition]
    };
  }

  const depthUncert = Math.min(6.5, 0.8 + layer.depthMetersFromTop * 0.008);
  return {
    layerId: layer.id,
    ageYearsLabel: layer.ageYearsLabel,
    reconstructedTempC: Number(layer.meanTempCAtDeposition.toFixed(1)),
    reconstructedCo2Ppm: Math.round(layer.co2PpmAtDeposition / 25) * 25,
    reconstructedO2Percent: Number(layer.o2PercentAtDeposition.toFixed(1)),
    dominantLithology: layer.lithology,
    fossilCount: layer.preservedFossilIds.length,
    sourceType: 'APPROXIMATE_STRATIGRAPHIC_RECONSTRUCTION',
    confidenceRangeTempC: [
      Number((layer.meanTempCAtDeposition - depthUncert).toFixed(1)),
      Number((layer.meanTempCAtDeposition + depthUncert).toFixed(1))
    ]
  };
}
