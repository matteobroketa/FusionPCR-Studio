import {
  defaultChangeApprovals,
  defaultCodingIntent,
  defaultEditorLockConfig,
  defaultGenomicSpecificitySettings,
  defaultProtocolConfig,
  defaultReactionConditions,
  ENGINE_VERSION,
  normalizeChangeApprovals,
  normalizeEditorLocks,
  normalizeFragmentInput,
  normalizeGenomicSpecificitySettings,
  normalizeProtocolConfig,
  normalizeReactionConditions,
  PROJECT_SCHEMA_VERSION,
  type ChangeApprovals,
  type CodingIntent,
  type DesignMode,
  type FragmentInput,
  type FusionProjectInput,
  type GenomicSpecificitySettings,
} from './fusion';
import type { EditorLocks } from './editor';
import type { ProtocolSettings } from './protocol';
import type { ThermodynamicConditions } from './thermodynamics';

function isFragmentInput(value: unknown): value is FragmentInput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.label === 'string' &&
    typeof candidate.sequence === 'string' &&
    typeof candidate.start === 'number' &&
    typeof candidate.end === 'number'
  );
}

function isFusionProjectInput(value: unknown): value is FusionProjectInput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.polymeraseId === 'string' &&
    typeof candidate.insertSequence === 'string' &&
    typeof candidate.notes === 'string' &&
    isFragmentInput(candidate.fragmentA) &&
    isFragmentInput(candidate.fragmentB)
  );
}

function isCodingIntent(value: unknown): value is CodingIntent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.upstreamFrame === 'number' &&
    typeof candidate.downstreamFrame === 'number' &&
    typeof candidate.retainUpstreamStop === 'boolean' &&
    typeof candidate.retainDownstreamStart === 'boolean' &&
    typeof candidate.linkerRequired === 'boolean' &&
    typeof candidate.preserveProtein === 'boolean' &&
    typeof candidate.flexibleCodons === 'number'
  );
}

function isThermodynamicConditions(value: unknown): value is ThermodynamicConditions {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.monovalentMillimolar === 'number' &&
    typeof candidate.magnesiumMillimolar === 'number' &&
    typeof candidate.dntpMillimolar === 'number' &&
    typeof candidate.oligoNanomolar === 'number' &&
    typeof candidate.dmsoPercent === 'number' &&
    typeof candidate.dmsoFactor === 'number'
  );
}

function isProtocolSettings(value: unknown): value is ProtocolSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.stageAConcentrationNgPerUl === 'number' &&
    typeof candidate.stageBConcentrationNgPerUl === 'number' &&
    typeof candidate.totalTemplatePmol === 'number' &&
    typeof candidate.mixStrategy === 'string' &&
    typeof candidate.stageMixRatioA === 'number' &&
    typeof candidate.stageMixRatioB === 'number' &&
    typeof candidate.primerStockMicromolar === 'number' &&
    typeof candidate.primerWorkingMicromolar === 'number' &&
    typeof candidate.workingStockPrepMicroliters === 'number' &&
    typeof candidate.primerPerReactionMicroliters === 'number' &&
    typeof candidate.stage1TemplatePerReactionMicroliters === 'number' &&
    typeof candidate.reactionVolumeMicroliters === 'number' &&
    typeof candidate.stage1ReactionCountPerProduct === 'number' &&
    typeof candidate.finalReactionCount === 'number' &&
    typeof candidate.overfillPercent === 'number' &&
    typeof candidate.stage1Cycles === 'number' &&
    typeof candidate.finalCycles === 'number'
  );
}

function isEditorLocks(value: unknown): value is EditorLocks {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.fragmentA === 'boolean' &&
    typeof candidate.fragmentB === 'boolean' &&
    typeof candidate.fragmentABoundaries === 'boolean' &&
    typeof candidate.fragmentBBoundaries === 'boolean' &&
    typeof candidate.insertSequence === 'boolean' &&
    typeof candidate.polymeraseSettings === 'boolean'
  );
}

function isChangeApprovals(value: unknown): value is ChangeApprovals {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.removeUpstreamStop === 'boolean' &&
    typeof candidate.removeDownstreamStart === 'boolean' &&
    Array.isArray(candidate.acceptedSynonymousChanges) &&
    candidate.acceptedSynonymousChanges.every((item) => typeof item === 'string')
  );
}

function isGenomicSpecificitySettings(value: unknown): value is GenomicSpecificitySettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.organism === 'string' &&
    typeof candidate.database === 'string' &&
    typeof candidate.notes === 'string'
  );
}

function clampFrame(value: unknown): 0 | 1 | 2 {
  const numeric = typeof value === 'number' ? Math.floor(value) : 0;
  if (numeric <= 0) {
    return 0;
  }
  if (numeric === 1) {
    return 1;
  }
  return 2;
}

export function normalizeImportedProject(value: unknown): FusionProjectInput | null {
  if (!isFusionProjectInput(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const now = new Date().toISOString();
  const codingDefaults = defaultCodingIntent();
  const reactionDefaults = defaultReactionConditions();
  const protocolDefaults = defaultProtocolConfig();
  const editorDefaults = defaultEditorLockConfig();
  const changeApprovalDefaults = defaultChangeApprovals();
  const genomicSpecificityDefaults = defaultGenomicSpecificitySettings();
  const coding = isCodingIntent(candidate.coding)
    ? {
        upstreamFrame: clampFrame(candidate.coding.upstreamFrame),
        downstreamFrame: clampFrame(candidate.coding.downstreamFrame),
        retainUpstreamStop: candidate.coding.retainUpstreamStop,
        retainDownstreamStart: candidate.coding.retainDownstreamStart,
        linkerRequired: candidate.coding.linkerRequired,
        preserveProtein: candidate.coding.preserveProtein,
        flexibleCodons: Math.max(0, Math.floor(candidate.coding.flexibleCodons)),
      }
    : codingDefaults;
  const reactionConditions = isThermodynamicConditions(candidate.reactionConditions)
    ? normalizeReactionConditions(candidate.reactionConditions)
    : reactionDefaults;
  const protocolSettings = isProtocolSettings(candidate.protocolSettings)
    ? normalizeProtocolConfig(candidate.protocolSettings)
    : protocolDefaults;
  const editorLocks = isEditorLocks(candidate.editorLocks)
    ? normalizeEditorLocks(candidate.editorLocks)
    : editorDefaults;
  const changeApprovals = isChangeApprovals(candidate.changeApprovals)
    ? normalizeChangeApprovals(candidate.changeApprovals)
    : changeApprovalDefaults;
  const genomicSpecificity = isGenomicSpecificitySettings(candidate.genomicSpecificity)
    ? normalizeGenomicSpecificitySettings(candidate.genomicSpecificity)
    : genomicSpecificityDefaults;

  return {
    schemaVersion: typeof candidate.schemaVersion === 'string' ? candidate.schemaVersion : PROJECT_SCHEMA_VERSION,
    engineVersion: typeof candidate.engineVersion === 'string' ? candidate.engineVersion : ENGINE_VERSION,
    name: candidate.name as string,
    polymeraseId: candidate.polymeraseId as FusionProjectInput['polymeraseId'],
    mode: (typeof candidate.mode === 'string' ? candidate.mode : 'exact') as DesignMode,
    insertSequence: candidate.insertSequence as string,
    notes: candidate.notes as string,
    coding,
    reactionConditions,
    protocolSettings,
    editorLocks,
    changeApprovals,
    genomicSpecificity,
    fragmentA: normalizeFragmentInput(candidate.fragmentA as Partial<FragmentInput>, 'Fragment A'),
    fragmentB: normalizeFragmentInput(candidate.fragmentB as Partial<FragmentInput>, 'Fragment B'),
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : now,
    modifiedAt: typeof candidate.modifiedAt === 'string' ? candidate.modifiedAt : now,
  };
}

export function loadInitialProject(storageKey: string, fallbackProject: FusionProjectInput): FusionProjectInput {
  if (typeof window === 'undefined') {
    return fallbackProject;
  }

  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    return fallbackProject;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return normalizeImportedProject(parsed) ?? fallbackProject;
  } catch {
    return fallbackProject;
  }
}

export function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
