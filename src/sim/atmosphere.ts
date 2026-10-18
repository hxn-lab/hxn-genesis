/**
 * Simplified atmospheric composition model.
 *
 * Tracked gases: O₂ (%), CO₂ (ppm), Ar (%), with N₂ as the only filler gas so
 * editing one gas never silently changes another tracked gas. Water vapour is
 * not a free parameter — it is the column humidity computed by the climate model.
 *
 * Coupling to climate: total surface pressure adds a crude pressure-broadening
 * term to the greenhouse forcing (ΔF_p = 7·ln(P / 1 bar) W/m²). This is NOT a
 * line-by-line radiative transfer model.
 */

export type TrackedGas = 'O2' | 'CO2' | 'AR';

export interface AtmosphereComposition {
  pressureBar: number;
  o2Percent: number;
  co2Ppm: number;
  argonPercent: number;
}

export const ATMOSPHERE_RANGES = {
  pressureBar: { min: 0.006, max: 90 },
  o2Percent: { min: 0, max: 35 },
  co2Ppm: { min: 50, max: 10000 },
  argonPercent: { min: 0, max: 10 }
} as const;

export function nitrogenPercent(c: AtmosphereComposition): number {
  return Math.max(0, 100 - c.o2Percent - c.co2Ppm / 10000 - c.argonPercent);
}

export interface AtmosphereValidation {
  valid: boolean;
  errors: Array<'PRESSURE_RANGE' | 'O2_RANGE' | 'CO2_RANGE' | 'AR_RANGE' | 'SUM_EXCEEDS_100' | 'NOT_FINITE'>;
}

export function validateAtmosphere(c: AtmosphereComposition): AtmosphereValidation {
  const errors: AtmosphereValidation['errors'] = [];
  const vals = [c.pressureBar, c.o2Percent, c.co2Ppm, c.argonPercent];
  if (vals.some((v) => !Number.isFinite(v))) {
    return { valid: false, errors: ['NOT_FINITE'] };
  }
  const r = ATMOSPHERE_RANGES;
  if (c.pressureBar < r.pressureBar.min || c.pressureBar > r.pressureBar.max) errors.push('PRESSURE_RANGE');
  if (c.o2Percent < r.o2Percent.min || c.o2Percent > r.o2Percent.max) errors.push('O2_RANGE');
  if (c.co2Ppm < r.co2Ppm.min || c.co2Ppm > r.co2Ppm.max) errors.push('CO2_RANGE');
  if (c.argonPercent < r.argonPercent.min || c.argonPercent > r.argonPercent.max) errors.push('AR_RANGE');
  if (c.o2Percent + c.co2Ppm / 10000 + c.argonPercent > 100 + 1e-9) errors.push('SUM_EXCEEDS_100');
  return { valid: errors.length === 0, errors };
}

/**
 * Sets one gas, clamping it to its range and to the room left by the other tracked
 * gases. Other tracked gases are never modified; N₂ absorbs the difference.
 */
export function setGas(c: AtmosphereComposition, gas: TrackedGas, value: number): AtmosphereComposition {
  const next = { ...c };
  const r = ATMOSPHERE_RANGES;
  const v = Number.isFinite(value) ? value : 0;
  if (gas === 'O2') {
    const room = 100 - c.co2Ppm / 10000 - c.argonPercent;
    next.o2Percent = Math.max(r.o2Percent.min, Math.min(r.o2Percent.max, room, v));
  } else if (gas === 'CO2') {
    const roomPpm = (100 - c.o2Percent - c.argonPercent) * 10000;
    next.co2Ppm = Math.max(r.co2Ppm.min, Math.min(r.co2Ppm.max, roomPpm, v));
  } else {
    const room = 100 - c.o2Percent - c.co2Ppm / 10000;
    next.argonPercent = Math.max(r.argonPercent.min, Math.min(r.argonPercent.max, room, v));
  }
  return next;
}

export function clampPressure(p: number): number {
  if (!Number.isFinite(p)) return 1;
  return Math.max(ATMOSPHERE_RANGES.pressureBar.min, Math.min(ATMOSPHERE_RANGES.pressureBar.max, p));
}

/** Greenhouse forcing (W/m²) from CO₂ (IPCC logarithmic) plus the crude pressure term. */
export function greenhouseForcingWm2(co2Ppm: number, pressureBar = 1): number {
  const co2 = 5.35 * Math.log(Math.max(10, co2Ppm) / 280.0);
  const pressure = 7.0 * Math.log(clampPressure(pressureBar));
  return co2 + pressure;
}
