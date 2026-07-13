import { calculateGcPercentage } from './pcr';

export const OVERLAP_CRITERIA = {
  minTmC: 58,
  maxTmC: 72,
  minLengthNt: 24,
  minGcPercent: 35,
  maxGcPercent: 65,
  maxHomopolymerRun: 4,
} as const;

export type OverlapAssessment = {
  score: number;
  gcPercent: number;
  homopolymerRun: number;
  finiteTm: boolean;
  criteria: {
    tm: boolean;
    length: boolean;
    gc: boolean;
    homopolymer: boolean;
  };
};

function longestHomopolymerRun(sequence: string): number {
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

export function evaluateOverlapCriteria(
  sequence: string,
  tmCelsius: number,
): OverlapAssessment {
  const gcPercent = calculateGcPercentage(sequence);
  const homopolymerRun = longestHomopolymerRun(sequence);
  const finiteTm = Number.isFinite(tmCelsius);
  const criteria = {
    tm:
      finiteTm &&
      tmCelsius >= OVERLAP_CRITERIA.minTmC &&
      tmCelsius <= OVERLAP_CRITERIA.maxTmC,
    length: sequence.length >= OVERLAP_CRITERIA.minLengthNt,
    gc:
      gcPercent >= OVERLAP_CRITERIA.minGcPercent &&
      gcPercent <= OVERLAP_CRITERIA.maxGcPercent,
    homopolymer: homopolymerRun <= OVERLAP_CRITERIA.maxHomopolymerRun,
  };
  const passedCount = Object.values(criteria).filter(Boolean).length;

  return {
    score: passedCount / 4,
    gcPercent,
    homopolymerRun,
    finiteTm,
    criteria,
  };
}
