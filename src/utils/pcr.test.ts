import {
  analyzePrimer,
  calculateGcPercentage,
  calculateWallaceTm,
  estimateAmplicon,
  findBindingSites,
  normalizeSequence,
  reverseComplement,
} from './pcr';

describe('PCR utilities', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeSequence(' atg c\nta ')).toBe('ATGCTA');
  });

  it('creates the reverse complement', () => {
    expect(reverseComplement('ATGCCGTA')).toBe('TACGGCAT');
  });

  it('calculates GC percentage with one decimal place', () => {
    expect(calculateGcPercentage('ATGCCGTA')).toBe(50);
    expect(calculateGcPercentage('ATGG')).toBe(50);
    expect(calculateGcPercentage('AGC')).toBe(66.7);
  });

  it('calculates Wallace melting temperature', () => {
    expect(calculateWallaceTm('ATGCCGTA')).toBe(24);
  });

  it('analyzes primer metrics', () => {
    const primer = analyzePrimer('ATGACTGACCGTACGT');

    expect(primer.length).toBe(16);
    expect(primer.gcPercentage).toBe(50);
    expect(primer.reverseComplement).toBe('ACGTACGGTCAGTCAT');
    expect(primer.wallaceTm).toBe(48);
    expect(primer.invalidBases).toEqual([]);
  });

  it('finds binding sites', () => {
    expect(findBindingSites('ATATAT', 'ATA')).toEqual([0, 2]);
  });

  it('detects a valid amplicon from the example dataset', () => {
    const template = 'ATGACTGACCGTACGTTAACCGATGCAATGCC';
    const forwardPrimer = 'ATGACTGACCGTACGT';
    const reversePrimer = 'GGCATTGCATCGGTTA';
    const amplicon = estimateAmplicon(template, forwardPrimer, reversePrimer);

    expect(amplicon).not.toBeNull();
    expect(amplicon?.forwardSite).toBe(0);
    expect(amplicon?.reverseSite).toBe(16);
    expect(amplicon?.end).toBe(32);
    expect(amplicon?.length).toBe(32);
    expect(amplicon?.sequence.startsWith(forwardPrimer)).toBe(true);
    expect(amplicon?.sequence.endsWith(amplicon!.reverseBindingSequence)).toBe(
      true,
    );
  });

  it('returns null when primers do not amplify in a valid orientation', () => {
    const amplicon = estimateAmplicon('AAACCCGGGTTT', 'GGG', 'TTT');
    expect(amplicon).toBeNull();
  });
});
