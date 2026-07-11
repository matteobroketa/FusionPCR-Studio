import { calculateNearestNeighborTm, defaultThermodynamicConditions, divalentToMonovalentEquivalent, isSelfComplementary } from './thermodynamics';

describe('thermodynamics', () => {
  it('matches stable reference values for Primer3-style nearest-neighbour Tm', () => {
    const conditions = defaultThermodynamicConditions();
    const result = calculateNearestNeighborTm('GATCGATCGATCGATCGATC', conditions);

    expect(result.deltaHKcalPerMol).toBeCloseTo(-160.2, 6);
    expect(result.deltaSCalPerMolK).toBeCloseTo(-439.8, 6);
    expect(result.rawTmCelsius).toBeCloseTo(68.696342, 5);
    expect(result.correctedTmCelsius).toBeCloseTo(59.589566, 5);
  });

  it('applies DMSO as a separate correction', () => {
    const withoutDmso = calculateNearestNeighborTm('ATGACTGACCGTACGT', defaultThermodynamicConditions());
    const withDmso = calculateNearestNeighborTm('ATGACTGACCGTACGT', {
      ...defaultThermodynamicConditions(),
      dmsoPercent: 5,
      dmsoFactor: 0.6,
    });

    expect(withDmso.correctedTmCelsius).toBeCloseTo(withoutDmso.correctedTmCelsius - 3, 6);
  });

  it('detects self-complementary sequences', () => {
    expect(isSelfComplementary('ATCGAT')).toBe(true);
    expect(isSelfComplementary('ATGCATG')).toBe(false);
  });

  it('computes the divalent to monovalent equivalent used in legacy salt correction paths', () => {
    expect(divalentToMonovalentEquivalent(1.5, 0.2)).toBeCloseTo(136.821, 3);
  });
});
