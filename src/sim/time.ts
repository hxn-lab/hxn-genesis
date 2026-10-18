/**
 * Numerically safe Infinite-Time representation and Time Mode Classification.
 *
 * Ordinary IEEE-754 float64 loses 1-second precision after 2^53 seconds (~2.85e8 years)
 * and overflows around 1.79e308. However, storing cumulative elapsed time as a single float
 * causes catastrophic absorption when adding small delta-t (e.g. 1 second) to large elapsed
 * times (e.g. 1e20 seconds).
 *
 * To solve this cleanly and deterministically across arbitrary scales (1s to 1e100x+):
 * 1. Exact sub-geological accumulation is tracked in `fineSeconds` (float64 up to 1e9 s)
 *    plus `epochYears` (BigInt exact integer years for up to millions/trillions of years)
 *    plus `log10DeepYears` / `DeepDecimal` (mantissa + BigInt exponent in base 10) for ultra-deep
 *    cosmological/infinite timescales (e.g., 1e100x).
 */

export type TimeExecutionMode =
  | 'REALTIME'           // Normal fine physics integration steps (<= 10x)
  | 'FAST_FORWARD'       // Multiple fine physics steps per frame (10x .. 1,000x)
  | 'COARSE_TIME'        // Larger bounded integration steps with CFL/stability clamping (1,000x .. 1e6x)
  | 'ANALYTICAL_ADVANCE' // Asymptotic equilibrium + tectonic/erosion secular decay (1e6x .. 1e12x)
  | 'VISUAL_TIME_WARP';  // Extreme scale (> 1e12x up to 1e100x+): analytical equilibrium + visual warp without fake step claims

export const SECONDS_PER_HOUR = 3600;
export const SECONDS_PER_DAY = 86400;
export const SECONDS_PER_YEAR = 31557600; // Julian year (365.25 days)

/**
 * Arbitrary-exponent decimal number: value = mantissa * 10^exponent
 * Mantissa is normalized to [1, 10) when non-zero, or 0 when zero.
 */
export interface SciNumber {
  mantissa: number;
  exponent: number;
}

export function normalizeSci(mantissa: number, exponent: number): SciNumber {
  if (mantissa === 0 || !Number.isFinite(mantissa)) {
    return { mantissa: 0, exponent: 0 };
  }
  const sign = mantissa < 0 ? -1 : 1;
  let m = Math.abs(mantissa);
  let e = Math.trunc(exponent);
  const log = Math.floor(Math.log10(m));
  m = m / Math.pow(10, log);
  e += log;
  if (m >= 10) {
    m /= 10;
    e += 1;
  } else if (m < 1 && m > 0) {
    m *= 10;
    e -= 1;
  }
  return { mantissa: sign * m, exponent: e };
}

export function parseSciSpeed(input: string | number): SciNumber {
  if (typeof input === 'number') {
    if (input <= 0 || !Number.isFinite(input)) return { mantissa: 0, exponent: 0 };
    return normalizeSci(input, 0);
  }
  const trimmed = input.trim().toLowerCase().replace(/x$/, '');
  const match = trimmed.match(/^([+-]?\d+(?:\.\d+)?)\s*(?:e\s*([+-]?\d+))?$/);
  if (!match) {
    throw new Error(`Invalid scientific speed format: "${input}"`);
  }
  const m = parseFloat(match[1]);
  const e = match[2] ? parseInt(match[2], 10) : 0;
  if (m < 0 || Number.isNaN(m) || Number.isNaN(e)) {
    throw new Error(`Speed must be non-negative: "${input}"`);
  }
  return normalizeSci(m, e);
}

export function addSciNumbers(a: SciNumber, b: SciNumber): SciNumber {
  if (a.mantissa === 0) return { ...b };
  if (b.mantissa === 0) return { ...a };
  const diff = a.exponent - b.exponent;
  if (diff > 15) return { ...a }; // b is below float64 precision relative to a
  if (diff < -15) return { ...b }; // a is below float64 precision relative to b
  const combinedMantissa = a.mantissa + b.mantissa * Math.pow(10, -diff);
  return normalizeSci(combinedMantissa, a.exponent);
}

export function scaleSciNumber(a: SciNumber, factor: number): SciNumber {
  if (a.mantissa === 0 || factor === 0) return { mantissa: 0, exponent: 0 };
  return normalizeSci(a.mantissa * factor, a.exponent);
}

export function sciToNumber(a: SciNumber): number {
  if (a.mantissa === 0) return 0;
  if (a.exponent > 307) return Infinity;
  if (a.exponent < -307) return 0;
  return a.mantissa * Math.pow(10, a.exponent);
}

export function formatSciNumber(a: SciNumber, precision = 3): string {
  if (a.mantissa === 0) return '0';
  if (a.exponent >= -2 && a.exponent <= 5) {
    const val = a.mantissa * Math.pow(10, a.exponent);
    if (Math.abs(val - Math.round(val)) < 1e-6) {
      return Math.round(val).toLocaleString('en-US');
    }
    return val.toFixed(Math.max(0, Math.min(4, precision - a.exponent)));
  }
  return `${a.mantissa.toFixed(precision)}e+${a.exponent}`;
}

export interface SafeSimTimeState {
  /** Sub-year remainder in seconds [0, SECONDS_PER_YEAR) for exact diurnal/seasonal phase */
  subYearSeconds: number;
  /** Exact integer years accumulated in normal/geological regime (stored as string for JSON serialization) */
  exactYears: string;
  /** Ultra-deep time accumulator in years (mantissa * 10^exponent) when scale exceeds 1e12 years */
  deepYears: SciNumber;
  /** Total seconds expressed as SciNumber for universal telemetry */
  totalSecondsSci: SciNumber;
  /** Total simulation steps actually computed on the grid */
  stepsComputed: number;
  /** Equivalent fine-resolution steps bypassed via Coarse/Analytical/Visual modes */
  stepsSkippedSci: SciNumber;
}

export function createInitialTimeState(): SafeSimTimeState {
  return {
    subYearSeconds: 0,
    exactYears: '0',
    deepYears: { mantissa: 0, exponent: 0 },
    totalSecondsSci: { mantissa: 0, exponent: 0 },
    stepsComputed: 0,
    stepsSkippedSci: { mantissa: 0, exponent: 0 }
  };
}

/**
 * Classifies the execution mode cleanly from the requested time multiplier.
 */
export function classifyTimeMode(speed: SciNumber): TimeExecutionMode {
  if (speed.mantissa === 0) return 'REALTIME';
  const exp = speed.exponent + Math.log10(Math.abs(speed.mantissa));
  if (exp <= 1.0001) return 'REALTIME';            // <= 10x
  if (exp <= 3.0001) return 'FAST_FORWARD';        // 10x .. 1,000x
  if (exp <= 6.0001) return 'COARSE_TIME';         // 1,000x .. 1e6x
  if (exp <= 12.0001) return 'ANALYTICAL_ADVANCE'; // 1e6x .. 1e12x
  return 'VISUAL_TIME_WARP';                       // > 1e12x (up to 1e100x+)
}

/**
 * Advances the numerically safe time state by `deltaSecondsSci` without precision collapse.
 */
export function advanceSafeTime(
  state: SafeSimTimeState,
  deltaSecondsSci: SciNumber,
  actualStepsRun: number,
  nominalFineDtSeconds = 600
): void {
  state.stepsComputed += actualStepsRun;
  if (deltaSecondsSci.mantissa <= 0) return;

  state.totalSecondsSci = addSciNumbers(state.totalSecondsSci, deltaSecondsSci);

  // Compute equivalent fine steps that would have occurred at nominalFineDtSeconds
  const equivFineSteps = scaleSciNumber(deltaSecondsSci, 1 / nominalFineDtSeconds);
  const actualSci = normalizeSci(actualStepsRun, 0);
  if (
    equivFineSteps.exponent > actualSci.exponent ||
    (equivFineSteps.exponent === actualSci.exponent && equivFineSteps.mantissa > actualSci.mantissa)
  ) {
    const skipped = addSciNumbers(equivFineSteps, {
      mantissa: -actualSci.mantissa,
      exponent: actualSci.exponent
    });
    if (skipped.mantissa > 0) {
      state.stepsSkippedSci = addSciNumbers(state.stepsSkippedSci, skipped);
    }
  }

  // Update exact subYearSeconds and exactYears if deltaSeconds fits safely within BigInt range (< 1e21 s)
  if (deltaSecondsSci.exponent <= 14) {
    const deltaSec = sciToNumber(deltaSecondsSci);
    const totalSub = state.subYearSeconds + deltaSec;
    const wholeYears = Math.floor(totalSub / SECONDS_PER_YEAR);
    state.subYearSeconds = totalSub - wholeYears * SECONDS_PER_YEAR;
    if (wholeYears > 0) {
      const nextExact = BigInt(state.exactYears) + BigInt(wholeYears);
      state.exactYears = nextExact.toString();
    }
    const deltaYearsSci = scaleSciNumber(deltaSecondsSci, 1 / SECONDS_PER_YEAR);
    state.deepYears = addSciNumbers(state.deepYears, deltaYearsSci);
  } else {
    // Ultra-deep time step (> 1e14 seconds ~ 3.17M years in a single frame)
    const deltaYearsSci = scaleSciNumber(deltaSecondsSci, 1 / SECONDS_PER_YEAR);
    state.deepYears = addSciNumbers(state.deepYears, deltaYearsSci);
    // Advance diurnal/seasonal visual phase deterministically using mantissa fractional part
    const phaseShift = ((deltaSecondsSci.mantissa * 1e7) % 1) * SECONDS_PER_YEAR;
    state.subYearSeconds = (state.subYearSeconds + phaseShift) % SECONDS_PER_YEAR;
  }
}

export interface FormattedTimeBreakdown {
  seconds: string;
  hours: string;
  days: string;
  years: string;
  geological: string;
  diurnalHours: number;
  dayOfYear: number;
}

export function formatTimeBreakdown(state: SafeSimTimeState): FormattedTimeBreakdown {
  const secSci = state.totalSecondsSci;
  const hoursSci = scaleSciNumber(secSci, 1 / SECONDS_PER_HOUR);
  const daysSci = scaleSciNumber(secSci, 1 / SECONDS_PER_DAY);
  const yearsSci = state.deepYears;

  const diurnalSeconds = state.subYearSeconds % SECONDS_PER_DAY;
  const diurnalHours = diurnalSeconds / SECONDS_PER_HOUR;
  const dayOfYear = Math.floor(state.subYearSeconds / SECONDS_PER_DAY) + 1;

  let geological = '0 yr (Present Epoch)';
  const yrExp = yearsSci.exponent;
  const yrVal = sciToNumber(yearsSci);

  if (yearsSci.mantissa === 0 || yrExp < 3) {
    geological = `${yrVal.toFixed(2)} yr (Holocene-scale)`;
  } else if (yrExp < 6) {
    geological = `${(yrVal / 1e3).toFixed(2)} kyr (Glacial-scale)`;
  } else if (yrExp < 9) {
    geological = `${(yrVal / 1e6).toFixed(3)} Myr (Tectonic-scale)`;
  } else if (yrExp < 12) {
    geological = `${(yrVal / 1e9).toFixed(3)} Gyr (Planetary Eon)`;
  } else {
    geological = `${formatSciNumber(yearsSci, 3)} yr (Cosmological Deep Time)`;
  }

  return {
    seconds: `${formatSciNumber(secSci, 3)} s`,
    hours: `${formatSciNumber(hoursSci, 2)} hr`,
    days: `${formatSciNumber(daysSci, 2)} d`,
    years: yearsSci.exponent < 9 ? `${state.exactYears} yr` : `${formatSciNumber(yearsSci, 3)} yr`,
    geological,
    diurnalHours,
    dayOfYear
  };
}
