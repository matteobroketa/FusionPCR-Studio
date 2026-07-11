import { defaultEditorLocks, type EditorLocks } from './editor';
import { analyzePrimer, calculateGcPercentage, calculateWallaceTm, findInvalidBases, normalizeSequence, reverseComplement } from './pcr';
import { buildProtocolPlan, defaultProtocolSettings, normalizeProtocolSettings, type ProtocolPlan, type ProtocolSettings } from './protocol';
import { findPrimerSpecificitySites, predictOffTargetAmplicons, type OffTargetAmplicon, type PrimerDirection, type SpecificitySite, type SpecificityTemplate } from './specificity';
import { analyzeHeterodimer, analyzePrimerStructure, type PrimerStructureAnalysis, type StructureResult } from './structure';
import { calculateNearestNeighborTm, defaultThermodynamicConditions, type ThermodynamicConditions, type ThermodynamicResult } from './thermodynamics';
import { codonsForAminoAcid, formatAminoAcidWindow, synonymousCodonsForCodon, translateSequence } from './translation';

export type PolymeraseId = 'q5' | 'phusion_plus';
export type DesignMode = 'exact' | 'protein-fusion' | 'insertion' | 'deletion' | 'substitution' | 'domain-swap';
export type SourceFormat = 'manual' | 'plain' | 'fasta' | 'genbank' | 'project';
export type SequenceTopology = 'linear' | 'circular';

export const PROJECT_SCHEMA_VERSION = '0.2.0';
export const ENGINE_VERSION = '0.2.0';

export type SequenceFeature = {
  key: string;
  location: string;
  label: string;
  qualifiers: Record<string, string>;
  crossesOrigin: boolean;
};

export type FragmentInput = {
  label: string;
  sequence: string;
  start: number;
  end: number;
  topology: SequenceTopology;
  sourceFormat: SourceFormat;
  importedName: string;
  checksum: string;
  ambiguousBases: string[];
  features: SequenceFeature[];
  reverseComplemented: boolean;
};

export type CodingIntent = {
  upstreamFrame: 0 | 1 | 2;
  downstreamFrame: 0 | 1 | 2;
  retainUpstreamStop: boolean;
  retainDownstreamStart: boolean;
  linkerRequired: boolean;
  preserveProtein: boolean;
  flexibleCodons: number;
};

export type ChangeApprovals = {
  removeUpstreamStop: boolean;
  removeDownstreamStart: boolean;
  acceptedSynonymousChanges: string[];
};

export type GenomicSpecificitySettings = {
  organism: string;
  database: string;
  notes: string;
};

export type FusionProjectInput = {
  schemaVersion: string;
  engineVersion: string;
  name: string;
  polymeraseId: PolymeraseId;
  mode: DesignMode;
  insertSequence: string;
  notes: string;
  coding: CodingIntent;
  reactionConditions: ThermodynamicConditions;
  protocolSettings: ProtocolSettings;
  editorLocks: EditorLocks;
  changeApprovals: ChangeApprovals;
  genomicSpecificity: GenomicSpecificitySettings;
  fragmentA: FragmentInput;
  fragmentB: FragmentInput;
  createdAt: string;
  modifiedAt: string;
};

export type PolymeraseProfile = {
  id: PolymeraseId;
  label: string;
  targetBodyTm: number;
  secondsPerKb: number;
  minExtensionSeconds: number;
  gradientSpan: number;
  annealingTemperature: (lowerPrimerBodyTm: number) => number;
};

export type PrimerStructure = PrimerStructureAnalysis;

export type PrimerPairInteraction = {
  primerAName: string;
  primerBName: string;
  interaction: StructureResult | null;
  intended: boolean;
  note: string;
};

export type PrimerDesign = {
  name: string;
  direction: PrimerDirection;
  expectedTemplateId: string;
  role: string;
  sequence: string;
  tail: string;
  body: string;
  bodyTemplateSequence: string;
  fullLength: number;
  bodyLength: number;
  bodyTm: number;
  fullOligoTm: number;
  overlapTm: number | null;
  bodyGcPercentage: number;
  structure: PrimerStructure;
  bodyThermodynamics: ThermodynamicResult;
  fullOligoThermodynamics: ThermodynamicResult;
  reaction: 'PCR 1A' | 'PCR 1B' | 'Fusion PCR';
  specificitySites: SpecificitySite[];
};

export type ReactionPlan = {
  name: 'PCR 1A' | 'PCR 1B' | 'Fusion PCR';
  primerNames: [string, string];
  productLength: number;
  annealingTemperature: number;
  extensionSeconds: number;
  gradientRecommendation?: string;
};

export type FusionDesign = {
  project: FusionProjectInput;
  profile: PolymeraseProfile;
  selectedA: string;
  selectedB: string;
  effectiveSelectedA: string;
  effectiveSelectedB: string;
  insertSequence: string;
  overlapSequence: string;
  targetSequence: string;
  stageAProduct: string;
  stageBProduct: string;
  finalProduct: string;
  finalProductVerified: boolean;
  primers: PrimerDesign[];
  reactions: ReactionPlan[];
  proteinValidation: ProteinValidation | null;
  specificityTemplates: SpecificityTemplate[];
  offTargetAmplicons: OffTargetAmplicon[];
  primerPairInteractions: PrimerPairInteraction[];
  protocolPlan: ProtocolPlan;
  qualityScore: number;
  qualityBreakdown: DesignQualityBreakdown;
  alternativeDesigns: AlternativeDesign[];
  sequenceChangeProposals: SequenceChangeProposal[];
  issues: string[];
  warnings: string[];
};

export type DesignQualityBreakdown = {
  tmBalance: number;
  bodyFit: number;
  overlap: number;
  structure: number;
  specificity: number;
  synthesis: number;
  total: number;
};

export type AlternativeDesign = {
  id: string;
  label: string;
  priority: 'balanced' | 'low-dimer' | 'short-oligo' | 'high-overlap';
  qualityScore: number;
  qualityBreakdown: DesignQualityBreakdown;
  overlapTm: number;
  tmSpread: number;
  totalOligoLength: number;
  worstNonIntendedDimerDeltaG: number | null;
  highRiskOffTargets: number;
  warnings: string[];
  primers: PrimerDesign[];
  reactions: ReactionPlan[];
};

export type ProteinValidation = {
  enabled: boolean;
  upstreamTranslation: string;
  insertTranslation: string;
  downstreamTranslation: string;
  finalTranslation: string;
  proteinLength: number;
  framePreserved: boolean;
  frameMessage: string;
  upstreamHasTerminalStop: boolean;
  downstreamHasStartCodon: boolean;
  fusedHasPrematureStop: boolean;
  junctionAminoAcids: string;
  linkerAminoAcids: string;
  synonymousOptimization: SynonymousOptimization | null;
  warnings: string[];
};

export type SequenceChangeProposal = {
  id: string;
  kind: 'remove-upstream-stop' | 'remove-downstream-start' | 'synonymous-codon';
  fragment: 'fragment-a' | 'fragment-b';
  start: number;
  end: number;
  from: string;
  to: string;
  approved: boolean;
  label: string;
  description: string;
  aminoAcid?: string;
};

export type SynonymousOptimizationChange = {
  id: string;
  fragment: 'fragment-a' | 'fragment-b';
  codonIndex: number;
  aminoAcid: string;
  start: number;
  from: string;
  to: string;
  accepted: boolean;
};

export type SynonymousOptimization = {
  enabled: boolean;
  applied: boolean;
  changed: boolean;
  windowCodons: number;
  optimizedSelectedA: string;
  optimizedSelectedB: string;
  scoreDelta: number;
  changes: SynonymousOptimizationChange[];
  summary: string;
};

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
  stageAProduct: string;
  stageBProduct: string;
  finalProduct: string;
  finalProductVerified: boolean;
  primers: PrimerDesign[];
  reactions: ReactionPlan[];
  specificityTemplates: SpecificityTemplate[];
  offTargetAmplicons: OffTargetAmplicon[];
  primerPairInteractions: PrimerPairInteraction[];
  protocolPlan: ProtocolPlan;
  qualityScore: number;
  qualityBreakdown: DesignQualityBreakdown;
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

const MIN_BODY_LENGTH = 12;
const MAX_BODY_LENGTH = 28;
const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA']);

export const polymeraseProfiles: Record<PolymeraseId, PolymeraseProfile> = {
  q5: {
    id: 'q5',
    label: 'Q5 High-Fidelity',
    targetBodyTm: 64,
    secondsPerKb: 15,
    minExtensionSeconds: 10,
    gradientSpan: 3,
    annealingTemperature: (lowerPrimerBodyTm) => Math.round(lowerPrimerBodyTm + 3),
  },
  phusion_plus: {
    id: 'phusion_plus',
    label: 'Phusion Plus',
    targetBodyTm: 62,
    secondsPerKb: 20,
    minExtensionSeconds: 15,
    gradientSpan: 4,
    annealingTemperature: (lowerPrimerBodyTm) => Math.round(Math.max(60, lowerPrimerBodyTm)),
  },
};

export const defaultCodingIntent = (): CodingIntent => ({
  upstreamFrame: 0,
  downstreamFrame: 0,
  retainUpstreamStop: false,
  retainDownstreamStart: false,
  linkerRequired: false,
  preserveProtein: false,
  flexibleCodons: 0,
});

export const defaultChangeApprovals = (): ChangeApprovals => ({
  removeUpstreamStop: false,
  removeDownstreamStart: false,
  acceptedSynonymousChanges: [],
});

export const defaultGenomicSpecificitySettings = (): GenomicSpecificitySettings => ({
  organism: '',
  database: 'refseq_representative_genomes',
  notes: '',
});

export const defaultReactionConditions = defaultThermodynamicConditions;
export const defaultProtocolConfig = defaultProtocolSettings;
export const defaultEditorLockConfig = defaultEditorLocks;

type NormalizedRange = {
  start: number;
  end: number;
  clamped: boolean;
  wrapsOrigin: boolean;
};

function clampRange(length: number, topology: SequenceTopology, start: number, end: number): NormalizedRange {
  if (length <= 0) {
    return { start: 1, end: 0, clamped: true, wrapsOrigin: false };
  }

  const safeStart = Number.isFinite(start) ? Math.floor(start) : 1;
  const safeEnd = Number.isFinite(end) ? Math.floor(end) : length;
  const normalizedStart = Math.max(1, Math.min(length, safeStart));
  const normalizedEnd = Math.max(1, Math.min(length, safeEnd));
  const wrapsOrigin = topology === 'circular' && normalizedStart > normalizedEnd;

  if (topology === 'circular') {
    return {
      start: normalizedStart,
      end: normalizedEnd,
      clamped: normalizedStart !== safeStart || normalizedEnd !== safeEnd,
      wrapsOrigin,
    };
  }

  return {
    start: Math.min(normalizedStart, normalizedEnd),
    end: Math.max(normalizedStart, normalizedEnd),
    clamped: normalizedStart !== safeStart || normalizedEnd !== safeEnd || safeStart > safeEnd,
    wrapsOrigin: false,
  };
}

function selectRange(sequenceInput: string, range: NormalizedRange): string {
  const sequence = normalizeSequence(sequenceInput);
  if (!sequence.length || range.end <= 0) {
    return '';
  }

  if (!range.wrapsOrigin) {
    return sequence.slice(Math.max(0, range.start - 1), range.end);
  }

  return `${sequence.slice(range.start - 1)}${sequence.slice(0, range.end)}`;
}

function longestHomopolymerRun(sequenceInput: string): number {
  const sequence = normalizeSequence(sequenceInput);
  let best = 0;
  let current = 0;
  let previous = '';

  for (const base of sequence) {
    if (base === previous) {
      current += 1;
    } else {
      current = 1;
      previous = base;
    }

    if (current > best) {
      best = current;
    }
  }

  return best;
}

function chooseBodyCandidate(
  templateSequenceInput: string,
  location: 'start' | 'end',
  primerDirection: 'forward' | 'reverse',
  targetTm: number,
  reactionConditions: ThermodynamicConditions,
): CandidateBody {
  return enumerateBodyCandidates(templateSequenceInput, location, primerDirection, targetTm, reactionConditions, 1)[0];
}

function enumerateBodyCandidates(
  templateSequenceInput: string,
  location: 'start' | 'end',
  primerDirection: 'forward' | 'reverse',
  targetTm: number,
  reactionConditions: ThermodynamicConditions,
  limit = 4,
): CandidateBody[] {
  const templateSequence = normalizeSequence(templateSequenceInput);
  const maxLength = Math.min(MAX_BODY_LENGTH, templateSequence.length);
  const minLength = templateSequence.length < MIN_BODY_LENGTH ? templateSequence.length : MIN_BODY_LENGTH;
  const candidates: CandidateBody[] = [];

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
    const thermodynamics = calculateNearestNeighborTm(primerSequence, reactionConditions);
    const gcPenalty =
      bodyMetrics.gcPercentage < 40
        ? 40 - bodyMetrics.gcPercentage
        : bodyMetrics.gcPercentage > 60
          ? bodyMetrics.gcPercentage - 60
          : 0;
    const clampPenalty = /[GC]$/.test(primerSequence) ? 0 : 1.5;
    const homopolymerPenalty = Math.max(0, longestHomopolymerRun(primerSequence) - 4) * 1.25;
    const preferredLengthPenalty =
      bodyLength < 18 ? (18 - bodyLength) * 0.45 : bodyLength > 24 ? (bodyLength - 24) * 0.2 : 0;
    const score =
      Math.abs(thermodynamics.correctedTmCelsius - targetTm) +
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

  return candidates.sort((left, right) => left.score - right.score).slice(0, Math.max(1, limit));
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
  const windowCodons = Math.min(Math.max(0, Math.floor(flexibleCodons)), translation.codons.length);

  if (!windowCodons) {
    return null;
  }

  const startCodonIndex = edge === 'end' ? translation.codons.length - windowCodons : 0;
  const originalCodons = translation.codons.slice(startCodonIndex, startCodonIndex + windowCodons);
  const aminoAcids = translation.aminoAcids.slice(startCodonIndex, startCodonIndex + windowCodons).split('');
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

function applyWindowCodons(window: SynonymousWindow | null, codons: string[] | null): string {
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
  const innerReverseBody = chooseBodyCandidate(selectedA, 'end', 'reverse', profile.targetBodyTm, reactionConditions);
  const innerForwardBody = chooseBodyCandidate(selectedB, 'start', 'forward', profile.targetBodyTm, reactionConditions);
  const overlapSequence = `${innerReverseBody.templateSequence}${insertSequence}${innerForwardBody.templateSequence}`;
  const overlapTm = calculateNearestNeighborTm(overlapSequence, reactionConditions).correctedTmCelsius;
  const overlapGc = calculateGcPercentage(overlapSequence);
  const overlapGcPenalty = overlapGc < 40 ? 40 - overlapGc : overlapGc > 60 ? overlapGc - 60 : 0;
  const overlapHomopolymerPenalty = Math.max(0, longestHomopolymerRun(overlapSequence) - 4) * 1.5;

  return (
    innerReverseBody.score +
    innerForwardBody.score +
    Math.abs(innerReverseBody.bodyTm - innerForwardBody.bodyTm) * 0.6 +
    Math.abs(overlapTm - profile.targetBodyTm) * 0.25 +
    overlapGcPenalty * 0.2 +
    overlapHomopolymerPenalty
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
  const upstreamWindow = buildSynonymousWindow('fragment-a', selectedA, coding.upstreamFrame, coding.flexibleCodons, 'end');
  const downstreamWindow = buildSynonymousWindow('fragment-b', selectedB, coding.downstreamFrame, coding.flexibleCodons, 'start');

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
      summary: 'Synonymous optimization was enabled, but there were no in-frame codons available near the junction.',
    };
  }

  const beamWidth = 24;
  const baseUpstreamCodons = upstreamWindow?.originalCodons.slice() ?? [];
  const baseDownstreamCodons = downstreamWindow?.originalCodons.slice() ?? [];
  const evaluateCandidate = (upstreamCodons: string[], downstreamCodons: string[]) => {
    const optimizedSelectedA = upstreamWindow ? applyWindowCodons(upstreamWindow, upstreamCodons) : selectedA;
    const optimizedSelectedB = downstreamWindow ? applyWindowCodons(downstreamWindow, downstreamCodons) : selectedB;
    return {
      upstreamCodons,
      downstreamCodons,
      optimizedSelectedA,
      optimizedSelectedB,
      score: scoreSynonymousJunction(optimizedSelectedA, optimizedSelectedB, insertSequence, profile, reactionConditions),
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
            upstreamWindow.aminoAcids[index] === '*' || !codonsForAminoAcid(upstreamWindow.aminoAcids[index]).length
              ? [codon]
              : synonymousCodonsForCodon(codon),
        }))
      : []),
    ...(downstreamWindow
      ? downstreamWindow.originalCodons.map((codon, index) => ({
          fragment: 'fragment-b' as const,
          index,
          options:
            downstreamWindow.aminoAcids[index] === '*' || !codonsForAminoAcid(downstreamWindow.aminoAcids[index]).length
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
    for (const candidate of expanded.sort((left, right) => left.score - right.score)) {
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

  const best = beam.sort((left, right) => left.score - right.score)[0] ?? baseline;
  const changed =
    (best.optimizedSelectedA !== baseline.optimizedSelectedA || best.optimizedSelectedB !== baseline.optimizedSelectedB) &&
    best.score < baseline.score - 0.25;
  const optimizedSelectedA = changed ? best.optimizedSelectedA : baseline.optimizedSelectedA;
  const optimizedSelectedB = changed ? best.optimizedSelectedB : baseline.optimizedSelectedB;
  const selectedUpstreamCodons = changed ? best.upstreamCodons : baseline.upstreamCodons;
  const selectedDownstreamCodons = changed ? best.downstreamCodons : baseline.downstreamCodons;
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
          start: upstreamWindow.frame + upstreamWindow.codonIndices[index] * 3 + 1,
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
          start: downstreamWindow.frame + downstreamWindow.codonIndices[index] * 3 + 1,
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
    scoreDelta: Number((baseline.score - (changed ? best.score : baseline.score)).toFixed(2)),
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
    if (sequence.slice(startIndex, startIndex + change.from.length) !== change.from) {
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
  const fullOligoThermodynamics = calculateNearestNeighborTm(sequence, reactionConditions);
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

function mergeProducts(stageAProduct: string, stageBProduct: string, overlapSequence: string): string {
  if (stageAProduct.endsWith(overlapSequence) && stageBProduct.startsWith(overlapSequence)) {
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
  const annealingTemperature = profile.annealingTemperature(lowerTm);
  const extensionSeconds = Math.max(profile.minExtensionSeconds, Math.ceil((productLength / 1000) * profile.secondsPerKb));
  const tmSpread = Math.abs(higherTm - lowerTm);

  return {
    name,
    primerNames: [primerA.name, primerB.name],
    productLength,
    annealingTemperature,
    extensionSeconds,
    gradientRecommendation:
      tmSpread >= 3 ? `${annealingTemperature - profile.gradientSpan}-${annealingTemperature + profile.gradientSpan} C` : undefined,
  };
}

function buildSpecificityTemplates(project: FusionProjectInput, stageAProduct: string, stageBProduct: string, finalProduct: string): SpecificityTemplate[] {
  const fragmentASequence = normalizeSequence(project.fragmentA.sequence);
  const fragmentBSequence = normalizeSequence(project.fragmentB.sequence);
  const templates: SpecificityTemplate[] = [
    { id: 'fragment-a', name: project.fragmentA.label, sequence: fragmentASequence, kind: 'imported' },
    { id: 'fragment-a-rc', name: `${project.fragmentA.label} (rev comp)`, sequence: reverseComplement(fragmentASequence), kind: 'reverse-complement' },
    { id: 'fragment-b', name: project.fragmentB.label, sequence: fragmentBSequence, kind: 'imported' },
    { id: 'fragment-b-rc', name: `${project.fragmentB.label} (rev comp)`, sequence: reverseComplement(fragmentBSequence), kind: 'reverse-complement' },
    { id: 'stage-a', name: 'PCR 1A product', sequence: stageAProduct, kind: 'stage-product' },
    { id: 'stage-b', name: 'PCR 1B product', sequence: stageBProduct, kind: 'stage-product' },
    { id: 'final-product', name: 'Final fusion product', sequence: finalProduct, kind: 'final-product' },
  ];
  return templates.filter((template) => template.sequence.length > 0);
}

function clampQuality(value: number): number {
  return Math.max(0.05, Math.min(1, value));
}

function weightedGeometricMean(components: Array<{ value: number; weight: number }>): number {
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  if (!totalWeight) {
    return 0;
  }
  const logMean = components.reduce(
    (sum, component) => sum + (component.weight / totalWeight) * Math.log(clampQuality(component.value)),
    0,
  );
  return Math.exp(logMean);
}

function buildOffTargetAmplicons(
  specificityTemplates: SpecificityTemplate[],
  primers: PrimerDesign[],
): OffTargetAmplicon[] {
  return [
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
}

function scoreDesignVariant(
  profile: PolymeraseProfile,
  primers: PrimerDesign[],
  offTargetAmplicons: OffTargetAmplicon[],
  primerPairInteractions: PrimerPairInteraction[],
  overlapTm: number,
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
  const highRiskOffTargets = offTargetAmplicons.filter((amplicon) => amplicon.risk === 'high').length;
  const watchOffTargets = offTargetAmplicons.filter((amplicon) => amplicon.risk === 'watch').length;
  const nonIntendedInteractions = primerPairInteractions.filter((pair) => !pair.intended && pair.interaction);
  const highRiskInteractions = nonIntendedInteractions.filter((pair) => pair.interaction?.risk === 'High').length;
  const watchRiskInteractions = nonIntendedInteractions.filter((pair) => pair.interaction?.risk === 'Watch').length;
  const worstNonIntendedDimerDeltaG = nonIntendedInteractions.length
    ? Math.min(...nonIntendedInteractions.map((pair) => pair.interaction?.deltaG ?? 0))
    : null;
  const totalOligoLength = primers.reduce((sum, primer) => sum + primer.fullLength, 0);
  const maxPrimerLength = Math.max(...primers.map((primer) => primer.fullLength));

  const tmBalance = clampQuality(1 - innerTmSpread / 8);
  const bodyFit = clampQuality(1 - averageBodyScore / 12);
  const overlap = clampQuality(1 - Math.abs(overlapTm - profile.targetBodyTm) / 12);
  const structure = clampQuality(1 / (1 + highRiskInteractions * 1.2 + watchRiskInteractions * 0.35));
  const specificity = clampQuality(1 / (1 + highRiskOffTargets * 1.5 + watchOffTargets * 0.3));
  const synthesis = clampQuality(1 - Math.max(0, maxPrimerLength - 45) / 30 - Math.max(0, totalOligoLength - 140) / 180);
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
    worstNonIntendedDimerDeltaG: worstNonIntendedDimerDeltaG !== null ? Number(worstNonIntendedDimerDeltaG.toFixed(2)) : null,
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
  const overlapTm = calculateNearestNeighborTm(overlapSequence, normalizedProject.reactionConditions).correctedTmCelsius;
  const stageAProduct = `${effectiveSelectedA}${insertSequence}${bodies.innerForward.templateSequence}`;
  const stageBProduct = `${bodies.innerReverse.templateSequence}${insertSequence}${effectiveSelectedB}`;
  const finalProduct = mergeProducts(stageAProduct, stageBProduct, overlapSequence);
  const targetSequence = `${effectiveSelectedA}${insertSequence}${effectiveSelectedB}`;
  const finalProductVerified = finalProduct === targetSequence;
  const primers = [
    createPrimerDesign('A_outer_F', 'forward', 'fragment-a', 'Amplifies the upstream fragment into PCR 1A.', '', bodies.outerForward, 'PCR 1A', normalizedProject.reactionConditions, null),
    createPrimerDesign(
      'A_inner_R',
      'reverse',
      'fragment-a',
      'Adds the downstream overlap tail onto fragment A.',
      reverseComplement(`${insertSequence}${bodies.innerForward.templateSequence}`),
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
    createPrimerDesign('B_outer_R', 'reverse', 'fragment-b', 'Amplifies the downstream fragment into PCR 1B.', '', bodies.outerReverse, 'PCR 1B', normalizedProject.reactionConditions, null),
  ];
  const specificityTemplates = buildSpecificityTemplates(normalizedProject, stageAProduct, stageBProduct, finalProduct);
  const primersWithSpecificity = primers.map((primer) => ({
    ...primer,
    specificitySites: findPrimerSpecificitySites(primer.name, primer.body, primer.direction, specificityTemplates),
  }));
  const primerPairInteractions: PrimerPairInteraction[] = [];
  for (let firstIndex = 0; firstIndex < primersWithSpecificity.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < primersWithSpecificity.length; secondIndex += 1) {
      const primerA = primersWithSpecificity[firstIndex];
      const primerB = primersWithSpecificity[secondIndex];
      const intended =
        (primerA.name === 'A_inner_R' && primerB.name === 'B_inner_F') ||
        (primerA.name === 'B_inner_F' && primerB.name === 'A_inner_R');
      primerPairInteractions.push({
        primerAName: primerA.name,
        primerBName: primerB.name,
        interaction: analyzeHeterodimer(primerA.sequence, primerB.sequence, normalizedProject.reactionConditions),
        intended,
        note: intended
          ? 'Intended inner-primer complementarity for OE-PCR overlap generation.'
          : 'Cross-dimer interaction between two primers in the current design.',
      });
    }
  }
  const reactions = [
    buildReactionPlan('PCR 1A', primersWithSpecificity[0], primersWithSpecificity[1], stageAProduct.length, profile),
    buildReactionPlan('PCR 1B', primersWithSpecificity[2], primersWithSpecificity[3], stageBProduct.length, profile),
    buildReactionPlan('Fusion PCR', primersWithSpecificity[0], primersWithSpecificity[3], finalProduct.length, profile),
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
  const offTargetAmplicons = buildOffTargetAmplicons(specificityTemplates, primersWithSpecificity);
  const variantWarnings: string[] = [];
  for (const primer of primersWithSpecificity) {
    if (primer.structure.risk !== 'Low') {
      variantWarnings.push(`${primer.name} has ${primer.structure.risk.toLowerCase()} structure risk.`);
    }
    const extraRiskySites = primer.specificitySites.filter(
      (site) =>
        site.risk !== 'low' &&
        !(site.templateId === primer.expectedTemplateId && site.mismatchCount === 0 && site.matchedSequence === primer.bodyTemplateSequence),
    );
    if (extraRiskySites.length) {
      variantWarnings.push(`${primer.name} has ${extraRiskySites.length} additional local specificity match(es) beyond the intended template site.`);
    }
  }
  const innerTmSpread = Math.abs(primersWithSpecificity[1].bodyTm - primersWithSpecificity[2].bodyTm);
  if (innerTmSpread >= 4) {
    variantWarnings.push(`Inner primer body Tm spread is ${innerTmSpread.toFixed(1)} C; consider adjusting the selected ranges.`);
  }
  const highRiskOffTargets = offTargetAmplicons.filter(
    (amplicon) =>
      amplicon.risk === 'high' &&
      (amplicon.templateId.endsWith('-rc') || amplicon.templateId === 'fragment-a' || amplicon.templateId === 'fragment-b'),
  );
  if (highRiskOffTargets.length) {
    variantWarnings.push(`${highRiskOffTargets.length} high-risk unintended amplicon candidate(s) were detected locally.`);
  }
  const riskyCrossDimers = primerPairInteractions.filter((pair) => pair.interaction?.risk === 'High' && !pair.intended);
  if (riskyCrossDimers.length) {
    variantWarnings.push(`${riskyCrossDimers.length} high-risk cross-dimer interaction(s) were detected among the current primers.`);
  }
  const scored = scoreDesignVariant(profile, primersWithSpecificity, offTargetAmplicons, primerPairInteractions, overlapTm);

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
    offTargetAmplicons,
    primerPairInteractions,
    protocolPlan,
    qualityScore: scored.qualityScore,
    qualityBreakdown: scored.qualityBreakdown,
    warnings: variantWarnings,
    totalOligoLength: scored.totalOligoLength,
    worstNonIntendedDimerDeltaG: scored.worstNonIntendedDimerDeltaG,
    highRiskOffTargets: scored.highRiskOffTargets,
  };
}

export function checksumSequence(sequenceInput: string): string {
  const sequence = normalizeSequence(sequenceInput);
  let hash = 2166136261;

  for (let index = 0; index < sequence.length; index += 1) {
    hash ^= sequence.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createEmptyFragment(label: string): FragmentInput {
  return {
    label,
    sequence: '',
    start: 1,
    end: 1,
    topology: 'linear',
    sourceFormat: 'manual',
    importedName: label,
    checksum: checksumSequence(''),
    ambiguousBases: [],
    features: [],
    reverseComplemented: false,
  };
}

export function normalizeFragmentInput(value: Partial<FragmentInput> | undefined, fallbackLabel: string): FragmentInput {
  const label = typeof value?.label === 'string' ? value.label : fallbackLabel;
  const sequence = typeof value?.sequence === 'string' ? value.sequence : '';
  const length = normalizeSequence(sequence).length;

  return {
    label,
    sequence,
    start: typeof value?.start === 'number' ? value.start : 1,
    end: typeof value?.end === 'number' ? value.end : Math.max(length, 1),
    topology: value?.topology === 'circular' ? 'circular' : 'linear',
    sourceFormat:
      value?.sourceFormat === 'plain' ||
      value?.sourceFormat === 'fasta' ||
      value?.sourceFormat === 'genbank' ||
      value?.sourceFormat === 'project'
        ? value.sourceFormat
        : 'manual',
    importedName: typeof value?.importedName === 'string' ? value.importedName : label,
    checksum: typeof value?.checksum === 'string' ? value.checksum : checksumSequence(sequence),
    ambiguousBases: Array.isArray(value?.ambiguousBases) ? value.ambiguousBases.filter((item): item is string => typeof item === 'string') : [],
    features: Array.isArray(value?.features)
      ? value.features.filter(
          (item): item is SequenceFeature =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof item.key === 'string' &&
            typeof item.location === 'string' &&
            typeof item.label === 'string' &&
            typeof item.qualifiers === 'object' &&
            typeof item.crossesOrigin === 'boolean',
        )
      : [],
    reverseComplemented: Boolean(value?.reverseComplemented),
  };
}

export function normalizeReactionConditions(value: Partial<ThermodynamicConditions> | undefined): ThermodynamicConditions {
  const defaults = defaultReactionConditions();
  return {
    monovalentMillimolar: Math.max(value?.monovalentMillimolar ?? defaults.monovalentMillimolar, 0),
    magnesiumMillimolar: Math.max(value?.magnesiumMillimolar ?? defaults.magnesiumMillimolar, 0),
    dntpMillimolar: Math.max(value?.dntpMillimolar ?? defaults.dntpMillimolar, 0),
    oligoNanomolar: Math.max(value?.oligoNanomolar ?? defaults.oligoNanomolar, 1e-6),
    dmsoPercent: Math.max(value?.dmsoPercent ?? defaults.dmsoPercent, 0),
    dmsoFactor: Math.max(value?.dmsoFactor ?? defaults.dmsoFactor, 0),
  };
}

export function normalizeProtocolConfig(value: Partial<ProtocolSettings> | undefined): ProtocolSettings {
  return normalizeProtocolSettings(value);
}

export function normalizeEditorLocks(value: Partial<EditorLocks> | undefined): EditorLocks {
  const defaults = defaultEditorLockConfig();
  return {
    fragmentA: Boolean(value?.fragmentA ?? defaults.fragmentA),
    fragmentB: Boolean(value?.fragmentB ?? defaults.fragmentB),
    fragmentABoundaries: Boolean(value?.fragmentABoundaries ?? defaults.fragmentABoundaries),
    fragmentBBoundaries: Boolean(value?.fragmentBBoundaries ?? defaults.fragmentBBoundaries),
    insertSequence: Boolean(value?.insertSequence ?? defaults.insertSequence),
    polymeraseSettings: Boolean(value?.polymeraseSettings ?? defaults.polymeraseSettings),
  };
}

export function normalizeChangeApprovals(value: Partial<ChangeApprovals> | undefined): ChangeApprovals {
  const defaults = defaultChangeApprovals();
  return {
    removeUpstreamStop: Boolean(value?.removeUpstreamStop ?? defaults.removeUpstreamStop),
    removeDownstreamStart: Boolean(value?.removeDownstreamStart ?? defaults.removeDownstreamStart),
    acceptedSynonymousChanges: Array.isArray(value?.acceptedSynonymousChanges)
      ? value.acceptedSynonymousChanges.filter((item): item is string => typeof item === 'string')
      : defaults.acceptedSynonymousChanges,
  };
}

export function normalizeGenomicSpecificitySettings(
  value: Partial<GenomicSpecificitySettings> | undefined,
): GenomicSpecificitySettings {
  const defaults = defaultGenomicSpecificitySettings();
  return {
    organism: typeof value?.organism === 'string' ? value.organism : defaults.organism,
    database: typeof value?.database === 'string' ? value.database : defaults.database,
    notes: typeof value?.notes === 'string' ? value.notes : defaults.notes,
  };
}

function replaceLastInFrameCodon(sequenceInput: string, frame: 0 | 1 | 2): { sequence: string; removed: boolean; start: number; codon: string } {
  const sequence = normalizeSequence(sequenceInput);
  const codingLength = sequence.length - frame;

  if (codingLength < 3) {
    return { sequence, removed: false, start: 0, codon: '' };
  }

  const remainder = codingLength % 3;
  const lastCodonStart = sequence.length - remainder - 3;
  const lastCodon = sequence.slice(lastCodonStart, lastCodonStart + 3);

  if (!STOP_CODONS.has(lastCodon)) {
    return { sequence, removed: false, start: 0, codon: '' };
  }

  return {
    sequence: `${sequence.slice(0, lastCodonStart)}${sequence.slice(lastCodonStart + 3)}`,
    removed: true,
    start: lastCodonStart + 1,
    codon: lastCodon,
  };
}

function removeFirstInFrameStartCodon(sequenceInput: string, frame: 0 | 1 | 2): { sequence: string; removed: boolean; start: number; codon: string } {
  const sequence = normalizeSequence(sequenceInput);
  const firstCodonStart = frame;
  const firstCodon = sequence.slice(firstCodonStart, firstCodonStart + 3);

  if (firstCodon !== 'ATG') {
    return { sequence, removed: false, start: 0, codon: '' };
  }

  return {
    sequence: `${sequence.slice(0, firstCodonStart)}${sequence.slice(firstCodonStart + 3)}`,
    removed: true,
    start: firstCodonStart + 1,
    codon: firstCodon,
  };
}

function validateProteinFusion(
  mode: DesignMode,
  selectedAInput: string,
  selectedBInput: string,
  effectiveAInput: string,
  effectiveBInput: string,
  insertSequenceInput: string,
  coding: CodingIntent,
  synonymousOptimization: SynonymousOptimization | null,
): ProteinValidation | null {
  if (mode !== 'protein-fusion') {
    return null;
  }

  const selectedA = normalizeSequence(selectedAInput);
  const selectedB = normalizeSequence(selectedBInput);
  const effectiveA = normalizeSequence(effectiveAInput);
  const effectiveB = normalizeSequence(effectiveBInput);
  const insertSequence = normalizeSequence(insertSequenceInput);

  const upstreamTranslation = translateSequence(effectiveA, coding.upstreamFrame);
  const insertTranslation = translateSequence(insertSequence, 0);
  const downstreamTranslation = translateSequence(effectiveB, coding.downstreamFrame);
  const finalCodingSequence = `${effectiveA.slice(coding.upstreamFrame)}${insertSequence}${effectiveB.slice(coding.downstreamFrame)}`;
  const finalTranslation = translateSequence(finalCodingSequence, 0);
  const codingBasesBeforeJunction = Math.max(0, effectiveA.length - coding.upstreamFrame);
  const expectedFrame = coding.downstreamFrame;
  const observedFrame = (codingBasesBeforeJunction + insertSequence.length) % 3;
  const framePreserved = observedFrame === expectedFrame;
  const upstreamFullTranslation = translateSequence(selectedA, coding.upstreamFrame);
  const downstreamFullTranslation = translateSequence(selectedB, coding.downstreamFrame);
  const upstreamHasTerminalStop = upstreamFullTranslation.codons.at(-1) !== undefined && STOP_CODONS.has(upstreamFullTranslation.codons.at(-1)!);
  const downstreamHasStartCodon = downstreamFullTranslation.codons[0] === 'ATG';
  const proteinWarnings: string[] = [];

  if (!framePreserved) {
    const delta = (expectedFrame - observedFrame + 3) % 3;
    proteinWarnings.push(
      `Frameshift: the current junction leaves remainder ${observedFrame}; adjust the inserted sequence by ${delta === 0 ? 3 : delta} base(s) to reach downstream frame ${expectedFrame}.`,
    );
  }

  if (upstreamHasTerminalStop && coding.retainUpstreamStop) {
    proteinWarnings.push('Premature termination: the upstream fragment retains its stop codon.');
  }

  if (downstreamHasStartCodon && coding.retainDownstreamStart) {
    proteinWarnings.push('Unexpected N-terminal methionine: the downstream ATG is retained.');
  }

  if (coding.linkerRequired && !insertSequence.length) {
    proteinWarnings.push('Linker required: protein fusion mode is configured to require an inserted linker sequence.');
  }

  const firstPrematureStop = finalTranslation.stopPositions.find((position) => position < finalTranslation.aminoAcids.length - 1);
  if (firstPrematureStop !== undefined) {
    proteinWarnings.push(`Premature stop codon detected at amino-acid position ${firstPrematureStop + 1} in the fused product.`);
  }

  const junctionAaIndex = Math.max(0, Math.floor(codingBasesBeforeJunction / 3) - 1);

  return {
    enabled: true,
    upstreamTranslation: upstreamTranslation.aminoAcids,
    insertTranslation: insertTranslation.aminoAcids,
    downstreamTranslation: downstreamTranslation.aminoAcids,
    finalTranslation: finalTranslation.aminoAcids,
    proteinLength: finalTranslation.aminoAcids.replace(/\*/g, '').length,
    framePreserved,
    frameMessage: framePreserved
      ? `Reading frame preserved: (${codingBasesBeforeJunction} + ${insertSequence.length}) mod 3 = ${expectedFrame}.`
      : `Reading frame mismatch: (${codingBasesBeforeJunction} + ${insertSequence.length}) mod 3 = ${observedFrame}, expected ${expectedFrame}.`,
    upstreamHasTerminalStop,
    downstreamHasStartCodon,
    fusedHasPrematureStop: firstPrematureStop !== undefined,
    junctionAminoAcids: formatAminoAcidWindow(finalTranslation.aminoAcids, junctionAaIndex),
    linkerAminoAcids: insertTranslation.aminoAcids,
    synonymousOptimization,
    warnings: proteinWarnings,
  };
}

export function buildFusionDesign(projectInput: FusionProjectInput): FusionDesign {
  const profile = polymeraseProfiles[projectInput.polymeraseId] ?? polymeraseProfiles.q5;
  const reactionConditions = normalizeReactionConditions(projectInput.reactionConditions);
  const protocolSettings = normalizeProtocolConfig(projectInput.protocolSettings);
  const editorLocks = normalizeEditorLocks(projectInput.editorLocks);
  const changeApprovals = normalizeChangeApprovals(projectInput.changeApprovals);
  const insertSequence = normalizeSequence(projectInput.insertSequence);
  const normalizedA = normalizeSequence(projectInput.fragmentA.sequence);
  const normalizedB = normalizeSequence(projectInput.fragmentB.sequence);
  const issues: string[] = [];
  const warnings: string[] = [];

  const invalidFragmentA = findInvalidBases(normalizedA, false);
  const invalidFragmentB = findInvalidBases(normalizedB, false);
  const invalidInsert = findInvalidBases(insertSequence, false);

  if (invalidFragmentA.length) {
    issues.push(`Fragment A contains unsupported bases: ${invalidFragmentA.join(', ')}`);
  }
  if (invalidFragmentB.length) {
    issues.push(`Fragment B contains unsupported bases: ${invalidFragmentB.join(', ')}`);
  }
  if (invalidInsert.length) {
    issues.push(`Insert sequence contains unsupported bases: ${invalidInsert.join(', ')}`);
  }
  if (!normalizedA.length) {
    issues.push('Fragment A is empty.');
  }
  if (!normalizedB.length) {
    issues.push('Fragment B is empty.');
  }

  const rangeA = clampRange(normalizedA.length, projectInput.fragmentA.topology, projectInput.fragmentA.start, projectInput.fragmentA.end);
  const rangeB = clampRange(normalizedB.length, projectInput.fragmentB.topology, projectInput.fragmentB.start, projectInput.fragmentB.end);
  const selectedA = selectRange(normalizedA, rangeA);
  const selectedB = selectRange(normalizedB, rangeB);
  let effectiveSelectedA = selectedA;
  let effectiveSelectedB = selectedB;
  let synonymousOptimization: SynonymousOptimization | null = null;
  const sequenceChangeProposals: SequenceChangeProposal[] = [];

  if (rangeA.clamped) {
    warnings.push('Fragment A range was normalized to stay within the sequence bounds.');
  }
  if (rangeB.clamped) {
    warnings.push('Fragment B range was normalized to stay within the sequence bounds.');
  }
  if (selectedA.length < MIN_BODY_LENGTH) {
    warnings.push(`Fragment A contributes only ${selectedA.length} bases to the design, so primer bodies are shorter than preferred.`);
  }
  if (selectedB.length < MIN_BODY_LENGTH) {
    warnings.push(`Fragment B contributes only ${selectedB.length} bases to the design, so primer bodies are shorter than preferred.`);
  }

  if (projectInput.mode === 'protein-fusion') {
    if (!projectInput.coding.retainUpstreamStop) {
      const removed = replaceLastInFrameCodon(selectedA, projectInput.coding.upstreamFrame);
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
        warnings.push('Upstream terminal stop codon removal was approved and applied to the fused coding product.');
      } else if (removed.removed) {
        warnings.push('Upstream stop codon removal is proposed but not yet approved.');
      }
    }

    if (!projectInput.coding.retainDownstreamStart) {
      const removed = removeFirstInFrameStartCodon(selectedB, projectInput.coding.downstreamFrame);
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
          description: 'Remove the initial downstream ATG so the fused coding region does not introduce an extra N-terminal methionine.',
        });
      }
      if (removed.removed && changeApprovals.removeDownstreamStart) {
        effectiveSelectedB = removed.sequence;
        warnings.push('Downstream initial ATG removal was approved and applied to the fused coding product.');
      } else if (removed.removed) {
        warnings.push('Downstream start-codon removal is proposed but not yet approved.');
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
      synonymousOptimization.changes = synonymousOptimization.changes.map((change) => ({
        ...change,
        accepted: accepted.appliedIds.includes(change.id),
      }));
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
      warnings.push(
        accepted.appliedIds.length
          ? `Accepted ${accepted.appliedIds.length} of ${synonymousOptimization.changes.length} proposed synonymous codon change(s).`
          : 'Synonymous optimization produced proposed codon changes pending approval.',
      );
    }
  }

  const normalizedProject: FusionProjectInput = {
    ...projectInput,
    schemaVersion: projectInput.schemaVersion || PROJECT_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
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
    modifiedAt: new Date().toISOString(),
  };

  if (issues.length) {
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
      offTargetAmplicons: [],
      primerPairInteractions: [],
      protocolPlan: buildProtocolPlan(protocolSettings, {
        stageAProductLength: 0,
        stageBProductLength: 0,
        finalProductLength: 0,
      }, [], normalizedProject.polymeraseId, {
        dntpMillimolar: normalizedProject.reactionConditions.dntpMillimolar,
        dmsoPercent: normalizedProject.reactionConditions.dmsoPercent,
      }),
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
      issues,
      warnings,
    };
  }
  const bodyLimit = 4;
  const outerForwardCandidates = enumerateBodyCandidates(effectiveSelectedA, 'start', 'forward', profile.targetBodyTm, normalizedProject.reactionConditions, bodyLimit);
  const innerReverseCandidates = enumerateBodyCandidates(effectiveSelectedA, 'end', 'reverse', profile.targetBodyTm, normalizedProject.reactionConditions, bodyLimit);
  const innerForwardCandidates = enumerateBodyCandidates(effectiveSelectedB, 'start', 'forward', profile.targetBodyTm, normalizedProject.reactionConditions, bodyLimit);
  const outerReverseCandidates = enumerateBodyCandidates(effectiveSelectedB, 'end', 'reverse', profile.targetBodyTm, normalizedProject.reactionConditions, bodyLimit);

  const roughCombinations: CandidateCombination[] = [];
  for (const outerForward of outerForwardCandidates) {
    for (const innerReverse of innerReverseCandidates) {
      for (const innerForward of innerForwardCandidates) {
        for (const outerReverse of outerReverseCandidates) {
          const overlapSequence = `${innerReverse.templateSequence}${insertSequence}${innerForward.templateSequence}`;
          const overlapTm = calculateNearestNeighborTm(overlapSequence, normalizedProject.reactionConditions).correctedTmCelsius;
          const roughScore =
            outerForward.score +
            innerReverse.score +
            innerForward.score +
            outerReverse.score +
            Math.abs(innerReverse.bodyTm - innerForward.bodyTm) * 0.7 +
            Math.abs(overlapTm - profile.targetBodyTm) * 0.35;
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
            candidate.outerForward.bodyLength === combination.outerForward.bodyLength &&
            candidate.innerReverse.bodyLength === combination.innerReverse.bodyLength &&
            candidate.innerForward.bodyLength === combination.innerForward.bodyLength &&
            candidate.outerReverse.bodyLength === combination.outerReverse.bodyLength,
        ) === index,
    )
    .slice(0, 8)
    .map((combination) =>
      buildDesignVariant(normalizedProject, profile, effectiveSelectedA, effectiveSelectedB, insertSequence, {
        outerForward: combination.outerForward,
        innerReverse: combination.innerReverse,
        innerForward: combination.innerForward,
        outerReverse: combination.outerReverse,
      }),
    );

  const bestVariant =
    [...evaluatedVariants].sort((left, right) => right.qualityScore - left.qualityScore || left.warnings.length - right.warnings.length)[0] ??
    buildDesignVariant(
      normalizedProject,
      profile,
      effectiveSelectedA,
      effectiveSelectedB,
      insertSequence,
      {
        outerForward: outerForwardCandidates[0],
        innerReverse: innerReverseCandidates[0],
        innerForward: innerForwardCandidates[0],
        outerReverse: outerReverseCandidates[0],
      },
    );

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

  if (!bestVariant.finalProductVerified) {
    issues.push('The simulated fusion product does not match the requested target sequence.');
  }

  warnings.push(...bestVariant.warnings);
  if (proteinValidation) {
    warnings.push(...proteinValidation.warnings);
  }

  const alternativeDesigns: AlternativeDesign[] = [];
  const alternativeStrategies: Array<{
    priority: AlternativeDesign['priority'];
    label: string;
    selector: (variants: DesignVariant[]) => DesignVariant | undefined;
  }> = [
    {
      priority: 'balanced',
      label: 'Best balanced design',
      selector: (variants) => [...variants].sort((left, right) => right.qualityScore - left.qualityScore)[0],
    },
    {
      priority: 'low-dimer',
      label: 'Lower dimer risk',
      selector: (variants) =>
        [...variants].sort(
          (left, right) =>
            (right.worstNonIntendedDimerDeltaG ?? Number.POSITIVE_INFINITY) - (left.worstNonIntendedDimerDeltaG ?? Number.POSITIVE_INFINITY) ||
            right.qualityScore - left.qualityScore,
        )[0],
    },
    {
      priority: 'short-oligo',
      label: 'Shorter oligos',
      selector: (variants) => [...variants].sort((left, right) => left.totalOligoLength - right.totalOligoLength || right.qualityScore - left.qualityScore)[0],
    },
    {
      priority: 'high-overlap',
      label: 'Higher overlap Tm',
      selector: (variants) => [...variants].sort((left, right) => right.overlapTm - left.overlapTm || right.qualityScore - left.qualityScore)[0],
    },
  ];
  for (const strategy of alternativeStrategies) {
    const variant = strategy.selector(evaluatedVariants);
    if (!variant || alternativeDesigns.some((alternative) => alternative.id === variant.id)) {
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
    offTargetAmplicons: bestVariant.offTargetAmplicons,
    primerPairInteractions: bestVariant.primerPairInteractions,
    protocolPlan: bestVariant.protocolPlan,
    qualityScore: bestVariant.qualityScore,
    qualityBreakdown: bestVariant.qualityBreakdown,
    alternativeDesigns,
    sequenceChangeProposals,
    issues,
    warnings,
  };
}

export function summarizeSequenceMetrics(sequenceInput: string): { length: number; gcPercentage: number; tm: number } {
  const sequence = normalizeSequence(sequenceInput);
  return {
    length: sequence.length,
    gcPercentage: calculateGcPercentage(sequence),
    tm: calculateWallaceTm(sequence),
  };
}
