import { OVERLAP_CRITERIA, evaluateOverlapCriteria } from './overlap';

describe('overlap criteria', () => {
  it('scores each documented overlap criterion separately', () => {
    const passing = evaluateOverlapCriteria('ATGCATGCATGCATGCATGCATGC', 64);

    expect(passing.criteria.tm).toBe(true);
    expect(passing.criteria.length).toBe(true);
    expect(passing.criteria.gc).toBe(true);
    expect(passing.criteria.homopolymer).toBe(true);
    expect(passing.score).toBe(1);
  });

  it('fails noncompliant overlaps by the specific documented criterion', () => {
    const tooShort = evaluateOverlapCriteria('ATGCATGCATGCATGCATGCATG', 64);
    const lowTm = evaluateOverlapCriteria('ATGCATGCATGCATGCATGCATGC', OVERLAP_CRITERIA.minTmC - 1);
    const gcExtreme = evaluateOverlapCriteria('GCGCGCGCGCGCGCGCGCGCGCGC', 64);
    const homopolymer = evaluateOverlapCriteria('AAAAATGCATGCATGCATGCATGC', 64);

    expect(tooShort.criteria.length).toBe(false);
    expect(lowTm.criteria.tm).toBe(false);
    expect(gcExtreme.criteria.gc).toBe(false);
    expect(homopolymer.criteria.homopolymer).toBe(false);
  });
});
