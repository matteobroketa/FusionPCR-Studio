import { defaultEditorLocks, type EditorLocks } from './editor';
import { normalizeSequence } from './pcr';
import { defaultProtocolSettings, normalizeProtocolSettings, type ProtocolPlan, type ProtocolSettings } from './protocol';
import type { OffTargetAmplicon, PrimerDirection, SpecificitySite, SpecificityTemplate } from './specificity';
import type { PrimerStructureAnalysis, StructureResult } from './structure';
import { defaultThermodynamicConditions, type ThermodynamicConditions, type ThermodynamicResult } from './thermodynamics';

export type PolymeraseId = 'q5' | 'phusion_plus';
export type DesignMode = 'exact' | 'protein-fusion' | 'insertion' | 'deletion' | 'substitution' | 'domain-swap';
export type SourceFormat = 'manual' | 'plain' | 'fasta' | 'genbank' | 'project';
export type SequenceTopology = 'linear' | 'circular';
export type AnnealingRule = 'lower-primer-plus-3c' | 'lower-primer-min-60c';

export const PROJECT_SCHEMA_VERSION = '0.1.0-alpha.3';
export const ENGINE_VERSION = '0.1.0-alpha.3';
export const MIN_BODY_LENGTH = 12;
export const MAX_BODY_LENGTH = 40;

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
  revision: number;
  projectHash: string;
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
  minBodyLength: number;
  maxBodyLength: number;
  targetBodyTm: number;
  secondsPerKb: number;
  minExtensionSeconds: number;
  gradientSpan: number;
  annealingRule: AnnealingRule;
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
  intendedAmplicons: OffTargetAmplicon[];
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

export const polymeraseProfiles: Record<PolymeraseId, PolymeraseProfile> = {
  q5: {
    id: 'q5',
    label: 'Q5 High-Fidelity',
    minBodyLength: 20,
    maxBodyLength: 40,
    targetBodyTm: 64,
    secondsPerKb: 15,
    minExtensionSeconds: 10,
    gradientSpan: 3,
    annealingRule: 'lower-primer-plus-3c',
  },
  phusion_plus: {
    id: 'phusion_plus',
    label: 'Phusion Plus',
    minBodyLength: 18,
    maxBodyLength: 35,
    targetBodyTm: 62,
    secondsPerKb: 20,
    minExtensionSeconds: 15,
    gradientSpan: 4,
    annealingRule: 'lower-primer-min-60c',
  },
};

export function resolveAnnealingTemperature(profile: PolymeraseProfile, lowerPrimerBodyTm: number): number {
  if (profile.annealingRule === 'lower-primer-min-60c') {
    return Math.round(Math.max(60, lowerPrimerBodyTm));
  }

  return Math.round(lowerPrimerBodyTm + 3);
}

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
