import { normalizeSequence, reverseComplement } from './pcr';
import {
  calculateNearestNeighborTm,
  defaultThermodynamicConditions,
  type ThermodynamicConditions,
} from './thermodynamics';

export type StructureKind =
  'hairpin' | 'homodimer' | 'heterodimer' | 'three-prime-dimer';

export type StructureCoordinates = {
  start: number;
  end: number;
};

export type StructureResult = {
  kind: StructureKind;
  deltaG: number;
  predictedTm: number;
  basePairCount: number;
  longestContiguousStem: number;
  threePrimePairedBasesA: number;
  threePrimePairedBasesB: number;
  coordinatesA: StructureCoordinates;
  coordinatesB: StructureCoordinates | null;
  diagram: string;
  alignedTop: string;
  alignedBottom: string;
  risk: 'Low' | 'Watch' | 'High';
};

type AlignmentTrace = 'diag' | 'up' | 'left' | 'stop';

type AlignmentResult = {
  score: number;
  alignedA: string;
  alignedB: string;
  startA: number;
  endA: number;
  startB: number;
  endB: number;
};

const COMPLEMENT: Record<string, string> = {
  A: 'T',
  T: 'A',
  C: 'G',
  G: 'C',
  N: 'N',
};

function isComplement(baseA: string, baseB: string): boolean {
  return COMPLEMENT[baseA] === baseB;
}

function pairEnergy(baseA: string, baseB: string): number {
  const sorted = [baseA, baseB].sort().join('');
  return sorted === 'CG' ? -2.2 : -1.4;
}

function complementMatchScore(baseA: string, baseB: string): number {
  if (!isComplement(baseA, baseB)) {
    return -3;
  }
  return baseA === 'G' || baseA === 'C' ? 3 : 2;
}

function localComplementAlignment(
  sequenceAInput: string,
  sequenceBInput: string,
): AlignmentResult | null {
  const sequenceA = normalizeSequence(sequenceAInput);
  const sequenceB = normalizeSequence(sequenceBInput);
  if (!sequenceA.length || !sequenceB.length) {
    return null;
  }

  const rows = sequenceA.length + 1;
  const cols = sequenceB.length + 1;
  const scores: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0),
  );
  const traces: AlignmentTrace[][] = Array.from({ length: rows }, () =>
    Array(cols).fill('stop'),
  );
  let bestScore = 0;
  let bestRow = 0;
  let bestCol = 0;

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const diag =
        scores[row - 1][col - 1] +
        complementMatchScore(sequenceA[row - 1], sequenceB[col - 1]);
      const up = scores[row - 1][col] - 2;
      const left = scores[row][col - 1] - 2;
      const best = Math.max(0, diag, up, left);
      scores[row][col] = best;
      traces[row][col] =
        best === 0
          ? 'stop'
          : best === diag
            ? 'diag'
            : best === up
              ? 'up'
              : 'left';

      if (best > bestScore) {
        bestScore = best;
        bestRow = row;
        bestCol = col;
      }
    }
  }

  if (bestScore <= 0) {
    return null;
  }

  let row = bestRow;
  let col = bestCol;
  const alignedA: string[] = [];
  const alignedB: string[] = [];

  while (row > 0 && col > 0 && traces[row][col] !== 'stop') {
    const trace = traces[row][col];
    if (trace === 'diag') {
      alignedA.push(sequenceA[row - 1]);
      alignedB.push(sequenceB[col - 1]);
      row -= 1;
      col -= 1;
    } else if (trace === 'up') {
      alignedA.push(sequenceA[row - 1]);
      alignedB.push('-');
      row -= 1;
    } else {
      alignedA.push('-');
      alignedB.push(sequenceB[col - 1]);
      col -= 1;
    }
  }

  return {
    score: bestScore,
    alignedA: alignedA.reverse().join(''),
    alignedB: alignedB.reverse().join(''),
    startA: row,
    endA: bestRow - 1,
    startB: col,
    endB: bestCol - 1,
  };
}

function countTerminalPairedBases(
  alignedA: string,
  alignedB: string,
  checkTopThreePrime: boolean,
): number {
  let count = 0;
  const indices = checkTopThreePrime
    ? [...Array(alignedA.length).keys()].reverse()
    : [...Array(alignedA.length).keys()];

  for (const index of indices) {
    if (alignedA[index] === '-' || alignedB[index] === '-') {
      if (count > 0) {
        break;
      }
      continue;
    }
    if (isComplement(alignedA[index], alignedB[index])) {
      count += 1;
    } else {
      break;
    }
  }

  return count;
}

function maxThreePrimeAnchoredComplement(
  sequenceAInput: string,
  sequenceBInput: string,
): number {
  const sequenceA = normalizeSequence(sequenceAInput);
  const sequenceB = normalizeSequence(sequenceBInput);
  const maxLength = Math.min(sequenceA.length, sequenceB.length);

  for (let length = maxLength; length >= 1; length -= 1) {
    const suffixA = sequenceA.slice(-length);
    for (let start = 0; start <= sequenceB.length - length; start += 1) {
      if (
        suffixA === reverseComplement(sequenceB.slice(start, start + length))
      ) {
        return length;
      }
    }
  }

  return 0;
}

function buildDiagram(top: string, bottom: string): string {
  const bars = top
    .split('')
    .map((base, index) =>
      base !== '-' && bottom[index] !== '-' && isComplement(base, bottom[index])
        ? '|'
        : ' ',
    )
    .join('');
  return [`5' ${top} 3'`, `   ${bars}`, `3' ${bottom} 5'`].join('\n');
}

function summarizeAlignment(
  kind: StructureKind,
  alignment: AlignmentResult,
  topSequenceForTm: string,
  loopPenalty = 0,
  conditions: ThermodynamicConditions = defaultThermodynamicConditions(),
): StructureResult {
  let basePairCount = 0;
  let longestContiguousStem = 0;
  let currentStem = 0;
  let deltaG = 0;

  for (let index = 0; index < alignment.alignedA.length; index += 1) {
    const baseA = alignment.alignedA[index];
    const baseB = alignment.alignedB[index];
    if (baseA !== '-' && baseB !== '-' && isComplement(baseA, baseB)) {
      basePairCount += 1;
      currentStem += 1;
      longestContiguousStem = Math.max(longestContiguousStem, currentStem);
      deltaG += pairEnergy(baseA, baseB);
      if (currentStem > 1) {
        deltaG -= 0.25;
      }
    } else {
      currentStem = 0;
    }
  }

  const threePrimePairedBasesA = countTerminalPairedBases(
    alignment.alignedA,
    alignment.alignedB,
    true,
  );
  const threePrimePairedBasesB = countTerminalPairedBases(
    alignment.alignedB,
    alignment.alignedA,
    false,
  );
  deltaG -= 0.45 * Math.max(threePrimePairedBasesA, threePrimePairedBasesB);
  deltaG += loopPenalty;

  const predictedTm = basePairCount
    ? calculateNearestNeighborTm(topSequenceForTm, conditions)
        .correctedTmCelsius - Math.max(loopPenalty * 2.5, 0)
    : 0;
  const risk =
    deltaG <= -9 ||
    Math.max(threePrimePairedBasesA, threePrimePairedBasesB) >= 5
      ? 'High'
      : deltaG <= -6 ||
          Math.max(threePrimePairedBasesA, threePrimePairedBasesB) >= 4
        ? 'Watch'
        : 'Low';

  return {
    kind,
    deltaG: Number(deltaG.toFixed(2)),
    predictedTm: Number(predictedTm.toFixed(1)),
    basePairCount,
    longestContiguousStem,
    threePrimePairedBasesA,
    threePrimePairedBasesB,
    coordinatesA: {
      start: alignment.startA + 1,
      end: alignment.endA + 1,
    },
    coordinatesB: {
      start: alignment.startB + 1,
      end: alignment.endB + 1,
    },
    diagram: buildDiagram(alignment.alignedA, alignment.alignedB),
    alignedTop: alignment.alignedA,
    alignedBottom: alignment.alignedB,
    risk,
  };
}

export function analyzeHomodimer(
  sequenceInput: string,
  conditions = defaultThermodynamicConditions(),
): StructureResult | null {
  const sequence = normalizeSequence(sequenceInput);
  const alignment = localComplementAlignment(sequence, sequence);
  if (!alignment) {
    return null;
  }
  return summarizeAlignment(
    'homodimer',
    alignment,
    sequence.slice(alignment.startA, alignment.endA + 1),
    0,
    conditions,
  );
}

export function analyzeThreePrimeDimer(
  sequenceAInput: string,
  sequenceBInput: string,
  conditions = defaultThermodynamicConditions(),
): StructureResult | null {
  const sequenceA = normalizeSequence(sequenceAInput);
  const sequenceB = normalizeSequence(sequenceBInput);
  const alignment = localComplementAlignment(sequenceA, sequenceB);
  if (!alignment) {
    return null;
  }
  const result = summarizeAlignment(
    'three-prime-dimer',
    alignment,
    sequenceA.slice(alignment.startA, alignment.endA + 1),
    0,
    conditions,
  );
  const anchoredA = maxThreePrimeAnchoredComplement(sequenceA, sequenceB);
  const anchoredB = maxThreePrimeAnchoredComplement(sequenceB, sequenceA);
  const strongestAnchor = Math.max(anchoredA, anchoredB);
  return {
    ...result,
    threePrimePairedBasesA: anchoredA,
    threePrimePairedBasesB: anchoredB,
    deltaG: Number((result.deltaG - strongestAnchor * 0.35).toFixed(2)),
    risk:
      strongestAnchor >= 5
        ? 'High'
        : strongestAnchor >= 3
          ? 'Watch'
          : result.risk,
  };
}

export function analyzeHeterodimer(
  sequenceAInput: string,
  sequenceBInput: string,
  conditions = defaultThermodynamicConditions(),
): StructureResult | null {
  const sequenceA = normalizeSequence(sequenceAInput);
  const sequenceB = normalizeSequence(sequenceBInput);
  const alignment = localComplementAlignment(sequenceA, sequenceB);
  if (!alignment) {
    return null;
  }
  return summarizeAlignment(
    'heterodimer',
    alignment,
    sequenceA.slice(alignment.startA, alignment.endA + 1),
    0,
    conditions,
  );
}

export function analyzeHairpin(
  sequenceInput: string,
  conditions = defaultThermodynamicConditions(),
): StructureResult | null {
  const sequence = normalizeSequence(sequenceInput);
  if (sequence.length < 8) {
    return null;
  }

  let best: { result: StructureResult; score: number } | null = null;

  for (let leftEnd = 3; leftEnd < sequence.length - 4; leftEnd += 1) {
    for (
      let rightStart = leftEnd + 4;
      rightStart < sequence.length - 3;
      rightStart += 1
    ) {
      const left = sequence.slice(0, leftEnd + 1);
      const right = sequence.slice(rightStart);
      const alignment = localComplementAlignment(left, right);
      if (!alignment) {
        continue;
      }

      const topMatched = left.slice(alignment.startA, alignment.endA + 1);
      const loopLength = Math.max(3, rightStart - alignment.endA - 1);
      const summarized = summarizeAlignment(
        'hairpin',
        alignment,
        topMatched,
        loopLength * 0.2,
        conditions,
      );
      const remapped: StructureResult = {
        ...summarized,
        coordinatesA: {
          start: alignment.startA + 1,
          end: alignment.endA + 1,
        },
        coordinatesB: {
          start: rightStart + alignment.startB + 1,
          end: rightStart + alignment.endB + 1,
        },
      };

      const score = remapped.basePairCount * 3 - loopLength - remapped.deltaG;
      if (!best || score > best.score) {
        best = { result: remapped, score };
      }
    }
  }

  return best?.result ?? null;
}

export type PrimerStructureAnalysis = {
  hairpin: StructureResult | null;
  homodimer: StructureResult | null;
  threePrimeHomodimer: StructureResult | null;
  risk: 'Low' | 'Watch' | 'High';
};

export function analyzePrimerStructure(
  primerSequence: string,
  conditions = defaultThermodynamicConditions(),
): PrimerStructureAnalysis {
  const hairpin = analyzeHairpin(primerSequence, conditions);
  const homodimer = analyzeHomodimer(primerSequence, conditions);
  const threePrimeHomodimer = analyzeThreePrimeDimer(
    primerSequence,
    primerSequence,
    conditions,
  );
  const risks = [hairpin?.risk, homodimer?.risk, threePrimeHomodimer?.risk];
  const risk = risks.includes('High')
    ? 'High'
    : risks.includes('Watch')
      ? 'Watch'
      : 'Low';

  return {
    hairpin,
    homodimer,
    threePrimeHomodimer,
    risk,
  };
}
