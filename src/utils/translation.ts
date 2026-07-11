import { normalizeSequence } from './pcr';

export type TranslationResult = {
  codingSequence: string;
  codons: string[];
  aminoAcids: string;
  hasStartCodon: boolean;
  hasStopCodon: boolean;
  stopPositions: number[];
};

const CODON_TABLE: Record<string, string> = {
  TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L',
  TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S',
  TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*',
  TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W',
  CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L',
  CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q',
  CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
  ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M',
  ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
  AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K',
  AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
  GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V',
  GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E',
  GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
};

const AMINO_ACID_TO_CODONS = Object.entries(CODON_TABLE).reduce<Record<string, string[]>>((mapping, [codon, aminoAcid]) => {
  if (!mapping[aminoAcid]) {
    mapping[aminoAcid] = [];
  }
  mapping[aminoAcid].push(codon);
  return mapping;
}, {});

export function translateSequence(sequenceInput: string, frame = 0): TranslationResult {
  const sequence = normalizeSequence(sequenceInput);
  const safeFrame = Math.max(0, Math.min(2, Math.floor(frame)));
  const codingSequence = sequence.slice(safeFrame);
  const usableLength = codingSequence.length - (codingSequence.length % 3);
  const codons: string[] = [];
  const aminoAcids: string[] = [];
  const stopPositions: number[] = [];

  for (let index = 0; index < usableLength; index += 3) {
    const codon = codingSequence.slice(index, index + 3);
    const aminoAcid = CODON_TABLE[codon] ?? 'X';
    codons.push(codon);
    aminoAcids.push(aminoAcid);

    if (aminoAcid === '*') {
      stopPositions.push(index / 3);
    }
  }

  return {
    codingSequence: codingSequence.slice(0, usableLength),
    codons,
    aminoAcids: aminoAcids.join(''),
    hasStartCodon: codons[0] === 'ATG',
    hasStopCodon: stopPositions.length > 0,
    stopPositions,
  };
}

export function codonAt(sequenceInput: string, frame: number, codonIndex: number): string {
  const translation = translateSequence(sequenceInput, frame);
  return translation.codons[codonIndex] ?? '';
}

export function aminoAcidForCodon(codonInput: string): string {
  const codon = normalizeSequence(codonInput);
  return CODON_TABLE[codon] ?? 'X';
}

export function codonsForAminoAcid(aminoAcid: string): string[] {
  return [...(AMINO_ACID_TO_CODONS[aminoAcid] ?? [])];
}

export function synonymousCodonsForCodon(codonInput: string): string[] {
  const codon = normalizeSequence(codonInput);
  const aminoAcid = aminoAcidForCodon(codon);

  if (!codon || aminoAcid === 'X') {
    return codon ? [codon] : [];
  }

  return [codon, ...codonsForAminoAcid(aminoAcid).filter((candidate) => candidate !== codon)];
}

export function formatAminoAcidWindow(aminoAcids: string, centerIndex: number, radius = 5): string {
  if (!aminoAcids.length) {
    return '';
  }

  const start = Math.max(0, centerIndex - radius);
  const end = Math.min(aminoAcids.length, centerIndex + radius + 1);
  return aminoAcids.slice(start, end);
}
