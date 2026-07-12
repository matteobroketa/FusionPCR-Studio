import { useEffect, useRef, useState, useTransition, type ChangeEvent } from 'react';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { PrimerCard, ReactionCard, SequencePreview, SequenceRail } from './components/designPanels';
import { emptyProject, exampleProject, exampleProjectOptions, exampleProjects, type ExampleProjectId } from './data/example';
import { useFusionDesign } from './hooks/useFusionDesign';
import { useProjectPersistence } from './hooks/useProjectPersistence';
import { describeFeatureSelection, parseFeatureSelection } from './utils/features';
import {
  buildAnnotatedGenbank,
  buildCalculationManifest,
  buildExpectedGelDiagram,
  buildFinalConstructFasta,
  buildJunctionReport,
  buildPipettingTableCsv,
  buildPrimerBlastPackage,
  buildPrimerCsv,
  buildPrimerFasta,
  buildProjectJson,
  buildProtocolText,
  buildStageProductFasta,
  buildThermocyclerProgram,
  buildValidationReport,
} from './utils/export';
import {
  checksumSequence,
  createEmptyFragment,
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
  polymeraseProfiles,
  PROJECT_SCHEMA_VERSION,
  summarizeSequenceMetrics,
  type CodingIntent,
  type ChangeApprovals,
  type DesignMode,
  type FragmentInput,
  type FusionProjectInput,
  type GenomicSpecificitySettings,
} from './utils/fusion';
import {
  deleteSelectedRange,
  duplicateSelectedRange,
  extractSelectedRange,
  insertAtPosition,
  replaceSelectedRange,
  splitFragment,
  trimFragment,
  type EditorLocks,
} from './utils/editor';
import { flipImportedSource, parseSequenceImport, type ImportParseResult, type ImportedSource } from './utils/import';
import { buildMutationPlan, selectedFragmentSequence, type MutationPlannerMode } from './utils/mutation';
import { reverseComplement } from './utils/pcr';
import type { ProtocolSettings } from './utils/protocol';
import {
  buildJunctionSummary,
  getStagePrimerNames,
  getStageSequencePreviews,
  getWorkflowStageLabel,
  summarizeDesignComparison,
  type DesignComparisonSummary,
  type WorkflowStage,
} from './utils/review';
import type { ThermodynamicConditions } from './utils/thermodynamics';
import { downloadText, loadInitialProject, normalizeImportedProject, stampProjectMetadata } from './utils/project';

const STORAGE_KEY = 'fusionpcr-studio-project';
const EXPERIMENTAL_NOTICE_STORAGE_KEY = 'fusionpcr-studio-experimental-notice-dismissed';
const PUBLIC_EXAMPLE_IDS: ExampleProjectId[] = ['protein-fusion', 'exact-fusion'];
const PUBLIC_DESIGN_MODES: DesignMode[] = ['exact', 'protein-fusion'];

type InspectorFocus = 'junction' | 'fragment-a' | 'fragment-b' | 'primer' | 'reaction';
type WorkbenchStep = 'sequences' | 'construct' | 'primers' | 'protocol' | 'export';
type PrimerResultTab = 'overview' | 'sequences' | 'structures' | 'specificity' | 'alternatives';
type ProtocolResultTab = 'overview' | 'setup' | 'cycling' | 'pipetting' | 'products';

type CanvasTracks = {
  sourceFragments: boolean;
  finalConstruct: boolean;
  primerOverlays: boolean;
  gcAndTm: boolean;
  stageProducts: boolean;
  translation: boolean;
  features: boolean;
  riskSummary: boolean;
};

type ComparisonSnapshot = {
  capturedAt: string;
  metrics: DesignComparisonSummary;
};

type MutationPayloadSource = 'manual' | 'donor-selection';

type StepStatusLevel = 'complete' | 'warning' | 'error' | 'pending';
type ConfirmationState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
} | null;

function loadInitialAppProject() {
  return loadInitialProject(STORAGE_KEY, emptyProject);
}

function loadExperimentalNoticeVisibility() {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.localStorage.getItem(EXPERIMENTAL_NOTICE_STORAGE_KEY) !== 'dismissed';
}

function hasProjectSequenceContent(project: FusionProjectInput) {
  return Boolean(project.fragmentA.sequence.trim() || project.fragmentB.sequence.trim());
}

function isProjectNonEmpty(project: FusionProjectInput) {
  return Boolean(
    project.fragmentA.sequence.trim() ||
      project.fragmentB.sequence.trim() ||
      project.insertSequence.trim() ||
      project.notes.trim(),
  );
}

function isPublicExampleId(exampleId: ExampleProjectId) {
  return PUBLIC_EXAMPLE_IDS.includes(exampleId);
}

function isPublicDesignMode(mode: DesignMode) {
  return PUBLIC_DESIGN_MODES.includes(mode);
}

function formatStepStatus(level: StepStatusLevel, text: string) {
  switch (level) {
    case 'complete':
      return `✓ ${text}`;
    case 'warning':
      return `! ${text}`;
    case 'error':
      return `× ${text}`;
    default:
      return `○ ${text}`;
  }
}

function App() {
  const [project, setProject] = useState<FusionProjectInput>(() => loadInitialAppProject());
  const [pastProjects, setPastProjects] = useState<FusionProjectInput[]>([]);
  const [futureProjects, setFutureProjects] = useState<FusionProjectInput[]>([]);
  const [isPending, startTransition] = useTransition();
  const [importError, setImportError] = useState('');
  const [sequenceImportText, setSequenceImportText] = useState('');
  const [sequenceImportError, setSequenceImportError] = useState('');
  const [sequenceImportResult, setSequenceImportResult] = useState<ImportParseResult | null>(null);
  const [featureSelectionMessage, setFeatureSelectionMessage] = useState('');
  const [activeFragmentKey, setActiveFragmentKey] = useState<'fragmentA' | 'fragmentB'>('fragmentA');
  const [editPayload, setEditPayload] = useState('');
  const [editPosition, setEditPosition] = useState(1);
  const [trimAmount, setTrimAmount] = useState(1);
  const [selectedStage, setSelectedStage] = useState<WorkflowStage>('overview');
  const [inspectorFocus, setInspectorFocus] = useState<InspectorFocus>('junction');
  const [activeStep, setActiveStep] = useState<WorkbenchStep>(() => (hasProjectSequenceContent(loadInitialAppProject()) ? 'construct' : 'sequences'));
  const [primerResultTab, setPrimerResultTab] = useState<PrimerResultTab>('overview');
  const [protocolResultTab, setProtocolResultTab] = useState<ProtocolResultTab>('overview');
  const [selectedPrimerName, setSelectedPrimerName] = useState<string | null>(null);
  const [showExperimentalNotice, setShowExperimentalNotice] = useState(() => loadExperimentalNoticeVisibility());
  const [showWorkbench, setShowWorkbench] = useState(() => hasProjectSequenceContent(loadInitialAppProject()));
  const [showSidebar, setShowSidebar] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>(null);
  const [recoverableProjectSnapshot, setRecoverableProjectSnapshot] = useState<FusionProjectInput | null>(null);
  const [comparisonSnapshot, setComparisonSnapshot] = useState<ComparisonSnapshot | null>(null);
  const [canvasTracks, setCanvasTracks] = useState<CanvasTracks>({
    sourceFragments: true,
    finalConstruct: true,
    primerOverlays: true,
    gcAndTm: true,
    stageProducts: true,
    translation: true,
    features: true,
    riskSummary: true,
  });
  const [mutationRecipientKey, setMutationRecipientKey] = useState<'fragmentA' | 'fragmentB'>('fragmentA');
  const [mutationDonorKey, setMutationDonorKey] = useState<'fragmentA' | 'fragmentB'>('fragmentB');
  const [mutationStart, setMutationStart] = useState(1);
  const [mutationEnd, setMutationEnd] = useState(1);
  const [mutationCoordinate, setMutationCoordinate] = useState(1);
  const [mutationPayloadSource, setMutationPayloadSource] = useState<MutationPayloadSource>('manual');
  const [mutationPayloadInput, setMutationPayloadInput] = useState('');
  const [selectedExampleId, setSelectedExampleId] = useState<ExampleProjectId>('protein-fusion');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sequenceFileInputRef = useRef<HTMLInputElement | null>(null);
  const { design, calculationState, isDesignPending, isDesignCurrent, workerError, retry } = useFusionDesign(project);
  const { persistenceState, persistenceError, retryPersistence } = useProjectPersistence(STORAGE_KEY, project);
  const fragmentAMetrics = summarizeSequenceMetrics(project.fragmentA.sequence);
  const fragmentBMetrics = summarizeSequenceMetrics(project.fragmentB.sequence);
  const activeFragment = project[activeFragmentKey];
  const isFragmentALocked = project.editorLocks.fragmentA;
  const isFragmentBLocked = project.editorLocks.fragmentB;
  const isInsertLocked = project.editorLocks.insertSequence;
  const isPolymeraseLocked = project.editorLocks.polymeraseSettings;
  const activeFragmentLocked = activeFragmentKey === 'fragmentA' ? isFragmentALocked : isFragmentBLocked;
  const counterpartFragmentLocked = activeFragmentKey === 'fragmentA' ? isFragmentBLocked : isFragmentALocked;
  const hasCurrentValidDesign =
    isDesignCurrent &&
    calculationState === 'complete' &&
    !workerError &&
    !design.issues.length &&
    design.primers.length > 0 &&
    design.reactions.length > 0;
  const hasExportableDesign = hasCurrentValidDesign;
  const stagePrimerNames = getStagePrimerNames(design, selectedStage);
  const stageSequencePreviews = getStageSequencePreviews(design, selectedStage);
  const junctionSummary = buildJunctionSummary(design);
  const comparisonMetrics = summarizeDesignComparison(design);
  const mutationMode: MutationPlannerMode | null =
    project.mode === 'insertion' || project.mode === 'deletion' || project.mode === 'substitution' || project.mode === 'domain-swap'
      ? project.mode
      : null;
  const mutationRecipient = project[mutationRecipientKey];
  const mutationDonor = project[mutationDonorKey];
  const mutationPayload =
    mutationPayloadSource === 'donor-selection'
      ? selectedFragmentSequence(mutationDonor)
      : mutationPayloadInput;
  const mutationPreview =
    mutationMode === null
      ? null
      : (() => {
          try {
            return buildMutationPlan({
              mode: mutationMode,
              recipient: mutationRecipient,
              coordinate: mutationCoordinate,
              start: mutationStart,
              end: mutationEnd,
              payloadInput: mutationPayload,
              recipientLabel: mutationRecipient.label,
            });
          } catch {
            return null;
          }
        })();
  const visiblePrimers =
    selectedStage === 'overview' || selectedStage === 'verification'
      ? design.primers
      : design.primers.filter((primer) => stagePrimerNames.includes(primer.name));
  const selectedPrimer =
    visiblePrimers.find((primer) => primer.name === selectedPrimerName) ??
    visiblePrimers[0] ??
    null;
  const selectedReaction =
    selectedStage === 'overview' || selectedStage === 'verification'
      ? null
      : design.reactions.find((reaction) => reaction.name === getWorkflowStageLabel(selectedStage));
  const hasSequenceContent = hasProjectSequenceContent(project);
  const activeReaction = selectedReaction ?? design.reactions[0] ?? null;
  const saveStateLabel =
    persistenceState === 'saving'
      ? 'Saving locally'
      : persistenceState === 'saved'
        ? 'Saved locally'
        : persistenceState === 'failed'
          ? 'Local save failed'
          : 'Autosave pending';
  const publicExampleOptions = exampleProjectOptions.filter((option) => isPublicExampleId(option.id));
  const selectedPublicExampleDescription = publicExampleOptions.find((option) => option.id === selectedExampleId)?.description ?? 'Built-in example';
  const sequenceStepStatus: { level: StepStatusLevel; text: string } =
    project.fragmentA.sequence.trim() && project.fragmentB.sequence.trim()
      ? { level: 'complete', text: 'Two sequences loaded' }
      : project.fragmentA.sequence.trim() || project.fragmentB.sequence.trim()
        ? { level: 'warning', text: 'One fragment still missing' }
        : { level: 'pending', text: 'No sequences loaded' };
  const constructStepStatus: { level: StepStatusLevel; text: string } = design.issues.length
    ? { level: 'error', text: `${design.issues.length} blocking issue(s)` }
    : design.finalProductVerified
      ? { level: 'complete', text: 'Target verified' }
      : { level: 'pending', text: 'Target not yet verified' };
  const primerStepStatus: { level: StepStatusLevel; text: string } = !design.primers.length
    ? { level: 'pending', text: 'No primer set yet' }
    : design.warnings.length
      ? { level: 'warning', text: `${design.warnings.length} primer warning(s)` }
      : { level: 'complete', text: `${design.primers.length} primers ready` };
  const protocolStepStatus: { level: StepStatusLevel; text: string } = !design.reactions.length
    ? { level: 'pending', text: 'Protocol not reviewed' }
    : design.issues.length
      ? { level: 'warning', text: 'Protocol blocked by design issues' }
      : { level: 'complete', text: `${design.reactions.length} reactions planned` };
  const exportStepStatus: { level: StepStatusLevel; text: string } = hasExportableDesign
    ? { level: 'complete', text: 'Export ready' }
    : calculationState === 'pending' || calculationState === 'stale'
      ? { level: 'warning', text: 'Waiting for a current calculation' }
      : workerError
        ? { level: 'error', text: 'Calculation failed' }
    : { level: 'pending', text: 'Awaiting runnable design' };
  const compareRows = [
    {
      label: 'Total oligo nt',
      current: String(comparisonMetrics.totalOligoLength),
      baseline: comparisonSnapshot ? String(comparisonSnapshot.metrics.totalOligoLength) : 'n/a',
    },
    {
      label: 'Worst dimer dG',
      current: comparisonMetrics.worstDimerDeltaG !== null ? comparisonMetrics.worstDimerDeltaG.toFixed(1) : 'n/a',
      baseline:
        comparisonSnapshot && comparisonSnapshot.metrics.worstDimerDeltaG !== null
          ? comparisonSnapshot.metrics.worstDimerDeltaG.toFixed(1)
          : 'n/a',
    },
    {
      label: 'Tm spread',
      current: `${comparisonMetrics.tmSpread.toFixed(1)} C`,
      baseline: comparisonSnapshot ? `${comparisonSnapshot.metrics.tmSpread.toFixed(1)} C` : 'n/a',
    },
    {
      label: 'Overlap Tm',
      current: comparisonMetrics.overlapTm !== null ? `${comparisonMetrics.overlapTm.toFixed(1)} C` : 'n/a',
      baseline:
        comparisonSnapshot && comparisonSnapshot.metrics.overlapTm !== null
          ? `${comparisonSnapshot.metrics.overlapTm.toFixed(1)} C`
          : 'n/a',
    },
    {
      label: 'Local off-targets',
      current: String(comparisonMetrics.localOffTargets),
      baseline: comparisonSnapshot ? String(comparisonSnapshot.metrics.localOffTargets) : 'n/a',
    },
  ];

  const commitProject = (
    updater: FusionProjectInput | ((current: FusionProjectInput) => FusionProjectInput),
    options?: { recordHistory?: boolean },
  ) => {
    setProject((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (JSON.stringify(next) === JSON.stringify(current)) {
        return current;
      }
      const stampedProject = stampProjectMetadata(next, current);
      if (options?.recordHistory !== false) {
        setPastProjects((previous) => [...previous.slice(-49), current]);
        setFutureProjects([]);
      }
      return stampedProject;
    });
  };

  const undoProject = () => {
    if (!pastProjects.length) {
      return;
    }
    const previous = pastProjects[pastProjects.length - 1];
    setPastProjects((items) => items.slice(0, -1));
    setFutureProjects((items) => [project, ...items].slice(0, 50));
    setProject(previous);
  };

  const redoProject = () => {
    if (!futureProjects.length) {
      return;
    }
    const [next, ...rest] = futureProjects;
    setFutureProjects(rest);
    setPastProjects((items) => [...items.slice(-49), project]);
    setProject(next);
  };

  useEffect(() => {
    if (hasSequenceContent) {
      setShowWorkbench(true);
    }
  }, [hasSequenceContent]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (showExperimentalNotice) {
      window.localStorage.removeItem(EXPERIMENTAL_NOTICE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(EXPERIMENTAL_NOTICE_STORAGE_KEY, 'dismissed');
  }, [showExperimentalNotice]);

  useEffect(() => {
    if (!visiblePrimers.length) {
      setSelectedPrimerName(null);
      return;
    }

    setSelectedPrimerName((current) => (current && visiblePrimers.some((primer) => primer.name === current) ? current : visiblePrimers[0].name));
  }, [visiblePrimers]);

  const updateProject = <K extends keyof FusionProjectInput>(field: K, value: FusionProjectInput[K]) => {
    commitProject((current) => {
      if (field === 'insertSequence' && current.editorLocks.insertSequence) {
        return current;
      }
      if ((field === 'polymeraseId' || field === 'reactionConditions' || field === 'protocolSettings') && current.editorLocks.polymeraseSettings) {
        return current;
      }
      if ((field === 'fragmentA' && current.editorLocks.fragmentA) || (field === 'fragmentB' && current.editorLocks.fragmentB)) {
        return current;
      }
      return {
        ...current,
        [field]: value,
        modifiedAt: new Date().toISOString(),
      };
    });
  };

  const updateFragment = (
    fragmentKey: 'fragmentA' | 'fragmentB',
    field: keyof FragmentInput,
    value: string | number,
  ) => {
    commitProject((current) => {
      const fragmentLocked = fragmentKey === 'fragmentA' ? current.editorLocks.fragmentA : current.editorLocks.fragmentB;
      const boundaryLocked =
        (fragmentKey === 'fragmentA' && current.editorLocks.fragmentABoundaries) ||
        (fragmentKey === 'fragmentB' && current.editorLocks.fragmentBBoundaries);
      if (fragmentLocked) {
        return current;
      }
      if (boundaryLocked && (field === 'start' || field === 'end')) {
        return current;
      }
      return {
        ...current,
        [fragmentKey]: {
          ...current[fragmentKey],
          [field]: value,
        },
        modifiedAt: new Date().toISOString(),
      };
    });
  };

  const updateFragmentSequence = (fragmentKey: 'fragmentA' | 'fragmentB', value: string) => {
    commitProject((current) => {
      const fragmentLocked = fragmentKey === 'fragmentA' ? current.editorLocks.fragmentA : current.editorLocks.fragmentB;
      if (fragmentLocked) {
        return current;
      }
      const normalizedLength = value.toUpperCase().replace(/\s+/g, '').length;
      const previousLength = current[fragmentKey].sequence.toUpperCase().replace(/\s+/g, '').length;
      const currentFragment = current[fragmentKey];
      const nextEnd =
        normalizedLength === 0
          ? 1
          : previousLength === 0 || currentFragment.end > previousLength
            ? normalizedLength
            : Math.min(currentFragment.end, normalizedLength);
      const nextStart = normalizedLength === 0 ? 1 : Math.min(currentFragment.start, nextEnd);
      return {
        ...current,
        [fragmentKey]: {
          ...currentFragment,
          sequence: value,
          end: nextEnd,
          start: nextStart,
          sourceFormat: 'manual',
          checksum: checksumSequence(value),
          ambiguousBases: Array.from(new Set(value.toUpperCase().match(/N/g) ?? [])),
          features: [],
          reverseComplemented: false,
        },
        modifiedAt: new Date().toISOString(),
      };
    });
  };

  const updateCoding = <K extends keyof CodingIntent>(field: K, value: CodingIntent[K]) => {
    commitProject((current) => ({
      ...current,
      coding: {
        ...current.coding,
        [field]: value,
      },
      modifiedAt: new Date().toISOString(),
    }));
  };

  const updateReactionCondition = <K extends keyof ThermodynamicConditions>(
    field: K,
    value: ThermodynamicConditions[K],
  ) => {
    commitProject((current) => {
      if (current.editorLocks.polymeraseSettings) {
        return current;
      }
      return {
        ...current,
        reactionConditions: {
          ...current.reactionConditions,
          [field]: value,
        },
        modifiedAt: new Date().toISOString(),
      };
    });
  };

  const updateProtocolSetting = <K extends keyof ProtocolSettings>(field: K, value: ProtocolSettings[K]) => {
    commitProject((current) => {
      if (current.editorLocks.polymeraseSettings) {
        return current;
      }
      return {
        ...current,
        protocolSettings: {
          ...current.protocolSettings,
          [field]: value,
        },
        modifiedAt: new Date().toISOString(),
      };
    });
  };

  const updateGenomicSpecificity = <K extends keyof GenomicSpecificitySettings>(
    field: K,
    value: GenomicSpecificitySettings[K],
  ) => {
    commitProject((current) => ({
      ...current,
      genomicSpecificity: {
        ...current.genomicSpecificity,
        [field]: value,
      },
      modifiedAt: new Date().toISOString(),
    }));
  };

  const preserveRecoverableSnapshot = (current: FusionProjectInput) => {
    if (!isProjectNonEmpty(current)) {
      return;
    }

    setRecoverableProjectSnapshot(current);
  };

  const requestProjectReplacement = (action: ConfirmationState extends infer T ? T : never) => {
    if (!isProjectNonEmpty(project)) {
      action?.onConfirm();
      return;
    }

    setConfirmationState(action);
  };

  const loadExample = (exampleId: ExampleProjectId = selectedExampleId) => {
    const runLoad = () => {
      startTransition(() => {
        preserveRecoverableSnapshot(project);
        commitProject(exampleProjects[exampleId] ?? exampleProject);
        setPastProjects([]);
        setFutureProjects([]);
        setImportError('');
        setFeatureSelectionMessage('');
        setShowWorkbench(true);
        setShowMenu(false);
        setActiveStep('construct');
        setInspectorFocus('junction');
        setPrimerResultTab('overview');
        setProtocolResultTab('overview');
      });
    };

    requestProjectReplacement({
      title: 'Replace current project?',
      message: 'Loading a built-in example will replace the current project in the editor. The current project will remain available as a recoverable snapshot.',
      confirmLabel: 'Load built-in example',
      onConfirm: runLoad,
    });
  };

  const resetProject = () => {
    requestProjectReplacement({
      title: 'Clear current project?',
      message: 'This removes the current project from the active editor. The previous project will remain available as a recoverable snapshot until another replacement occurs.',
      confirmLabel: 'Clear project',
      onConfirm: () => {
        startTransition(() => {
          preserveRecoverableSnapshot(project);
          commitProject(emptyProject);
          setPastProjects([]);
          setFutureProjects([]);
          setImportError('');
          setFeatureSelectionMessage('');
          setShowWorkbench(false);
          setShowMenu(false);
          setActiveStep('sequences');
          setInspectorFocus('junction');
          setSelectedPrimerName(null);
        });
      },
    });
  };

  const restorePreviousProject = () => {
    if (!recoverableProjectSnapshot) {
      return;
    }

    startTransition(() => {
      commitProject(recoverableProjectSnapshot);
      setRecoverableProjectSnapshot(null);
      setShowWorkbench(true);
      setShowMenu(false);
      setActiveStep('construct');
      setInspectorFocus('junction');
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleSequenceImportClick = () => {
    sequenceFileInputRef.current?.click();
  };

  const parseSequenceImportText = (rawInput: string) => {
    try {
      const parsed = parseSequenceImport(rawInput);
      setSequenceImportResult(parsed);
      setSequenceImportError('');
      setFeatureSelectionMessage('');
    } catch (error) {
      setSequenceImportResult(null);
      setSequenceImportError(error instanceof Error ? error.message : 'Sequence import failed.');
    }
  };

  const applyImportedSource = (fragmentKey: 'fragmentA' | 'fragmentB', source: ImportedSource) => {
    commitProject((current) => {
      const fragmentLocked = fragmentKey === 'fragmentA' ? current.editorLocks.fragmentA : current.editorLocks.fragmentB;
      if (fragmentLocked) {
        return current;
      }
      return {
        ...current,
        [fragmentKey]: {
          label: source.name,
          sequence: source.sequence,
          start: 1,
          end: source.sequence.length || 1,
          topology: source.topology,
          sourceFormat: source.format,
          importedName: source.name,
          checksum: source.checksum,
          ambiguousBases: source.ambiguousBases,
          features: source.features,
          reverseComplemented: source.reverseComplemented,
        },
        modifiedAt: new Date().toISOString(),
      };
    });
    setShowWorkbench(true);
    setActiveStep('construct');
  };

  const applyFirstTwoImportedSources = () => {
    if (!sequenceImportResult?.records.length) {
      return;
    }

    commitProject((current) => {
      const [first, second] = sequenceImportResult.records;
      const next = {
        ...current,
        fragmentA: current.fragmentA,
        fragmentB: current.fragmentB,
      };
      let changed = false;

      if (first && !current.editorLocks.fragmentA) {
        next.fragmentA = {
          label: first.name,
          sequence: first.sequence,
          start: 1,
          end: first.sequence.length || 1,
          topology: first.topology,
          sourceFormat: first.format,
          importedName: first.name,
          checksum: first.checksum,
          ambiguousBases: first.ambiguousBases,
          features: first.features,
          reverseComplemented: first.reverseComplemented,
        };
        changed = true;
      }

      if (second && !current.editorLocks.fragmentB) {
        next.fragmentB = {
          label: second.name,
          sequence: second.sequence,
          start: 1,
          end: second.sequence.length || 1,
          topology: second.topology,
          sourceFormat: second.format,
          importedName: second.name,
          checksum: second.checksum,
          ambiguousBases: second.ambiguousBases,
          features: second.features,
          reverseComplemented: second.reverseComplemented,
        };
        changed = true;
      }

      return changed
        ? {
            ...next,
            modifiedAt: new Date().toISOString(),
          }
        : current;
    });
    setShowWorkbench(true);
    setActiveStep('construct');
  };

  const reverseComplementFragment = (fragmentKey: 'fragmentA' | 'fragmentB') => {
    commitProject((current) => {
      const fragmentLocked = fragmentKey === 'fragmentA' ? current.editorLocks.fragmentA : current.editorLocks.fragmentB;
      if (fragmentLocked) {
        return current;
      }
      const fragment = current[fragmentKey];
      const sequence = reverseComplement(fragment.sequence);
      return {
        ...current,
        [fragmentKey]: {
          ...fragment,
          sequence,
          checksum: checksumSequence(sequence),
          reverseComplemented: !fragment.reverseComplemented,
          sourceFormat: fragment.sourceFormat === 'project' ? 'project' : 'manual',
          features: [],
        },
        modifiedAt: new Date().toISOString(),
      };
    });
  };

  const applyFeatureSelection = (fragmentKey: 'fragmentA' | 'fragmentB', featureIndex: number) => {
    commitProject((current) => {
      const fragmentLocked = fragmentKey === 'fragmentA' ? current.editorLocks.fragmentA : current.editorLocks.fragmentB;
      const boundaryLocked =
        (fragmentKey === 'fragmentA' && current.editorLocks.fragmentABoundaries) ||
        (fragmentKey === 'fragmentB' && current.editorLocks.fragmentBBoundaries);
      if (fragmentLocked || boundaryLocked) {
        return current;
      }

      const fragment = current[fragmentKey];
      const feature = fragment.features[featureIndex];
      if (!feature) {
        return current;
      }

      const parsed = parseFeatureSelection(feature.location, fragment.topology);
      if (!parsed?.supported) {
        setFeatureSelectionMessage(
          parsed?.reason
            ? `${feature.label}: ${parsed.reason}`
            : `${feature.label}: this feature location is not currently selectable.`,
        );
        return current;
      }

      setFeatureSelectionMessage(
        parsed.complement
          ? `${feature.label} applied as ${parsed.start}-${parsed.end}. This feature is annotated on the complement strand; reverse-complement the fragment manually if you need feature orientation rather than genomic coordinates.`
          : `${feature.label} applied as ${parsed.start}-${parsed.end}${parsed.wrapsOrigin ? ' wraparound coordinates' : ''}.`,
      );

      return {
        ...current,
        [fragmentKey]: {
          ...fragment,
          start: parsed.start,
          end: parsed.end,
        },
        modifiedAt: new Date().toISOString(),
      };
    });
  };

  const toggleEditorLock = (field: keyof EditorLocks) => {
    commitProject((current) => ({
      ...current,
      editorLocks: {
        ...current.editorLocks,
        [field]: !current.editorLocks[field],
      },
      modifiedAt: new Date().toISOString(),
    }));
  };

  const toggleCanvasTrack = (track: keyof CanvasTracks) => {
    setCanvasTracks((current) => ({
      ...current,
      [track]: !current[track],
    }));
  };

  const toggleChangeApproval = (field: Exclude<keyof ChangeApprovals, 'acceptedSynonymousChanges'>) => {
    commitProject((current) => ({
      ...current,
      changeApprovals: {
        ...current.changeApprovals,
        [field]: !current.changeApprovals[field],
      },
      modifiedAt: new Date().toISOString(),
    }));
  };

  const toggleSynonymousChangeApproval = (changeId: string) => {
    commitProject((current) => {
      const accepted = current.changeApprovals.acceptedSynonymousChanges.includes(changeId)
        ? current.changeApprovals.acceptedSynonymousChanges.filter((item) => item !== changeId)
        : [...current.changeApprovals.acceptedSynonymousChanges, changeId];

      return {
        ...current,
        changeApprovals: {
          ...current.changeApprovals,
          acceptedSynonymousChanges: accepted,
        },
        modifiedAt: new Date().toISOString(),
      };
    });
  };

  const captureComparisonSnapshot = () => {
    setComparisonSnapshot({
      capturedAt: new Date().toISOString(),
      metrics: comparisonMetrics,
    });
  };

  const applyMutationWorkflow = () => {
    if (!mutationMode) {
      return;
    }

    commitProject((current) => {
      const recipient = current[mutationRecipientKey];
      const donor = current[mutationDonorKey];
      const payload = mutationPayloadSource === 'donor-selection' ? selectedFragmentSequence(donor) : mutationPayloadInput;
      const plan = buildMutationPlan({
        mode: mutationMode,
        recipient,
        coordinate: mutationCoordinate,
        start: mutationStart,
        end: mutationEnd,
        payloadInput: payload,
        recipientLabel: recipient.label,
      });

      return {
        ...current,
        fragmentA: plan.leftFragment,
        fragmentB: plan.rightFragment,
        insertSequence: plan.insertSequence,
        changeApprovals: defaultChangeApprovals(),
        notes: `${current.notes ? `${current.notes}\n` : ''}${plan.summary}`.trim(),
        modifiedAt: new Date().toISOString(),
      };
    });
    setActiveFragmentKey('fragmentA');
    setInspectorFocus('junction');
    setActiveStep('construct');
    setShowWorkbench(true);
  };

  const applyFragmentEdit = (
    fragmentKey: 'fragmentA' | 'fragmentB',
    operation: (fragment: FragmentInput) => FragmentInput,
  ) => {
    commitProject((current) => {
      const fragmentLocked = fragmentKey === 'fragmentA' ? current.editorLocks.fragmentA : current.editorLocks.fragmentB;
      if (fragmentLocked) {
        return current;
      }
      return {
        ...current,
        [fragmentKey]: operation(current[fragmentKey]),
        modifiedAt: new Date().toISOString(),
      };
    });
  };

  const handleTrim = (side: 'left' | 'right') => {
    applyFragmentEdit(activeFragmentKey, (fragment) => trimFragment(fragment, side, trimAmount));
  };

  const handleExtractSelection = () => {
    applyFragmentEdit(activeFragmentKey, extractSelectedRange);
  };

  const handleDeleteSelection = () => {
    applyFragmentEdit(activeFragmentKey, deleteSelectedRange);
  };

  const handleDuplicateSelection = () => {
    applyFragmentEdit(activeFragmentKey, duplicateSelectedRange);
  };

  const handleReplaceSelection = () => {
    applyFragmentEdit(activeFragmentKey, (fragment) => replaceSelectedRange(fragment, editPayload));
  };

  const handleInsertPayload = () => {
    applyFragmentEdit(activeFragmentKey, (fragment) => insertAtPosition(fragment, editPosition, editPayload));
  };

  const handleSplitActiveFragment = () => {
    commitProject((current) => {
      const activeLocked = activeFragmentKey === 'fragmentA' ? current.editorLocks.fragmentA : current.editorLocks.fragmentB;
      const counterpartLocked = activeFragmentKey === 'fragmentA' ? current.editorLocks.fragmentB : current.editorLocks.fragmentA;
      if (activeLocked || counterpartLocked) {
        return current;
      }
      const [left, right] = splitFragment(current[activeFragmentKey], editPosition, `${current[activeFragmentKey].label} left`, `${current[activeFragmentKey].label} right`);
      return activeFragmentKey === 'fragmentA'
        ? {
            ...current,
            fragmentA: left,
            fragmentB: right,
            modifiedAt: new Date().toISOString(),
          }
        : {
            ...current,
            fragmentA: left,
            fragmentB: right,
            modifiedAt: new Date().toISOString(),
          };
    });
  };

  const handleDuplicateSelectionToInsert = () => {
    commitProject((current) => {
      if (current.editorLocks.insertSequence) {
        return current;
      }
      const fragment = current[activeFragmentKey];
      const sequence = fragment.sequence.toUpperCase().replace(/\s+/g, '');
      const start = Math.max(1, Math.min(fragment.start, sequence.length));
      const end = Math.max(start, Math.min(fragment.end, sequence.length));
      const selected = sequence.slice(start - 1, end);
      return {
        ...current,
        insertSequence: `${current.insertSequence}${selected}`,
        modifiedAt: new Date().toISOString(),
      };
    });
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      const normalized = normalizeImportedProject(parsed);

      if (!normalized) {
        throw new Error('The selected file is not a FusionPCR Studio project JSON document.');
      }

      const applyImportedProject = () => {
        startTransition(() => {
          preserveRecoverableSnapshot(project);
          commitProject(normalized);
          setImportError('');
          setShowWorkbench(true);
          setShowMenu(false);
          setActiveStep('construct');
        });
      };

      if (isProjectNonEmpty(project)) {
        setConfirmationState({
          title: 'Replace current project?',
          message: 'Importing a project JSON will replace the current project in the editor. The current project will remain available as a recoverable snapshot.',
          confirmLabel: 'Import project',
          onConfirm: applyImportedProject,
        });
      } else {
        applyImportedProject();
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Project import failed.');
    } finally {
      event.target.value = '';
    }
  };

  const handleSequenceFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      setSequenceImportText(raw);
      parseSequenceImportText(raw);
    } catch (error) {
      setSequenceImportError(error instanceof Error ? error.message : 'Sequence file import failed.');
      setSequenceImportResult(null);
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="app-shell">
      <main className="app">
        <header className="app-topbar panel">
          <div className="topbar-brand">
            <div className="product-mark" aria-hidden="true">
              FP
            </div>
            <div>
              <strong>FusionPCR Studio</strong>
              <span className="topbar-subtitle">Two-fragment OE-PCR workbench</span>
            </div>
          </div>

          <div className="topbar-actions">
            {!showWorkbench ? (
              <button type="button" className="button button-secondary" onClick={handleImportClick}>
                Open project
              </button>
            ) : null}
            {showWorkbench ? (
              <>
                <label className="topbar-project">
                  <span className="sr-only">Project name</span>
                  <input
                    aria-label="Project name"
                    className="text-input"
                    value={project.name}
                    onChange={(event) => updateProject('name', event.target.value)}
                  />
                </label>
                <div className="topbar-status">
                  <span className={`pill ${persistenceState === 'failed' ? 'pill-alert' : persistenceState === 'saved' ? 'pill-success' : 'pill-watch'}`}>{saveStateLabel}</span>
                  <span className={`pill ${workerError ? 'pill-alert' : calculationState === 'complete' && isDesignCurrent ? 'pill-success' : 'pill-watch'}`}>
                    {workerError ? 'Calculation failed' : calculationState === 'complete' && isDesignCurrent ? 'Calculation complete' : 'Calculating'}
                  </span>
                </div>
                <button type="button" className="button button-secondary" onClick={undoProject} disabled={!pastProjects.length}>
                  Undo
                </button>
                <button type="button" className="button button-secondary" onClick={redoProject} disabled={!futureProjects.length}>
                  Redo
                </button>
              </>
            ) : null}
            <div className="topbar-menu">
              <button type="button" className="button button-secondary" aria-expanded={showMenu} onClick={() => setShowMenu((current) => !current)}>
                Menu
              </button>
              {showMenu ? (
                <div className="menu-panel panel" role="menu" aria-label="Project actions">
                  <button type="button" className="button button-secondary" role="menuitem" onClick={handleImportClick}>
                    Import project JSON
                  </button>
                  <button type="button" className="button button-secondary" role="menuitem" onClick={() => loadExample('exact-fusion')}>
                    Load exact fusion example
                  </button>
                  <button type="button" className="button button-secondary" role="menuitem" onClick={() => loadExample('protein-fusion')}>
                    Load protein fusion example
                  </button>
                  {recoverableProjectSnapshot ? (
                    <button type="button" className="button button-secondary" role="menuitem" onClick={restorePreviousProject}>
                      Restore previous project
                    </button>
                  ) : null}
                  {showWorkbench ? (
                    <button type="button" className="button button-secondary" role="menuitem" onClick={resetProject}>
                      Clear project
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {showExperimentalNotice ? (
          <div className="notice-banner panel" role="status">
            <span>
              Experimental alpha — independently review primers and protocols.
            </span>
            <details className="notice-details">
              <summary>Details</summary>
              <p className="field-helper">
                Primer ranking, structure review, specificity review, and protocol suggestions remain computational aids. Independently review every primer, reconstructed product, and protocol before experimental use.
              </p>
            </details>
            <button type="button" className="button button-secondary" onClick={() => setShowExperimentalNotice(false)}>
              Dismiss
            </button>
          </div>
        ) : null}

        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
        <input ref={sequenceFileInputRef} type="file" accept=".txt,.fa,.fasta,.gb,.gbk,.gbff" hidden onChange={handleSequenceFileImport} />

        {!showWorkbench ? (
          <section className="empty-state panel">
            <div className="empty-state-copy">
              <p className="eyebrow">FusionPCR Studio</p>
              <h1>Design primers and protocols for two-fragment overlap-extension PCR.</h1>
              <p className="hero-text">Load two sequences or start from a built-in example to enter the workbench.</p>
            </div>
            <div className="empty-state-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  setShowWorkbench(true);
                  setActiveStep('sequences');
                }}
              >
                Import sequences
              </button>
              <button type="button" className="button button-secondary" onClick={() => loadExample('exact-fusion')}>
                Load exact fusion example
              </button>
              <button type="button" className="button button-secondary" onClick={() => loadExample('protein-fusion')}>
                Load protein fusion example
              </button>
              <button type="button" className="button button-secondary" onClick={handleImportClick}>
                Open project
              </button>
            </div>
          </section>
        ) : (
          <>
            <div className="workbench-mobile-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowSidebar((current) => !current)}>
                {showSidebar ? 'Hide steps' : 'Show steps'}
              </button>
              <button type="button" className="button button-secondary" onClick={() => setShowInspector((current) => !current)}>
                {showInspector ? 'Hide inspector' : 'Show inspector'}
              </button>
            </div>

            <section className="workbench-layout">
              <aside className={`workflow-sidebar panel ${showSidebar ? 'is-open' : ''}`}>
                <div className="sidebar-header">
                  <p className="eyebrow">Design steps</p>
                  <h2>Workflow</h2>
                </div>

                <div className="workflow-step-list" role="tablist" aria-label="Design steps">
                  {([
                    ['sequences', 'Sequences', sequenceStepStatus],
                    ['construct', 'Junction', constructStepStatus],
                    ['primers', 'Primers', primerStepStatus],
                    ['protocol', 'Protocol & Export', protocolStepStatus],
                  ] as Array<[WorkbenchStep, string, { level: StepStatusLevel; text: string }]>).map(([step, label, status]) => (
                    <button
                      key={step}
                      type="button"
                      className={`workflow-step ${activeStep === step ? 'workflow-step-active' : ''}`}
                      aria-label={`${label} step`}
                      onClick={() => {
                        setActiveStep(step);
                        setShowSidebar(false);
                      }}
                    >
                      <span className="workflow-step-index">{label === 'Sequences' ? 1 : label === 'Junction' ? 2 : label === 'Primers' ? 3 : 4}</span>
                      <span className="workflow-step-copy">
                        <strong>{label}</strong>
                        <span className={`step-status step-status-${status.level}`}>{formatStepStatus(status.level, status.text)}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="sidebar-summary">
                  <div className="metric compact-metric">
                    <span>Selected stage</span>
                    <strong>{getWorkflowStageLabel(selectedStage)}</strong>
                  </div>
                  <div className="metric compact-metric">
                    <span>Target</span>
                    <strong>{design.targetSequence.length} bp</strong>
                  </div>
                  <div className="metric compact-metric">
                    <span>Exact verification</span>
                    <strong>{design.finalProductVerified ? 'Pass' : 'Pending'}</strong>
                  </div>
                </div>

                <div className="sidebar-actions">
                  <button type="button" className="button button-secondary" onClick={resetProject}>
                    Clear project
                  </button>
                </div>
              </aside>

              <section className="workspace-pane">
                {activeStep === 'sequences' ? (
                  <div className="workspace-stack">
                    <section className="panel workspace-section">
                      <div className="panel-header">
                        <div>
                          <p className="eyebrow">Project setup</p>
                          <h2>Sequences and construct definition</h2>
                        </div>
                        <span className="pill pill-muted">{selectedPublicExampleDescription}</span>
                      </div>

                      <div className="field-grid">
                        <label className="field-card">
                          <span className="field-label">Polymerase profile</span>
                          <select
                            className="text-input"
                            value={project.polymeraseId}
                            disabled={isPolymeraseLocked}
                            onChange={(event) => updateProject('polymeraseId', event.target.value as FusionProjectInput['polymeraseId'])}
                          >
                            {Object.values(polymeraseProfiles).map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="field-card">
                          <span className="field-label">Design mode</span>
                          <select
                            aria-label="Design mode"
                            className="text-input"
                            value={project.mode}
                            onChange={(event) => updateProject('mode', event.target.value as DesignMode)}
                          >
                            <option value="exact">Exact fusion</option>
                            <option value="protein-fusion">Protein fusion</option>
                            {!isPublicDesignMode(project.mode) ? (
                              <option value={project.mode} disabled>
                                Experimental mode ({project.mode})
                              </option>
                            ) : null}
                          </select>
                        </label>
                      </div>

                      <label className="field-card">
                        <span className="field-label">Linker or mutation payload</span>
                        <textarea
                          className="sequence-input short-input"
                          value={project.insertSequence}
                          disabled={isInsertLocked}
                          onChange={(event) => updateProject('insertSequence', event.target.value)}
                          placeholder="Optional inserted sequence between the selected fragment ranges"
                          spellCheck={false}
                        />
                        <span className="field-helper">Leave empty for an exact fusion. Use DNA sequence only.</span>
                      </label>

                      <label className="field-card">
                        <span className="field-label">Project notes</span>
                        <textarea
                          aria-label="Project notes"
                          className="sequence-input short-input"
                          value={project.notes}
                          onChange={(event) => updateProject('notes', event.target.value)}
                          placeholder="Optional wet-lab notes, template source, or cloning context"
                        />
                      </label>
                    </section>

                    <section className="panel workspace-section import-panel">
                      <div className="panel-header">
                        <div>
                          <p className="eyebrow">Sequence import</p>
                          <h2>Plain DNA, FASTA, Multi-FASTA, or GenBank</h2>
                        </div>
                      </div>

                      <label className="field-card">
                        <span className="field-label">Import text</span>
                        <textarea
                          aria-label="Import text"
                          className="sequence-input"
                          value={sequenceImportText}
                          onChange={(event) => setSequenceImportText(event.target.value)}
                          placeholder="Paste plain DNA, FASTA, or a GenBank record here"
                          spellCheck={false}
                        />
                      </label>

                      <div className="action-row">
                        <button type="button" className="button button-primary" onClick={() => parseSequenceImportText(sequenceImportText)}>
                          Parse import text
                        </button>
                        <button type="button" className="button button-secondary" onClick={handleSequenceImportClick}>
                          Load sequence file
                        </button>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={applyFirstTwoImportedSources}
                          disabled={!sequenceImportResult?.records.length || (isFragmentALocked && isFragmentBLocked)}
                        >
                          Apply first two records
                        </button>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => {
                            setSequenceImportText('');
                            setSequenceImportError('');
                            setSequenceImportResult(null);
                          }}
                        >
                          Clear import
                        </button>
                      </div>

                      {sequenceImportError ? <p className="status-note status-note-alert">{sequenceImportError}</p> : null}
                      {sequenceImportResult ? (
                        <div className="import-result-stack">
                          <p className="status-note status-note-success">
                            Parsed {sequenceImportResult.records.length} record(s) as {sequenceImportResult.format}.
                          </p>
                          {sequenceImportResult.warnings.length ? (
                            <div className="status-block">
                              <p className="status-title">Import warnings</p>
                              <ul className="status-list">
                                {sequenceImportResult.warnings.map((warning) => (
                                  <li key={warning}>{warning}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          <div className="import-record-grid">
                            {sequenceImportResult.records.map((record) => (
                              <article key={`${record.name}-${record.checksum}`} className="primer-card">
                                <div className="panel-header">
                                  <div>
                                    <h3>{record.name}</h3>
                                    <p>
                                      {record.format} | {record.topology} | {record.sequence.length} bp
                                    </p>
                                  </div>
                                  <span className="pill pill-muted">{record.checksum}</span>
                                </div>
                                <div className="metric-grid compact-grid">
                                  <div className="metric">
                                    <span>Ambiguous bases</span>
                                    <strong>{record.ambiguousBases.join(', ') || 'None'}</strong>
                                  </div>
                                  <div className="metric">
                                    <span>Features</span>
                                    <strong>{record.features.length}</strong>
                                  </div>
                                </div>
                                <code className="sequence-preview compact-preview">{record.sequence}</code>
                                <div className="action-row">
                                  <button type="button" className="button button-secondary" onClick={() => applyImportedSource('fragmentA', record)} disabled={isFragmentALocked}>
                                    Use for fragment A
                                  </button>
                                  <button type="button" className="button button-secondary" onClick={() => applyImportedSource('fragmentB', record)} disabled={isFragmentBLocked}>
                                    Use for fragment B
                                  </button>
                                  <button
                                    type="button"
                                    className="button button-secondary"
                                    onClick={() =>
                                      setSequenceImportResult((current) =>
                                        current
                                          ? {
                                              ...current,
                                              records: current.records.map((item) => (item.checksum === record.checksum ? flipImportedSource(item) : item)),
                                            }
                                          : current,
                                      )
                                    }
                                  >
                                    Reverse complement
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </section>

                    {mutationMode && !isPublicDesignMode(project.mode) ? (
                      <section className="panel workspace-section mutation-panel">
                        <div className="panel-header">
                          <div>
                            <p className="eyebrow">Mutation planner</p>
                            <h2>Recipient-to-flank workflow</h2>
                          </div>
                          <span className="pill pill-muted">{mutationMode}</span>
                        </div>

                        <div className="field-grid">
                          <label className="field-card">
                            <span className="field-label">Recipient fragment</span>
                            <select
                              className="text-input"
                              value={mutationRecipientKey}
                              onChange={(event) => {
                                const nextRecipient = event.target.value as 'fragmentA' | 'fragmentB';
                                setMutationRecipientKey(nextRecipient);
                                if (nextRecipient === mutationDonorKey) {
                                  setMutationDonorKey(nextRecipient === 'fragmentA' ? 'fragmentB' : 'fragmentA');
                                }
                              }}
                            >
                              <option value="fragmentA">Fragment A</option>
                              <option value="fragmentB">Fragment B</option>
                            </select>
                          </label>

                          <label className="field-card">
                            <span className="field-label">Payload source</span>
                            <select
                              className="text-input"
                              value={mutationPayloadSource}
                              disabled={mutationMode === 'deletion'}
                              onChange={(event) => setMutationPayloadSource(event.target.value as MutationPayloadSource)}
                            >
                              <option value="manual">Manual payload</option>
                              <option value="donor-selection">Donor selected range</option>
                            </select>
                          </label>

                          {mutationMode === 'insertion' ? (
                            <label className="field-card">
                              <span className="field-label">Insertion coordinate</span>
                              <input aria-label="Insertion coordinate" className="text-input" type="number" min={1} step="1" value={mutationCoordinate} onChange={(event) => setMutationCoordinate(Math.max(1, Number(event.target.value) || 1))} />
                            </label>
                          ) : (
                            <>
                              <label className="field-card">
                                <span className="field-label">Mutation start</span>
                                <input className="text-input" type="number" min={1} step="1" value={mutationStart} onChange={(event) => setMutationStart(Math.max(1, Number(event.target.value) || 1))} />
                              </label>
                              <label className="field-card">
                                <span className="field-label">Mutation end</span>
                                <input className="text-input" type="number" min={1} step="1" value={mutationEnd} onChange={(event) => setMutationEnd(Math.max(1, Number(event.target.value) || 1))} />
                              </label>
                            </>
                          )}
                        </div>

                        {mutationPayloadSource === 'donor-selection' && mutationMode !== 'deletion' ? (
                          <div className="field-grid">
                            <label className="field-card">
                              <span className="field-label">Donor fragment</span>
                              <select className="text-input" value={mutationDonorKey} onChange={(event) => setMutationDonorKey(event.target.value as 'fragmentA' | 'fragmentB')}>
                                <option value="fragmentA" disabled={mutationRecipientKey === 'fragmentA'}>
                                  Fragment A
                                </option>
                                <option value="fragmentB" disabled={mutationRecipientKey === 'fragmentB'}>
                                  Fragment B
                                </option>
                              </select>
                            </label>
                            <div className="field-card">
                              <span className="field-label">Donor selected range</span>
                              <code className="inline-sequence-preview">{mutationPayload || 'No donor selection available.'}</code>
                            </div>
                          </div>
                        ) : null}

                        {mutationPayloadSource === 'manual' && mutationMode !== 'deletion' ? (
                          <label className="field-card">
                            <span className="field-label">{mutationMode === 'domain-swap' ? 'Swap payload' : 'Mutation payload'}</span>
                            <textarea aria-label="Mutation payload" className="sequence-input short-input" value={mutationPayloadInput} onChange={(event) => setMutationPayloadInput(event.target.value)} placeholder={mutationMode === 'insertion' ? 'Inserted DNA' : 'Replacement DNA'} spellCheck={false} />
                          </label>
                        ) : null}

                        <div className="status-block">
                          <p className="status-title">Planned construct preview</p>
                          {mutationPreview ? (
                            <>
                              <ul className="status-list">
                                <li>{mutationPreview.summary}</li>
                                <li>Left flank: {mutationPreview.leftFragment.sequence.length} bp</li>
                                <li>Removed region: {mutationPreview.removedSequence.length} bp</li>
                                <li>Payload: {mutationPreview.insertSequence.length} bp</li>
                                <li>Right flank: {mutationPreview.rightFragment.sequence.length} bp</li>
                              </ul>
                              <SequencePreview title="Planned target product" sequence={mutationPreview.targetSequence} />
                            </>
                          ) : (
                            <p>Fill in valid recipient coordinates and payload settings to preview the planned construct.</p>
                          )}
                        </div>

                        <button type="button" className="button button-secondary" onClick={applyMutationWorkflow} disabled={!mutationPreview}>
                          Apply mutation workflow
                        </button>
                      </section>
                    ) : null}

                    <section className="workspace-two-column">
                      <section className="panel workspace-section fragment-editor">
                        <div className="panel-header">
                          <div>
                            <p className="eyebrow">Fragment A</p>
                            <h2>{project.fragmentA.label}</h2>
                          </div>
                          <span className="pill pill-muted">{fragmentAMetrics.length} bp</span>
                        </div>

                        <div className="field-grid">
                          <label className="field-card">
                            <span className="field-label">Label</span>
                            <input className="text-input" value={project.fragmentA.label} disabled={isFragmentALocked} onChange={(event) => updateFragment('fragmentA', 'label', event.target.value)} />
                          </label>
                          <label className="field-card">
                            <span className="field-label">GC</span>
                            <input className="text-input" value={`${fragmentAMetrics.gcPercentage.toFixed(1)}%`} readOnly />
                          </label>
                        </div>

                        <label className="field-card">
                          <span className="field-label">Sequence</span>
                          <textarea className="sequence-input" value={project.fragmentA.sequence} disabled={isFragmentALocked} onChange={(event) => updateFragmentSequence('fragmentA', event.target.value)} placeholder="Paste fragment A DNA sequence" spellCheck={false} />
                        </label>

                        <div className="action-row">
                          <button type="button" className="button button-secondary" onClick={() => reverseComplementFragment('fragmentA')} disabled={isFragmentALocked}>
                            Reverse complement A
                          </button>
                          <button type="button" className="button button-secondary" onClick={() => updateProject('fragmentA', createEmptyFragment('Fragment A'))} disabled={isFragmentALocked}>
                            Reset fragment A
                          </button>
                        </div>

                        <div className="field-grid range-grid">
                          <label className="field-card">
                            <span className="field-label">Start</span>
                            <input className="text-input" type="number" value={project.fragmentA.start} disabled={isFragmentALocked || project.editorLocks.fragmentABoundaries} onChange={(event) => updateFragment('fragmentA', 'start', Number(event.target.value) || 1)} />
                          </label>
                          <label className="field-card">
                            <span className="field-label">End</span>
                            <input className="text-input" type="number" value={project.fragmentA.end} disabled={isFragmentALocked || project.editorLocks.fragmentABoundaries} onChange={(event) => updateFragment('fragmentA', 'end', Number(event.target.value) || 1)} />
                          </label>
                        </div>

                        {project.fragmentA.features.length ? (
                          <div className="status-block">
                            <p className="status-title">GenBank features</p>
                            <ul className="status-list">
                              {project.fragmentA.features.slice(0, 6).map((feature, index) => {
                                const selectionSummary = describeFeatureSelection(feature, project.fragmentA.topology);
                                const parsed = parseFeatureSelection(feature.location, project.fragmentA.topology);
                                return (
                                  <li key={`${feature.key}-${feature.location}`}>
                                    {feature.label} ({feature.key}) at {feature.location} - {selectionSummary}
                                    <button type="button" className="button button-secondary inline-button" onClick={() => applyFeatureSelection('fragmentA', index)} disabled={isFragmentALocked || project.editorLocks.fragmentABoundaries || !parsed?.supported}>
                                      Use feature range
                                    </button>
                                  </li>
                                );
                              })}
                              {featureSelectionMessage ? <li>{featureSelectionMessage}</li> : null}
                            </ul>
                          </div>
                        ) : null}
                      </section>

                      <section className="panel workspace-section fragment-editor">
                        <div className="panel-header">
                          <div>
                            <p className="eyebrow">Fragment B</p>
                            <h2>{project.fragmentB.label}</h2>
                          </div>
                          <span className="pill pill-muted">{fragmentBMetrics.length} bp</span>
                        </div>

                        <div className="field-grid">
                          <label className="field-card">
                            <span className="field-label">Label</span>
                            <input className="text-input" value={project.fragmentB.label} disabled={isFragmentBLocked} onChange={(event) => updateFragment('fragmentB', 'label', event.target.value)} />
                          </label>
                          <label className="field-card">
                            <span className="field-label">GC</span>
                            <input className="text-input" value={`${fragmentBMetrics.gcPercentage.toFixed(1)}%`} readOnly />
                          </label>
                        </div>

                        <label className="field-card">
                          <span className="field-label">Sequence</span>
                          <textarea className="sequence-input" value={project.fragmentB.sequence} disabled={isFragmentBLocked} onChange={(event) => updateFragmentSequence('fragmentB', event.target.value)} placeholder="Paste fragment B DNA sequence" spellCheck={false} />
                        </label>

                        <div className="action-row">
                          <button type="button" className="button button-secondary" onClick={() => reverseComplementFragment('fragmentB')} disabled={isFragmentBLocked}>
                            Reverse complement B
                          </button>
                          <button type="button" className="button button-secondary" onClick={() => updateProject('fragmentB', createEmptyFragment('Fragment B'))} disabled={isFragmentBLocked}>
                            Reset fragment B
                          </button>
                        </div>

                        <div className="field-grid range-grid">
                          <label className="field-card">
                            <span className="field-label">Start</span>
                            <input className="text-input" type="number" value={project.fragmentB.start} disabled={isFragmentBLocked || project.editorLocks.fragmentBBoundaries} onChange={(event) => updateFragment('fragmentB', 'start', Number(event.target.value) || 1)} />
                          </label>
                          <label className="field-card">
                            <span className="field-label">End</span>
                            <input className="text-input" type="number" value={project.fragmentB.end} disabled={isFragmentBLocked || project.editorLocks.fragmentBBoundaries} onChange={(event) => updateFragment('fragmentB', 'end', Number(event.target.value) || 1)} />
                          </label>
                        </div>

                        {project.fragmentB.features.length ? (
                          <div className="status-block">
                            <p className="status-title">GenBank features</p>
                            <ul className="status-list">
                              {project.fragmentB.features.slice(0, 6).map((feature, index) => {
                                const selectionSummary = describeFeatureSelection(feature, project.fragmentB.topology);
                                const parsed = parseFeatureSelection(feature.location, project.fragmentB.topology);
                                return (
                                  <li key={`${feature.key}-${feature.location}`}>
                                    {feature.label} ({feature.key}) at {feature.location} - {selectionSummary}
                                    <button type="button" className="button button-secondary inline-button" onClick={() => applyFeatureSelection('fragmentB', index)} disabled={isFragmentBLocked || project.editorLocks.fragmentBBoundaries || !parsed?.supported}>
                                      Use feature range
                                    </button>
                                  </li>
                                );
                              })}
                              {featureSelectionMessage ? <li>{featureSelectionMessage}</li> : null}
                            </ul>
                          </div>
                        ) : null}
                      </section>
                    </section>

                    <details className="panel workspace-section advanced-disclosure">
                      <summary>Advanced settings</summary>

                      <section className="editor-panel advanced-section">
                        <div className="panel-header">
                          <div>
                            <p className="eyebrow">Editing workspace</p>
                            <h3>Explicit reversible fragment operations</h3>
                          </div>
                          <span className="pill pill-muted">History {pastProjects.length}/{futureProjects.length}</span>
                        </div>

                        <div className="field-grid">
                          <label className="field-card">
                            <span className="field-label">Active fragment</span>
                            <select className="text-input" value={activeFragmentKey} onChange={(event) => setActiveFragmentKey(event.target.value as 'fragmentA' | 'fragmentB')}>
                              <option value="fragmentA">Fragment A</option>
                              <option value="fragmentB">Fragment B</option>
                            </select>
                          </label>
                          <label className="field-card">
                            <span className="field-label">Trim amount</span>
                            <input className="text-input" type="number" min={1} step="1" value={trimAmount} onChange={(event) => setTrimAmount(Math.max(1, Number(event.target.value) || 1))} />
                          </label>
                          <label className="field-card">
                            <span className="field-label">Edit position</span>
                            <input className="text-input" type="number" min={1} step="1" value={editPosition} onChange={(event) => setEditPosition(Math.max(1, Number(event.target.value) || 1))} />
                          </label>
                          <label className="field-card">
                            <span className="field-label">Payload / linker / tag</span>
                            <input className="text-input" value={editPayload} onChange={(event) => setEditPayload(event.target.value)} placeholder="DNA payload for insert or replace" />
                          </label>
                        </div>

                        <div className="toggle-grid">
                          <label className="toggle-card"><input type="checkbox" checked={project.editorLocks.fragmentA} onChange={() => toggleEditorLock('fragmentA')} /><span>Lock fragment A</span></label>
                          <label className="toggle-card"><input type="checkbox" checked={project.editorLocks.fragmentB} onChange={() => toggleEditorLock('fragmentB')} /><span>Lock fragment B</span></label>
                          <label className="toggle-card"><input type="checkbox" checked={project.editorLocks.fragmentABoundaries} onChange={() => toggleEditorLock('fragmentABoundaries')} /><span>Lock A boundaries</span></label>
                          <label className="toggle-card"><input type="checkbox" checked={project.editorLocks.fragmentBBoundaries} onChange={() => toggleEditorLock('fragmentBBoundaries')} /><span>Lock B boundaries</span></label>
                          <label className="toggle-card"><input type="checkbox" checked={project.editorLocks.insertSequence} onChange={() => toggleEditorLock('insertSequence')} /><span>Lock inserted sequence</span></label>
                          <label className="toggle-card"><input type="checkbox" checked={project.editorLocks.polymeraseSettings} onChange={() => toggleEditorLock('polymeraseSettings')} /><span>Lock polymerase settings</span></label>
                        </div>

                        <div className="action-row">
                          <button type="button" className="button button-secondary" onClick={() => handleTrim('left')} disabled={activeFragmentLocked}>Trim left</button>
                          <button type="button" className="button button-secondary" onClick={() => handleTrim('right')} disabled={activeFragmentLocked}>Trim right</button>
                          <button type="button" className="button button-secondary" onClick={handleExtractSelection} disabled={activeFragmentLocked}>Extract selection</button>
                          <button type="button" className="button button-secondary" onClick={handleDuplicateSelection} disabled={activeFragmentLocked}>Duplicate selection</button>
                          <button type="button" className="button button-secondary" onClick={handleDeleteSelection} disabled={activeFragmentLocked}>Delete selection</button>
                          <button type="button" className="button button-secondary" onClick={handleReplaceSelection} disabled={activeFragmentLocked || !editPayload.trim()}>Replace selection</button>
                          <button type="button" className="button button-secondary" onClick={handleInsertPayload} disabled={activeFragmentLocked || !editPayload.trim()}>Insert payload</button>
                          <button type="button" className="button button-secondary" onClick={handleSplitActiveFragment} disabled={activeFragmentLocked || counterpartFragmentLocked}>Split to A/B</button>
                          <button type="button" className="button button-secondary" onClick={handleDuplicateSelectionToInsert} disabled={isInsertLocked}>Duplicate to insert</button>
                        </div>
                      </section>

                      {project.mode === 'protein-fusion' ? (
                        <section className="advanced-section protein-form">
                          <div className="panel-header">
                            <div>
                              <p className="eyebrow">Coding intent</p>
                              <h3>Frame and codon handling</h3>
                            </div>
                            <span className={`pill ${design.proteinValidation?.framePreserved ? 'pill-success' : 'pill-watch'}`}>{design.proteinValidation?.framePreserved ? 'Frame preserved' : 'Check frame'}</span>
                          </div>

                          <div className="field-grid">
                            <label className="field-card">
                              <span className="field-label">Upstream frame</span>
                              <select className="text-input" value={project.coding.upstreamFrame} onChange={(event) => updateCoding('upstreamFrame', Number(event.target.value) as 0 | 1 | 2)}>
                                <option value={0}>0</option>
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                              </select>
                            </label>
                            <label className="field-card">
                              <span className="field-label">Downstream frame</span>
                              <select className="text-input" value={project.coding.downstreamFrame} onChange={(event) => updateCoding('downstreamFrame', Number(event.target.value) as 0 | 1 | 2)}>
                                <option value={0}>0</option>
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                              </select>
                            </label>
                          </div>

                          <div className="toggle-grid">
                            <label className="toggle-card"><input type="checkbox" checked={project.coding.retainUpstreamStop} onChange={(event) => updateCoding('retainUpstreamStop', event.target.checked)} /><span>Retain upstream stop codon</span></label>
                            <label className="toggle-card"><input type="checkbox" checked={project.coding.retainDownstreamStart} onChange={(event) => updateCoding('retainDownstreamStart', event.target.checked)} /><span>Retain downstream start codon</span></label>
                            <label className="toggle-card"><input type="checkbox" checked={project.coding.linkerRequired} onChange={(event) => updateCoding('linkerRequired', event.target.checked)} /><span>Require inserted linker</span></label>
                            <label className="toggle-card"><input type="checkbox" checked={project.coding.preserveProtein} onChange={(event) => updateCoding('preserveProtein', event.target.checked)} /><span>Preserve amino-acid sequence near junction</span></label>
                          </div>

                          <label className="field-card">
                            <span className="field-label">Flexible codons</span>
                            <input className="text-input" type="number" min={0} value={project.coding.flexibleCodons} onChange={(event) => updateCoding('flexibleCodons', Math.max(0, Number(event.target.value) || 0))} />
                          </label>

                          <div className="status-block">
                            <p className="status-title">Sequence change approvals</p>
                            {design.sequenceChangeProposals.length ? (
                              <div className="proposal-stack">
                                {design.sequenceChangeProposals.map((proposal) => (
                                  <article key={proposal.id} className="proposal-card">
                                    <div>
                                      <strong>{proposal.label}</strong>
                                      <p className="field-helper">{proposal.description}</p>
                                    </div>
                                    <button
                                      type="button"
                                      className={`button ${proposal.approved ? 'button-primary' : 'button-secondary'}`}
                                      onClick={() => {
                                        if (proposal.kind === 'remove-upstream-stop') {
                                          toggleChangeApproval('removeUpstreamStop');
                                          return;
                                        }
                                        if (proposal.kind === 'remove-downstream-start') {
                                          toggleChangeApproval('removeDownstreamStart');
                                          return;
                                        }
                                        toggleSynonymousChangeApproval(proposal.id);
                                      }}
                                    >
                                      {proposal.approved ? 'Approved' : 'Approve'}
                                    </button>
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <p>No proposed coding-sequence changes are pending for the current protein-fusion design.</p>
                            )}
                          </div>
                        </section>
                      ) : null}

                      <section className="advanced-section thermo-panel">
                        <div className="panel-header">
                          <div>
                            <p className="eyebrow">Thermodynamics</p>
                            <h3>Nearest-neighbour calculation conditions</h3>
                          </div>
                        </div>
                        <div className="field-grid">
                          <label className="field-card"><span className="field-label">Monovalent ions (mM)</span><input className="text-input" type="number" min={0} step="0.1" value={project.reactionConditions.monovalentMillimolar} disabled={isPolymeraseLocked} onChange={(event) => updateReactionCondition('monovalentMillimolar', Math.max(0, Number(event.target.value) || 0))} /></label>
                          <label className="field-card"><span className="field-label">Magnesium (mM)</span><input className="text-input" type="number" min={0} step="0.01" value={project.reactionConditions.magnesiumMillimolar} disabled={isPolymeraseLocked} onChange={(event) => updateReactionCondition('magnesiumMillimolar', Math.max(0, Number(event.target.value) || 0))} /></label>
                          <label className="field-card"><span className="field-label">dNTP total (mM)</span><input className="text-input" type="number" min={0} step="0.01" value={project.reactionConditions.dntpMillimolar} disabled={isPolymeraseLocked} onChange={(event) => updateReactionCondition('dntpMillimolar', Math.max(0, Number(event.target.value) || 0))} /></label>
                          <label className="field-card"><span className="field-label">Oligo concentration (nM)</span><input className="text-input" type="number" min={0.001} step="1" value={project.reactionConditions.oligoNanomolar} disabled={isPolymeraseLocked} onChange={(event) => updateReactionCondition('oligoNanomolar', Math.max(0.001, Number(event.target.value) || 0.001))} /></label>
                          <label className="field-card"><span className="field-label">DMSO (%)</span><input className="text-input" type="number" min={0} step="0.1" value={project.reactionConditions.dmsoPercent} disabled={isPolymeraseLocked} onChange={(event) => updateReactionCondition('dmsoPercent', Math.max(0, Number(event.target.value) || 0))} /></label>
                          <label className="field-card"><span className="field-label">DMSO factor (C/% )</span><input className="text-input" type="number" min={0} step="0.01" value={project.reactionConditions.dmsoFactor} disabled={isPolymeraseLocked} onChange={(event) => updateReactionCondition('dmsoFactor', Math.max(0, Number(event.target.value) || 0))} /></label>
                        </div>
                      </section>

                      <section className="advanced-section specificity-panel">
                        <div className="panel-header">
                          <div>
                            <p className="eyebrow">Genomic specificity</p>
                            <h3>Primer-BLAST handoff</h3>
                          </div>
                        </div>
                        <div className="field-grid">
                          <label className="field-card"><span className="field-label">Organism</span><input className="text-input" value={project.genomicSpecificity.organism} onChange={(event) => updateGenomicSpecificity('organism', event.target.value)} placeholder="Example: Homo sapiens" /></label>
                          <label className="field-card"><span className="field-label">Database</span><input className="text-input" value={project.genomicSpecificity.database} onChange={(event) => updateGenomicSpecificity('database', event.target.value)} placeholder="Example: RefSeq representative genomes" /></label>
                        </div>
                        <label className="field-card">
                          <span className="field-label">Handoff notes</span>
                          <textarea className="sequence-input short-input" value={project.genomicSpecificity.notes} onChange={(event) => updateGenomicSpecificity('notes', event.target.value)} placeholder="Why this external specificity check is needed, target organism, or reviewer notes" />
                        </label>
                        <p className="status-note status-note-alert">Exporting or submitting a Primer-BLAST handoff will move primer and target information outside this local-first application.</p>
                      </section>
                    </details>
                  </div>
                ) : null}

                {activeStep === 'construct' ? (
                  <div className="workspace-stack">
                    <section className="panel workspace-section canvas-panel">
                      <div className="panel-header">
                        <div>
                          <p className="eyebrow">Construct workspace</p>
                          <h2>Stage-aware assembly map</h2>
                        </div>
                        <div className="panel-actions">
                          <span className="pill pill-muted">{getWorkflowStageLabel(selectedStage)}</span>
                          <span className={`pill ${design.finalProductVerified ? 'pill-success' : 'pill-watch'}`}>{design.finalProductVerified ? 'Sequence reconstruction verified.' : 'Calculation pending'}</span>
                        </div>
                      </div>

                      {canvasTracks.sourceFragments ? (
                        <div className="canvas-stack">
                          <SequenceRail label={project.fragmentA.label} sequenceLength={fragmentAMetrics.length} start={design.project.fragmentA.start} end={design.project.fragmentA.end} topology={design.project.fragmentA.topology} accentClass="rail-a" />
                          <SequenceRail label={project.fragmentB.label} sequenceLength={fragmentBMetrics.length} start={design.project.fragmentB.start} end={design.project.fragmentB.end} topology={design.project.fragmentB.topology} accentClass="rail-b" />
                        </div>
                      ) : null}

                      <div className="construct-workspace">
                        <div className="construct-label-row">
                          <span>Fragment A</span>
                          <span>Fragment B</span>
                        </div>
                        <div className="construct-strip">
                          <button type="button" className={`construct-block block-a construct-button ${inspectorFocus === 'fragment-a' ? 'construct-active' : ''}`} style={{ flexGrow: Math.max(design.selectedA.length, 1) }} onClick={() => setInspectorFocus('fragment-a')} aria-pressed={inspectorFocus === 'fragment-a'}>
                            <span>{project.fragmentA.label}</span>
                            <strong>{design.selectedA.length} bp</strong>
                          </button>
                          <button type="button" className={`construct-block block-insert construct-button ${inspectorFocus === 'junction' ? 'construct-active' : ''}`} style={{ flexGrow: Math.max(design.insertSequence.length || design.overlapSequence.length, 1) }} onClick={() => setInspectorFocus('junction')} aria-pressed={inspectorFocus === 'junction'}>
                            <span>{design.insertSequence ? 'J1' : 'Join'}</span>
                            <strong>{design.insertSequence.length ? `${design.insertSequence.length} bp` : `${design.overlapSequence.length} bp overlap`}</strong>
                          </button>
                          <button type="button" className={`construct-block block-b construct-button ${inspectorFocus === 'fragment-b' ? 'construct-active' : ''}`} style={{ flexGrow: Math.max(design.selectedB.length, 1) }} onClick={() => setInspectorFocus('fragment-b')} aria-pressed={inspectorFocus === 'fragment-b'}>
                            <span>{project.fragmentB.label}</span>
                            <strong>{design.selectedB.length} bp</strong>
                          </button>
                        </div>
                      </div>

                      <div className="primer-direction-grid">
                        {visiblePrimers.map((primer) => (
                          <button
                            key={primer.name}
                            type="button"
                            className={`primer-direction-card ${selectedPrimer?.name === primer.name ? 'primer-direction-card-active' : ''}`}
                            onClick={() => {
                              setSelectedPrimerName(primer.name);
                              setInspectorFocus('primer');
                              setShowInspector(true);
                            }}
                          >
                            <strong>{primer.name}</strong>
                            <span>{primer.name.endsWith('_R') ? '← reverse' : 'forward →'}</span>
                            <span>Tail {primer.tail.length || 0} nt · Body {primer.bodyLength} nt</span>
                          </button>
                        ))}
                      </div>

                      <div className="workspace-two-column">
                        {stageSequencePreviews.map((preview) => (
                          <SequencePreview key={preview.label} title={preview.label} sequence={preview.sequence} />
                        ))}
                      </div>

                      {canvasTracks.translation && design.proteinValidation ? (
                        <div className="status-block">
                          <p className="status-title">Protein readout</p>
                          <ul className="status-list">
                            <li>{design.proteinValidation.frameMessage}</li>
                            <li>Junction window: {design.proteinValidation.junctionAminoAcids || 'n/a'}</li>
                            <li>Linker aa: {design.proteinValidation.linkerAminoAcids || 'none'}</li>
                          </ul>
                        </div>
                      ) : null}
                    </section>

                    <details className="panel workspace-section advanced-disclosure">
                      <summary>Advanced settings</summary>
                      <div className="toggle-grid canvas-toggle-grid">
                        <label className="toggle-card"><input type="checkbox" checked={canvasTracks.sourceFragments} onChange={() => toggleCanvasTrack('sourceFragments')} /><span>Source fragments</span></label>
                        <label className="toggle-card"><input type="checkbox" checked={canvasTracks.finalConstruct} onChange={() => toggleCanvasTrack('finalConstruct')} /><span>Final construct</span></label>
                        <label className="toggle-card"><input type="checkbox" checked={canvasTracks.primerOverlays} onChange={() => toggleCanvasTrack('primerOverlays')} /><span>Primer overlays</span></label>
                        <label className="toggle-card"><input type="checkbox" checked={canvasTracks.gcAndTm} onChange={() => toggleCanvasTrack('gcAndTm')} /><span>GC and Tm</span></label>
                        <label className="toggle-card"><input type="checkbox" checked={canvasTracks.stageProducts} onChange={() => toggleCanvasTrack('stageProducts')} /><span>Stage products</span></label>
                        <label className="toggle-card"><input type="checkbox" checked={canvasTracks.translation} onChange={() => toggleCanvasTrack('translation')} /><span>Translation</span></label>
                        <label className="toggle-card"><input type="checkbox" checked={canvasTracks.features} onChange={() => toggleCanvasTrack('features')} /><span>Feature track</span></label>
                        <label className="toggle-card"><input type="checkbox" checked={canvasTracks.riskSummary} onChange={() => toggleCanvasTrack('riskSummary')} /><span>Risk summary</span></label>
                      </div>

                      <div className="action-row">
                        <button type="button" className="button button-secondary" onClick={captureComparisonSnapshot}>
                          {comparisonSnapshot ? 'Refresh pinned design' : 'Pin current design'}
                        </button>
                        {comparisonSnapshot ? (
                          <button type="button" className="button button-secondary" onClick={() => setComparisonSnapshot(null)}>
                            Clear compare
                          </button>
                        ) : null}
                      </div>

                      {comparisonSnapshot ? (
                        <div className="compare-table" role="table" aria-label="Design comparison">
                          <div className="compare-row compare-header" role="row">
                            <span role="columnheader">Metric</span>
                            <strong role="columnheader">Current</strong>
                            <strong role="columnheader">Pinned</strong>
                          </div>
                          {compareRows.map((row) => (
                            <div key={row.label} className="compare-row" role="row">
                              <span role="cell">{row.label}</span>
                              <strong role="cell">{row.current}</strong>
                              <strong role="cell">{row.baseline}</strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="field-helper">Pin the current design to compare total oligo length, dimer severity, Tm spread, overlap Tm, and local off-target counts after each edit.</p>
                      )}
                    </details>
                  </div>
                ) : null}

                {activeStep === 'primers' ? (
                  <div className="workspace-stack">
                    <section className="panel workspace-section">
                      <div className="panel-header">
                        <div>
                          <p className="eyebrow">Primers</p>
                          <h2>Primer results</h2>
                        </div>
                        <span className="pill pill-muted">{visiblePrimers.length} primer(s)</span>
                      </div>

                      <div className="result-tabs">
                        {([
                          ['overview', 'Overview'],
                          ['sequences', 'Primer sequences'],
                          ['structures', 'Structures'],
                          ['specificity', 'Specificity'],
                          ['alternatives', 'Alternatives'],
                        ] as Array<[PrimerResultTab, string]>).map(([tab, label]) => (
                          <button key={tab} type="button" className={`tab-button ${primerResultTab === tab ? 'tab-button-active' : ''}`} onClick={() => setPrimerResultTab(tab)}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {primerResultTab === 'overview' ? (
                        <>
                          <div className="metric-grid">
                            <div className="metric"><span>Primer count</span><strong>{design.primers.length}</strong></div>
                            <div className="metric"><span>Overlap sequence</span><strong>{design.overlapSequence.length} nt</strong></div>
                            <div className="metric"><span>Unintended products</span><strong>{design.offTargetAmplicons.length}</strong></div>
                          </div>
                          <div className="primer-grid">
                            {visiblePrimers.map((primer) => (
                              <PrimerCard
                                key={primer.name}
                                primer={primer}
                                selected={selectedPrimer?.name === primer.name}
                                onSelect={() => {
                                  setSelectedPrimerName(primer.name);
                                  setInspectorFocus('primer');
                                  setShowInspector(true);
                                }}
                              />
                            ))}
                          </div>
                        </>
                      ) : null}

                      {primerResultTab === 'sequences' ? (
                        <div className="primer-grid">
                          {visiblePrimers.map((primer) => (
                            <PrimerCard
                              key={primer.name}
                              primer={primer}
                              selected={selectedPrimer?.name === primer.name}
                              onSelect={() => {
                                setSelectedPrimerName(primer.name);
                                setInspectorFocus('primer');
                                setShowInspector(true);
                              }}
                            />
                          ))}
                        </div>
                      ) : null}

                      {primerResultTab === 'structures' ? (
                        <div className="workspace-two-column">
                          <div className="status-block">
                            <p className="status-title">Approximate structure summary</p>
                            <ul className="status-list">
                              {visiblePrimers.map((primer) => (
                                <li key={`${primer.name}-structure`}>
                                  {primer.name}: hairpin {primer.structure.hairpin ? `${primer.structure.hairpin.deltaG} kcal/mol` : 'none'}, homodimer {primer.structure.homodimer ? `${primer.structure.homodimer.deltaG} kcal/mol` : 'none'}, 3 prime {primer.structure.threePrimeHomodimer?.threePrimePairedBasesA ?? 0}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="status-block">
                            <p className="status-title">Primer pair interactions</p>
                            <ul className="status-list">
                              {design.primerPairInteractions.length ? (
                                design.primerPairInteractions.slice(0, 8).map((pair) => (
                                  <li key={`${pair.primerAName}-${pair.primerBName}`}>
                                    {pair.primerAName}/{pair.primerBName}: {pair.interaction ? `${pair.interaction.risk}, dG ${pair.interaction.deltaG} kcal/mol` : 'none'}{pair.intended ? ' (intended overlap pair)' : ''}
                                  </li>
                                ))
                              ) : (
                                <li>No pairwise interactions were computed.</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      ) : null}

                      {primerResultTab === 'specificity' ? (
                        <div className="workspace-two-column">
                          <div className="status-block">
                            <p className="status-title">Intended amplicons</p>
                            <ul className="status-list">
                              {design.intendedAmplicons.length ? (
                                design.intendedAmplicons.map((amplicon) => (
                                  <li key={`intended-${amplicon.templateId}-${amplicon.forwardPrimerName}-${amplicon.reversePrimerName}-${amplicon.start}`}>
                                    Intended: {amplicon.templateName} {amplicon.forwardPrimerName}/{amplicon.reversePrimerName} predicts {amplicon.length} bp
                                  </li>
                                ))
                              ) : (
                                <li>No intended amplicon models were classified for the current design.</li>
                              )}
                            </ul>
                          </div>
                          <div className="status-block">
                            <p className="status-title">Unintended amplicons</p>
                            <ul className="status-list">
                              {design.offTargetAmplicons.length ? (
                                design.offTargetAmplicons.slice(0, 8).map((amplicon) => (
                                  <li key={`${amplicon.templateId}-${amplicon.forwardPrimerName}-${amplicon.reversePrimerName}-${amplicon.start}`}>
                                    {amplicon.templateName}: {amplicon.forwardPrimerName}/{amplicon.reversePrimerName} predicts {amplicon.length} bp ({amplicon.risk})
                                  </li>
                                ))
                              ) : (
                                <li>No unintended amplicons detected by the current local scan.</li>
                              )}
                            </ul>
                            <p className="field-helper">Exporting a handoff package keeps the app local by default, but submitting it to Primer-BLAST is an external genomic-specificity check.</p>
                          </div>
                        </div>
                      ) : null}

                      {primerResultTab === 'alternatives' ? (
                        <>
                          {comparisonSnapshot ? (
                            <div className="compare-table" role="table" aria-label="Design comparison">
                              <div className="compare-row compare-header" role="row">
                                <span role="columnheader">Metric</span>
                                <strong role="columnheader">Current</strong>
                                <strong role="columnheader">Pinned</strong>
                              </div>
                              {compareRows.map((row) => (
                                <div key={row.label} className="compare-row" role="row">
                                  <span role="cell">{row.label}</span>
                                  <strong role="cell">{row.current}</strong>
                                  <strong role="cell">{row.baseline}</strong>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <div className="candidate-stack">
                            {design.alternativeDesigns.length ? (
                              design.alternativeDesigns.map((candidate) => (
                                <article key={candidate.id} className="candidate-card">
                                  <div className="panel-header">
                                    <div>
                                      <h3>{candidate.label}</h3>
                                      <p className="field-helper">{candidate.priority}</p>
                                    </div>
                                    <span className="pill pill-muted">{candidate.qualityScore.toFixed(3)}</span>
                                  </div>
                                  <ul className="status-list">
                                    <li>Total oligo nt: {candidate.totalOligoLength}</li>
                                    <li>Overlap Tm: {candidate.overlapTm.toFixed(1)} C</li>
                                    <li>Tm spread: {candidate.tmSpread.toFixed(1)} C</li>
                                    <li>Worst non-intended dimer dG: {candidate.worstNonIntendedDimerDeltaG !== null ? `${candidate.worstNonIntendedDimerDeltaG.toFixed(1)} kcal/mol` : 'n/a'}</li>
                                    <li>High-risk off-targets: {candidate.highRiskOffTargets}</li>
                                  </ul>
                                </article>
                              ))
                            ) : (
                              <div className="status-block">
                                <p className="status-title">No alternatives</p>
                                <p>No ranked alternatives were generated for the current search space.</p>
                              </div>
                            )}
                          </div>
                        </>
                      ) : null}
                    </section>
                  </div>
                ) : null}

                {activeStep === 'protocol' ? (
                  <div className="workspace-stack">
                    <section className="panel workspace-section">
                      <div className="panel-header">
                        <div>
                          <p className="eyebrow">Protocol & Export</p>
                          <h2>Reaction planning and deliverables</h2>
                        </div>
                        <span className="pill pill-muted">{project.protocolSettings.mixStrategy}</span>
                      </div>

                      <div className="result-tabs">
                        {([
                          ['overview', 'Overview'],
                          ['setup', 'Reaction setup'],
                          ['cycling', 'Cycling'],
                          ['pipetting', 'Pipetting'],
                          ['products', 'Expected products'],
                        ] as Array<[ProtocolResultTab, string]>).map(([tab, label]) => (
                          <button key={tab} type="button" className={`tab-button ${protocolResultTab === tab ? 'tab-button-active' : ''}`} onClick={() => setProtocolResultTab(tab)}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {protocolResultTab === 'overview' ? (
                        <div className="reaction-stack">
                          {(selectedReaction ? [selectedReaction] : design.reactions).map((reaction) => (
                            <ReactionCard
                              key={reaction.name}
                              reaction={reaction}
                              selected={activeReaction?.name === reaction.name}
                              onSelect={() => {
                                setSelectedStage(reaction.name === 'PCR 1A' ? 'pcr1a' : reaction.name === 'PCR 1B' ? 'pcr1b' : 'fusion');
                                setInspectorFocus('reaction');
                                setShowInspector(true);
                              }}
                            />
                          ))}
                        </div>
                      ) : null}

                      {protocolResultTab === 'setup' ? (
                        <>
                          <div className="field-grid">
                            <label className="field-card"><span className="field-label">Stage A concentration (ng/uL)</span><input className="text-input" type="number" min={0.0001} step="0.1" value={project.protocolSettings.stageAConcentrationNgPerUl} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('stageAConcentrationNgPerUl', Math.max(0.0001, Number(event.target.value) || 0.0001))} /></label>
                            <label className="field-card"><span className="field-label">Stage B concentration (ng/uL)</span><input className="text-input" type="number" min={0.0001} step="0.1" value={project.protocolSettings.stageBConcentrationNgPerUl} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('stageBConcentrationNgPerUl', Math.max(0.0001, Number(event.target.value) || 0.0001))} /></label>
                            <label className="field-card"><span className="field-label">Total target DNA (pmol)</span><input className="text-input" type="number" min={0.000001} step="0.01" value={project.protocolSettings.totalTemplatePmol} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('totalTemplatePmol', Math.max(0.000001, Number(event.target.value) || 0.000001))} /></label>
                            <label className="field-card"><span className="field-label">Mix strategy</span><select className="text-input" value={project.protocolSettings.mixStrategy} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('mixStrategy', event.target.value as ProtocolSettings['mixStrategy'])}><option value="equimolar">1:1 equimolar</option><option value="user-defined">User-defined ratio</option><option value="limiting-a">Fragment A limiting</option><option value="limiting-b">Fragment B limiting</option></select></label>
                            <label className="field-card"><span className="field-label">Mix ratio A</span><input className="text-input" type="number" min={0.000001} step="0.1" value={project.protocolSettings.stageMixRatioA} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('stageMixRatioA', Math.max(0.000001, Number(event.target.value) || 0.000001))} /></label>
                            <label className="field-card"><span className="field-label">Mix ratio B</span><input className="text-input" type="number" min={0.000001} step="0.1" value={project.protocolSettings.stageMixRatioB} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('stageMixRatioB', Math.max(0.000001, Number(event.target.value) || 0.000001))} /></label>
                            <label className="field-card"><span className="field-label">Primer stock (uM)</span><input className="text-input" type="number" min={0.000001} step="0.1" value={project.protocolSettings.primerStockMicromolar} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('primerStockMicromolar', Math.max(0.000001, Number(event.target.value) || 0.000001))} /></label>
                            <label className="field-card"><span className="field-label">Primer working (uM)</span><input className="text-input" type="number" min={0.000001} step="0.1" value={project.protocolSettings.primerWorkingMicromolar} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('primerWorkingMicromolar', Math.max(0.000001, Number(event.target.value) || 0.000001))} /></label>
                            <label className="field-card"><span className="field-label">Working stock prep (uL)</span><input className="text-input" type="number" min={0.000001} step="1" value={project.protocolSettings.workingStockPrepMicroliters} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('workingStockPrepMicroliters', Math.max(0.000001, Number(event.target.value) || 0.000001))} /></label>
                            <label className="field-card"><span className="field-label">Primer per reaction (uL)</span><input className="text-input" type="number" min={0.000001} step="0.1" value={project.protocolSettings.primerPerReactionMicroliters} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('primerPerReactionMicroliters', Math.max(0.000001, Number(event.target.value) || 0.000001))} /></label>
                            <label className="field-card"><span className="field-label">Stage 1 template / reaction (uL)</span><input className="text-input" type="number" min={0.000001} step="0.1" value={project.protocolSettings.stage1TemplatePerReactionMicroliters} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('stage1TemplatePerReactionMicroliters', Math.max(0.000001, Number(event.target.value) || 0.000001))} /></label>
                            <label className="field-card"><span className="field-label">Reaction volume (uL)</span><input className="text-input" type="number" min={0.000001} step="1" value={project.protocolSettings.reactionVolumeMicroliters} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('reactionVolumeMicroliters', Math.max(0.000001, Number(event.target.value) || 0.000001))} /></label>
                            <label className="field-card"><span className="field-label">Stage 1 reactions / product</span><input className="text-input" type="number" min={1} step="1" value={project.protocolSettings.stage1ReactionCountPerProduct} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('stage1ReactionCountPerProduct', Math.max(1, Number(event.target.value) || 1))} /></label>
                            <label className="field-card"><span className="field-label">Final reactions</span><input className="text-input" type="number" min={1} step="1" value={project.protocolSettings.finalReactionCount} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('finalReactionCount', Math.max(1, Number(event.target.value) || 1))} /></label>
                            <label className="field-card"><span className="field-label">Overfill (%)</span><input className="text-input" type="number" min={0} step="1" value={project.protocolSettings.overfillPercent} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('overfillPercent', Math.max(0, Number(event.target.value) || 0))} /></label>
                            <label className="field-card"><span className="field-label">Stage 1 cycles</span><input className="text-input" type="number" min={1} step="1" value={project.protocolSettings.stage1Cycles} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('stage1Cycles', Math.max(1, Number(event.target.value) || 1))} /></label>
                            <label className="field-card"><span className="field-label">Final cycles</span><input className="text-input" type="number" min={1} step="1" value={project.protocolSettings.finalCycles} disabled={isPolymeraseLocked} onChange={(event) => updateProtocolSetting('finalCycles', Math.max(1, Number(event.target.value) || 1))} /></label>
                          </div>

                          <div className="workspace-two-column">
                            <div className="status-block">
                              <p className="status-title">Protocol plan</p>
                              <ul className="status-list">
                                {design.protocolPlan.stageMixEntries.map((entry) => (
                                  <li key={entry.label}>
                                    {entry.label}: {entry.targetPmol.toFixed(3)} pmol, {entry.requiredMassNg.toFixed(2)} ng, {entry.requiredVolumeUl.toFixed(2)} uL at {entry.concentrationNgPerUl} ng/uL
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="status-block">
                              <p className="status-title">Reaction mixes</p>
                              <ul className="status-list">
                                {design.protocolPlan.reactionMixes.map((mix) => (
                                  <li key={mix.name}>
                                    {mix.name}: {mix.totalMasterMixVolumeUl.toFixed(2)} uL total master mix, {mix.cycleCount} cycles, {mix.overfilledReactionCount.toFixed(2)} effective reactions
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </>
                      ) : null}

                      {protocolResultTab === 'cycling' ? (
                        <div className="reaction-stack">
                          {design.reactions.map((reaction) => (
                            <ReactionCard key={reaction.name} reaction={reaction} selected={activeReaction?.name === reaction.name} onSelect={() => setInspectorFocus('reaction')} />
                          ))}
                        </div>
                      ) : null}

                      {protocolResultTab === 'pipetting' ? (
                        <div className="workspace-two-column">
                          <div className="status-block">
                            <p className="status-title">Primer usage</p>
                            <ul className="status-list">
                              {design.protocolPlan.primerUsage.map((entry) => (
                                <li key={entry.primerName}>
                                  {entry.primerName}: {entry.totalWorkingVolumeUl.toFixed(2)} uL total working stock across {entry.reactionsUsingPrimer} reactions
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="status-block">
                            <p className="status-title">Reaction recipes</p>
                            <div className="recipe-stack">
                              {design.protocolPlan.reactionRecipes.map((recipe) => (
                                <article key={recipe.name} className="recipe-card">
                                  <div className="panel-header">
                                    <div>
                                      <h3>{recipe.name}</h3>
                                      <p className="field-helper">{recipe.totalVolumeUl.toFixed(2)} uL total setup volume</p>
                                    </div>
                                  </div>
                                  <ul className="status-list">
                                    {recipe.entries.map((entry) => (
                                      <li key={`${recipe.name}-${entry.label}`}>
                                        {entry.label}: {entry.perReactionVolumeUl.toFixed(2)} uL/reaction, {entry.totalVolumeUl.toFixed(2)} uL total
                                        {entry.note ? ` (${entry.note})` : ''}
                                      </li>
                                    ))}
                                    {recipe.note ? <li>{recipe.note}</li> : null}
                                  </ul>
                                </article>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {protocolResultTab === 'products' ? (
                        <div className="workspace-two-column">
                          {getStageSequencePreviews(design, selectedStage).map((preview) => (
                            <SequencePreview key={preview.label} title={preview.label} sequence={preview.sequence} />
                          ))}
                        </div>
                      ) : null}

                      <section className="panel workspace-section">
                        <div className="panel-header">
                          <div>
                            <p className="eyebrow">Export</p>
                            <h2>Public MVP artifacts</h2>
                          </div>
                          <span className={`pill ${hasExportableDesign ? 'pill-success' : 'pill-watch'}`}>{hasExportableDesign ? 'Export ready' : 'Awaiting runnable design'}</span>
                        </div>

                        <div className="export-grid">
                          <button type="button" className="button button-primary" onClick={() => downloadText('fusionpcr-primers.csv', buildPrimerCsv(design), 'text/csv')} disabled={!hasExportableDesign}>Download oligo CSV</button>
                          <button type="button" className="button button-secondary" onClick={() => downloadText('fusionpcr-primers.fasta', buildPrimerFasta(design), 'text/plain')} disabled={!hasExportableDesign}>Export primer FASTA</button>
                          <button type="button" className="button button-secondary" onClick={() => downloadText('fusionpcr-final-construct.fasta', buildFinalConstructFasta(design), 'text/plain')} disabled={!hasExportableDesign}>Export final construct FASTA</button>
                          <button type="button" className="button button-secondary" onClick={() => downloadText('fusionpcr-protocol.txt', buildProtocolText(design), 'text/plain')} disabled={!hasExportableDesign}>Export printable protocol</button>
                          <button type="button" className="button button-secondary" onClick={() => downloadText('fusionpcr-project.json', buildProjectJson(project), 'application/json')} disabled={!hasExportableDesign}>Export project JSON</button>
                        </div>

                        <div className="workspace-two-column">
                          <div className="status-block">
                            <p className="status-title">Project model</p>
                            <ul className="status-list">
                              <li>Schema version: {design.project.schemaVersion}</li>
                              <li>Engine version: {design.project.engineVersion}</li>
                              <li>Revision: {project.revision}</li>
                              <li>Project hash: {project.projectHash}</li>
                            </ul>
                          </div>
                          <div className="status-block">
                            <p className="status-title">Export readiness</p>
                            <ul className="status-list">
                              <li>{design.primers.length} primer(s) available</li>
                              <li>{design.reactions.length} reaction plan entry(ies)</li>
                              <li>Final product length: {design.finalProduct.length} bp</li>
                              <li>Exact verification: {design.finalProductVerified ? 'pass' : 'pending'}</li>
                            </ul>
                          </div>
                        </div>
                      </section>
                    </section>
                  </div>
                ) : null}

                {activeStep === 'export' ? (
                  <div className="workspace-stack">
                    <section className="panel workspace-section">
                      <div className="panel-header">
                        <div>
                          <p className="eyebrow">Export</p>
                          <h2>Project, sequence, and protocol artifacts</h2>
                        </div>
                        <span className={`pill ${hasExportableDesign ? 'pill-success' : 'pill-watch'}`}>{hasExportableDesign ? 'Export ready' : 'Awaiting runnable design'}</span>
                      </div>

                      <div className="export-grid">
                        <button type="button" className="button button-primary" onClick={() => downloadText('fusionpcr-primers.csv', buildPrimerCsv(design), 'text/csv')} disabled={!hasExportableDesign}>Download oligo CSV</button>
                        <button type="button" className="button button-secondary" onClick={() => downloadText('fusionpcr-primers.fasta', buildPrimerFasta(design), 'text/plain')} disabled={!hasExportableDesign}>Export primer FASTA</button>
                        <button type="button" className="button button-secondary" onClick={() => downloadText('fusionpcr-final-construct.fasta', buildFinalConstructFasta(design), 'text/plain')} disabled={!hasExportableDesign}>Export final construct FASTA</button>
                        <button type="button" className="button button-secondary" onClick={() => downloadText('fusionpcr-protocol.txt', buildProtocolText(design), 'text/plain')} disabled={!hasExportableDesign}>Export printable protocol</button>
                        <button type="button" className="button button-secondary" onClick={() => downloadText('fusionpcr-project.json', buildProjectJson(project), 'application/json')} disabled={!hasExportableDesign}>Export project JSON</button>
                      </div>

                      <div className="workspace-two-column">
                        <div className="status-block">
                          <p className="status-title">Project model</p>
                          <ul className="status-list">
                            <li>Schema version: {design.project.schemaVersion}</li>
                            <li>Engine version: {design.project.engineVersion}</li>
                            <li>Created: {new Date(design.project.createdAt).toLocaleString()}</li>
                            <li>Modified: {new Date(design.project.modifiedAt).toLocaleString()}</li>
                          </ul>
                        </div>
                        <div className="status-block">
                          <p className="status-title">Export readiness</p>
                          <ul className="status-list">
                            <li>{design.primers.length} primer(s) available</li>
                            <li>{design.reactions.length} reaction plan entry(ies)</li>
                            <li>Final product length: {design.finalProduct.length} bp</li>
                            <li>Exact verification: {design.finalProductVerified ? 'pass' : 'pending'}</li>
                          </ul>
                        </div>
                      </div>
                    </section>
                  </div>
                ) : null}
              </section>

              <aside className={`inspector-pane panel ${showInspector ? 'is-open' : ''}`}>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Inspector</p>
                    <h2>
                      {inspectorFocus === 'fragment-a'
                        ? project.fragmentA.label
                        : inspectorFocus === 'fragment-b'
                          ? project.fragmentB.label
                          : inspectorFocus === 'primer'
                            ? selectedPrimer?.name ?? 'Primer'
                            : inspectorFocus === 'reaction'
                              ? activeReaction?.name ?? 'Reaction'
                              : 'Junction 1'}
                    </h2>
                  </div>
                  <span className={`pill ${design.issues.length ? 'pill-alert' : 'pill-success'}`}>{design.issues.length ? `${design.issues.length} issue(s)` : 'Calculation complete'}</span>
                </div>

                {inspectorFocus === 'junction' ? (
                  <div className="status-block">
                    <p className="status-title">Junction 1</p>
                    <div className="property-list">
                      <div className="property-row"><span>Mode</span><strong>{project.mode}</strong></div>
                      <div className="property-row"><span>Inserted sequence</span><code>{junctionSummary.insertSequence || 'Direct join'}</code></div>
                      <div className="property-row"><span>Reading frame</span><strong>{design.proteinValidation ? (design.proteinValidation.framePreserved ? 'Preserved' : 'Shifted') : 'n/a'}</strong></div>
                      <div className="property-row"><span>Overlap</span><strong>{design.overlapSequence.length} bp · {comparisonMetrics.overlapTm !== null ? `${comparisonMetrics.overlapTm.toFixed(1)} C` : 'n/a'}</strong></div>
                    </div>
                    <SequencePreview title="Final junction window" sequence={junctionSummary.finalJunction || design.finalProduct} />
                    <ul className="status-list">
                      <li>A inner R 3 prime annealing region: {junctionSummary.upstreamAnnealRegion || 'n/a'}</li>
                      <li>B inner F 3 prime annealing region: {junctionSummary.downstreamAnnealRegion || 'n/a'}</li>
                      <li>A inner R tail contribution: {junctionSummary.aInnerTailContribution || 'none'}</li>
                      <li>B inner F tail contribution: {junctionSummary.bInnerTailContribution || 'none'}</li>
                    </ul>
                  </div>
                ) : null}

                {inspectorFocus === 'fragment-a' ? (
                  <div className="status-block">
                    <div className="property-list">
                      <div className="property-row"><span>Selected coordinates</span><strong>{design.project.fragmentA.start}-{design.project.fragmentA.end}</strong></div>
                      <div className="property-row"><span>Source format</span><strong>{project.fragmentA.sourceFormat}</strong></div>
                      <div className="property-row"><span>Topology</span><strong>{project.fragmentA.topology}</strong></div>
                      <div className="property-row"><span>Checksum</span><strong>{project.fragmentA.checksum}</strong></div>
                      <div className="property-row"><span>Features</span><strong>{project.fragmentA.features.length}</strong></div>
                    </div>
                  </div>
                ) : null}

                {inspectorFocus === 'fragment-b' ? (
                  <div className="status-block">
                    <div className="property-list">
                      <div className="property-row"><span>Selected coordinates</span><strong>{design.project.fragmentB.start}-{design.project.fragmentB.end}</strong></div>
                      <div className="property-row"><span>Source format</span><strong>{project.fragmentB.sourceFormat}</strong></div>
                      <div className="property-row"><span>Topology</span><strong>{project.fragmentB.topology}</strong></div>
                      <div className="property-row"><span>Checksum</span><strong>{project.fragmentB.checksum}</strong></div>
                      <div className="property-row"><span>Features</span><strong>{project.fragmentB.features.length}</strong></div>
                    </div>
                  </div>
                ) : null}

                {inspectorFocus === 'primer' && selectedPrimer ? (
                  <div className="status-block">
                    <div className="property-list">
                      <div className="property-row"><span>Reaction</span><strong>{selectedPrimer.reaction}</strong></div>
                      <div className="property-row"><span>Role</span><strong>{selectedPrimer.role}</strong></div>
                      <div className="property-row"><span>Body Tm</span><strong>{selectedPrimer.bodyTm.toFixed(1)} C</strong></div>
                      <div className="property-row"><span>Overlap Tm</span><strong>{selectedPrimer.overlapTm !== null ? `${selectedPrimer.overlapTm.toFixed(1)} C` : 'n/a'}</strong></div>
                      <div className="property-row"><span>Approximate risk</span><strong>{selectedPrimer.structure.risk}</strong></div>
                    </div>
                    <code className="primer-sequence">
                      {selectedPrimer.tail ? <span className="primer-tail">{selectedPrimer.tail}</span> : null}
                      <span className="primer-body">{selectedPrimer.body}</span>
                    </code>
                    <ul className="status-list">
                      <li>Tail: {selectedPrimer.tail.length || 0} nt</li>
                      <li>Annealing body: {selectedPrimer.bodyLength} nt</li>
                      <li>Local specificity hits: {selectedPrimer.specificitySites.filter((site) => site.risk !== 'low').length}</li>
                    </ul>
                  </div>
                ) : null}

                {inspectorFocus === 'reaction' && activeReaction ? (
                  <div className="status-block">
                    <div className="property-list">
                      <div className="property-row"><span>Primers</span><strong>{activeReaction.primerNames.join(' + ')}</strong></div>
                      <div className="property-row"><span>Product</span><strong>{activeReaction.productLength} bp</strong></div>
                      <div className="property-row"><span>Anneal</span><strong>{activeReaction.annealingTemperature} C</strong></div>
                      <div className="property-row"><span>Extend</span><strong>{activeReaction.extensionSeconds} s</strong></div>
                      <div className="property-row"><span>Gradient</span><strong>{activeReaction.gradientRecommendation ?? 'Not needed'}</strong></div>
                    </div>
                  </div>
                ) : null}

                {workerError ? (
                  <div className="status-block">
                    <p className="status-note status-note-alert">{workerError}</p>
                    <div className="action-row">
                      <button type="button" className="button button-secondary" onClick={retry}>
                        Retry calculation
                      </button>
                    </div>
                  </div>
                ) : null}
                {persistenceError ? (
                  <div className="status-block">
                    <p className="status-note status-note-alert">{persistenceError}</p>
                    <div className="action-row">
                      <button type="button" className="button button-secondary" onClick={retryPersistence}>
                        Retry save
                      </button>
                    </div>
                  </div>
                ) : null}
                {importError ? <p className="status-note status-note-alert">{importError}</p> : null}
                {design.issues.length ? (
                  <div className="status-block">
                    <p className="status-title">Blocking issues</p>
                    <ul className="status-list">
                      {design.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="status-note status-note-success">The simulated final product matches the requested target sequence exactly.</p>
                )}

                <div className="status-block">
                  <p className="status-title">Warnings</p>
                  <ul className="status-list">
                    {(design.warnings.length ? design.warnings : ['No warnings for the current design.']).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>

                <div className="status-block">
                  <p className="status-title">Scientific scope</p>
                  <ul className="status-list">
                    <li>{design.intendedAmplicons.length} intended amplicon model(s) are reported separately from unintended penalties.</li>
                    <li>Structure and quality outputs are heuristic approximations, not experimentally calibrated success probabilities.</li>
                  </ul>
                </div>
              </aside>
            </section>

            <section className="timeline-dock panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Reaction timeline</p>
                  <h2>Stage filter</h2>
                </div>
              </div>
              <div className="workflow-stage-row">
                {(['overview', 'pcr1a', 'pcr1b', 'fusion', 'verification'] as WorkflowStage[]).map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    className={`timeline-step ${selectedStage === stage ? 'timeline-step-active' : ''}`}
                    onClick={() => {
                      setSelectedStage(stage);
                      setInspectorFocus(stage === 'overview' || stage === 'verification' ? 'junction' : 'reaction');
                    }}
                  >
                    {getWorkflowStageLabel(stage)}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
        <ConfirmationDialog
          open={confirmationState !== null}
          title={confirmationState?.title ?? ''}
          message={confirmationState?.message ?? ''}
          confirmLabel={confirmationState?.confirmLabel ?? 'Confirm'}
          onConfirm={() => {
            const action = confirmationState;
            setConfirmationState(null);
            action?.onConfirm();
          }}
          onCancel={() => setConfirmationState(null)}
        />
      </main>
    </div>
  );
}

export default App;
