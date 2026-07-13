import { useEffect, useRef, useState, useTransition, type ChangeEvent } from 'react';
import { emptyProject, exampleProject, exampleProjects, type ExampleProjectId } from '../data/example';
import {
  checksumSequence,
  defaultChangeApprovals,
  type ChangeApprovals,
  type CodingIntent,
  type DesignMode,
  type FragmentInput,
  type FusionProjectInput,
  type GenomicSpecificitySettings,
} from '../utils/fusion';
import {
  deleteSelectedRange,
  duplicateSelectedRange,
  extractSelectedRange,
  insertAtPosition,
  replaceSelectedRange,
  splitFragment,
  trimFragment,
  type EditorLocks,
} from '../utils/editor';
import { parseFeatureSelection } from '../utils/features';
import { flipImportedSource, parseSequenceImport, type ImportParseResult, type ImportedSource } from '../utils/import';
import { buildMutationPlan, selectedFragmentSequence, type MutationPlannerMode } from '../utils/mutation';
import { reverseComplement } from '../utils/pcr';
import type { ProtocolSettings } from '../utils/protocol';
import type { DesignComparisonSummary } from '../utils/review';
import type { ThermodynamicConditions } from '../utils/thermodynamics';
import { loadInitialProject, normalizeImportedProject, stampProjectMetadata } from '../utils/project';

const STORAGE_KEY = 'fusionpcr-studio-project';
const EXPERIMENTAL_NOTICE_STORAGE_KEY = 'fusionpcr-studio-experimental-notice-dismissed';

export type ActiveFragmentKey = 'fragmentA' | 'fragmentB';

export type CanvasTracks = {
  sourceFragments: boolean;
  finalConstruct: boolean;
  primerOverlays: boolean;
  gcAndTm: boolean;
  stageProducts: boolean;
  translation: boolean;
  features: boolean;
  riskSummary: boolean;
};

export type ComparisonSnapshot = {
  capturedAt: string;
  metrics: DesignComparisonSummary;
};

export type MutationPayloadSource = 'manual' | 'donor-selection';

export type ConfirmationState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
} | null;

function loadInitialControllerProject() {
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

export function useProjectController() {
  const [project, setProject] = useState<FusionProjectInput>(() => loadInitialControllerProject());
  const [pastProjects, setPastProjects] = useState<FusionProjectInput[]>([]);
  const [futureProjects, setFutureProjects] = useState<FusionProjectInput[]>([]);
  const [, startTransition] = useTransition();
  const [importError, setImportError] = useState('');
  const [sequenceImportText, setSequenceImportText] = useState('');
  const [sequenceImportError, setSequenceImportError] = useState('');
  const [sequenceImportResult, setSequenceImportResult] = useState<ImportParseResult | null>(null);
  const [featureSelectionMessage, setFeatureSelectionMessage] = useState('');
  const [activeFragmentKey, setActiveFragmentKey] = useState<ActiveFragmentKey>('fragmentA');
  const [editPayload, setEditPayload] = useState('');
  const [editPosition, setEditPosition] = useState(1);
  const [trimAmount, setTrimAmount] = useState(1);
  const [showExperimentalNotice, setShowExperimentalNotice] = useState(() => loadExperimentalNoticeVisibility());
  const [showWorkbench, setShowWorkbench] = useState(() => hasProjectSequenceContent(loadInitialControllerProject()));
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
  const [mutationRecipientKey, setMutationRecipientKey] = useState<ActiveFragmentKey>('fragmentA');
  const [mutationDonorKey, setMutationDonorKey] = useState<ActiveFragmentKey>('fragmentB');
  const [mutationStart, setMutationStart] = useState(1);
  const [mutationEnd, setMutationEnd] = useState(1);
  const [mutationCoordinate, setMutationCoordinate] = useState(1);
  const [mutationPayloadSource, setMutationPayloadSource] = useState<MutationPayloadSource>('manual');
  const [mutationPayloadInput, setMutationPayloadInput] = useState('');
  const [selectedExampleId, setSelectedExampleId] = useState<ExampleProjectId>('protein-fusion');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sequenceFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (hasProjectSequenceContent(project)) {
      setShowWorkbench(true);
    }
  }, [project]);

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
    fragmentKey: ActiveFragmentKey,
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

  const updateFragmentSequence = (fragmentKey: ActiveFragmentKey, value: string) => {
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

  const requestProjectReplacement = (action: NonNullable<ConfirmationState>) => {
    if (!isProjectNonEmpty(project)) {
      action.onConfirm();
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

  const applyImportedSource = (fragmentKey: ActiveFragmentKey, source: ImportedSource) => {
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
  };

  const reverseComplementFragment = (fragmentKey: ActiveFragmentKey) => {
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

  const applyFeatureSelection = (fragmentKey: ActiveFragmentKey, featureIndex: number) => {
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

  const captureComparisonSnapshot = (metrics: DesignComparisonSummary) => {
    setComparisonSnapshot({
      capturedAt: new Date().toISOString(),
      metrics,
    });
  };

  const applyMutationWorkflow = (mutationMode: MutationPlannerMode | null) => {
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
    setShowWorkbench(true);
  };

  const applyFragmentEdit = (
    fragmentKey: ActiveFragmentKey,
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
      return {
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

  return {
    project,
    importError,
    setImportError,
    sequenceImportText,
    setSequenceImportText,
    sequenceImportError,
    setSequenceImportError,
    sequenceImportResult,
    setSequenceImportResult,
    featureSelectionMessage,
    activeFragmentKey,
    setActiveFragmentKey,
    editPayload,
    setEditPayload,
    editPosition,
    setEditPosition,
    trimAmount,
    setTrimAmount,
    showExperimentalNotice,
    setShowExperimentalNotice,
    showWorkbench,
    setShowWorkbench,
    showSidebar,
    setShowSidebar,
    showInspector,
    setShowInspector,
    showMenu,
    setShowMenu,
    confirmationState,
    setConfirmationState,
    recoverableProjectSnapshot,
    comparisonSnapshot,
    setComparisonSnapshot,
    canvasTracks,
    mutationRecipientKey,
    setMutationRecipientKey,
    mutationDonorKey,
    setMutationDonorKey,
    mutationStart,
    setMutationStart,
    mutationEnd,
    setMutationEnd,
    mutationCoordinate,
    setMutationCoordinate,
    mutationPayloadSource,
    setMutationPayloadSource,
    mutationPayloadInput,
    setMutationPayloadInput,
    selectedExampleId,
    setSelectedExampleId,
    fileInputRef,
    sequenceFileInputRef,
    canUndo: pastProjects.length > 0,
    canRedo: futureProjects.length > 0,
    undoProject,
    redoProject,
    updateProject,
    updateFragment,
    updateFragmentSequence,
    updateCoding,
    updateReactionCondition,
    updateProtocolSetting,
    updateGenomicSpecificity,
    loadExample,
    resetProject,
    restorePreviousProject,
    handleImportClick,
    handleSequenceImportClick,
    applyImportedSource,
    applyFirstTwoImportedSources,
    reverseComplementFragment,
    applyFeatureSelection,
    toggleEditorLock,
    toggleCanvasTrack,
    toggleChangeApproval,
    toggleSynonymousChangeApproval,
    captureComparisonSnapshot,
    applyMutationWorkflow,
    handleTrim,
    handleExtractSelection,
    handleDeleteSelection,
    handleDuplicateSelection,
    handleReplaceSelection,
    handleInsertPayload,
    handleSplitActiveFragment,
    handleDuplicateSelectionToInsert,
    handleImportFile,
    handleSequenceFileImport,
    parseSequenceImportText,
  };
}
