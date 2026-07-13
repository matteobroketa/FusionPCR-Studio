import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  calculateNearestNeighborTm,
  defaultThermodynamicConditions,
  divalentToMonovalentEquivalent,
  isSelfComplementary,
} from './thermodynamics';

type TmReferenceFixture = {
  fixtureFormatVersion: number;
  generatedBy: {
    script: string;
    referenceToolName: string;
    referenceToolVersion: string;
    referenceFunction: string;
  };
  cases: Array<{
    name: string;
    sequence: string;
    coverageTags: string[];
    referenceTool: {
      name: string;
      version: string;
      function: string;
    };
    parameters: {
      mv_conc_mM: number;
      dv_conc_mM: number;
      dntp_conc_mM: number;
      dna_conc_nM: number;
      dmso_conc_percent: number;
      dmso_fact_celsius_per_percent: number;
      annealing_temp_celsius: number;
      max_nn_length: number;
      tm_method: string;
      salt_corrections_method: string;
    };
    toleranceCelsius: number;
    expected: {
      correctedTmCelsius?: number;
      selfComplementary: boolean;
      errorType?: string;
      errorContains?: string;
    };
  }>;
};

const tmReferenceFixtures = JSON.parse(
  readFileSync(
    path.resolve(process.cwd(), 'test-data/reference/tm-reference.json'),
    'utf8',
  ),
) as TmReferenceFixture;

describe('thermodynamics', () => {
  it('ships at least 30 curated primer3-backed Tm fixtures with complete reference metadata', () => {
    expect(tmReferenceFixtures.fixtureFormatVersion).toBe(1);
    expect(tmReferenceFixtures.generatedBy.referenceToolName).toBe(
      'primer3-py',
    );
    expect(
      tmReferenceFixtures.generatedBy.referenceToolVersion.length,
    ).toBeGreaterThan(0);
    expect(tmReferenceFixtures.cases.length).toBeGreaterThanOrEqual(30);

    for (const fixture of tmReferenceFixtures.cases) {
      expect(fixture.referenceTool.name, fixture.name).toBe('primer3-py');
      expect(fixture.referenceTool.version, fixture.name).toBe(
        tmReferenceFixtures.generatedBy.referenceToolVersion,
      );
      expect(fixture.referenceTool.function, fixture.name).toBe(
        'primer3.bindings.calc_tm',
      );
      expect(fixture.parameters.tm_method, fixture.name).toBe('santalucia');
      expect(fixture.parameters.salt_corrections_method, fixture.name).toBe(
        'owczarzy',
      );
      expect(fixture.toleranceCelsius, fixture.name).toBeGreaterThanOrEqual(0);
      expect(fixture.coverageTags.length, fixture.name).toBeGreaterThan(0);
    }
  });

  it('matches the recorded Tm reference fixtures', () => {
    for (const fixture of tmReferenceFixtures.cases) {
      const result = calculateNearestNeighborTm(fixture.sequence, {
        monovalentMillimolar: fixture.parameters.mv_conc_mM,
        magnesiumMillimolar: fixture.parameters.dv_conc_mM,
        dntpMillimolar: fixture.parameters.dntp_conc_mM,
        oligoNanomolar: fixture.parameters.dna_conc_nM,
        dmsoPercent: fixture.parameters.dmso_conc_percent,
        dmsoFactor: fixture.parameters.dmso_fact_celsius_per_percent,
      });

      if (fixture.expected.errorType) {
        expect(Number.isFinite(result.correctedTmCelsius), fixture.name).toBe(
          false,
        );
        continue;
      }

      expect(result.selfComplementary, fixture.name).toBe(
        fixture.expected.selfComplementary,
      );
      expect(Number.isFinite(result.correctedTmCelsius), fixture.name).toBe(
        true,
      );
      expect(
        Math.abs(
          result.correctedTmCelsius -
            (fixture.expected.correctedTmCelsius ?? Number.NaN),
        ),
        fixture.name,
      ).toBeLessThanOrEqual(fixture.toleranceCelsius);
    }
  });

  it('applies DMSO as a separate correction', () => {
    const withoutDmso = calculateNearestNeighborTm(
      'ATGACTGACCGTACGT',
      defaultThermodynamicConditions(),
    );
    const withDmso = calculateNearestNeighborTm('ATGACTGACCGTACGT', {
      ...defaultThermodynamicConditions(),
      dmsoPercent: 5,
      dmsoFactor: 0.6,
    });

    expect(withDmso.correctedTmCelsius).toBeCloseTo(
      withoutDmso.correctedTmCelsius - 3,
      6,
    );
  });

  it('detects self-complementary sequences', () => {
    expect(isSelfComplementary('ATCGAT')).toBe(true);
    expect(isSelfComplementary('ATGCATG')).toBe(false);
  });

  it('computes the divalent to monovalent equivalent used in legacy salt correction paths', () => {
    expect(divalentToMonovalentEquivalent(1.5, 0.2)).toBeCloseTo(136.821, 3);
  });
});
