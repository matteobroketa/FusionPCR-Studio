import { normalizeSequence } from './pcr';
import type { CodingIntent, DesignMode, SynonymousOptimization, ProteinValidation } from './fusion-model';
import { formatAminoAcidWindow, translateSequence } from './translation';

const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA']);

export function replaceLastInFrameCodon(sequenceInput: string, frame: 0 | 1 | 2): { sequence: string; removed: boolean; start: number; codon: string } {
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

export function removeFirstInFrameStartCodon(sequenceInput: string, frame: 0 | 1 | 2): { sequence: string; removed: boolean; start: number; codon: string } {
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

  const upstreamTranslation = translateSequence(effectiveA, coding.upstreamFrame);
  const insertTranslation = translateSequence(insertSequence, 0);
  const downstreamTranslation = translateSequence(effectiveB, coding.downstreamFrame);
  const finalCodingSequence = `${effectiveA.slice(coding.upstreamFrame)}${insertSequence}${effectiveB.slice(coding.downstreamFrame)}`;
  const finalTranslation = translateSequence(finalCodingSequence, 0);
  const codingBasesBeforeJunction = Math.max(0, effectiveA.length - coding.upstreamFrame);
  const expectedFrame = coding.downstreamFrame;
  const observedFrame = (codingBasesBeforeJunction + insertSequence.length) % 3;
  const framePreserved = observedFrame === expectedFrame;
  const upstreamFullTranslation = translateSequence(selectedA, coding.upstreamFrame);
  const downstreamFullTranslation = translateSequence(selectedB, coding.downstreamFrame);
  const upstreamHasTerminalStop = upstreamFullTranslation.codons.at(-1) !== undefined && STOP_CODONS.has(upstreamFullTranslation.codons.at(-1)!);
  const downstreamHasStartCodon = downstreamFullTranslation.codons[0] === 'ATG';
  const proteinWarnings: string[] = [];

  if (!framePreserved) {
    const delta = (expectedFrame - observedFrame + 3) % 3;
    proteinWarnings.push(
      `Frameshift: the current junction leaves remainder ${observedFrame}; adjust the inserted sequence by ${delta === 0 ? 3 : delta} base(s) to reach downstream frame ${expectedFrame}.`,
    );
  }

  if (upstreamHasTerminalStop && coding.retainUpstreamStop) {
    proteinWarnings.push('Premature termination: the upstream fragment retains its stop codon.');
  }

  if (downstreamHasStartCodon && coding.retainDownstreamStart) {
    proteinWarnings.push('Unexpected N-terminal methionine: the downstream ATG is retained.');
  }

  if (coding.linkerRequired && !insertSequence.length) {
    proteinWarnings.push('Linker required: protein fusion mode is configured to require an inserted linker sequence.');
  }

  const firstPrematureStop = finalTranslation.stopPositions.find((position) => position < finalTranslation.aminoAcids.length - 1);
  if (firstPrematureStop !== undefined) {
    proteinWarnings.push(`Premature stop codon detected at amino-acid position ${firstPrematureStop + 1} in the fused product.`);
  }

  const junctionAaIndex = Math.max(0, Math.floor(codingBasesBeforeJunction / 3) - 1);

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
    junctionAminoAcids: formatAminoAcidWindow(finalTranslation.aminoAcids, junctionAaIndex),
    linkerAminoAcids: insertTranslation.aminoAcids,
    synonymousOptimization,
    warnings: proteinWarnings,
  };
}
