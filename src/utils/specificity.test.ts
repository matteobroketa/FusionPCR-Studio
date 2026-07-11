import { findPrimerSpecificitySites, predictOffTargetAmplicons, type SpecificityTemplate } from './specificity';

describe('local specificity', () => {
  it('finds intended and extra seed-matched sites for a forward primer', () => {
    const templates: SpecificityTemplate[] = [
      {
        id: 'template-a',
        name: 'Template A',
        sequence: 'CCCATGACTGACCGGTTATTGACTGACCGG',
        kind: 'imported',
      },
    ];

    const sites = findPrimerSpecificitySites('PrimerF', 'ATGACTGACC', 'forward', templates);

    expect(sites.length).toBeGreaterThanOrEqual(2);
    expect(sites[0].templateName).toBe('Template A');
    expect(sites.some((site) => site.mismatchCount === 0)).toBe(true);
    expect(sites.some((site) => site.mismatchCount > 0 && site.risk !== 'low')).toBe(true);
  });

  it('finds sites for a reverse primer using the correct 3 prime seed orientation', () => {
    const templates: SpecificityTemplate[] = [
      {
        id: 'template-b',
        name: 'Template B',
        sequence: 'GGGTTAACCGATGCATTT',
        kind: 'imported',
      },
    ];

    const sites = findPrimerSpecificitySites('PrimerR', 'AAATGCATCGGTTAACCC', 'reverse', templates);

    expect(sites.length).toBe(1);
    expect(sites[0].mismatchCount).toBe(0);
    expect(sites[0].risk).toBe('high');
  });

  it('predicts unintended amplicons from compatible risky sites', () => {
    const template: SpecificityTemplate = {
      id: 'template-c',
      name: 'Template C',
      sequence: 'ATGACTGACCGGTTTTTTGGTAAGCCTAGC',
      kind: 'imported',
    };

    const forwardSites = findPrimerSpecificitySites('A_outer_F', 'ATGACTGACC', 'forward', [template]);
    const reverseSites = findPrimerSpecificitySites('B_outer_R', 'GCTAGGCTTACC', 'reverse', [template]);
    const amplicons = predictOffTargetAmplicons(template, 'A_outer_F', forwardSites, 'B_outer_R', reverseSites);

    expect(amplicons.length).toBeGreaterThan(0);
    expect(amplicons[0].length).toBeGreaterThan(10);
  });
});
