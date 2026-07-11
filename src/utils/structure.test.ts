import { analyzeHairpin, analyzeHeterodimer, analyzeHomodimer, analyzePrimerStructure, analyzeThreePrimeDimer } from './structure';

describe('secondary structure analysis', () => {
  it('detects a hairpin-like internal complementarity', () => {
    const result = analyzeHairpin('GACTGACCTGATCGTCAGTC');

    expect(result).not.toBeNull();
    expect(result?.basePairCount).toBeGreaterThanOrEqual(3);
    expect(result?.diagram.includes('|')).toBe(true);
  });

  it('detects a homodimer interaction', () => {
    const result = analyzeHomodimer('GATATC');

    expect(result).not.toBeNull();
    expect(result?.basePairCount).toBeGreaterThanOrEqual(3);
    expect(result?.deltaG).toBeLessThan(0);
  });

  it('detects a 3 prime anchored heterodimer interaction', () => {
    const result = analyzeThreePrimeDimer('GACTGACCTGATCGTACG', 'CGTACGATCAGGTCAGTC');

    expect(result).not.toBeNull();
    expect(Math.max(result?.threePrimePairedBasesA ?? 0, result?.threePrimePairedBasesB ?? 0)).toBeGreaterThan(3);
  });

  it('produces a heterodimer result for complementary inner-primer pairs', () => {
    const result = analyzeHeterodimer('CGGTAAGCCTAGCTAC', 'GTAGCTAGGCTTACCG');

    expect(result).not.toBeNull();
    expect(result?.risk === 'High' || result?.risk === 'Watch').toBe(true);
    expect(result?.basePairCount).toBeGreaterThanOrEqual(6);
  });

  it('summarizes overall primer structure risk', () => {
    const result = analyzePrimerStructure('CGGTAAGCCTAGCTACGTAGCTAGGCTTACCG');

    expect(result.risk === 'High' || result.risk === 'Watch' || result.risk === 'Low').toBe(true);
    expect(result.homodimer || result.hairpin || result.threePrimeHomodimer).not.toBeNull();
  });
});
