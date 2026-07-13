export * from './fusion-model';
import { evaluateOverlapCriteria, type OverlapAssessment } from './overlap';
import {
  analyzePrimer,
  calculateGcPercentage,
  calculateWallaceTm,
  findInvalidBases,
  normalizeSequence,
  reverseComplement,
} from './pcr';
import {
  buildProtocolPlan,
  emptyProtocolPlan,
  type ProtocolPlan,
} from './protocol';
import {
  findPrimerSpecificitySites,
  predictOffTargetAmplicons,
  type OffTargetAmplicon,
  type PrimerDirection,
  type SpecificityTemplate,
} from './specificity';
import { analyzeHeterodimer, analyzePrimerStructure } from './structure';
import {
  calculateNearestNeighborTm,
  type ThermodynamicConditions,
  type ThermodynamicResult,
} from './thermodynamics';
import {
  codonsForAminoAcid,
  synonymousCodonsForCodon,
  translateSequence,
} from './translation';
import {
  ENGINE_VERSION,
  MAX_BODY_LENGTH,
  MIN_BODY_LENGTH,
  PROJECT_SCHEMA_VERSION,
  polymeraseProfiles,
  normalizeChangeApprovals,
  normalizeEditorLocks,
  normalizeProtocolConfig,
  normalizeReactionConditions,
  resolveAnnealingTemperature,
  type AlternativeDesign,
  type CodingIntent,
  type DesignQualityBreakdown,
  type FusionDesign,
  type FusionProjectInput,
  type PolymeraseProfile,
  type PrimerDesign,
  type PrimerPairInteraction,
  type ReactionPlan,
  type ReviewItem,
  type SequenceChangeProposal,
  type SynonymousOptimization,
  type SynonymousOptimizationChange,
} from './fusion-model';
import {
  removeFirstInFrameStartCodon,
  replaceLastInFrameCodon,
  validateProteinFusion,
} from './fusion-protein';
import {
  getNonIntendedSpecificitySites,
  primerPairSharesReaction,
} from './primer-review';
import {
  clampRange,
  isFiniteThermodynamicResult,
  longestHomopolymerRun,
  selectRange,
} from './fusion-sequence';
import {
  createReviewItem,
  deduplicateReviewItems,
  sortReviewItems,
  summarizeReviewItem,
} from './review-items';

type CandidateBody = {
  templateSequence: string;
  primerSequence: string;
  score: number;
  bodyTm: number;
  bodyGcPercentage: number;
  bodyLength: number;
  thermodynamics: ThermodynamicResult;
};

type CandidateCombination = {
  outerForward: CandidateBody;
  innerReverse: CandidateBody;
  innerForward: CandidateBody;
  outerReverse: CandidateBody;
  roughScore: number;
};

type DesignVariant = {
  id: string;
  overlapSequence: string;
  overlapTm: number;
  overlapAssessment: OverlapAssessment;
  stageAProduct: string;
  stageBProduct: string;
  finalProduct: string;
  finalProductVerified: boolean;
  primers: PrimerDesign[];
  reactions: ReactionPlan[];
  specificityTemplates: SpecificityTemplate[];
  intendedAmplicons: OffTargetAmplicon[];
  offTargetAmplicons: OffTargetAmplicon[];
  primerPairInteractions: PrimerPairInteraction[];
  protocolPlan: ProtocolPlan;
  qualityScore: number;
  qualityBreakdown: DesignQualityBreakdown;
  reviewItems: ReviewItem[];
  warnings: string[];
  totalOligoLength: number;
  worstNonIntendedDimerDeltaG: number | null;
  highRiskOffTargets: number;
};

type SynonymousWindow = {
  fragment: 'fragment-a' | 'fragment-b';
  sequence: string;
  frame: 0 | 1 | 2;
  originalCodons: string[];
  aminoAcids: string[];
  codonIndices: number[];
  prefix: string;
  suffix: string;
};

function chooseBodyCandidate(
  templateSequenceInput: string,
  location: 'start' | 'end',
  primerDirection: 'forward' | 'reverse',
  profile: Pick<
    PolymeraseProfile,
    'targetBodyTm' | 'minBodyLength' | 'maxBodyLength'
  >,
  reactionConditions: ThermodynamicConditions,
): CandidateBody | undefined {
  return enumerateBodyCandidates(
    templateSequenceInput,
    location,
    primerDirection,
    profile,
    reactionConditions,
    1,
  )[0];
}

function enumerateBodyCandidates(
  templateSequenceInput: string,
  location: 'start' | 'end',
  primerDirection: 'forward' | 'reverse',
  profile: Pick<
    PolymeraseProfile,
    'targetBodyTm' | 'minBodyLength' | 'maxBodyLength'
  >,
  reactionConditions: ThermodynamicConditions,
  limit = 4,
): CandidateBody[] {
  const templateSequence = normalizeSequence(templateSequenceInput);
  const maxLength = Math.min(
    profile.maxBodyLength,
    MAX_BODY_LENGTH,
    templateSequence.length,
  );
  const minLength = Math.max(profile.minBodyLength, MIN_BODY_LENGTH);
  const candidates: CandidateBody[] = [];

  if (templateSequence.length < minLength || maxLength < minLength) {
    return [];
  }

  for (let bodyLength = minLength; bodyLength <= maxLength; bodyLength += 1) {
    const bodyTemplateSequence =
      location === 'start'
        ? templateSequence.slice(0, bodyLength)
        : templateSequence.slice(templateSequence.length - bodyLength);
    const primerSequence =
      primerDirection === 'forward'
        ? bodyTemplateSequence
        : reverseComplement(bodyTemplateSequence);
    const bodyMetrics = analyzePrimer(primerSequence);
    const thermodynamics = calculateNearestNeighborTm(
      primerSequence,
      reactionConditions,
    );
    if (!isFiniteThermodynamicResult(thermodynamics)) {
      continue;
    }
    const gcPenalty =
      bodyMetrics.gcPercentage < 40
        ? 40 - bodyMetrics.gcPercentage
        : bodyMetrics.gcPercentage > 60
          ? bodyMetrics.gcPercentage - 60
          : 0;
    const clampPenalty = /[GC]$/.test(primerSequence) ? 0 : 1.5;
    const homopolymerPenalty =
      Math.max(0, longestHomopolymerRun(primerSequence) - 4) * 1.25;
    const preferredLengthPenalty =
      bodyLength < profile.minBodyLength
        ? (profile.minBodyLength - bodyLength) * 0.6
        : bodyLength > Math.min(profile.maxBodyLength, 24)
          ? (bodyLength - Math.min(profile.maxBodyLength, 24)) * 0.2
          : 0;
    const score =
      Math.abs(thermodynamics.correctedTmCelsius - profile.targetBodyTm) +
      gcPenalty * 0.35 +
      clampPenalty +
      homopolymerPenalty +
      preferredLengthPenalty;

    candidates.push({
      templateSequence: bodyTemplateSequence,
      primerSequence,
      score,
      bodyTm: thermodynamics.correctedTmCelsius,
      bodyGcPercentage: bodyMetrics.gcPercentage,
      bodyLength,
      thermodynamics,
    });
  }

  return candidates
    .sort((left, right) => left.score - right.score)
    .slice(0, Math.max(1, limit));
}

function buildSynonymousWindow(
  fragment: 'fragment-a' | 'fragment-b',
  sequenceInput: string,
  frame: 0 | 1 | 2,
  flexibleCodons: number,
  edge: 'start' | 'end',
): SynonymousWindow | null {
  const sequence = normalizeSequence(sequenceInput);
  const translation = translateSequence(sequence, frame);
  const windowCodons = Math.min(
    Math.max(0, Math.floor(flexibleCodons)),
    translation.codons.length,
  );

  if (!windowCodons) {
    return null;
  }

  const startCodonIndex =
    edge === 'end' ? translation.codons.length - windowCodons : 0;
  const originalCodons = translation.codons.slice(
    startCodonIndex,
    startCodonIndex + windowCodons,
  );
  const aminoAcids = translation.aminoAcids
    .slice(startCodonIndex, startCodonIndex + windowCodons)
    .split('');
  const prefixEnd = frame + startCodonIndex * 3;
  const suffixStart = prefixEnd + windowCodons * 3;

  return {
    fragment,
    sequence,
    frame,
    originalCodons,
    aminoAcids,
    codonIndices: originalCodons.map((_, index) => startCodonIndex + index),
    prefix: sequence.slice(0, prefixEnd),
    suffix: sequence.slice(suffixStart),
  };
}

function applyWindowCodons(
  window: SynonymousWindow | null,
  codons: string[] | null,
): string {
  if (!window || !codons) {
    return window?.sequence ?? '';
  }
  return `${window.prefix}${codons.join('')}${window.suffix}`;
}

function scoreSynonymousJunction(
  selectedA: string,
  selectedB: string,
  insertSequence: string,
  profile: PolymeraseProfile,
  reactionConditions: ThermodynamicConditions,
): number {
  const innerReverseBody = chooseBodyCandidate(
    selectedA,
    'end',
    'reverse',
    profile,
    reactionConditions,
  );
  const innerForwardBody = chooseBodyCandidate(
    selectedB,
    'start',
    'forward',
    profile,
    reactionConditions,
  );
  if (!innerReverseBody || !innerForwardBody) {
    return Number.POSITIVE_INFINITY;
  }
  const overlapSequence = `${innerReverseBody.templateSequence}${insertSequence}${innerForwardBody.templateSequence}`;
  const overlapTm = calculateNearestNeighborTm(
    overlapSequence,
    reactionConditions,
  ).correctedTmCelsius;
  const overlapAssessment = evaluateOverlapCriteria(overlapSequence, overlapTm);

  return (
    innerReverseBody.score +
    innerForwardBody.score +
    Math.abs(innerReverseBody.bodyTm - innerForwardBody.bodyTm) * 0.6 +
    (1 - overlapAssessment.score) * 8
  );
}

function optimizeSynonymousJunction(
  selectedAInput: string,
  selectedBInput: string,
  insertSequenceInput: string,
  coding: CodingIntent,
  profile: PolymeraseProfile,
  reactionConditions: ThermodynamicConditions,
): SynonymousOptimization | null {
  if (!coding.preserveProtein || coding.flexibleCodons <= 0) {
    return null;
  }

  const selectedA = normalizeSequence(selectedAInput);
  const selectedB = normalizeSequence(selectedBInput);
  const insertSequence = normalizeSequence(insertSequenceInput);
  const upstreamWindow = buildSynonymousWindow(
    'fragment-a',
    selectedA,
    coding.upstreamFrame,
    coding.flexibleCodons,
    'end',
  );
  const downstreamWindow = buildSynonymousWindow(
    'fragment-b',
    selectedB,
    coding.downstreamFrame,
    coding.flexibleCodons,
    'start',
  );

  if (!upstreamWindow && !downstreamWindow) {
    return {
      enabled: true,
      applied: false,
      changed: false,
      windowCodons: Math.max(0, Math.floor(coding.flexibleCodons)),
      optimizedSelectedA: selectedA,
      optimizedSelectedB: selectedB,
      scoreDelta: 0,
      changes: [],
      summary:
        'Synonymous optimization was enabled, but there were no in-frame codons available near the junction.',
    };
  }

  const beamWidth = 24;
  const baseUpstreamCodons = upstreamWindow?.originalCodons.slice() ?? [];
  const baseDownstreamCodons = downstreamWindow?.originalCodons.slice() ?? [];
  const evaluateCandidate = (
    upstreamCodons: string[],
    downstreamCodons: string[],
  ) => {
    const optimizedSelectedA = upstreamWindow
      ? applyWindowCodons(upstreamWindow, upstreamCodons)
      : selectedA;
    const optimizedSelectedB = downstreamWindow
      ? applyWindowCodons(downstreamWindow, downstreamCodons)
      : selectedB;
    return {
      upstreamCodons,
      downstreamCodons,
      optimizedSelectedA,
      optimizedSelectedB,
      score: scoreSynonymousJunction(
        optimizedSelectedA,
        optimizedSelectedB,
        insertSequence,
        profile,
        reactionConditions,
      ),
    };
  };

  const baseline = evaluateCandidate(baseUpstreamCodons, baseDownstreamCodons);
  let beam = [baseline];
  const positions = [
    ...(upstreamWindow
      ? upstreamWindow.originalCodons.map((codon, index) => ({
          fragment: 'fragment-a' as const,
          index,
          options:
            upstreamWindow.aminoAcids[index] === '*' ||
            !codonsForAminoAcid(upstreamWindow.aminoAcids[index]).length
              ? [codon]
              : synonymousCodonsForCodon(codon),
        }))
      : []),
    ...(downstreamWindow
      ? downstreamWindow.originalCodons.map((codon, index) => ({
          fragment: 'fragment-b' as const,
          index,
          options:
            downstreamWindow.aminoAcids[index] === '*' ||
            !codonsForAminoAcid(downstreamWindow.aminoAcids[index]).length
              ? [codon]
              : synonymousCodonsForCodon(codon),
        }))
      : []),
  ];

  for (const position of positions) {
    const expanded = beam.flatMap((candidate) =>
      position.options.map((option) => {
        const upstreamCodons = candidate.upstreamCodons.slice();
        const downstreamCodons = candidate.downstreamCodons.slice();

        if (position.fragment === 'fragment-a') {
          upstreamCodons[position.index] = option;
        } else {
          downstreamCodons[position.index] = option;
        }

        return evaluateCandidate(upstreamCodons, downstreamCodons);
      }),
    );

    const uniqueCandidates = new Map<string, (typeof expanded)[number]>();
    for (const candidate of expanded.sort(
      (left, right) => left.score - right.score,
    )) {
      const key = `${candidate.optimizedSelectedA}|${candidate.optimizedSelectedB}`;
      if (!uniqueCandidates.has(key)) {
        uniqueCandidates.set(key, candidate);
      }
      if (uniqueCandidates.size >= beamWidth) {
        break;
      }
    }
    beam = Array.from(uniqueCandidates.values());
  }

  const best =
    beam.sort((left, right) => left.score - right.score)[0] ?? baseline;
  const changed =
    (best.optimizedSelectedA !== baseline.optimizedSelectedA ||
      best.optimizedSelectedB !== baseline.optimizedSelectedB) &&
    best.score < baseline.score - 0.25;
  const optimizedSelectedA = changed
    ? best.optimizedSelectedA
    : baseline.optimizedSelectedA;
  const optimizedSelectedB = changed
    ? best.optimizedSelectedB
    : baseline.optimizedSelectedB;
  const selectedUpstreamCodons = changed
    ? best.upstreamCodons
    : baseline.upstreamCodons;
  const selectedDownstreamCodons = changed
    ? best.downstreamCodons
    : baseline.downstreamCodons;
  const changes: SynonymousOptimizationChange[] = [];

  if (upstreamWindow) {
    upstreamWindow.originalCodons.forEach((codon, index) => {
      const replacement = selectedUpstreamCodons[index];
      if (replacement !== codon) {
        changes.push({
          id: `fragment-a:${upstreamWindow.codonIndices[index]}:${codon}:${replacement}`,
          fragment: 'fragment-a',
          codonIndex: upstreamWindow.codonIndices[index],
          aminoAcid: upstreamWindow.aminoAcids[index],
          start:
            upstreamWindow.frame + upstreamWindow.codonIndices[index] * 3 + 1,
          from: codon,
          to: replacement,
          accepted: false,
        });
      }
    });
  }

  if (downstreamWindow) {
    downstreamWindow.originalCodons.forEach((codon, index) => {
      const replacement = selectedDownstreamCodons[index];
      if (replacement !== codon) {
        changes.push({
          id: `fragment-b:${downstreamWindow.codonIndices[index]}:${codon}:${replacement}`,
          fragment: 'fragment-b',
          codonIndex: downstreamWindow.codonIndices[index],
          aminoAcid: downstreamWindow.aminoAcids[index],
          start:
            downstreamWindow.frame +
            downstreamWindow.codonIndices[index] * 3 +
            1,
          from: codon,
          to: replacement,
          accepted: false,
        });
      }
    });
  }

  return {
    enabled: true,
    applied: changed,
    changed,
    windowCodons: Math.max(0, Math.floor(coding.flexibleCodons)),
    optimizedSelectedA,
    optimizedSelectedB,
    scoreDelta: Number(
      (baseline.score - (changed ? best.score : baseline.score)).toFixed(2),
    ),
    changes,
    summary: changed
      ? `Proposed ${changes.length} synonymous codon change(s) within ${Math.max(0, Math.floor(coding.flexibleCodons))} codon(s) of the junction to improve the inner-primer design window while preserving the encoded protein.`
      : 'Synonymous optimization evaluated the junction window but kept the original codons.',
  };
}

function applyAcceptedSynonymousChanges(
  selectedAInput: string,
  selectedBInput: string,
  changes: SynonymousOptimizationChange[],
  acceptedIds: string[],
): { selectedA: string; selectedB: string; appliedIds: string[] } {
  let selectedA = normalizeSequence(selectedAInput);
  let selectedB = normalizeSequence(selectedBInput);
  const approved = new Set(acceptedIds);
  const appliedIds: string[] = [];

  for (const change of changes) {
    if (!approved.has(change.id)) {
      continue;
    }

    const sequence = change.fragment === 'fragment-a' ? selectedA : selectedB;
    const startIndex = change.start - 1;
    if (
      sequence.slice(startIndex, startIndex + change.from.length) !==
      change.from
    ) {
      continue;
    }

    const updated = `${sequence.slice(0, startIndex)}${change.to}${sequence.slice(startIndex + change.from.length)}`;
    if (change.fragment === 'fragment-a') {
      selectedA = updated;
    } else {
      selectedB = updated;
    }
    appliedIds.push(change.id);
  }

  return {
    selectedA,
    selectedB,
    appliedIds,
  };
}

function createPrimerDesign(
  name: string,
  direction: PrimerDirection,
  expectedTemplateId: string,
  role: string,
  tail: string,
  body: CandidateBody,
  reaction: PrimerDesign['reaction'],
  reactionConditions: ThermodynamicConditions,
  overlapTm: number | null,
): PrimerDesign {
  const sequence = `${tail}${body.primerSequence}`;
  const fullOligoThermodynamics = calculateNearestNeighborTm(
    sequence,
    reactionConditions,
  );
  if (
    !isFiniteThermodynamicResult(body.thermodynamics) ||
    !isFiniteThermodynamicResult(fullOligoThermodynamics)
  ) {
    throw new Error(`Non-finite thermodynamic result encountered for ${name}.`);
  }
  const structure = analyzePrimerStructure(sequence, reactionConditions);
  return {
    name,
    direction,
    expectedTemplateId,
    role,
    tail,
    body: body.primerSequence,
    bodyTemplateSequence: body.templateSequence,
    sequence,
    fullLength: sequence.length,
    bodyLength: body.bodyLength,
    bodyTm: body.bodyTm,
    fullOligoTm: fullOligoThermodynamics.correctedTmCelsius,
    overlapTm,
    bodyGcPercentage: body.bodyGcPercentage,
    structure,
    bodyThermodynamics: body.thermodynamics,
    fullOligoThermodynamics,
    reaction,
    specificitySites: [],
  };
}

function mergeProducts(
  stageAProduct: string,
  stageBProduct: string,
  overlapSequence: string,
): string {
  if (
    stageAProduct.endsWith(overlapSequence) &&
    stageBProduct.startsWith(overlapSequence)
  ) {
    return `${stageAProduct}${stageBProduct.slice(overlapSequence.length)}`;
  }

  return `${stageAProduct}${stageBProduct}`;
}

function buildReactionPlan(
  name: ReactionPlan['name'],
  primerA: PrimerDesign,
  primerB: PrimerDesign,
  productLength: number,
  profile: PolymeraseProfile,
): ReactionPlan {
  const lowerTm = Math.min(primerA.bodyTm, primerB.bodyTm);
  const higherTm = Math.max(primerA.bodyTm, primerB.bodyTm);
  const annealingTemperature = resolveAnnealingTemperature(profile, lowerTm);
  const extensionSeconds = Math.max(
    profile.minExtensionSeconds,
    Math.ceil((productLength / 1000) * profile.secondsPerKb),
  );
  const tmSpread = Math.abs(higherTm - lowerTm);

  return {
    name,
    primerNames: [primerA.name, primerB.name],
    productLength,
    annealingTemperature,
    extensionSeconds,
    gradientRecommendation:
      tmSpread >= 3
        ? `${annealingTemperature - profile.gradientSpan}-${annealingTemperature + profile.gradientSpan} C`
        : undefined,
  };
}

function buildSpecificityTemplates(
  project: FusionProjectInput,
  stageAProduct: string,
  stageBProduct: string,
  finalProduct: string,
): SpecificityTemplate[] {
  const fragmentASequence = normalizeSequence(project.fragmentA.sequence);
  const fragmentBSequence = normalizeSequence(project.fragmentB.sequence);
  const templates: SpecificityTemplate[] = [
    {
      id: 'fragment-a',
      name: project.fragmentA.label,
      sequence: fragmentASequence,
      kind: 'imported',
    },
    {
      id: 'fragment-a-rc',
      name: `${project.fragmentA.label} (rev comp)`,
      sequence: reverseComplement(fragmentASequence),
      kind: 'reverse-complement',
    },
    {
      id: 'fragment-b',
      name: project.fragmentB.label,
      sequence: fragmentBSequence,
      kind: 'imported',
    },
    {
      id: 'fragment-b-rc',
      name: `${project.fragmentB.label} (rev comp)`,
      sequence: reverseComplement(fragmentBSequence),
      kind: 'reverse-complement',
    },
    {
      id: 'stage-a',
      name: 'PCR 1A product',
      sequence: stageAProduct,
      kind: 'stage-product',
    },
    {
      id: 'stage-b',
      name: 'PCR 1B product',
      sequence: stageBProduct,
      kind: 'stage-product',
    },
    {
      id: 'final-product',
      name: 'Final fusion product',
      sequence: finalProduct,
      kind: 'final-product',
    },
  ];
  return templates.filter((template) => template.sequence.length > 0);
}

function finalizeReviewItems(reviewItems: ReviewItem[]): ReviewItem[] {
  return sortReviewItems(deduplicateReviewItems(reviewItems));
}

function deriveLegacyReviewLists(reviewItems: ReviewItem[]): {
  issues: string[];
  warnings: string[];
} {
  return {
    issues: reviewItems
      .filter((item) => item.severity === 'blocking')
      .map(summarizeReviewItem),
    warnings: reviewItems
      .filter(
        (item) => item.severity === 'warning' || item.severity === 'review',
      )
      .map(summarizeReviewItem),
  };
}

function clampQuality(value: number): number {
  return Math.max(0.05, Math.min(1, value));
}

function weightedGeometricMean(
  components: Array<{ value: number; weight: number }>,
): number {
  const totalWeight = components.reduce(
    (sum, component) => sum + component.weight,
    0,
  );
  if (!totalWeight) {
    return 0;
  }
  const logMean = components.reduce(
    (sum, component) =>
      sum +
      (component.weight / totalWeight) *
        Math.log(clampQuality(component.value)),
    0,
  );
  return Math.exp(logMean);
}

function classifyAmplicons(
  specificityTemplates: SpecificityTemplate[],
  primers: PrimerDesign[],
  expectedLengths: {
    selectedALength: number;
    selectedBLength: number;
    finalProductLength: number;
  },
): {
  intendedAmplicons: OffTargetAmplicon[];
  unintendedAmplicons: OffTargetAmplicon[];
} {
  const allAmplicons = [
    ...specificityTemplates.flatMap((template) =>
      predictOffTargetAmplicons(
        template,
        primers[0].name,
        primers[0].specificitySites,
        primers[1].name,
        primers[1].specificitySites,
      ),
    ),
    ...specificityTemplates.flatMap((template) =>
      predictOffTargetAmplicons(
        template,
        primers[2].name,
        primers[2].specificitySites,
        primers[3].name,
        primers[3].specificitySites,
      ),
    ),
    ...specificityTemplates.flatMap((template) =>
      predictOffTargetAmplicons(
        template,
        primers[0].name,
        primers[0].specificitySites,
        primers[3].name,
        primers[3].specificitySites,
      ),
    ),
  ];

  const intendedAmplicons = allAmplicons.filter((amplicon) => {
    if (
      amplicon.forwardPrimerName === 'A_outer_F' &&
      amplicon.reversePrimerName === 'A_inner_R'
    ) {
      return (
        amplicon.templateId === 'fragment-a' &&
        amplicon.length === expectedLengths.selectedALength
      );
    }
    if (
      amplicon.forwardPrimerName === 'B_inner_F' &&
      amplicon.reversePrimerName === 'B_outer_R'
    ) {
      return (
        amplicon.templateId === 'fragment-b' &&
        amplicon.length === expectedLengths.selectedBLength
      );
    }
    if (
      amplicon.forwardPrimerName === 'A_outer_F' &&
      amplicon.reversePrimerName === 'B_outer_R'
    ) {
      return (
        amplicon.templateId === 'final-product' &&
        amplicon.length === expectedLengths.finalProductLength
      );
    }
    return false;
  });

  const intendedKeys = new Set(
    intendedAmplicons.map(
      (amplicon) =>
        `${amplicon.templateId}:${amplicon.forwardPrimerName}:${amplicon.reversePrimerName}:${amplicon.start}:${amplicon.end}:${amplicon.length}`,
    ),
  );

  return {
    intendedAmplicons,
    unintendedAmplicons: allAmplicons.filter(
      (amplicon) =>
        !intendedKeys.has(
          `${amplicon.templateId}:${amplicon.forwardPrimerName}:${amplicon.reversePrimerName}:${amplicon.start}:${amplicon.end}:${amplicon.length}`,
        ),
    ),
  };
}

function scoreDesignVariant(
  profile: PolymeraseProfile,
  primers: PrimerDesign[],
  offTargetAmplicons: OffTargetAmplicon[],
  primerPairInteractions: PrimerPairInteraction[],
  overlapAssessment: OverlapAssessment,
): {
  qualityScore: number;
  qualityBreakdown: DesignQualityBreakdown;
  totalOligoLength: number;
  worstNonIntendedDimerDeltaG: number | null;
  highRiskOffTargets: number;
} {
  const innerTmSpread = Math.abs(primers[1].bodyTm - primers[2].bodyTm);
  const averageBodyScore =
    primers.reduce((sum, primer) => {
      const tmPenalty = Math.abs(primer.bodyTm - profile.targetBodyTm);
      const gcPenalty =
        primer.bodyGcPercentage < 40
          ? 40 - primer.bodyGcPercentage
          : primer.bodyGcPercentage > 60
            ? primer.bodyGcPercentage - 60
            : 0;
      return sum + tmPenalty + gcPenalty * 0.2;
    }, 0) / Math.max(primers.length, 1);
  const highRiskOffTargets = offTargetAmplicons.filter(
    (amplicon) => amplicon.risk === 'high',
  ).length;
  const watchOffTargets = offTargetAmplicons.filter(
    (amplicon) => amplicon.risk === 'watch',
  ).length;
  const nonIntendedInteractions = primerPairInteractions.filter(
    (pair) => !pair.intended && pair.interaction,
  );
  const highRiskInteractions = nonIntendedInteractions.filter(
    (pair) => pair.interaction?.risk === 'High',
  ).length;
  const watchRiskInteractions = nonIntendedInteractions.filter(
    (pair) => pair.interaction?.risk === 'Watch',
  ).length;
  const worstNonIntendedDimerDeltaG = nonIntendedInteractions.length
    ? Math.min(
        ...nonIntendedInteractions.map((pair) => pair.interaction?.deltaG ?? 0),
      )
    : null;
  const totalOligoLength = primers.reduce(
    (sum, primer) => sum + primer.fullLength,
    0,
  );
  const maxPrimerLength = Math.max(
    ...primers.map((primer) => primer.fullLength),
  );

  const tmBalance = clampQuality(1 - innerTmSpread / 8);
  const bodyFit = clampQuality(1 - averageBodyScore / 12);
  const overlap = clampQuality(overlapAssessment.score);
  const structure = clampQuality(
    1 / (1 + highRiskInteractions * 1.2 + watchRiskInteractions * 0.35),
  );
  const specificity = clampQuality(
    1 / (1 + highRiskOffTargets * 1.5 + watchOffTargets * 0.3),
  );
  const synthesis = clampQuality(
    1 -
      Math.max(0, maxPrimerLength - 45) / 30 -
      Math.max(0, totalOligoLength - 140) / 180,
  );
  const total = weightedGeometricMean([
    { value: tmBalance, weight: 0.18 },
    { value: bodyFit, weight: 0.18 },
    { value: overlap, weight: 0.16 },
    { value: structure, weight: 0.18 },
    { value: specificity, weight: 0.18 },
    { value: synthesis, weight: 0.12 },
  ]);

  return {
    qualityScore: Number(total.toFixed(4)),
    qualityBreakdown: {
      tmBalance: Number(tmBalance.toFixed(4)),
      bodyFit: Number(bodyFit.toFixed(4)),
      overlap: Number(overlap.toFixed(4)),
      structure: Number(structure.toFixed(4)),
      specificity: Number(specificity.toFixed(4)),
      synthesis: Number(synthesis.toFixed(4)),
      total: Number(total.toFixed(4)),
    },
    totalOligoLength,
    worstNonIntendedDimerDeltaG:
      worstNonIntendedDimerDeltaG !== null
        ? Number(worstNonIntendedDimerDeltaG.toFixed(2))
        : null,
    highRiskOffTargets,
  };
}

function buildDesignVariant(
  normalizedProject: FusionProjectInput,
  profile: PolymeraseProfile,
  effectiveSelectedA: string,
  effectiveSelectedB: string,
  insertSequence: string,
  bodies: Omit<CandidateCombination, 'roughScore'>,
): DesignVariant {
  const overlapSequence = `${bodies.innerReverse.templateSequence}${insertSequence}${bodies.innerForward.templateSequence}`;
  const overlapThermodynamics = calculateNearestNeighborTm(
    overlapSequence,
    normalizedProject.reactionConditions,
  );
  const overlapTm = overlapThermodynamics.correctedTmCelsius;
  if (!isFiniteThermodynamicResult(overlapThermodynamics)) {
    throw new Error(
      'Non-finite overlap thermodynamics encountered while constructing a design variant.',
    );
  }
  const overlapAssessment = evaluateOverlapCriteria(overlapSequence, overlapTm);
  const stageAProduct = `${effectiveSelectedA}${insertSequence}${bodies.innerForward.templateSequence}`;
  const stageBProduct = `${bodies.innerReverse.templateSequence}${insertSequence}${effectiveSelectedB}`;
  const finalProduct = mergeProducts(
    stageAProduct,
    stageBProduct,
    overlapSequence,
  );
  const targetSequence = `${effectiveSelectedA}${insertSequence}${effectiveSelectedB}`;
  const finalProductVerified = finalProduct === targetSequence;
  const primers = [
    createPrimerDesign(
      'A_outer_F',
      'forward',
      'fragment-a',
      'Amplifies the upstream fragment into PCR 1A.',
      '',
      bodies.outerForward,
      'PCR 1A',
      normalizedProject.reactionConditions,
      null,
    ),
    createPrimerDesign(
      'A_inner_R',
      'reverse',
      'fragment-a',
      'Adds the downstream overlap tail onto fragment A.',
      reverseComplement(
        `${insertSequence}${bodies.innerForward.templateSequence}`,
      ),
      bodies.innerReverse,
      'PCR 1A',
      normalizedProject.reactionConditions,
      overlapTm,
    ),
    createPrimerDesign(
      'B_inner_F',
      'forward',
      'fragment-b',
      'Adds the upstream overlap tail onto fragment B.',
      `${bodies.innerReverse.templateSequence}${insertSequence}`,
      bodies.innerForward,
      'PCR 1B',
      normalizedProject.reactionConditions,
      overlapTm,
    ),
    createPrimerDesign(
      'B_outer_R',
      'reverse',
      'fragment-b',
      'Amplifies the downstream fragment into PCR 1B.',
      '',
      bodies.outerReverse,
      'PCR 1B',
      normalizedProject.reactionConditions,
      null,
    ),
  ];
  const specificityTemplates = buildSpecificityTemplates(
    normalizedProject,
    stageAProduct,
    stageBProduct,
    finalProduct,
  );
  const primersWithSpecificity = primers.map((primer) => ({
    ...primer,
    specificitySites: findPrimerSpecificitySites(
      primer.name,
      primer.body,
      primer.direction,
      specificityTemplates,
    ),
  }));
  const primerPairInteractions: PrimerPairInteraction[] = [];
  for (
    let firstIndex = 0;
    firstIndex < primersWithSpecificity.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < primersWithSpecificity.length;
      secondIndex += 1
    ) {
      const primerA = primersWithSpecificity[firstIndex];
      const primerB = primersWithSpecificity[secondIndex];
      const intended =
        (primerA.name === 'A_inner_R' && primerB.name === 'B_inner_F') ||
        (primerA.name === 'B_inner_F' && primerB.name === 'A_inner_R');
      primerPairInteractions.push({
        primerAName: primerA.name,
        primerBName: primerB.name,
        interaction: analyzeHeterodimer(
          primerA.sequence,
          primerB.sequence,
          normalizedProject.reactionConditions,
        ),
        intended,
        note: intended
          ? 'Intended inner-primer complementarity for OE-PCR overlap generation.'
          : 'Cross-dimer interaction between two primers in the current design.',
      });
    }
  }
  const reactions = [
    buildReactionPlan(
      'PCR 1A',
      primersWithSpecificity[0],
      primersWithSpecificity[1],
      stageAProduct.length,
      profile,
    ),
    buildReactionPlan(
      'PCR 1B',
      primersWithSpecificity[2],
      primersWithSpecificity[3],
      stageBProduct.length,
      profile,
    ),
    buildReactionPlan(
      'Fusion PCR',
      primersWithSpecificity[0],
      primersWithSpecificity[3],
      finalProduct.length,
      profile,
    ),
  ];
  const protocolPlan = buildProtocolPlan(
    normalizedProject.protocolSettings,
    {
      stageAProductLength: stageAProduct.length,
      stageBProductLength: stageBProduct.length,
      finalProductLength: finalProduct.length,
    },
    primersWithSpecificity.map((primer) => primer.name),
    normalizedProject.polymeraseId,
    {
      dntpMillimolar: normalizedProject.reactionConditions.dntpMillimolar,
      dmsoPercent: normalizedProject.reactionConditions.dmsoPercent,
    },
  );
  const { intendedAmplicons, unintendedAmplicons: offTargetAmplicons } =
    classifyAmplicons(specificityTemplates, primersWithSpecificity, {
      selectedALength: effectiveSelectedA.length,
      selectedBLength: effectiveSelectedB.length,
      finalProductLength: finalProduct.length,
    });
  const variantReviewItems: ReviewItem[] = [];
  const primersWithStructureRisk = primersWithSpecificity.filter(
    (primer) => primer.structure.risk !== 'Low',
  );
  if (primersWithStructureRisk.length) {
    variantReviewItems.push(
      createReviewItem({
        severity: 'information',
        scope: 'primer',
        relatedObjectId: null,
        title: `${primersWithStructureRisk.length} primer(s) show approximate structure-screen findings.`,
        explanation: primersWithStructureRisk
          .map(
            (primer) =>
              `${primer.name}: ${primer.structure.risk.toLowerCase()} risk`,
          )
          .join('; '),
        recommendedAction:
          'Inspect the named primers in the detail panel and compare alternative designs if the structure burden is unacceptable.',
        deduplicationKey: `variant:structure:${primersWithStructureRisk.map((primer) => `${primer.name}-${primer.structure.risk}`).join('|')}`,
      }),
    );
    for (const primer of primersWithStructureRisk) {
      variantReviewItems.push(
        createReviewItem({
          severity: 'information',
          scope: 'primer',
          relatedObjectId: primer.name,
          title: `${primer.name} has ${primer.structure.risk.toLowerCase()} approximate structure risk.`,
          explanation: `The approximate structure model detected a non-low hairpin, homodimer, or 3 prime dimer pattern for ${primer.name}.`,
          recommendedAction:
            'Review the structure findings for this primer before ordering oligos.',
          deduplicationKey: `primer-structure:${primer.name}:${primer.structure.risk}`,
        }),
      );
    }
  }
  const specificitySummaries = primersWithSpecificity
    .map((primer) => {
      const extraRiskySites = getNonIntendedSpecificitySites(primer);
      return {
        primer,
        extraRiskySites,
      };
    })
    .filter((entry) => entry.extraRiskySites.length > 0);
  if (specificitySummaries.length) {
    const hasHighSpecificityRisk = specificitySummaries.some((entry) =>
      entry.extraRiskySites.some((site) => site.risk === 'high'),
    );
    variantReviewItems.push(
      createReviewItem({
        severity: hasHighSpecificityRisk ? 'warning' : 'review',
        scope: 'primer',
        relatedObjectId: null,
        title: `${specificitySummaries.length} primer(s) have additional local specificity matches beyond the intended template site.`,
        explanation: specificitySummaries
          .map(
            (entry) =>
              `${entry.primer.name}: ${entry.extraRiskySites.length} extra match(es)`,
          )
          .join('; '),
        recommendedAction:
          'Inspect the local specificity panel and consider different fragment ranges if these extra matches are unacceptable.',
        deduplicationKey: `variant:specificity:${specificitySummaries.map((entry) => `${entry.primer.name}-${entry.extraRiskySites.length}`).join('|')}`,
      }),
    );
    for (const entry of specificitySummaries) {
      variantReviewItems.push(
        createReviewItem({
          severity: 'information',
          scope: 'primer',
          relatedObjectId: entry.primer.name,
          title: `${entry.primer.name} has ${entry.extraRiskySites.length} additional local specificity match(es).`,
          explanation: `These extra local matches exclude the intended template site and should be reviewed in the specificity panel.`,
          recommendedAction:
            'Review the local specificity hits for this primer before ordering oligos.',
          deduplicationKey: `primer-specificity:${entry.primer.name}:${entry.extraRiskySites.length}`,
        }),
      );
    }
  }
  const innerTmSpread = Math.abs(
    primersWithSpecificity[1].bodyTm - primersWithSpecificity[2].bodyTm,
  );
  if (innerTmSpread >= 4) {
    variantReviewItems.push(
      createReviewItem({
        severity: 'information',
        scope: 'junction',
        relatedObjectId: 'junction-1',
        title: `Inner primer body Tm spread is ${innerTmSpread.toFixed(1)} C.`,
        explanation:
          'The inner-primer body temperatures are farther apart than the documented 4 C review threshold.',
        recommendedAction:
          'Consider adjusting the selected ranges if you want a tighter inner-primer Tm match.',
        deduplicationKey: `junction:inner-tm-spread:${innerTmSpread.toFixed(1)}`,
      }),
    );
  }
  const failedOverlapCriteria: string[] = [];
  if (!overlapAssessment.criteria.tm) {
    failedOverlapCriteria.push(
      `Tm ${overlapTm.toFixed(1)} C is outside the documented 58-72 C operating window`,
    );
  }
  if (!overlapAssessment.criteria.gc) {
    failedOverlapCriteria.push(
      `GC ${overlapAssessment.gcPercent.toFixed(1)}% is outside the documented 35-65% range`,
    );
  }
  if (!overlapAssessment.criteria.length) {
    failedOverlapCriteria.push(
      `length ${overlapSequence.length} nt is below the documented 24 nt minimum`,
    );
  }
  if (!overlapAssessment.criteria.homopolymer) {
    failedOverlapCriteria.push(
      `homopolymer run ${overlapAssessment.homopolymerRun} exceeds the documented maximum of 4`,
    );
  }
  if (failedOverlapCriteria.length) {
    variantReviewItems.push(
      createReviewItem({
        severity: 'review',
        scope: 'junction',
        relatedObjectId: 'junction-1',
        title:
          'The overlap is outside one or more documented operating criteria.',
        explanation: failedOverlapCriteria.join('; '),
        recommendedAction:
          'Review the overlap criteria and adjust the selected ranges or inserted sequence if you need a different junction window.',
        deduplicationKey: `junction:overlap-criteria:${failedOverlapCriteria.join('|')}`,
      }),
    );
  }
  const highRiskOffTargets = offTargetAmplicons.filter(
    (amplicon) =>
      amplicon.risk === 'high' &&
      (amplicon.templateId.endsWith('-rc') ||
        amplicon.templateId === 'fragment-a' ||
        amplicon.templateId === 'fragment-b'),
  );
  if (highRiskOffTargets.length) {
    variantReviewItems.push(
      createReviewItem({
        severity: 'warning',
        scope: 'design',
        relatedObjectId: null,
        title: `${highRiskOffTargets.length} high-risk unintended amplicon candidate(s) were detected locally.`,
        explanation:
          'These unintended products arise from the local in-project specificity scan and exclude the intended amplicon models.',
        recommendedAction:
          'Inspect the unintended amplicons before ordering primers or exporting the protocol.',
        deduplicationKey: `design:high-risk-offtargets:${highRiskOffTargets.length}`,
      }),
    );
  }
  const riskyCrossDimers = primerPairInteractions.filter(
    (pair) =>
      pair.interaction?.risk === 'High' &&
      !pair.intended &&
      primerPairSharesReaction(pair, reactions),
  );
  if (riskyCrossDimers.length) {
    variantReviewItems.push(
      createReviewItem({
        severity: 'information',
        scope: 'primer',
        relatedObjectId: null,
        title: `${riskyCrossDimers.length} approximate cross-dimer interaction(s) were flagged among primers used together.`,
        explanation: riskyCrossDimers
          .map((pair) => `${pair.primerAName}/${pair.primerBName}`)
          .join('; '),
        recommendedAction:
          'Inspect the pairwise interaction panel and compare alternative primer sets if these interactions are unacceptable.',
        deduplicationKey: `variant:cross-dimer:${riskyCrossDimers.map((pair) => `${pair.primerAName}-${pair.primerBName}`).join('|')}`,
      }),
    );
  }
  const scored = scoreDesignVariant(
    profile,
    primersWithSpecificity,
    offTargetAmplicons,
    primerPairInteractions,
    overlapAssessment,
  );
  const reviewItems = finalizeReviewItems(variantReviewItems);
  const { warnings } = deriveLegacyReviewLists(reviewItems);

  return {
    id: [
      bodies.outerForward.bodyLength,
      bodies.innerReverse.bodyLength,
      bodies.innerForward.bodyLength,
      bodies.outerReverse.bodyLength,
    ].join('-'),
    overlapSequence,
    overlapTm: Number(overlapTm.toFixed(2)),
    stageAProduct,
    stageBProduct,
    finalProduct,
    finalProductVerified,
    primers: primersWithSpecificity,
    reactions,
    specificityTemplates,
    intendedAmplicons,
    offTargetAmplicons,
    primerPairInteractions,
    protocolPlan,
    overlapAssessment,
    qualityScore: scored.qualityScore,
    qualityBreakdown: scored.qualityBreakdown,
    reviewItems,
    warnings,
    totalOligoLength: scored.totalOligoLength,
    worstNonIntendedDimerDeltaG: scored.worstNonIntendedDimerDeltaG,
    highRiskOffTargets: scored.highRiskOffTargets,
  };
}

export function buildFusionDesign(
  projectInput: FusionProjectInput,
): FusionDesign {
  const profile =
    polymeraseProfiles[projectInput.polymeraseId] ?? polymeraseProfiles.q5;
  const reactionConditions = normalizeReactionConditions(
    projectInput.reactionConditions,
  );
  const protocolSettings = normalizeProtocolConfig(
    projectInput.protocolSettings,
  );
  const editorLocks = normalizeEditorLocks(projectInput.editorLocks);
  const changeApprovals = normalizeChangeApprovals(
    projectInput.changeApprovals,
  );
  const insertSequence = normalizeSequence(projectInput.insertSequence);
  const normalizedA = normalizeSequence(projectInput.fragmentA.sequence);
  const normalizedB = normalizeSequence(projectInput.fragmentB.sequence);
  const reviewItems: ReviewItem[] = [];

  const invalidFragmentA = findInvalidBases(normalizedA, false);
  const invalidFragmentB = findInvalidBases(normalizedB, false);
  const invalidInsert = findInvalidBases(insertSequence, false);

  if (invalidFragmentA.length) {
    reviewItems.push(
      createReviewItem({
        severity: 'blocking',
        scope: 'sequence',
        relatedObjectId: 'fragment-a',
        title: `Fragment A contains unsupported bases: ${invalidFragmentA.join(', ')}`,
        explanation:
          'Only A, C, G, and T are accepted in the public MVP DNA-entry workflow.',
        recommendedAction:
          'Replace the unsupported characters in Fragment A before calculating primers.',
        deduplicationKey: `sequence:fragment-a:invalid:${invalidFragmentA.join('|')}`,
      }),
    );
  }
  if (invalidFragmentB.length) {
    reviewItems.push(
      createReviewItem({
        severity: 'blocking',
        scope: 'sequence',
        relatedObjectId: 'fragment-b',
        title: `Fragment B contains unsupported bases: ${invalidFragmentB.join(', ')}`,
        explanation:
          'Only A, C, G, and T are accepted in the public MVP DNA-entry workflow.',
        recommendedAction:
          'Replace the unsupported characters in Fragment B before calculating primers.',
        deduplicationKey: `sequence:fragment-b:invalid:${invalidFragmentB.join('|')}`,
      }),
    );
  }
  if (invalidInsert.length) {
    reviewItems.push(
      createReviewItem({
        severity: 'blocking',
        scope: 'junction',
        relatedObjectId: 'junction-1',
        title: `Insert sequence contains unsupported bases: ${invalidInsert.join(', ')}`,
        explanation:
          'The optional inserted sequence must also be valid DNA in the public MVP workflow.',
        recommendedAction:
          'Replace the unsupported inserted bases before calculating primers.',
        deduplicationKey: `sequence:insert:invalid:${invalidInsert.join('|')}`,
      }),
    );
  }
  if (!normalizedA.length) {
    reviewItems.push(
      createReviewItem({
        severity: 'blocking',
        scope: 'sequence',
        relatedObjectId: 'fragment-a',
        title: 'Fragment A is empty.',
        explanation:
          'A two-fragment OE-PCR design requires a non-empty upstream fragment selection.',
        recommendedAction:
          'Provide Fragment A sequence content before calculating primers.',
        deduplicationKey: 'sequence:fragment-a:empty',
      }),
    );
  }
  if (!normalizedB.length) {
    reviewItems.push(
      createReviewItem({
        severity: 'blocking',
        scope: 'sequence',
        relatedObjectId: 'fragment-b',
        title: 'Fragment B is empty.',
        explanation:
          'A two-fragment OE-PCR design requires a non-empty downstream fragment selection.',
        recommendedAction:
          'Provide Fragment B sequence content before calculating primers.',
        deduplicationKey: 'sequence:fragment-b:empty',
      }),
    );
  }

  const rangeA = clampRange(
    normalizedA.length,
    projectInput.fragmentA.topology,
    projectInput.fragmentA.start,
    projectInput.fragmentA.end,
  );
  const rangeB = clampRange(
    normalizedB.length,
    projectInput.fragmentB.topology,
    projectInput.fragmentB.start,
    projectInput.fragmentB.end,
  );
  const selectedA = selectRange(normalizedA, rangeA);
  const selectedB = selectRange(normalizedB, rangeB);
  let effectiveSelectedA = selectedA;
  let effectiveSelectedB = selectedB;
  let synonymousOptimization: SynonymousOptimization | null = null;
  const sequenceChangeProposals: SequenceChangeProposal[] = [];

  if (rangeA.clamped) {
    reviewItems.push(
      createReviewItem({
        severity: 'information',
        scope: 'sequence',
        relatedObjectId: 'fragment-a',
        title:
          'Fragment A range was normalized to stay within the sequence bounds.',
        explanation:
          'The selected coordinates were clamped to the available Fragment A sequence length.',
        recommendedAction:
          'Review the displayed Fragment A coordinates if the normalized range is not what you intended.',
        deduplicationKey: 'sequence:fragment-a:range-normalized',
      }),
    );
  }
  if (rangeB.clamped) {
    reviewItems.push(
      createReviewItem({
        severity: 'information',
        scope: 'sequence',
        relatedObjectId: 'fragment-b',
        title:
          'Fragment B range was normalized to stay within the sequence bounds.',
        explanation:
          'The selected coordinates were clamped to the available Fragment B sequence length.',
        recommendedAction:
          'Review the displayed Fragment B coordinates if the normalized range is not what you intended.',
        deduplicationKey: 'sequence:fragment-b:range-normalized',
      }),
    );
  }
  if (selectedA.length < profile.minBodyLength) {
    reviewItems.push(
      createReviewItem({
        severity: 'blocking',
        scope: 'sequence',
        relatedObjectId: 'fragment-a',
        title: `Fragment A contributes only ${selectedA.length} bases, below the ${profile.minBodyLength} nt minimum primer-body length for ${profile.label}.`,
        explanation:
          'The upstream fragment selection is too short to support a physically valid annealing body under the chosen polymerase profile.',
        recommendedAction:
          'Extend the Fragment A selection or choose different source coordinates before calculating primers.',
        deduplicationKey: `sequence:fragment-a:too-short:${selectedA.length}:${profile.id}`,
      }),
    );
  }
  if (selectedB.length < profile.minBodyLength) {
    reviewItems.push(
      createReviewItem({
        severity: 'blocking',
        scope: 'sequence',
        relatedObjectId: 'fragment-b',
        title: `Fragment B contributes only ${selectedB.length} bases, below the ${profile.minBodyLength} nt minimum primer-body length for ${profile.label}.`,
        explanation:
          'The downstream fragment selection is too short to support a physically valid annealing body under the chosen polymerase profile.',
        recommendedAction:
          'Extend the Fragment B selection or choose different source coordinates before calculating primers.',
        deduplicationKey: `sequence:fragment-b:too-short:${selectedB.length}:${profile.id}`,
      }),
    );
  }

  if (projectInput.mode === 'protein-fusion') {
    if (!projectInput.coding.retainUpstreamStop) {
      const removed = replaceLastInFrameCodon(
        selectedA,
        projectInput.coding.upstreamFrame,
      );
      if (removed.removed) {
        sequenceChangeProposals.push({
          id: 'remove-upstream-stop',
          kind: 'remove-upstream-stop',
          fragment: 'fragment-a',
          start: removed.start,
          end: removed.start + removed.codon.length - 1,
          from: removed.codon,
          to: '',
          approved: changeApprovals.removeUpstreamStop,
          label: 'Remove upstream stop codon',
          description: `Remove terminal stop codon ${removed.codon} from the upstream coding fragment to permit continuous translation.`,
        });
      }
      if (removed.removed && changeApprovals.removeUpstreamStop) {
        effectiveSelectedA = removed.sequence;
        reviewItems.push(
          createReviewItem({
            severity: 'information',
            scope: 'protein',
            relatedObjectId: 'fragment-a',
            title:
              'Upstream terminal stop codon removal was approved and applied to the fused coding product.',
            explanation: `The terminal stop codon ${removed.codon} was removed from the upstream coding fragment after approval.`,
            recommendedAction:
              'Review the updated effective Fragment A sequence before ordering primers.',
            deduplicationKey: 'protein:upstream-stop-approved',
          }),
        );
      } else if (removed.removed) {
        reviewItems.push(
          createReviewItem({
            severity: 'review',
            scope: 'protein',
            relatedObjectId: 'fragment-a',
            title:
              'Upstream stop codon removal is proposed but not yet approved.',
            explanation: `The upstream coding fragment ends with stop codon ${removed.codon}, which would terminate translation before the fused product continues downstream.`,
            recommendedAction:
              'Approve removal of the upstream stop codon if continuous translation across the junction is intended.',
            deduplicationKey: 'protein:upstream-stop-pending',
          }),
        );
      }
    }

    if (!projectInput.coding.retainDownstreamStart) {
      const removed = removeFirstInFrameStartCodon(
        selectedB,
        projectInput.coding.downstreamFrame,
      );
      if (removed.removed) {
        sequenceChangeProposals.push({
          id: 'remove-downstream-start',
          kind: 'remove-downstream-start',
          fragment: 'fragment-b',
          start: removed.start,
          end: removed.start + removed.codon.length - 1,
          from: removed.codon,
          to: '',
          approved: changeApprovals.removeDownstreamStart,
          label: 'Remove downstream start codon',
          description:
            'Remove the initial downstream ATG so the fused coding region does not introduce an extra N-terminal methionine.',
        });
      }
      if (removed.removed && changeApprovals.removeDownstreamStart) {
        effectiveSelectedB = removed.sequence;
        reviewItems.push(
          createReviewItem({
            severity: 'information',
            scope: 'protein',
            relatedObjectId: 'fragment-b',
            title:
              'Downstream initial ATG removal was approved and applied to the fused coding product.',
            explanation:
              'The first in-frame downstream ATG was removed after approval to avoid an extra N-terminal methionine in the fusion.',
            recommendedAction:
              'Review the updated effective Fragment B sequence before ordering primers.',
            deduplicationKey: 'protein:downstream-start-approved',
          }),
        );
      } else if (removed.removed) {
        reviewItems.push(
          createReviewItem({
            severity: 'review',
            scope: 'protein',
            relatedObjectId: 'fragment-b',
            title:
              'Downstream start-codon removal is proposed but not yet approved.',
            explanation:
              'The downstream coding fragment still begins with ATG, which can add an extra methionine to the fused protein product.',
            recommendedAction:
              'Approve removal of the downstream start codon if continuous fusion is intended.',
            deduplicationKey: 'protein:downstream-start-pending',
          }),
        );
      }
    }

    synonymousOptimization = optimizeSynonymousJunction(
      effectiveSelectedA,
      effectiveSelectedB,
      insertSequence,
      projectInput.coding,
      profile,
      reactionConditions,
    );
    if (synonymousOptimization?.changed) {
      const accepted = applyAcceptedSynonymousChanges(
        effectiveSelectedA,
        effectiveSelectedB,
        synonymousOptimization.changes,
        changeApprovals.acceptedSynonymousChanges,
      );
      synonymousOptimization.changes = synonymousOptimization.changes.map(
        (change) => ({
          ...change,
          accepted: accepted.appliedIds.includes(change.id),
        }),
      );
      synonymousOptimization.applied = accepted.appliedIds.length > 0;
      synonymousOptimization.summary = accepted.appliedIds.length
        ? `Accepted ${accepted.appliedIds.length} of ${synonymousOptimization.changes.length} proposed synonymous codon change(s) within ${synonymousOptimization.windowCodons} codon(s) of the junction.`
        : synonymousOptimization.summary;
      effectiveSelectedA = accepted.selectedA;
      effectiveSelectedB = accepted.selectedB;
      sequenceChangeProposals.push(
        ...synonymousOptimization.changes.map((change) => ({
          id: change.id,
          kind: 'synonymous-codon' as const,
          fragment: change.fragment,
          start: change.start,
          end: change.start + change.from.length - 1,
          from: change.from,
          to: change.to,
          approved: change.accepted,
          label: `Synonymous codon change ${change.from} to ${change.to}`,
          description: `Replace ${change.from} with ${change.to} at codon ${change.codonIndex + 1} while preserving amino acid ${change.aminoAcid}.`,
          aminoAcid: change.aminoAcid,
        })),
      );
      reviewItems.push(
        createReviewItem({
          severity: accepted.appliedIds.length ? 'information' : 'review',
          scope: 'protein',
          relatedObjectId: 'junction-1',
          title: accepted.appliedIds.length
            ? `Accepted ${accepted.appliedIds.length} of ${synonymousOptimization.changes.length} proposed synonymous codon change(s).`
            : 'Synonymous optimization produced proposed codon changes pending approval.',
          explanation: synonymousOptimization.summary,
          recommendedAction: accepted.appliedIds.length
            ? 'Review the accepted synonymous codon changes in the protein validation output.'
            : 'Review and approve individual synonymous codon changes if you want to apply them.',
          deduplicationKey: accepted.appliedIds.length
            ? `protein:synonymous-approved:${accepted.appliedIds.length}:${synonymousOptimization.changes.length}`
            : `protein:synonymous-pending:${synonymousOptimization.changes.length}`,
        }),
      );
    }
  }

  const normalizedProject: FusionProjectInput = {
    ...projectInput,
    schemaVersion: projectInput.schemaVersion || PROJECT_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    revision: Math.max(
      1,
      Number.isFinite(projectInput.revision)
        ? Math.floor(projectInput.revision)
        : 1,
    ),
    projectHash: projectInput.projectHash,
    insertSequence,
    reactionConditions,
    protocolSettings,
    editorLocks,
    changeApprovals,
    fragmentA: {
      ...projectInput.fragmentA,
      sequence: normalizedA,
      start: rangeA.start,
      end: rangeA.end,
    },
    fragmentB: {
      ...projectInput.fragmentB,
      sequence: normalizedB,
      start: rangeB.start,
      end: rangeB.end,
    },
    modifiedAt: projectInput.modifiedAt,
  };

  if (reviewItems.some((item) => item.severity === 'blocking')) {
    const finalizedReviewItems = finalizeReviewItems(reviewItems);
    const { issues, warnings } = deriveLegacyReviewLists(finalizedReviewItems);
    return {
      project: normalizedProject,
      profile,
      selectedA,
      selectedB,
      effectiveSelectedA,
      effectiveSelectedB,
      insertSequence,
      overlapSequence: '',
      targetSequence: `${effectiveSelectedA}${insertSequence}${effectiveSelectedB}`,
      stageAProduct: '',
      stageBProduct: '',
      finalProduct: '',
      finalProductVerified: false,
      primers: [],
      reactions: [],
      proteinValidation: null,
      specificityTemplates: [],
      intendedAmplicons: [],
      offTargetAmplicons: [],
      primerPairInteractions: [],
      protocolPlan: emptyProtocolPlan(),
      qualityScore: 0,
      qualityBreakdown: {
        tmBalance: 0,
        bodyFit: 0,
        overlap: 0,
        structure: 0,
        specificity: 0,
        synthesis: 0,
        total: 0,
      },
      alternativeDesigns: [],
      sequenceChangeProposals,
      reviewItems: finalizedReviewItems,
      issues,
      warnings,
    };
  }
  const bodyLimit = 4;
  const outerForwardCandidates = enumerateBodyCandidates(
    effectiveSelectedA,
    'start',
    'forward',
    profile,
    normalizedProject.reactionConditions,
    bodyLimit,
  );
  const innerReverseCandidates = enumerateBodyCandidates(
    effectiveSelectedA,
    'end',
    'reverse',
    profile,
    normalizedProject.reactionConditions,
    bodyLimit,
  );
  const innerForwardCandidates = enumerateBodyCandidates(
    effectiveSelectedB,
    'start',
    'forward',
    profile,
    normalizedProject.reactionConditions,
    bodyLimit,
  );
  const outerReverseCandidates = enumerateBodyCandidates(
    effectiveSelectedB,
    'end',
    'reverse',
    profile,
    normalizedProject.reactionConditions,
    bodyLimit,
  );

  if (
    !outerForwardCandidates.length ||
    !innerReverseCandidates.length ||
    !innerForwardCandidates.length ||
    !outerReverseCandidates.length
  ) {
    const finalizedReviewItems = finalizeReviewItems([
      ...reviewItems,
      createReviewItem({
        severity: 'blocking',
        scope: 'primer',
        relatedObjectId: null,
        title: `No physically valid primer bodies could be generated within the ${profile.minBodyLength}-${profile.maxBodyLength} nt range for ${profile.label}.`,
        explanation:
          'At least one fragment range cannot support a finite thermodynamic annealing body under the selected polymerase constraints.',
        recommendedAction:
          'Adjust the fragment selections or polymerase profile before calculating primers.',
        deduplicationKey: `primer:no-valid-bodies:${profile.id}`,
      }),
    ]);
    const { issues, warnings } = deriveLegacyReviewLists(finalizedReviewItems);
    return {
      project: normalizedProject,
      profile,
      selectedA,
      selectedB,
      effectiveSelectedA,
      effectiveSelectedB,
      insertSequence,
      overlapSequence: '',
      targetSequence: `${effectiveSelectedA}${insertSequence}${effectiveSelectedB}`,
      stageAProduct: '',
      stageBProduct: '',
      finalProduct: '',
      finalProductVerified: false,
      primers: [],
      reactions: [],
      proteinValidation: null,
      specificityTemplates: [],
      intendedAmplicons: [],
      offTargetAmplicons: [],
      primerPairInteractions: [],
      protocolPlan: emptyProtocolPlan(),
      qualityScore: 0,
      qualityBreakdown: {
        tmBalance: 0,
        bodyFit: 0,
        overlap: 0,
        structure: 0,
        specificity: 0,
        synthesis: 0,
        total: 0,
      },
      alternativeDesigns: [],
      sequenceChangeProposals,
      reviewItems: finalizedReviewItems,
      issues,
      warnings,
    };
  }

  const roughCombinations: CandidateCombination[] = [];
  for (const outerForward of outerForwardCandidates) {
    for (const innerReverse of innerReverseCandidates) {
      for (const innerForward of innerForwardCandidates) {
        for (const outerReverse of outerReverseCandidates) {
          const overlapSequence = `${innerReverse.templateSequence}${insertSequence}${innerForward.templateSequence}`;
          const overlapTm = calculateNearestNeighborTm(
            overlapSequence,
            normalizedProject.reactionConditions,
          ).correctedTmCelsius;
          const overlapAssessment = evaluateOverlapCriteria(
            overlapSequence,
            overlapTm,
          );
          if (!Number.isFinite(overlapTm)) {
            continue;
          }
          const roughScore =
            outerForward.score +
            innerReverse.score +
            innerForward.score +
            outerReverse.score +
            Math.abs(innerReverse.bodyTm - innerForward.bodyTm) * 0.7 +
            (1 - overlapAssessment.score) * 8;
          roughCombinations.push({
            outerForward,
            innerReverse,
            innerForward,
            outerReverse,
            roughScore,
          });
        }
      }
    }
  }

  const evaluatedVariants = roughCombinations
    .sort((left, right) => left.roughScore - right.roughScore)
    .filter(
      (combination, index, items) =>
        items.findIndex(
          (candidate) =>
            candidate.outerForward.bodyLength ===
              combination.outerForward.bodyLength &&
            candidate.innerReverse.bodyLength ===
              combination.innerReverse.bodyLength &&
            candidate.innerForward.bodyLength ===
              combination.innerForward.bodyLength &&
            candidate.outerReverse.bodyLength ===
              combination.outerReverse.bodyLength,
        ) === index,
    )
    .slice(0, 8)
    .flatMap((combination) => {
      try {
        return [
          buildDesignVariant(
            normalizedProject,
            profile,
            effectiveSelectedA,
            effectiveSelectedB,
            insertSequence,
            {
              outerForward: combination.outerForward,
              innerReverse: combination.innerReverse,
              innerForward: combination.innerForward,
              outerReverse: combination.outerReverse,
            },
          ),
        ];
      } catch {
        return [];
      }
    });

  if (!evaluatedVariants.length) {
    const finalizedReviewItems = finalizeReviewItems([
      ...reviewItems,
      createReviewItem({
        severity: 'blocking',
        scope: 'design',
        relatedObjectId: null,
        title:
          'No physically valid complete primer design satisfied the current thermodynamic and overlap checks.',
        explanation:
          'Candidate primer bodies were found, but no complete four-primer OE-PCR design passed the current design checks.',
        recommendedAction:
          'Adjust the fragment selections, inserted sequence, or polymerase profile before recalculating.',
        deduplicationKey: 'design:no-valid-complete-design',
      }),
    ]);
    const { issues, warnings } = deriveLegacyReviewLists(finalizedReviewItems);
    return {
      project: normalizedProject,
      profile,
      selectedA,
      selectedB,
      effectiveSelectedA,
      effectiveSelectedB,
      insertSequence,
      overlapSequence: '',
      targetSequence: `${effectiveSelectedA}${insertSequence}${effectiveSelectedB}`,
      stageAProduct: '',
      stageBProduct: '',
      finalProduct: '',
      finalProductVerified: false,
      primers: [],
      reactions: [],
      proteinValidation: null,
      specificityTemplates: [],
      intendedAmplicons: [],
      offTargetAmplicons: [],
      primerPairInteractions: [],
      protocolPlan: emptyProtocolPlan(),
      qualityScore: 0,
      qualityBreakdown: {
        tmBalance: 0,
        bodyFit: 0,
        overlap: 0,
        structure: 0,
        specificity: 0,
        synthesis: 0,
        total: 0,
      },
      alternativeDesigns: [],
      sequenceChangeProposals,
      reviewItems: finalizedReviewItems,
      issues,
      warnings,
    };
  }

  const bestVariant = [...evaluatedVariants].sort(
    (left, right) =>
      right.qualityScore - left.qualityScore ||
      left.warnings.length - right.warnings.length,
  )[0];

  const targetSequence = `${effectiveSelectedA}${insertSequence}${effectiveSelectedB}`;
  const proteinValidation = validateProteinFusion(
    normalizedProject.mode,
    selectedA,
    selectedB,
    effectiveSelectedA,
    effectiveSelectedB,
    insertSequence,
    normalizedProject.coding,
    synonymousOptimization,
  );
  const finalReviewItems = [
    ...reviewItems,
    ...bestVariant.reviewItems,
    ...(proteinValidation?.reviewItems ?? []),
  ];
  if (!bestVariant.finalProductVerified) {
    finalReviewItems.push(
      createReviewItem({
        severity: 'blocking',
        scope: 'junction',
        relatedObjectId: 'junction-1',
        title:
          'The simulated fusion product does not match the requested target sequence.',
        explanation:
          'The reconstructed final product differs from the requested target sequence for the current design inputs.',
        recommendedAction:
          'Review the fragment ranges and inserted sequence before exporting primers or protocol outputs.',
        deduplicationKey: 'junction:final-product-mismatch',
      }),
    );
  }
  const finalizedReviewItems = finalizeReviewItems(finalReviewItems);
  const { issues, warnings } = deriveLegacyReviewLists(finalizedReviewItems);

  const alternativeDesigns: AlternativeDesign[] = [];
  const alternativeStrategies: Array<{
    priority: AlternativeDesign['priority'];
    label: string;
    selector: (variants: DesignVariant[]) => DesignVariant | undefined;
  }> = [
    {
      priority: 'balanced',
      label: 'Best balanced design',
      selector: (variants) =>
        [...variants].sort(
          (left, right) => right.qualityScore - left.qualityScore,
        )[0],
    },
    {
      priority: 'low-dimer',
      label: 'Lower dimer risk',
      selector: (variants) =>
        [...variants].sort(
          (left, right) =>
            (right.worstNonIntendedDimerDeltaG ?? Number.POSITIVE_INFINITY) -
              (left.worstNonIntendedDimerDeltaG ?? Number.POSITIVE_INFINITY) ||
            right.qualityScore - left.qualityScore,
        )[0],
    },
    {
      priority: 'short-oligo',
      label: 'Shorter oligos',
      selector: (variants) =>
        [...variants].sort(
          (left, right) =>
            left.totalOligoLength - right.totalOligoLength ||
            right.qualityScore - left.qualityScore,
        )[0],
    },
    {
      priority: 'high-overlap',
      label: 'Higher overlap Tm',
      selector: (variants) =>
        [...variants].sort(
          (left, right) =>
            right.overlapTm - left.overlapTm ||
            right.qualityScore - left.qualityScore,
        )[0],
    },
  ];
  for (const strategy of alternativeStrategies) {
    const variant = strategy.selector(evaluatedVariants);
    if (
      !variant ||
      alternativeDesigns.some((alternative) => alternative.id === variant.id)
    ) {
      continue;
    }
    alternativeDesigns.push({
      id: variant.id,
      label: strategy.label,
      priority: strategy.priority,
      qualityScore: variant.qualityScore,
      qualityBreakdown: variant.qualityBreakdown,
      overlapTm: variant.overlapTm,
      tmSpread: Math.abs(variant.primers[1].bodyTm - variant.primers[2].bodyTm),
      totalOligoLength: variant.totalOligoLength,
      worstNonIntendedDimerDeltaG: variant.worstNonIntendedDimerDeltaG,
      highRiskOffTargets: variant.highRiskOffTargets,
      reviewItems: variant.reviewItems,
      warnings: variant.warnings,
      primers: variant.primers,
      reactions: variant.reactions,
    });
  }

  return {
    project: normalizedProject,
    profile,
    selectedA,
    selectedB,
    effectiveSelectedA,
    effectiveSelectedB,
    insertSequence,
    overlapSequence: bestVariant.overlapSequence,
    targetSequence,
    stageAProduct: bestVariant.stageAProduct,
    stageBProduct: bestVariant.stageBProduct,
    finalProduct: bestVariant.finalProduct,
    finalProductVerified: bestVariant.finalProductVerified,
    primers: bestVariant.primers,
    reactions: bestVariant.reactions,
    proteinValidation,
    specificityTemplates: bestVariant.specificityTemplates,
    intendedAmplicons: bestVariant.intendedAmplicons,
    offTargetAmplicons: bestVariant.offTargetAmplicons,
    primerPairInteractions: bestVariant.primerPairInteractions,
    protocolPlan: bestVariant.protocolPlan,
    qualityScore: bestVariant.qualityScore,
    qualityBreakdown: bestVariant.qualityBreakdown,
    alternativeDesigns,
    sequenceChangeProposals,
    reviewItems: finalizedReviewItems,
    issues,
    warnings,
  };
}

export function createPlaceholderFusionDesign(
  projectInput: FusionProjectInput,
): FusionDesign {
  const profile =
    polymeraseProfiles[projectInput.polymeraseId] ?? polymeraseProfiles.q5;
  const reactionConditions = normalizeReactionConditions(
    projectInput.reactionConditions,
  );
  const protocolSettings = normalizeProtocolConfig(
    projectInput.protocolSettings,
  );
  const editorLocks = normalizeEditorLocks(projectInput.editorLocks);
  const changeApprovals = normalizeChangeApprovals(
    projectInput.changeApprovals,
  );
  const insertSequence = normalizeSequence(projectInput.insertSequence);
  const normalizedA = normalizeSequence(projectInput.fragmentA.sequence);
  const normalizedB = normalizeSequence(projectInput.fragmentB.sequence);
  const rangeA = clampRange(
    normalizedA.length,
    projectInput.fragmentA.topology,
    projectInput.fragmentA.start,
    projectInput.fragmentA.end,
  );
  const rangeB = clampRange(
    normalizedB.length,
    projectInput.fragmentB.topology,
    projectInput.fragmentB.start,
    projectInput.fragmentB.end,
  );
  const selectedA = selectRange(normalizedA, rangeA);
  const selectedB = selectRange(normalizedB, rangeB);
  const normalizedProject: FusionProjectInput = {
    ...projectInput,
    schemaVersion: projectInput.schemaVersion || PROJECT_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    revision: Math.max(
      1,
      Number.isFinite(projectInput.revision)
        ? Math.floor(projectInput.revision)
        : 1,
    ),
    projectHash: projectInput.projectHash,
    insertSequence,
    reactionConditions,
    protocolSettings,
    editorLocks,
    changeApprovals,
    fragmentA: {
      ...projectInput.fragmentA,
      sequence: normalizedA,
      start: rangeA.start,
      end: rangeA.end,
    },
    fragmentB: {
      ...projectInput.fragmentB,
      sequence: normalizedB,
      start: rangeB.start,
      end: rangeB.end,
    },
    modifiedAt: projectInput.modifiedAt,
  };
  const targetSequence = `${selectedA}${insertSequence}${selectedB}`;

  return {
    project: normalizedProject,
    profile,
    selectedA,
    selectedB,
    effectiveSelectedA: selectedA,
    effectiveSelectedB: selectedB,
    insertSequence,
    overlapSequence: '',
    targetSequence,
    stageAProduct: '',
    stageBProduct: '',
    finalProduct: '',
    finalProductVerified: false,
    primers: [],
    reactions: [],
    proteinValidation: null,
    specificityTemplates: [],
    intendedAmplicons: [],
    offTargetAmplicons: [],
    primerPairInteractions: [],
    protocolPlan: emptyProtocolPlan(),
    qualityScore: 0,
    qualityBreakdown: {
      tmBalance: 0,
      bodyFit: 0,
      overlap: 0,
      structure: 0,
      specificity: 0,
      synthesis: 0,
      total: 0,
    },
    alternativeDesigns: [],
    sequenceChangeProposals: [],
    reviewItems: [],
    issues: [],
    warnings: [],
  };
}

export function summarizeSequenceMetrics(sequenceInput: string): {
  length: number;
  gcPercentage: number;
  tm: number;
} {
  const sequence = normalizeSequence(sequenceInput);
  return {
    length: sequence.length,
    gcPercentage: calculateGcPercentage(sequence),
    tm: calculateWallaceTm(sequence),
  };
}
