import { buildProtocolPlan, defaultProtocolSettings, massNgToPmol, pmolToMassNg, volumeForMass } from './protocol';

describe('protocol calculations', () => {
  it('converts pmol to DNA mass and back', () => {
    const mass = pmolToMassNg(0.05, 500);

    expect(mass).toBeCloseTo(16.5, 6);
    expect(massNgToPmol(mass, 500)).toBeCloseTo(0.05, 6);
  });

  it('computes volume from concentration', () => {
    expect(volumeForMass(33, 11)).toBeCloseTo(3, 6);
  });

  it('builds an equimolar protocol plan', () => {
    const plan = buildProtocolPlan(defaultProtocolSettings(), {
      stageAProductLength: 100,
      stageBProductLength: 200,
      finalProductLength: 250,
    }, ['A_outer_F', 'A_inner_R', 'B_inner_F', 'B_outer_R'], 'q5', {
      dntpMillimolar: 0.2,
      dmsoPercent: 0,
    });

    expect(plan.stageMixEntries).toHaveLength(2);
    expect(plan.stageMixEntries[0].targetPmol).toBeCloseTo(0.0275, 6);
    expect(plan.stageMixEntries[1].requiredMassNg).toBeCloseTo(3.63, 6);
    expect(plan.primerUsage.find((entry) => entry.primerName === 'A_outer_F')?.reactionsUsingPrimer).toBe(3);
    expect(plan.reactionMixes.find((entry) => entry.name === 'Fusion PCR')?.cycleCount).toBe(22);
    expect(plan.reactionRecipes.find((entry) => entry.name === 'PCR 1A')?.entries.some((entry) => entry.role === 'master-mix')).toBe(true);
  });

  it('supports user-defined mix ratios', () => {
    const plan = buildProtocolPlan({
      ...defaultProtocolSettings(),
      mixStrategy: 'user-defined',
      totalTemplatePmol: 0.06,
      stageMixRatioA: 2,
      stageMixRatioB: 1,
    }, {
      stageAProductLength: 300,
      stageBProductLength: 300,
      finalProductLength: 600,
    }, ['A_outer_F', 'A_inner_R', 'B_inner_F', 'B_outer_R'], 'q5', {
      dntpMillimolar: 0.2,
      dmsoPercent: 0,
    });

    expect(plan.stageMixEntries[0].targetPmol).toBeCloseTo(0.044, 6);
    expect(plan.stageMixEntries[1].targetPmol).toBeCloseTo(0.022, 6);
  });

  it('builds separate-component recipes for phusion plus', () => {
    const plan = buildProtocolPlan({
      ...defaultProtocolSettings(),
      reactionVolumeMicroliters: 25,
      stage1TemplatePerReactionMicroliters: 1.5,
    }, {
      stageAProductLength: 400,
      stageBProductLength: 500,
      finalProductLength: 700,
    }, ['A_outer_F', 'A_inner_R', 'B_inner_F', 'B_outer_R'], 'phusion_plus', {
      dntpMillimolar: 0.2,
      dmsoPercent: 3,
    });

    const pcr1aRecipe = plan.reactionRecipes.find((entry) => entry.name === 'PCR 1A');
    expect(pcr1aRecipe?.entries.some((entry) => entry.role === 'buffer')).toBe(true);
    expect(pcr1aRecipe?.entries.some((entry) => entry.role === 'dntp')).toBe(true);
    expect(pcr1aRecipe?.entries.some((entry) => entry.role === 'polymerase')).toBe(true);
    expect(pcr1aRecipe?.entries.some((entry) => entry.role === 'dmso')).toBe(true);
    expect(pcr1aRecipe?.entries.find((entry) => entry.label === 'Fragment A source template')?.perReactionVolumeUl).toBeCloseTo(1.5, 6);
  });

  it('scales fusion template requirements by overfilled reaction count while preserving per-reaction loading', () => {
    const plan = buildProtocolPlan({
      ...defaultProtocolSettings(),
      totalTemplatePmol: 0.08,
      finalReactionCount: 3,
      overfillPercent: 20,
    }, {
      stageAProductLength: 300,
      stageBProductLength: 450,
      finalProductLength: 700,
    }, ['A_outer_F', 'A_inner_R', 'B_inner_F', 'B_outer_R'], 'q5', {
      dntpMillimolar: 0.2,
      dmsoPercent: 0,
    });

    const fusionMix = plan.reactionMixes.find((entry) => entry.name === 'Fusion PCR');
    const fusionRecipe = plan.reactionRecipes.find((entry) => entry.name === 'Fusion PCR');
    const stageAEntry = plan.stageMixEntries.find((entry) => entry.label === 'PCR 1A product');
    const stageATemplate = fusionRecipe?.entries.find((entry) => entry.label === 'PCR 1A product template');

    expect(fusionMix?.overfilledReactionCount).toBeCloseTo(3.6, 6);
    expect(stageAEntry?.targetPmol).toBeCloseTo(0.144, 6);
    expect(stageATemplate?.totalVolumeUl).toBeCloseTo(stageAEntry?.requiredVolumeUl ?? 0, 6);
    expect(stageATemplate?.perReactionVolumeUl).toBeCloseTo(0.53, 6);
  });

  it('returns an empty protocol plan for invalid or missing products', () => {
    const plan = buildProtocolPlan(defaultProtocolSettings(), {
      stageAProductLength: 0,
      stageBProductLength: 100,
      finalProductLength: 150,
    }, [], 'q5', {
      dntpMillimolar: 0.2,
      dmsoPercent: 0,
    });

    expect(plan.stageMixEntries).toEqual([]);
    expect(plan.reactionRecipes).toEqual([]);
    expect(plan.reactionMixes).toEqual([]);
  });
});
