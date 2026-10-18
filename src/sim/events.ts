/**
 * Unified God Mode & Environmental Event Toolbox definitions for HXN GENESIS 3.0.
 *
 * Covers both regional hazard strikes (Meteor, Volcano, Flood, Drought, Earthquake,
 * Tsunami, Storm) and global planetary experiments (Global Cooling, Rapid Greenhouse
 * Warming, Atmospheric Loss, Ocean Loss, Planetary Sterilization, Biosphere Bloom,
 * and Recovery Pulse).
 */

export type GlobalExperimentEventType =
  | 'GLOBAL_COOLING'
  | 'RAPID_GREENHOUSE'
  | 'ATMOSPHERE_LOSS'
  | 'OCEAN_LOSS'
  | 'STERILIZE'
  | 'SEED_GLOBAL_LIFE'
  | 'RECOVERY_EXPERIMENT';

export interface EnvironmentalEventDescriptor {
  type: GlobalExperimentEventType;
  requiresConfirmation: boolean;
  isDestructive: boolean;
}

export const GLOBAL_EVENT_CATALOG: Record<GlobalExperimentEventType, EnvironmentalEventDescriptor> = {
  GLOBAL_COOLING: {
    type: 'GLOBAL_COOLING',
    requiresConfirmation: false,
    isDestructive: false
  },
  RAPID_GREENHOUSE: {
    type: 'RAPID_GREENHOUSE',
    requiresConfirmation: false,
    isDestructive: false
  },
  ATMOSPHERE_LOSS: {
    type: 'ATMOSPHERE_LOSS',
    requiresConfirmation: true,
    isDestructive: true
  },
  OCEAN_LOSS: {
    type: 'OCEAN_LOSS',
    requiresConfirmation: true,
    isDestructive: true
  },
  STERILIZE: {
    type: 'STERILIZE',
    requiresConfirmation: true,
    isDestructive: true
  },
  SEED_GLOBAL_LIFE: {
    type: 'SEED_GLOBAL_LIFE',
    requiresConfirmation: false,
    isDestructive: false
  },
  RECOVERY_EXPERIMENT: {
    type: 'RECOVERY_EXPERIMENT',
    requiresConfirmation: false,
    isDestructive: false
  }
};

export function eventRequiresConfirmation(type: GlobalExperimentEventType): boolean {
  return GLOBAL_EVENT_CATALOG[type]?.requiresConfirmation ?? false;
}
