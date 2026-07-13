import { normalizeSequence } from './pcr';
import type { ThermodynamicResult } from './thermodynamics';
import type { SequenceTopology } from './fusion-model';

export type NormalizedRange = {
  start: number;
  end: number;
  clamped: boolean;
  wrapsOrigin: boolean;
};

export function clampRange(
  length: number,
  topology: SequenceTopology,
  start: number,
  end: number,
): NormalizedRange {
  if (length <= 0) {
    return { start: 1, end: 0, clamped: true, wrapsOrigin: false };
  }

  const safeStart = Number.isFinite(start) ? Math.floor(start) : 1;
  const safeEnd = Number.isFinite(end) ? Math.floor(end) : length;
  const normalizedStart = Math.max(1, Math.min(length, safeStart));
  const normalizedEnd = Math.max(1, Math.min(length, safeEnd));
  const wrapsOrigin =
    topology === 'circular' && normalizedStart > normalizedEnd;

  if (topology === 'circular') {
    return {
      start: normalizedStart,
      end: normalizedEnd,
      clamped: normalizedStart !== safeStart || normalizedEnd !== safeEnd,
      wrapsOrigin,
    };
  }

  return {
    start: Math.min(normalizedStart, normalizedEnd),
    end: Math.max(normalizedStart, normalizedEnd),
    clamped:
      normalizedStart !== safeStart ||
      normalizedEnd !== safeEnd ||
      safeStart > safeEnd,
    wrapsOrigin: false,
  };
}

export function selectRange(
  sequenceInput: string,
  range: NormalizedRange,
): string {
  const sequence = normalizeSequence(sequenceInput);
  if (!sequence.length || range.end <= 0) {
    return '';
  }

  if (!range.wrapsOrigin) {
    return sequence.slice(Math.max(0, range.start - 1), range.end);
  }

  return `${sequence.slice(range.start - 1)}${sequence.slice(0, range.end)}`;
}

export function longestHomopolymerRun(sequenceInput: string): number {
  const sequence = normalizeSequence(sequenceInput);
  let best = 0;
  let current = 0;
  let previous = '';

  for (const base of sequence) {
    if (base === previous) {
      current += 1;
    } else {
      current = 1;
      previous = base;
    }

    if (current > best) {
      best = current;
    }
  }

  return best;
}

export function isFiniteThermodynamicResult(
  result: ThermodynamicResult,
): boolean {
  return (
    Number.isFinite(result.deltaHKcalPerMol) &&
    Number.isFinite(result.deltaSCalPerMolK) &&
    Number.isFinite(result.rawTmCelsius) &&
    Number.isFinite(result.correctedTmCelsius) &&
    Number.isFinite(result.saltCorrection) &&
    Number.isFinite(result.effectiveFreeMagnesiumMolar) &&
    Number.isFinite(result.divalentToMonovalentRatio)
  );
}
