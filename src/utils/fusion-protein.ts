import { normalizeSequence } from './pcr';
import type {
  CodingIntent,
  DesignMode,
  ReviewItem,
  SynonymousOptimization,
  ProteinValidation,
} from './fusion-model';
import { createReviewItem } from './review-items';
import { formatAminoAcidWindow, translateSequence } from './translation';

const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA']);

export function replaceLastInFrameCodon(
  sequenceInput: string,
  frame: 0 | 1 | 2,
): { sequence: string; removed: boolean; start: number; codon: string } {
  const sequence = normalizeSequence(sequenceInput);
  const codingLength = sequence.length - frame;

  if (codingLength < 3) {
    return { sequence, removed: false, start: 0, codon: '' };
  }

  const remainder = codingLength % 3;
  const lastCodonStart = sequence.length - remainder - 3;
  const lastCodon = sequence.slice(lastCodonStart, lastCodonStart + 3);

  if (!STOP_CODONS.has(lastCodon)) {
    return { sequence, removed: false, start: 0, codon: '' };
  }

  return {
    sequence: `${sequence.slice(0, lastCodonStart)}${sequence.slice(lastCodonStart + 3)}`,
    removed: true,
    start: lastCodonStart + 1,
    codon: lastCodon,
  };
}

export function removeFirstInFrameStartCodon(
  sequenceInput: string,
  frame: 0 | 1 | 2,
): { sequence: string; removed: boolean; start: number; codon: string } {
  const sequence = normalizeSequence(sequenceInput);
  const firstCodonStart = frame;
  const firstCodon = sequence.slice(firstCodonStart, firstCodonStart + 3);

  if (firstCodon !== 'ATG') {
    return { sequence, removed: false, start: 0, codon: '' };
  }

  return {
    sequence: `${sequence.slice(0, firstCodonStart)}${sequence.slice(firstCodonStart + 3)}`,
    removed: true,
    start: firstCodonStart + 1,
    codon: firstCodon,
  };
}

export function validateProteinFusion(
  mode: DesignMode,
  selectedAInput: string,
  selectedBInput: string,
  effectiveAInput: string,
  effectiveBInput: string,
  insertSequenceInput: string,
  coding: CodingIntent,
  synonymousOptimization: SynonymousOptimization | null,
): ProteinValidation | null {
  if (mode !== 'protein-fusion') {
    return null;
  }

  const selectedA = normalizeSequence(selectedAInput);
  const selectedB = normalizeSequence(selectedBInput);
  const effectiveA = normalizeSequence(effectiveAInput);
  const effectiveB = normalizeSequence(effectiveBInput);
  const insertSequence = normalizeSequence(insertSequenceInput);

  const upstreamTranslation = translateSequence(
    effectiveA,
    coding.upstreamFrame,
  );
  const insertTranslation = translateSequence(insertSequence, 0);
  const downstreamTranslation = translateSequence(
    effectiveB,
    coding.downstreamFrame,
  );
  const finalCodingSequence = `${effectiveA.slice(coding.upstreamFrame)}${insertSequence}${effectiveB.slice(coding.downstreamFrame)}`;
  const finalTranslation = translateSequence(finalCodingSequence, 0);
  const codingBasesBeforeJunction = Math.max(
    0,
    effectiveA.length - coding.upstreamFrame,
  );
  const expectedFrame = coding.downstreamFrame;
  const observedFrame = (codingBasesBeforeJunction + insertSequence.length) % 3;
  const framePreserved = observedFrame === expectedFrame;
  const upstreamFullTranslation = translateSequence(
    selectedA,
    coding.upstreamFrame,
  );
  const downstreamFullTranslation = translateSequence(
    selectedB,
    coding.downstreamFrame,
  );
  const upstreamHasTerminalStop =
    upstreamFullTranslation.codons.at(-1) !== undefined &&
    STOP_CODONS.has(upstreamFullTranslation.codons.at(-1)!);
  const downstreamHasStartCodon = downstreamFullTranslation.codons[0] === 'ATG';
  const proteinWarnings: string[] = [];
  const proteinReviewItems: ReviewItem[] = [];

  if (!framePreserved) {
    const delta = (expectedFrame - observedFrame + 3) % 3;
    const title = `Frameshift: the current junction leaves remainder ${observedFrame}.`;
    proteinWarnings.push(title);
    proteinReviewItems.push(
      createReviewItem({
        severity: 'warning',
        scope: 'protein',
        relatedObjectId: 'junction-1',
        title,
        explanation: `The current fusion does not preserve the downstream frame ${expectedFrame}.`,
        recommendedAction: `Adjust the inserted sequence by ${delta === 0 ? 3 : delta} base(s) to restore the reading frame.`,
        deduplicationKey: `protein:frameshift:${observedFrame}:${expectedFrame}`,
      }),
    );
  }

  if (upstreamHasTerminalStop && coding.retainUpstreamStop) {
    const title =
      'Premature termination: the upstream fragment retains its stop codon.';
    proteinWarnings.push(title);
    proteinReviewItems.push(
      createReviewItem({
        severity: 'warning',
        scope: 'protein',
        relatedObjectId: 'fragment-a',
        title,
        explanation:
          'Translation would terminate at the upstream stop codon before reaching the fused downstream coding region.',
        recommendedAction:
          'Approve removal of the upstream stop codon or choose a fragment range without a terminal stop.',
        deduplicationKey: 'protein:upstream-stop-retained',
      }),
    );
  }

  if (downstreamHasStartCodon && coding.retainDownstreamStart) {
    const title =
      'Unexpected N-terminal methionine: the downstream ATG is retained.';
    proteinWarnings.push(title);
    proteinReviewItems.push(
      createReviewItem({
        severity: 'review',
        scope: 'protein',
        relatedObjectId: 'fragment-b',
        title,
        explanation:
          'The downstream coding fragment still begins with ATG, which can add an extra methionine to the fused product.',
        recommendedAction:
          'Approve removal of the downstream start codon if continuous fusion is intended.',
        deduplicationKey: 'protein:downstream-start-retained',
      }),
    );
  }

  if (coding.linkerRequired && !insertSequence.length) {
    const title =
      'Linker required: protein fusion mode is configured to require an inserted linker sequence.';
    proteinWarnings.push(title);
    proteinReviewItems.push(
      createReviewItem({
        severity: 'warning',
        scope: 'protein',
        relatedObjectId: 'junction-1',
        title,
        explanation:
          'Protein-fusion mode is configured to require a linker, but the current design inserts no bases at the junction.',
        recommendedAction:
          'Provide the intended linker or disable the linker-required coding setting.',
        deduplicationKey: 'protein:linker-required',
      }),
    );
  }

  const firstPrematureStop = finalTranslation.stopPositions.find(
    (position) => position < finalTranslation.aminoAcids.length - 1,
  );
  if (firstPrematureStop !== undefined) {
    const title = `Premature stop codon detected at amino-acid position ${firstPrematureStop + 1} in the fused product.`;
    proteinWarnings.push(title);
    proteinReviewItems.push(
      createReviewItem({
        severity: 'warning',
        scope: 'protein',
        relatedObjectId: 'junction-1',
        title,
        explanation:
          'The fused coding sequence introduces an internal stop codon before the end of the translated product.',
        recommendedAction:
          'Adjust the fragment ranges, reading frame, or inserted sequence before ordering primers.',
        deduplicationKey: `protein:premature-stop:${firstPrematureStop + 1}`,
      }),
    );
  }

  const junctionAaIndex = Math.max(
    0,
    Math.floor(codingBasesBeforeJunction / 3) - 1,
  );

  return {
    enabled: true,
    upstreamTranslation: upstreamTranslation.aminoAcids,
    insertTranslation: insertTranslation.aminoAcids,
    downstreamTranslation: downstreamTranslation.aminoAcids,
    finalTranslation: finalTranslation.aminoAcids,
    proteinLength: finalTranslation.aminoAcids.replace(/\*/g, '').length,
    framePreserved,
    frameMessage: framePreserved
      ? `Reading frame preserved: (${codingBasesBeforeJunction} + ${insertSequence.length}) mod 3 = ${expectedFrame}.`
      : `Reading frame mismatch: (${codingBasesBeforeJunction} + ${insertSequence.length}) mod 3 = ${observedFrame}, expected ${expectedFrame}.`,
    upstreamHasTerminalStop,
    downstreamHasStartCodon,
    fusedHasPrematureStop: firstPrematureStop !== undefined,
    junctionAminoAcids: formatAminoAcidWindow(
      finalTranslation.aminoAcids,
      junctionAaIndex,
    ),
    linkerAminoAcids: insertTranslation.aminoAcids,
    synonymousOptimization,
    reviewItems: proteinReviewItems,
    warnings: proteinWarnings,
  };
}
