import { reverseComplement } from './pcr';
import type { FusionDesign, PrimerDesign } from './fusion';
import { filterActionableReviewItems } from './review-items';

export type WorkflowStage = 'overview' | 'pcr1a' | 'pcr1b' | 'fusion' | 'verification';

export type StageSequencePreview = {
  label: string;
  sequence: string;
};

export type DesignComparisonSummary = {
  projectName: string;
  totalOligoLength: number;
  worstDimerDeltaG: number | null;
  tmSpread: number;
  overlapTm: number | null;
  localOffTargets: number;
  highRiskOffTargets: number;
  finalProductLength: number;
  warningCount: number;
};

export type JunctionSummary = {
  upstreamFlank: string;
  insertSequence: string;
  downstreamFlank: string;
  finalJunction: string;
  upstreamAnnealRegion: string;
  downstreamAnnealRegion: string;
  aInnerTailContribution: string;
  bInnerTailContribution: string;
};

function findPrimer(design: FusionDesign, primerName: string): PrimerDesign | null {
  return design.primers.find((primer) => primer.name === primerName) ?? null;
}

export function summarizeDesignComparison(design: FusionDesign): DesignComparisonSummary {
  const tmValues = design.primers.map((primer) => primer.bodyTm);
  const dimerValues = design.primerPairInteractions
    .map((pair) => pair.interaction?.deltaG ?? null)
    .filter((value): value is number => value !== null);
  const overlapPrimer = findPrimer(design, 'A_inner_R') ?? findPrimer(design, 'B_inner_F');

  return {
    projectName: design.project.name,
    totalOligoLength: design.primers.reduce((sum, primer) => sum + primer.fullLength, 0),
    worstDimerDeltaG: dimerValues.length ? Math.min(...dimerValues) : null,
    tmSpread: tmValues.length ? Math.max(...tmValues) - Math.min(...tmValues) : 0,
    overlapTm: overlapPrimer?.overlapTm ?? null,
    localOffTargets: design.offTargetAmplicons.length,
    highRiskOffTargets: design.offTargetAmplicons.filter((amplicon) => amplicon.risk === 'high').length,
    finalProductLength: design.finalProduct.length,
    warningCount: filterActionableReviewItems(design.reviewItems).length,
  };
}

export function getWorkflowStageLabel(stage: WorkflowStage): string {
  switch (stage) {
    case 'pcr1a':
      return 'PCR 1A';
    case 'pcr1b':
      return 'PCR 1B';
    case 'fusion':
      return 'Fusion PCR';
    case 'verification':
      return 'Verification';
    default:
      return 'Overview';
  }
}

export function getStagePrimerNames(design: FusionDesign, stage: WorkflowStage): string[] {
  if (stage === 'overview' || stage === 'verification') {
    return design.primers.map((primer) => primer.name);
  }

  const reactionName = getWorkflowStageLabel(stage) as 'PCR 1A' | 'PCR 1B' | 'Fusion PCR';
  return design.reactions.find((reaction) => reaction.name === reactionName)?.primerNames ?? [];
}

export function getStageSequencePreviews(design: FusionDesign, stage: WorkflowStage): StageSequencePreview[] {
  switch (stage) {
    case 'pcr1a':
      return [
        { label: 'Fragment A selected slice', sequence: design.effectiveSelectedA },
        { label: 'PCR 1A product', sequence: design.stageAProduct },
      ];
    case 'pcr1b':
      return [
        { label: 'Fragment B selected slice', sequence: design.effectiveSelectedB },
        { label: 'PCR 1B product', sequence: design.stageBProduct },
      ];
    case 'fusion':
      return [
        { label: 'PCR 1A product', sequence: design.stageAProduct },
        { label: 'PCR 1B product', sequence: design.stageBProduct },
        { label: 'Simulated fusion product', sequence: design.finalProduct },
      ];
    case 'verification':
      return [
        { label: 'Requested target sequence', sequence: design.targetSequence },
        { label: 'Simulated final fusion product', sequence: design.finalProduct },
      ];
    default:
      return [
        { label: 'Requested target sequence', sequence: design.targetSequence },
        { label: 'PCR 1A product', sequence: design.stageAProduct },
        { label: 'PCR 1B product', sequence: design.stageBProduct },
        { label: 'Simulated final fusion product', sequence: design.finalProduct },
      ];
  }
}

export function buildJunctionSummary(design: FusionDesign, flankLength = 14): JunctionSummary {
  const upstreamFlank = design.effectiveSelectedA.slice(-flankLength);
  const downstreamFlank = design.effectiveSelectedB.slice(0, flankLength);
  const aInner = findPrimer(design, 'A_inner_R');
  const bInner = findPrimer(design, 'B_inner_F');

  return {
    upstreamFlank,
    insertSequence: design.insertSequence,
    downstreamFlank,
    finalJunction: `${upstreamFlank}${design.insertSequence}${downstreamFlank}`,
    upstreamAnnealRegion: aInner?.bodyTemplateSequence ?? '',
    downstreamAnnealRegion: bInner?.bodyTemplateSequence ?? '',
    aInnerTailContribution: aInner?.tail ? reverseComplement(aInner.tail) : '',
    bInnerTailContribution: bInner?.tail ?? '',
  };
}
