export type MixStrategy =
  'equimolar' | 'user-defined' | 'limiting-a' | 'limiting-b';
export type ProtocolPolymeraseId = 'q5' | 'phusion_plus';

export type ProtocolSettings = {
  stageAConcentrationNgPerUl: number;
  stageBConcentrationNgPerUl: number;
  totalTemplatePmol: number;
  mixStrategy: MixStrategy;
  stageMixRatioA: number;
  stageMixRatioB: number;
  primerStockMicromolar: number;
  primerWorkingMicromolar: number;
  workingStockPrepMicroliters: number;
  primerPerReactionMicroliters: number;
  stage1TemplatePerReactionMicroliters: number;
  reactionVolumeMicroliters: number;
  stage1ReactionCountPerProduct: number;
  finalReactionCount: number;
  overfillPercent: number;
  stage1Cycles: number;
  finalCycles: number;
};

export type StageMixEntry = {
  label: string;
  productLengthBp: number;
  concentrationNgPerUl: number;
  targetPmol: number;
  requiredMassNg: number;
  requiredVolumeUl: number;
};

export type PrimerUsageEntry = {
  primerName: string;
  reactionsUsingPrimer: number;
  perReactionVolumeUl: number;
  totalWorkingVolumeUl: number;
};

export type ReactionMixPlan = {
  name: string;
  reactionCount: number;
  overfilledReactionCount: number;
  reactionVolumeUl: number;
  totalMasterMixVolumeUl: number;
  cycleCount: number;
};

export type ReactionRecipeEntry = {
  label: string;
  role:
    | 'master-mix'
    | 'buffer'
    | 'dntp'
    | 'polymerase'
    | 'dmso'
    | 'primer'
    | 'template'
    | 'water';
  perReactionVolumeUl: number;
  totalVolumeUl: number;
  note?: string;
};

export type ReactionRecipe = {
  name: string;
  entries: ReactionRecipeEntry[];
  totalVolumeUl: number;
  volumeOverflowUl: number;
  note?: string;
};

export type ProtocolPlan = {
  stageMixEntries: StageMixEntry[];
  workingStockStockVolumeUl: number;
  workingStockDiluentVolumeUl: number;
  primerUsage: PrimerUsageEntry[];
  reactionMixes: ReactionMixPlan[];
  reactionRecipes: ReactionRecipe[];
};

export function emptyProtocolPlan(): ProtocolPlan {
  return {
    stageMixEntries: [],
    workingStockStockVolumeUl: 0,
    workingStockDiluentVolumeUl: 0,
    primerUsage: [],
    reactionMixes: [],
    reactionRecipes: [],
  };
}

export function defaultProtocolSettings(): ProtocolSettings {
  return {
    stageAConcentrationNgPerUl: 15,
    stageBConcentrationNgPerUl: 15,
    totalTemplatePmol: 0.05,
    mixStrategy: 'equimolar',
    stageMixRatioA: 1,
    stageMixRatioB: 1,
    primerStockMicromolar: 100,
    primerWorkingMicromolar: 10,
    workingStockPrepMicroliters: 100,
    primerPerReactionMicroliters: 1,
    stage1TemplatePerReactionMicroliters: 1,
    reactionVolumeMicroliters: 25,
    stage1ReactionCountPerProduct: 2,
    finalReactionCount: 1,
    overfillPercent: 10,
    stage1Cycles: 28,
    finalCycles: 22,
  };
}

export function normalizeProtocolSettings(
  value: Partial<ProtocolSettings> | undefined,
): ProtocolSettings {
  const defaults = defaultProtocolSettings();
  return {
    stageAConcentrationNgPerUl: Math.max(
      value?.stageAConcentrationNgPerUl ?? defaults.stageAConcentrationNgPerUl,
      0.0001,
    ),
    stageBConcentrationNgPerUl: Math.max(
      value?.stageBConcentrationNgPerUl ?? defaults.stageBConcentrationNgPerUl,
      0.0001,
    ),
    totalTemplatePmol: Math.max(
      value?.totalTemplatePmol ?? defaults.totalTemplatePmol,
      0.000001,
    ),
    mixStrategy: value?.mixStrategy ?? defaults.mixStrategy,
    stageMixRatioA: Math.max(
      value?.stageMixRatioA ?? defaults.stageMixRatioA,
      0.000001,
    ),
    stageMixRatioB: Math.max(
      value?.stageMixRatioB ?? defaults.stageMixRatioB,
      0.000001,
    ),
    primerStockMicromolar: Math.max(
      value?.primerStockMicromolar ?? defaults.primerStockMicromolar,
      0.000001,
    ),
    primerWorkingMicromolar: Math.max(
      value?.primerWorkingMicromolar ?? defaults.primerWorkingMicromolar,
      0.000001,
    ),
    workingStockPrepMicroliters: Math.max(
      value?.workingStockPrepMicroliters ??
        defaults.workingStockPrepMicroliters,
      0.000001,
    ),
    primerPerReactionMicroliters: Math.max(
      value?.primerPerReactionMicroliters ??
        defaults.primerPerReactionMicroliters,
      0.000001,
    ),
    stage1TemplatePerReactionMicroliters: Math.max(
      value?.stage1TemplatePerReactionMicroliters ??
        defaults.stage1TemplatePerReactionMicroliters,
      0.000001,
    ),
    reactionVolumeMicroliters: Math.max(
      value?.reactionVolumeMicroliters ?? defaults.reactionVolumeMicroliters,
      0.000001,
    ),
    stage1ReactionCountPerProduct: Math.max(
      Math.floor(
        value?.stage1ReactionCountPerProduct ??
          defaults.stage1ReactionCountPerProduct,
      ),
      1,
    ),
    finalReactionCount: Math.max(
      Math.floor(value?.finalReactionCount ?? defaults.finalReactionCount),
      1,
    ),
    overfillPercent: Math.max(
      value?.overfillPercent ?? defaults.overfillPercent,
      0,
    ),
    stage1Cycles: Math.max(
      Math.floor(value?.stage1Cycles ?? defaults.stage1Cycles),
      1,
    ),
    finalCycles: Math.max(
      Math.floor(value?.finalCycles ?? defaults.finalCycles),
      1,
    ),
  };
}

export function pmolToMassNg(pmol: number, lengthBp: number): number {
  return (pmol * lengthBp * 660) / 1000;
}

export function massNgToPmol(massNg: number, lengthBp: number): number {
  return (massNg * 1000) / (lengthBp * 660);
}

export function volumeForMass(
  requiredMassNg: number,
  concentrationNgPerUl: number,
): number {
  return requiredMassNg / concentrationNgPerUl;
}

function targetPmolByStrategy(settings: ProtocolSettings): {
  stageA: number;
  stageB: number;
} {
  const ratioA = settings.stageMixRatioA;
  const ratioB = settings.stageMixRatioB;
  const total = settings.totalTemplatePmol;

  if (settings.mixStrategy === 'user-defined') {
    const ratioTotal = ratioA + ratioB;
    return {
      stageA: (total * ratioA) / ratioTotal,
      stageB: (total * ratioB) / ratioTotal,
    };
  }

  if (settings.mixStrategy === 'limiting-a') {
    return {
      stageA: total,
      stageB: total * (ratioB / ratioA),
    };
  }

  if (settings.mixStrategy === 'limiting-b') {
    return {
      stageA: total * (ratioA / ratioB),
      stageB: total,
    };
  }

  return {
    stageA: total / 2,
    stageB: total / 2,
  };
}

type RecipeProfile = {
  id: ProtocolPolymeraseId;
  masterMixLabel?: string;
  masterMixFraction?: number;
  bufferLabel?: string;
  bufferStockX?: number;
  bufferFinalX?: number;
  dntpLabel?: string;
  dntpStockMillimolarTotal?: number;
  polymeraseLabel?: string;
  polymerasePerReactionUl?: number;
};

const RECIPE_PROFILES: Record<ProtocolPolymeraseId, RecipeProfile> = {
  q5: {
    id: 'q5',
    masterMixLabel: '2x Q5 reaction mix',
    masterMixFraction: 0.5,
  },
  phusion_plus: {
    id: 'phusion_plus',
    bufferLabel: '5x Phusion HF buffer',
    bufferStockX: 5,
    bufferFinalX: 1,
    dntpLabel: '10 mM total dNTP mix',
    dntpStockMillimolarTotal: 10,
    polymeraseLabel: 'Phusion polymerase',
    polymerasePerReactionUl: 0.5,
  },
};

function roundVolume(value: number): number {
  return Number(value.toFixed(2));
}

function scaleEntry(
  label: string,
  role: ReactionRecipeEntry['role'],
  perReactionVolumeUl: number,
  overfilledReactionCount: number,
  note?: string,
): ReactionRecipeEntry {
  return {
    label,
    role,
    perReactionVolumeUl: roundVolume(perReactionVolumeUl),
    totalVolumeUl: roundVolume(perReactionVolumeUl * overfilledReactionCount),
    note,
  };
}

function buildReactionRecipe(
  name: ReactionMixPlan['name'],
  settings: ProtocolSettings,
  overfilledReactionCount: number,
  polymeraseId: ProtocolPolymeraseId,
  reactionConditions: { dntpMillimolar: number; dmsoPercent: number },
  templateEntries: Array<{
    label: string;
    perReactionVolumeUl: number;
    note?: string;
  }>,
  primerLabels: string[],
): ReactionRecipe {
  const recipeProfile = RECIPE_PROFILES[polymeraseId];
  const entries: ReactionRecipeEntry[] = [];

  if (recipeProfile.masterMixLabel && recipeProfile.masterMixFraction) {
    entries.push(
      scaleEntry(
        recipeProfile.masterMixLabel,
        'master-mix',
        settings.reactionVolumeMicroliters * recipeProfile.masterMixFraction,
        overfilledReactionCount,
      ),
    );
  } else {
    if (
      recipeProfile.bufferLabel &&
      recipeProfile.bufferStockX &&
      recipeProfile.bufferFinalX
    ) {
      entries.push(
        scaleEntry(
          recipeProfile.bufferLabel,
          'buffer',
          settings.reactionVolumeMicroliters *
            (recipeProfile.bufferFinalX / recipeProfile.bufferStockX),
          overfilledReactionCount,
        ),
      );
    }
    if (recipeProfile.dntpLabel && recipeProfile.dntpStockMillimolarTotal) {
      entries.push(
        scaleEntry(
          recipeProfile.dntpLabel,
          'dntp',
          (settings.reactionVolumeMicroliters *
            reactionConditions.dntpMillimolar) /
            recipeProfile.dntpStockMillimolarTotal,
          overfilledReactionCount,
        ),
      );
    }
    if (
      recipeProfile.polymeraseLabel &&
      recipeProfile.polymerasePerReactionUl
    ) {
      entries.push(
        scaleEntry(
          recipeProfile.polymeraseLabel,
          'polymerase',
          recipeProfile.polymerasePerReactionUl,
          overfilledReactionCount,
        ),
      );
    }
  }

  if (reactionConditions.dmsoPercent > 0) {
    entries.push(
      scaleEntry(
        'DMSO',
        'dmso',
        settings.reactionVolumeMicroliters *
          (reactionConditions.dmsoPercent / 100),
        overfilledReactionCount,
        'Optional additive from thermodynamic settings.',
      ),
    );
  }

  for (const primerLabel of primerLabels) {
    entries.push(
      scaleEntry(
        `${primerLabel} working primer`,
        'primer',
        settings.primerPerReactionMicroliters,
        overfilledReactionCount,
      ),
    );
  }

  for (const templateEntry of templateEntries) {
    entries.push(
      scaleEntry(
        templateEntry.label,
        'template',
        templateEntry.perReactionVolumeUl,
        overfilledReactionCount,
        templateEntry.note,
      ),
    );
  }

  const specifiedPerReaction = entries.reduce(
    (sum, entry) => sum + entry.perReactionVolumeUl,
    0,
  );
  const waterPerReaction = Math.max(
    0,
    settings.reactionVolumeMicroliters - specifiedPerReaction,
  );
  const overflow = Math.max(
    0,
    specifiedPerReaction - settings.reactionVolumeMicroliters,
  );
  entries.push(
    scaleEntry(
      'Nuclease-free water',
      'water',
      waterPerReaction,
      overfilledReactionCount,
    ),
  );

  return {
    name,
    entries,
    totalVolumeUl: roundVolume(
      entries.reduce((sum, entry) => sum + entry.totalVolumeUl, 0),
    ),
    volumeOverflowUl: roundVolume(overflow * overfilledReactionCount),
    note:
      overflow > 0
        ? `Specified per-reaction inputs exceed ${settings.reactionVolumeMicroliters} uL by ${overflow.toFixed(2)} uL; reduce template, primer, or additive volumes.`
        : undefined,
  };
}

export function buildProtocolPlan(
  settingsInput: Partial<ProtocolSettings> | undefined,
  lengths: {
    stageAProductLength: number;
    stageBProductLength: number;
    finalProductLength: number;
  },
  primerNames: string[],
  polymeraseId: ProtocolPolymeraseId,
  reactionConditions: {
    dntpMillimolar: number;
    dmsoPercent: number;
  },
): ProtocolPlan {
  const settings = normalizeProtocolSettings(settingsInput);
  if (
    lengths.stageAProductLength <= 0 ||
    lengths.stageBProductLength <= 0 ||
    lengths.finalProductLength <= 0 ||
    primerNames.length < 4
  ) {
    return emptyProtocolPlan();
  }

  const overfillFactor = 1 + settings.overfillPercent / 100;
  const fusionOverfilledReactionCount = Number(
    (settings.finalReactionCount * overfillFactor).toFixed(2),
  );
  const target = targetPmolByStrategy(settings);
  const stageMixEntries: StageMixEntry[] = [
    {
      label: 'PCR 1A product',
      productLengthBp: lengths.stageAProductLength,
      concentrationNgPerUl: settings.stageAConcentrationNgPerUl,
      targetPmol: target.stageA * fusionOverfilledReactionCount,
      requiredMassNg: pmolToMassNg(
        target.stageA * fusionOverfilledReactionCount,
        lengths.stageAProductLength,
      ),
      requiredVolumeUl: volumeForMass(
        pmolToMassNg(
          target.stageA * fusionOverfilledReactionCount,
          lengths.stageAProductLength,
        ),
        settings.stageAConcentrationNgPerUl,
      ),
    },
    {
      label: 'PCR 1B product',
      productLengthBp: lengths.stageBProductLength,
      concentrationNgPerUl: settings.stageBConcentrationNgPerUl,
      targetPmol: target.stageB * fusionOverfilledReactionCount,
      requiredMassNg: pmolToMassNg(
        target.stageB * fusionOverfilledReactionCount,
        lengths.stageBProductLength,
      ),
      requiredVolumeUl: volumeForMass(
        pmolToMassNg(
          target.stageB * fusionOverfilledReactionCount,
          lengths.stageBProductLength,
        ),
        settings.stageBConcentrationNgPerUl,
      ),
    },
  ].map((entry) => ({
    ...entry,
    requiredMassNg: Number(entry.requiredMassNg.toFixed(2)),
    requiredVolumeUl: Number(entry.requiredVolumeUl.toFixed(2)),
  }));

  const workingStockStockVolumeUl =
    (settings.primerWorkingMicromolar * settings.workingStockPrepMicroliters) /
    settings.primerStockMicromolar;
  const workingStockDiluentVolumeUl =
    settings.workingStockPrepMicroliters - workingStockStockVolumeUl;
  const outerPrimerReactionCount =
    settings.stage1ReactionCountPerProduct + settings.finalReactionCount;
  const innerPrimerReactionCount = settings.stage1ReactionCountPerProduct;
  const primerUsage = primerNames.map((primerName) => {
    const reactionsUsingPrimer =
      primerName === 'A_outer_F' || primerName === 'B_outer_R'
        ? outerPrimerReactionCount
        : innerPrimerReactionCount;
    return {
      primerName,
      reactionsUsingPrimer,
      perReactionVolumeUl: settings.primerPerReactionMicroliters,
      totalWorkingVolumeUl: Number(
        (
          settings.primerPerReactionMicroliters *
          reactionsUsingPrimer *
          overfillFactor
        ).toFixed(2),
      ),
    };
  });

  const reactionMixes: ReactionMixPlan[] = [
    {
      name: 'PCR 1A',
      reactionCount: settings.stage1ReactionCountPerProduct,
      overfilledReactionCount: Number(
        (settings.stage1ReactionCountPerProduct * overfillFactor).toFixed(2),
      ),
      reactionVolumeUl: settings.reactionVolumeMicroliters,
      totalMasterMixVolumeUl: Number(
        (
          settings.reactionVolumeMicroliters *
          settings.stage1ReactionCountPerProduct *
          overfillFactor
        ).toFixed(2),
      ),
      cycleCount: settings.stage1Cycles,
    },
    {
      name: 'PCR 1B',
      reactionCount: settings.stage1ReactionCountPerProduct,
      overfilledReactionCount: Number(
        (settings.stage1ReactionCountPerProduct * overfillFactor).toFixed(2),
      ),
      reactionVolumeUl: settings.reactionVolumeMicroliters,
      totalMasterMixVolumeUl: Number(
        (
          settings.reactionVolumeMicroliters *
          settings.stage1ReactionCountPerProduct *
          overfillFactor
        ).toFixed(2),
      ),
      cycleCount: settings.stage1Cycles,
    },
    {
      name: 'Fusion PCR',
      reactionCount: settings.finalReactionCount,
      overfilledReactionCount: Number(
        (settings.finalReactionCount * overfillFactor).toFixed(2),
      ),
      reactionVolumeUl: settings.reactionVolumeMicroliters,
      totalMasterMixVolumeUl: Number(
        (
          settings.reactionVolumeMicroliters *
          settings.finalReactionCount *
          overfillFactor
        ).toFixed(2),
      ),
      cycleCount: settings.finalCycles,
    },
  ];

  const stage1Overfilled = reactionMixes[0].overfilledReactionCount;
  const fusionOverfilled = reactionMixes[2].overfilledReactionCount;
  const reactionRecipes: ReactionRecipe[] = [
    buildReactionRecipe(
      'PCR 1A',
      settings,
      stage1Overfilled,
      polymeraseId,
      reactionConditions,
      [
        {
          label: 'Fragment A source template',
          perReactionVolumeUl: settings.stage1TemplatePerReactionMicroliters,
        },
      ],
      ['A_outer_F', 'A_inner_R'],
    ),
    buildReactionRecipe(
      'PCR 1B',
      settings,
      stage1Overfilled,
      polymeraseId,
      reactionConditions,
      [
        {
          label: 'Fragment B source template',
          perReactionVolumeUl: settings.stage1TemplatePerReactionMicroliters,
        },
      ],
      ['B_inner_F', 'B_outer_R'],
    ),
    buildReactionRecipe(
      'Fusion PCR',
      settings,
      fusionOverfilled,
      polymeraseId,
      reactionConditions,
      [
        {
          label: 'PCR 1A product template',
          perReactionVolumeUl:
            stageMixEntries[0].requiredVolumeUl / Math.max(fusionOverfilled, 1),
          note: `${stageMixEntries[0].targetPmol.toFixed(3)} pmol target across the fusion setup.`,
        },
        {
          label: 'PCR 1B product template',
          perReactionVolumeUl:
            stageMixEntries[1].requiredVolumeUl / Math.max(fusionOverfilled, 1),
          note: `${stageMixEntries[1].targetPmol.toFixed(3)} pmol target across the fusion setup.`,
        },
      ],
      ['A_outer_F', 'B_outer_R'],
    ),
  ];

  return {
    stageMixEntries,
    workingStockStockVolumeUl: roundVolume(workingStockStockVolumeUl),
    workingStockDiluentVolumeUl: roundVolume(workingStockDiluentVolumeUl),
    primerUsage,
    reactionMixes,
    reactionRecipes,
  };
}
