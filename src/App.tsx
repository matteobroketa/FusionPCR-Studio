import { useEffect, useRef, useState, useTransition, type ChangeEvent } from 'react';
import { emptyProject, exampleProject, exampleProjectOptions, exampleProjects, type ExampleProjectId } from './data/example';
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
  buildFusionDesign,
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
  type PrimerDesign,
  type ReactionPlan,
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

const STORAGE_KEY = 'fusionpcr-studio-project';

type InspectorFocus = 'junction' | 'fragment-a' | 'fragment-b' | 'warnings' | 'protocol';

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

function normalizeImportedProject(value: unknown): FusionProjectInput | null {
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

function loadInitialProject(): FusionProjectInput {
  if (typeof window === 'undefined') {
    return exampleProject;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return exampleProject;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return normalizeImportedProject(parsed) ?? exampleProject;
  } catch {
    return exampleProject;
  }
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SequenceRail({
  label,
  sequenceLength,
  start,
  end,
  topology,
  accentClass,
}: {
  label: string;
  sequenceLength: number;
  start: number;
  end: number;
  topology: 'linear' | 'circular';
  accentClass: string;
}) {
  const safeLength = Math.max(sequenceLength, 1);
  const wrapsOrigin = topology === 'circular' && sequenceLength > 0 && start > end;
  const selectionSegments = wrapsOrigin
    ? [
        {
          width: ((safeLength - start + 1) / safeLength) * 100,
          left: ((start - 1) / safeLength) * 100,
        },
        {
          width: (end / safeLength) * 100,
          left: 0,
        },
      ]
    : [
        {
          width: sequenceLength ? ((end - start + 1) / safeLength) * 100 : 0,
          left: sequenceLength ? ((start - 1) / safeLength) * 100 : 0,
        },
      ];

  return (
    <div className="rail-card">
      <div className="rail-meta">
        <span>{label}</span>
        <strong>{sequenceLength} bp</strong>
      </div>
      <div className="rail-track">
        {selectionSegments.map((segment) => (
          <div
            key={`${label}-${segment.left}-${segment.width}`}
            className={`rail-selection ${accentClass}`}
            style={{ width: `${segment.width}%`, left: `${segment.left}%` }}
          />
        ))}
      </div>
      <div className="rail-caption">
        Selected bases {start}-{end}
        {wrapsOrigin ? ' (wraparound)' : ''}
      </div>
    </div>
  );
}

function SequencePreview({
  title,
  sequence,
}: {
  title: string;
  sequence: string;
}) {
  return (
    <div className="preview-block">
      <span className="preview-label">{title}</span>
      <code className="sequence-preview">{sequence || 'No sequence available for the current state.'}</code>
    </div>
  );
}

function PrimerCard({
  primer,
}: {
  primer: PrimerDesign;
}) {
  return (
    <article className="primer-card">
      <div className="primer-card-header">
        <div>
          <h3>{primer.name}</h3>
          <p>{primer.role}</p>
        </div>
        <span className={`pill ${primer.structure.risk === 'High' ? 'pill-alert' : primer.structure.risk === 'Watch' ? 'pill-watch' : 'pill-success'}`}>
          {primer.structure.risk}
        </span>
      </div>

      <code className="primer-sequence">
        {primer.tail ? <span className="primer-tail">{primer.tail}</span> : null}
        <span className="primer-body">{primer.body}</span>
      </code>

      <div className="metric-grid compact-grid">
        <div className="metric">
          <span>Reaction</span>
          <strong>{primer.reaction}</strong>
        </div>
        <div className="metric">
          <span>Body Tm</span>
          <strong>{primer.bodyTm.toFixed(1)} C</strong>
        </div>
        <div className="metric">
          <span>Full oligo Tm</span>
          <strong>{primer.fullOligoTm.toFixed(1)} C</strong>
        </div>
        <div className="metric">
          <span>Overlap Tm</span>
          <strong>{primer.overlapTm !== null ? `${primer.overlapTm.toFixed(1)} C` : 'n/a'}</strong>
        </div>
        <div className="metric">
          <span>Body GC</span>
          <strong>{primer.bodyGcPercentage.toFixed(1)}%</strong>
        </div>
        <div className="metric">
          <span>Body length</span>
          <strong>{primer.bodyLength} nt</strong>
        </div>
        <div className="metric">
          <span>Delta H</span>
          <strong>{primer.bodyThermodynamics.deltaHKcalPerMol.toFixed(1)} kcal/mol</strong>
        </div>
        <div className="metric">
          <span>Delta S</span>
          <strong>{primer.bodyThermodynamics.deltaSCalPerMolK.toFixed(1)} cal/mol/K</strong>
        </div>
        <div className="metric">
          <span>Hairpin</span>
          <strong>{primer.structure.hairpin?.longestContiguousStem ?? 0} stem</strong>
        </div>
        <div className="metric">
          <span>3 prime dimer</span>
          <strong>{primer.structure.threePrimeHomodimer?.threePrimePairedBasesA ?? 0} paired</strong>
        </div>
        <div className="metric">
          <span>Specificity hits</span>
          <strong>{primer.specificitySites.filter((site) => site.risk !== 'low').length}</strong>
        </div>
      </div>

      <div className="status-block">
        <p className="status-title">Structure summary</p>
        <ul className="status-list">
          <li>
            Hairpin: {primer.structure.hairpin ? `${primer.structure.hairpin.deltaG} kcal/mol, Tm ${primer.structure.hairpin.predictedTm} C` : 'none'}
          </li>
          <li>
            Homodimer: {primer.structure.homodimer ? `${primer.structure.homodimer.deltaG} kcal/mol, stem ${primer.structure.homodimer.longestContiguousStem}` : 'none'}
          </li>
          <li>
            3 prime homodimer: {primer.structure.threePrimeHomodimer ? `${primer.structure.threePrimeHomodimer.deltaG} kcal/mol, 3 prime ${primer.structure.threePrimeHomodimer.threePrimePairedBasesA}` : 'none'}
          </li>
        </ul>
      </div>

      <div className="status-block">
        <p className="status-title">Local specificity</p>
        <ul className="status-list">
          {primer.specificitySites.slice(0, 4).map((site) => (
            <li key={`${primer.name}-${site.templateId}-${site.start}`}>
              {site.templateName} {site.start}-{site.end}, {site.risk} risk, {site.mismatchCount} mismatch(es), 3 prime match {site.threePrimeMatchedBases} nt
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function ReactionCard({
  reaction,
}: {
  reaction: ReactionPlan;
}) {
  return (
    <article className="reaction-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{reaction.name}</p>
          <h3>{reaction.primerNames.join(' + ')}</h3>
        </div>
      </div>
      <div className="metric-grid compact-grid">
        <div className="metric">
          <span>Product</span>
          <strong>{reaction.productLength} bp</strong>
        </div>
        <div className="metric">
          <span>Anneal</span>
          <strong>{reaction.annealingTemperature} C</strong>
        </div>
        <div className="metric">
          <span>Extend</span>
          <strong>{reaction.extensionSeconds} s</strong>
        </div>
        <div className="metric">
          <span>Gradient</span>
          <strong>{reaction.gradientRecommendation ?? 'Not needed'}</strong>
        </div>
      </div>
    </article>
  );
}

function App() {
  const [project, setProject] = useState<FusionProjectInput>(loadInitialProject);
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
  const design = buildFusionDesign(project);
  const fragmentAMetrics = summarizeSequenceMetrics(project.fragmentA.sequence);
  const fragmentBMetrics = summarizeSequenceMetrics(project.fragmentB.sequence);
  const activeFragment = project[activeFragmentKey];
  const isFragmentALocked = project.editorLocks.fragmentA;
  const isFragmentBLocked = project.editorLocks.fragmentB;
  const isInsertLocked = project.editorLocks.insertSequence;
  const isPolymeraseLocked = project.editorLocks.polymeraseSettings;
  const activeFragmentLocked = activeFragmentKey === 'fragmentA' ? isFragmentALocked : isFragmentBLocked;
  const counterpartFragmentLocked = activeFragmentKey === 'fragmentA' ? isFragmentBLocked : isFragmentALocked;
  const hasExportableDesign = design.primers.length > 0;
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
  const selectedReaction =
    selectedStage === 'overview' || selectedStage === 'verification'
      ? null
      : design.reactions.find((reaction) => reaction.name === getWorkflowStageLabel(selectedStage));
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
      if (options?.recordHistory !== false) {
        setPastProjects((previous) => [...previous.slice(-49), current]);
        setFutureProjects([]);
      }
      return next;
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }, [project]);

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

  const loadExample = (exampleId: ExampleProjectId = selectedExampleId) => {
    startTransition(() => {
      commitProject(exampleProjects[exampleId] ?? exampleProject);
      setPastProjects([]);
      setFutureProjects([]);
      setImportError('');
      setFeatureSelectionMessage('');
    });
  };

  const resetProject = () => {
    startTransition(() => {
      commitProject(emptyProject);
      setPastProjects([]);
      setFutureProjects([]);
      setImportError('');
      setFeatureSelectionMessage('');
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

      startTransition(() => {
        commitProject(normalized);
        setImportError('');
      });
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
        <header className="hero panel">
          <div className="hero-copy">
            <p className="eyebrow">FusionPCR Studio</p>
            <h1>Design two-stage overlap-extension PCR constructs directly in the browser.</h1>
            <p className="hero-text">
              Select the retained ranges from two fragments, insert an optional linker, simulate the intermediate products, and export primers plus a starting protocol without uploading sequence data.
            </p>
          </div>

          <div className="hero-actions">
            <label className="field-card">
              <span className="field-label">Example library</span>
              <select value={selectedExampleId} onChange={(event) => setSelectedExampleId(event.target.value as ExampleProjectId)}>
                {exampleProjectOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="button button-primary" onClick={() => loadExample()}>
              Load example
            </button>
            <button type="button" className="button button-secondary" onClick={resetProject}>
              Clear project
            </button>
            <button type="button" className="button button-secondary" onClick={handleImportClick}>
              Import JSON
            </button>
            <button type="button" className="button button-secondary" onClick={undoProject} disabled={!pastProjects.length}>
              Undo
            </button>
            <button type="button" className="button button-secondary" onClick={redoProject} disabled={!futureProjects.length}>
              Redo
            </button>
            <span className="pending-label">{isPending ? 'Refreshing project...' : 'Local-first mode active'}</span>
          </div>
          <p className="field-helper">{exampleProjectOptions.find((option) => option.id === selectedExampleId)?.description}</p>
        </header>

        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
        <input ref={sequenceFileInputRef} type="file" accept=".txt,.fa,.fasta,.gb,.gbk,.gbff" hidden onChange={handleSequenceFileImport} />

        <section className="summary-grid">
          <div className="summary-card panel">
            <span>Design mode</span>
            <strong>{project.mode}</strong>
          </div>
          <div className="summary-card panel">
            <span>Target product</span>
            <strong>{design.targetSequence.length} bp</strong>
          </div>
          <div className="summary-card panel">
            <span>Overlap</span>
            <strong>{design.overlapSequence.length} nt</strong>
          </div>
          <div className="summary-card panel">
            <span>Exact verification</span>
            <strong>{design.finalProductVerified ? 'Pass' : 'Pending'}</strong>
          </div>
          <div className="summary-card panel">
            <span>Off-target products</span>
            <strong>{design.offTargetAmplicons.length}</strong>
          </div>
          <div className="summary-card panel">
            <span>Quality score</span>
            <strong>{design.qualityScore.toFixed(3)}</strong>
          </div>
        </section>

        <section className="layout-grid">
          <section className="panel form-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Project Setup</p>
                <h2>Fragments and settings</h2>
              </div>
              <span className="pill pill-muted">{design.profile.label}</span>
            </div>

            <div className="field-grid">
              <label className="field-card">
                <span className="field-label">Project name</span>
                <input
                  className="text-input"
                  value={project.name}
                  onChange={(event) => updateProject('name', event.target.value)}
                />
              </label>

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
                  className="text-input"
                  value={project.mode}
                  onChange={(event) => updateProject('mode', event.target.value as DesignMode)}
                >
                  <option value="exact">Exact fusion</option>
                  <option value="protein-fusion">Protein fusion</option>
                  <option value="insertion">Insertion</option>
                  <option value="deletion">Deletion</option>
                  <option value="substitution">Substitution</option>
                  <option value="domain-swap">Domain swap</option>
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

            {mutationMode ? (
              <section className="mutation-panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Mutation Planner</p>
                    <h3>Recipient-to-flank workflow</h3>
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
                      <input
                        className="text-input"
                        type="number"
                        min={1}
                        step="1"
                        value={mutationCoordinate}
                        onChange={(event) => setMutationCoordinate(Math.max(1, Number(event.target.value) || 1))}
                      />
                    </label>
                  ) : (
                    <>
                      <label className="field-card">
                        <span className="field-label">Mutation start</span>
                        <input
                          className="text-input"
                          type="number"
                          min={1}
                          step="1"
                          value={mutationStart}
                          onChange={(event) => setMutationStart(Math.max(1, Number(event.target.value) || 1))}
                        />
                      </label>
                      <label className="field-card">
                        <span className="field-label">Mutation end</span>
                        <input
                          className="text-input"
                          type="number"
                          min={1}
                          step="1"
                          value={mutationEnd}
                          onChange={(event) => setMutationEnd(Math.max(1, Number(event.target.value) || 1))}
                        />
                      </label>
                    </>
                  )}
                </div>

                {mutationPayloadSource === 'donor-selection' && mutationMode !== 'deletion' ? (
                  <div className="field-grid">
                    <label className="field-card">
                      <span className="field-label">Donor fragment</span>
                      <select
                        className="text-input"
                        value={mutationDonorKey}
                        onChange={(event) => setMutationDonorKey(event.target.value as 'fragmentA' | 'fragmentB')}
                      >
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
                    <textarea
                      className="sequence-input short-input"
                      value={mutationPayloadInput}
                      onChange={(event) => setMutationPayloadInput(event.target.value)}
                      placeholder={mutationMode === 'insertion' ? 'Inserted DNA' : 'Replacement DNA'}
                      spellCheck={false}
                    />
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

            <section className="editor-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Editing Workspace</p>
                  <h3>Explicit reversible fragment operations</h3>
                </div>
                <span className="pill pill-muted">
                  History {pastProjects.length}/{futureProjects.length}
                </span>
              </div>

              <div className="field-grid">
                <label className="field-card">
                  <span className="field-label">Active fragment</span>
                  <select
                    className="text-input"
                    value={activeFragmentKey}
                    onChange={(event) => setActiveFragmentKey(event.target.value as 'fragmentA' | 'fragmentB')}
                  >
                    <option value="fragmentA">Fragment A</option>
                    <option value="fragmentB">Fragment B</option>
                  </select>
                </label>
                <label className="field-card">
                  <span className="field-label">Trim amount</span>
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    step="1"
                    value={trimAmount}
                    onChange={(event) => setTrimAmount(Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Edit position</span>
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    step="1"
                    value={editPosition}
                    onChange={(event) => setEditPosition(Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Payload / linker / tag</span>
                  <input
                    className="text-input"
                    value={editPayload}
                    onChange={(event) => setEditPayload(event.target.value)}
                    placeholder="DNA payload for insert or replace"
                  />
                </label>
              </div>

              <div className="toggle-grid">
                <label className="toggle-card">
                  <input type="checkbox" checked={project.editorLocks.fragmentA} onChange={() => toggleEditorLock('fragmentA')} />
                  <span>Lock fragment A</span>
                </label>
                <label className="toggle-card">
                  <input type="checkbox" checked={project.editorLocks.fragmentB} onChange={() => toggleEditorLock('fragmentB')} />
                  <span>Lock fragment B</span>
                </label>
                <label className="toggle-card">
                  <input type="checkbox" checked={project.editorLocks.fragmentABoundaries} onChange={() => toggleEditorLock('fragmentABoundaries')} />
                  <span>Lock A boundaries</span>
                </label>
                <label className="toggle-card">
                  <input type="checkbox" checked={project.editorLocks.fragmentBBoundaries} onChange={() => toggleEditorLock('fragmentBBoundaries')} />
                  <span>Lock B boundaries</span>
                </label>
                <label className="toggle-card">
                  <input type="checkbox" checked={project.editorLocks.insertSequence} onChange={() => toggleEditorLock('insertSequence')} />
                  <span>Lock inserted sequence</span>
                </label>
                <label className="toggle-card">
                  <input type="checkbox" checked={project.editorLocks.polymeraseSettings} onChange={() => toggleEditorLock('polymeraseSettings')} />
                  <span>Lock polymerase settings</span>
                </label>
              </div>

              <div className="export-grid">
                <button type="button" className="button button-secondary" onClick={() => handleTrim('left')} disabled={activeFragmentLocked}>
                  Trim left
                </button>
                <button type="button" className="button button-secondary" onClick={() => handleTrim('right')} disabled={activeFragmentLocked}>
                  Trim right
                </button>
                <button type="button" className="button button-secondary" onClick={handleExtractSelection} disabled={activeFragmentLocked}>
                  Extract selection
                </button>
                <button type="button" className="button button-secondary" onClick={handleDuplicateSelection} disabled={activeFragmentLocked}>
                  Duplicate selection
                </button>
                <button type="button" className="button button-secondary" onClick={handleDeleteSelection} disabled={activeFragmentLocked}>
                  Delete selection
                </button>
                <button type="button" className="button button-secondary" onClick={handleReplaceSelection} disabled={activeFragmentLocked || !editPayload.trim()}>
                  Replace selection
                </button>
                <button type="button" className="button button-secondary" onClick={handleInsertPayload} disabled={activeFragmentLocked || !editPayload.trim()}>
                  Insert payload
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={handleSplitActiveFragment}
                  disabled={activeFragmentLocked || counterpartFragmentLocked}
                >
                  Split to A/B
                </button>
                <button type="button" className="button button-secondary" onClick={handleDuplicateSelectionToInsert} disabled={isInsertLocked}>
                  Duplicate to insert
                </button>
              </div>
            </section>

            {project.mode === 'protein-fusion' ? (
              <section className="protein-form">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Coding Intent</p>
                    <h3>Frame and codon handling</h3>
                  </div>
                  <span className={`pill ${design.proteinValidation?.framePreserved ? 'pill-success' : 'pill-watch'}`}>
                    {design.proteinValidation?.framePreserved ? 'Frame preserved' : 'Check frame'}
                  </span>
                </div>

                <div className="field-grid">
                  <label className="field-card">
                    <span className="field-label">Upstream frame</span>
                    <select
                      className="text-input"
                      value={project.coding.upstreamFrame}
                      onChange={(event) => updateCoding('upstreamFrame', Number(event.target.value) as 0 | 1 | 2)}
                    >
                      <option value={0}>0</option>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                    </select>
                  </label>
                  <label className="field-card">
                    <span className="field-label">Downstream frame</span>
                    <select
                      className="text-input"
                      value={project.coding.downstreamFrame}
                      onChange={(event) => updateCoding('downstreamFrame', Number(event.target.value) as 0 | 1 | 2)}
                    >
                      <option value={0}>0</option>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                    </select>
                  </label>
                </div>

                <div className="toggle-grid">
                  <label className="toggle-card">
                    <input
                      type="checkbox"
                      checked={project.coding.retainUpstreamStop}
                      onChange={(event) => updateCoding('retainUpstreamStop', event.target.checked)}
                    />
                    <span>Retain upstream stop codon</span>
                  </label>
                  <label className="toggle-card">
                    <input
                      type="checkbox"
                      checked={project.coding.retainDownstreamStart}
                      onChange={(event) => updateCoding('retainDownstreamStart', event.target.checked)}
                    />
                    <span>Retain downstream start codon</span>
                  </label>
                  <label className="toggle-card">
                    <input
                      type="checkbox"
                      checked={project.coding.linkerRequired}
                      onChange={(event) => updateCoding('linkerRequired', event.target.checked)}
                    />
                    <span>Require inserted linker</span>
                  </label>
                  <label className="toggle-card">
                    <input
                      type="checkbox"
                      checked={project.coding.preserveProtein}
                      onChange={(event) => updateCoding('preserveProtein', event.target.checked)}
                    />
                    <span>Preserve amino-acid sequence near junction</span>
                  </label>
                </div>

                <label className="field-card">
                  <span className="field-label">Flexible codons</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    value={project.coding.flexibleCodons}
                    onChange={(event) => updateCoding('flexibleCodons', Math.max(0, Number(event.target.value) || 0))}
                  />
                  <span className="field-helper">Allows beam-searched synonymous optimization within this many codons on each side of the junction.</span>
                </label>

                <div className="status-block">
                  <p className="status-title">Sequence change approvals</p>
                  <p className="field-helper">
                    Protein-fusion sequence changes are proposed here first. Nothing is applied unless you explicitly approve it.
                  </p>
                  {design.sequenceChangeProposals.length ? (
                    <div className="proposal-stack">
                      {design.sequenceChangeProposals.map((proposal) => (
                        <article key={proposal.id} className="proposal-card">
                          <div>
                            <strong>{proposal.label}</strong>
                            <p className="field-helper">{proposal.description}</p>
                            <p className="field-helper">
                              {proposal.fragment} bases {proposal.start}-{proposal.end}: {proposal.from || 'none'} to {proposal.to || 'delete'}
                              {proposal.aminoAcid ? ` (${proposal.aminoAcid})` : ''}
                            </p>
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

            <section className="thermo-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Thermodynamics</p>
                  <h3>Nearest-neighbour calculation conditions</h3>
                </div>
                <span className="pill pill-muted">Owczarzy salt + DMSO adjustment</span>
              </div>

              <div className="field-grid">
                <label className="field-card">
                  <span className="field-label">Monovalent ions (mM)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    step="0.1"
                    value={project.reactionConditions.monovalentMillimolar}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateReactionCondition('monovalentMillimolar', Math.max(0, Number(event.target.value) || 0))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Magnesium (mM)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={project.reactionConditions.magnesiumMillimolar}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateReactionCondition('magnesiumMillimolar', Math.max(0, Number(event.target.value) || 0))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">dNTP total (mM)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={project.reactionConditions.dntpMillimolar}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateReactionCondition('dntpMillimolar', Math.max(0, Number(event.target.value) || 0))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Oligo concentration (nM)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0.001}
                    step="1"
                    value={project.reactionConditions.oligoNanomolar}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateReactionCondition('oligoNanomolar', Math.max(0.001, Number(event.target.value) || 0.001))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">DMSO (%)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    step="0.1"
                    value={project.reactionConditions.dmsoPercent}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateReactionCondition('dmsoPercent', Math.max(0, Number(event.target.value) || 0))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">DMSO factor (C/% )</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={project.reactionConditions.dmsoFactor}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateReactionCondition('dmsoFactor', Math.max(0, Number(event.target.value) || 0))}
                  />
                </label>
              </div>
            </section>

            <section className="specificity-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Genomic Specificity</p>
                  <h3>Primer-BLAST handoff</h3>
                </div>
                <span className="pill pill-muted">External check</span>
              </div>

              <div className="field-grid">
                <label className="field-card">
                  <span className="field-label">Organism</span>
                  <input
                    className="text-input"
                    value={project.genomicSpecificity.organism}
                    onChange={(event) => updateGenomicSpecificity('organism', event.target.value)}
                    placeholder="Example: Homo sapiens"
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Database</span>
                  <input
                    className="text-input"
                    value={project.genomicSpecificity.database}
                    onChange={(event) => updateGenomicSpecificity('database', event.target.value)}
                    placeholder="Example: RefSeq representative genomes"
                  />
                </label>
              </div>

              <label className="field-card">
                <span className="field-label">Handoff notes</span>
                <textarea
                  className="sequence-input short-input"
                  value={project.genomicSpecificity.notes}
                  onChange={(event) => updateGenomicSpecificity('notes', event.target.value)}
                  placeholder="Why this external specificity check is needed, target organism, or reviewer notes"
                />
              </label>

              <p className="status-note status-note-alert">
                Exporting or submitting a Primer-BLAST handoff will move primer and target information outside this local-first application.
              </p>
            </section>

            <section className="protocol-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Protocol Inputs</p>
                  <h3>Mixing, dilution, and cycle planning</h3>
                </div>
                <span className="pill pill-muted">{project.protocolSettings.mixStrategy}</span>
              </div>

              <div className="field-grid">
                <label className="field-card">
                  <span className="field-label">Stage A concentration (ng/uL)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0.0001}
                    step="0.1"
                    value={project.protocolSettings.stageAConcentrationNgPerUl}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('stageAConcentrationNgPerUl', Math.max(0.0001, Number(event.target.value) || 0.0001))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Stage B concentration (ng/uL)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0.0001}
                    step="0.1"
                    value={project.protocolSettings.stageBConcentrationNgPerUl}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('stageBConcentrationNgPerUl', Math.max(0.0001, Number(event.target.value) || 0.0001))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Total target DNA (pmol)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0.000001}
                    step="0.01"
                    value={project.protocolSettings.totalTemplatePmol}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('totalTemplatePmol', Math.max(0.000001, Number(event.target.value) || 0.000001))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Mix strategy</span>
                  <select
                    className="text-input"
                    value={project.protocolSettings.mixStrategy}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('mixStrategy', event.target.value as ProtocolSettings['mixStrategy'])}
                  >
                    <option value="equimolar">1:1 equimolar</option>
                    <option value="user-defined">User-defined ratio</option>
                    <option value="limiting-a">Fragment A limiting</option>
                    <option value="limiting-b">Fragment B limiting</option>
                  </select>
                </label>
                <label className="field-card">
                  <span className="field-label">Mix ratio A</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0.000001}
                    step="0.1"
                    value={project.protocolSettings.stageMixRatioA}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('stageMixRatioA', Math.max(0.000001, Number(event.target.value) || 0.000001))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Mix ratio B</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0.000001}
                    step="0.1"
                    value={project.protocolSettings.stageMixRatioB}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('stageMixRatioB', Math.max(0.000001, Number(event.target.value) || 0.000001))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Primer stock (uM)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0.000001}
                    step="0.1"
                    value={project.protocolSettings.primerStockMicromolar}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('primerStockMicromolar', Math.max(0.000001, Number(event.target.value) || 0.000001))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Primer working (uM)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0.000001}
                    step="0.1"
                    value={project.protocolSettings.primerWorkingMicromolar}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('primerWorkingMicromolar', Math.max(0.000001, Number(event.target.value) || 0.000001))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Working stock prep (uL)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0.000001}
                    step="1"
                    value={project.protocolSettings.workingStockPrepMicroliters}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('workingStockPrepMicroliters', Math.max(0.000001, Number(event.target.value) || 0.000001))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Primer per reaction (uL)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0.000001}
                    step="0.1"
                    value={project.protocolSettings.primerPerReactionMicroliters}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('primerPerReactionMicroliters', Math.max(0.000001, Number(event.target.value) || 0.000001))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Stage 1 template / reaction (uL)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0.000001}
                    step="0.1"
                    value={project.protocolSettings.stage1TemplatePerReactionMicroliters}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('stage1TemplatePerReactionMicroliters', Math.max(0.000001, Number(event.target.value) || 0.000001))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Reaction volume (uL)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0.000001}
                    step="1"
                    value={project.protocolSettings.reactionVolumeMicroliters}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('reactionVolumeMicroliters', Math.max(0.000001, Number(event.target.value) || 0.000001))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Stage 1 reactions / product</span>
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    step="1"
                    value={project.protocolSettings.stage1ReactionCountPerProduct}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('stage1ReactionCountPerProduct', Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Final reactions</span>
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    step="1"
                    value={project.protocolSettings.finalReactionCount}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('finalReactionCount', Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Overfill (%)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    step="1"
                    value={project.protocolSettings.overfillPercent}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('overfillPercent', Math.max(0, Number(event.target.value) || 0))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Stage 1 cycles</span>
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    step="1"
                    value={project.protocolSettings.stage1Cycles}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('stage1Cycles', Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Final cycles</span>
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    step="1"
                    value={project.protocolSettings.finalCycles}
                    disabled={isPolymeraseLocked}
                    onChange={(event) => updateProtocolSetting('finalCycles', Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
              </div>
            </section>

            <label className="field-card">
              <span className="field-label">Project notes</span>
              <textarea
                className="sequence-input short-input"
                value={project.notes}
                onChange={(event) => updateProject('notes', event.target.value)}
                placeholder="Optional wet-lab notes, template source, or cloning context"
              />
            </label>

            <section className="import-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Sequence Import</p>
                  <h3>Plain DNA, FASTA, Multi-FASTA, or GenBank</h3>
                </div>
              </div>

              <label className="field-card">
                <span className="field-label">Import text</span>
                <textarea
                  className="sequence-input"
                  value={sequenceImportText}
                  onChange={(event) => setSequenceImportText(event.target.value)}
                  placeholder="Paste plain DNA, FASTA, or a GenBank record here"
                  spellCheck={false}
                />
              </label>

              <div className="export-grid">
                <button type="button" className="button button-secondary" onClick={() => parseSequenceImportText(sequenceImportText)}>
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
                        <div className="export-grid">
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => applyImportedSource('fragmentA', record)}
                            disabled={isFragmentALocked}
                          >
                            Use for fragment A
                          </button>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => applyImportedSource('fragmentB', record)}
                            disabled={isFragmentBLocked}
                          >
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
                                      records: current.records.map((item) =>
                                        item.checksum === record.checksum ? flipImportedSource(item) : item,
                                      ),
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

            <section className="fragment-editor">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Fragment A</p>
                  <h3>{project.fragmentA.label}</h3>
                </div>
                <span className="pill pill-success">{fragmentAMetrics.length} bp</span>
              </div>

              <div className="field-grid">
                <label className="field-card">
                  <span className="field-label">Label</span>
                  <input
                    className="text-input"
                    value={project.fragmentA.label}
                    disabled={isFragmentALocked}
                    onChange={(event) => updateFragment('fragmentA', 'label', event.target.value)}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">GC</span>
                  <input className="text-input" value={`${fragmentAMetrics.gcPercentage.toFixed(1)}%`} readOnly />
                </label>
              </div>

              <label className="field-card">
                <span className="field-label">Sequence</span>
                <textarea
                  className="sequence-input"
                  value={project.fragmentA.sequence}
                  disabled={isFragmentALocked}
                  onChange={(event) => updateFragmentSequence('fragmentA', event.target.value)}
                  placeholder="Paste fragment A DNA sequence"
                  spellCheck={false}
                />
              </label>

              <div className="export-grid">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => reverseComplementFragment('fragmentA')}
                  disabled={isFragmentALocked}
                >
                  Reverse complement A
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => updateProject('fragmentA', createEmptyFragment('Fragment A'))}
                  disabled={isFragmentALocked}
                >
                  Reset fragment A
                </button>
              </div>

              <div className="field-grid range-grid">
                <label className="field-card">
                  <span className="field-label">Start</span>
                  <input
                    className="text-input"
                    type="number"
                    value={project.fragmentA.start}
                    disabled={isFragmentALocked || project.editorLocks.fragmentABoundaries}
                    onChange={(event) => updateFragment('fragmentA', 'start', Number(event.target.value) || 1)}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">End</span>
                  <input
                    className="text-input"
                    type="number"
                    value={project.fragmentA.end}
                    disabled={isFragmentALocked || project.editorLocks.fragmentABoundaries}
                    onChange={(event) => updateFragment('fragmentA', 'end', Number(event.target.value) || 1)}
                  />
                </label>
              </div>

              <div className="metric-grid compact-grid">
                <div className="metric">
                  <span>Source</span>
                  <strong>{project.fragmentA.sourceFormat}</strong>
                </div>
                <div className="metric">
                  <span>Topology</span>
                  <strong>{project.fragmentA.topology}</strong>
                </div>
                <div className="metric">
                  <span>Checksum</span>
                  <strong>{project.fragmentA.checksum}</strong>
                </div>
                <div className="metric">
                  <span>Ambiguous bases</span>
                  <strong>{project.fragmentA.ambiguousBases.join(', ') || 'None'}</strong>
                </div>
                <div className="metric">
                  <span>Imported name</span>
                  <strong>{project.fragmentA.importedName}</strong>
                </div>
                <div className="metric">
                  <span>Features</span>
                  <strong>{project.fragmentA.features.length}</strong>
                </div>
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
                          {feature.label} ({feature.key}) at {feature.location}
                          {' - '}
                          {selectionSummary}
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => applyFeatureSelection('fragmentA', index)}
                            disabled={isFragmentALocked || project.editorLocks.fragmentABoundaries || !parsed?.supported}
                          >
                            Use feature range
                          </button>
                        </li>
                      );
                    })}
                    {featureSelectionMessage ? (
                      <li>{featureSelectionMessage}</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </section>

            <section className="fragment-editor">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Fragment B</p>
                  <h3>{project.fragmentB.label}</h3>
                </div>
                <span className="pill pill-success">{fragmentBMetrics.length} bp</span>
              </div>

              <div className="field-grid">
                <label className="field-card">
                  <span className="field-label">Label</span>
                  <input
                    className="text-input"
                    value={project.fragmentB.label}
                    disabled={isFragmentBLocked}
                    onChange={(event) => updateFragment('fragmentB', 'label', event.target.value)}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">GC</span>
                  <input className="text-input" value={`${fragmentBMetrics.gcPercentage.toFixed(1)}%`} readOnly />
                </label>
              </div>

              <label className="field-card">
                <span className="field-label">Sequence</span>
                <textarea
                  className="sequence-input"
                  value={project.fragmentB.sequence}
                  disabled={isFragmentBLocked}
                  onChange={(event) => updateFragmentSequence('fragmentB', event.target.value)}
                  placeholder="Paste fragment B DNA sequence"
                  spellCheck={false}
                />
              </label>

              <div className="export-grid">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => reverseComplementFragment('fragmentB')}
                  disabled={isFragmentBLocked}
                >
                  Reverse complement B
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => updateProject('fragmentB', createEmptyFragment('Fragment B'))}
                  disabled={isFragmentBLocked}
                >
                  Reset fragment B
                </button>
              </div>

              <div className="field-grid range-grid">
                <label className="field-card">
                  <span className="field-label">Start</span>
                  <input
                    className="text-input"
                    type="number"
                    value={project.fragmentB.start}
                    disabled={isFragmentBLocked || project.editorLocks.fragmentBBoundaries}
                    onChange={(event) => updateFragment('fragmentB', 'start', Number(event.target.value) || 1)}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">End</span>
                  <input
                    className="text-input"
                    type="number"
                    value={project.fragmentB.end}
                    disabled={isFragmentBLocked || project.editorLocks.fragmentBBoundaries}
                    onChange={(event) => updateFragment('fragmentB', 'end', Number(event.target.value) || 1)}
                  />
                </label>
              </div>

              <div className="metric-grid compact-grid">
                <div className="metric">
                  <span>Source</span>
                  <strong>{project.fragmentB.sourceFormat}</strong>
                </div>
                <div className="metric">
                  <span>Topology</span>
                  <strong>{project.fragmentB.topology}</strong>
                </div>
                <div className="metric">
                  <span>Checksum</span>
                  <strong>{project.fragmentB.checksum}</strong>
                </div>
                <div className="metric">
                  <span>Ambiguous bases</span>
                  <strong>{project.fragmentB.ambiguousBases.join(', ') || 'None'}</strong>
                </div>
                <div className="metric">
                  <span>Imported name</span>
                  <strong>{project.fragmentB.importedName}</strong>
                </div>
                <div className="metric">
                  <span>Features</span>
                  <strong>{project.fragmentB.features.length}</strong>
                </div>
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
                          {feature.label} ({feature.key}) at {feature.location}
                          {' - '}
                          {selectionSummary}
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => applyFeatureSelection('fragmentB', index)}
                            disabled={isFragmentBLocked || project.editorLocks.fragmentBBoundaries || !parsed?.supported}
                          >
                            Use feature range
                          </button>
                        </li>
                      );
                    })}
                    {featureSelectionMessage ? (
                      <li>{featureSelectionMessage}</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </section>
          </section>

          <section className="panel canvas-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Construct Canvas</p>
                <h2>Stage-aware construct and sequence canvas</h2>
              </div>
              <div className="panel-actions">
                <span className="pill pill-muted">{getWorkflowStageLabel(selectedStage)}</span>
                <span className={`pill ${design.finalProductVerified ? 'pill-success' : 'pill-watch'}`}>
                  {design.finalProductVerified ? 'Exact product verified' : 'Awaiting valid design'}
                </span>
              </div>
            </div>

            <div className="toggle-grid canvas-toggle-grid">
              <label className="toggle-card">
                <input type="checkbox" checked={canvasTracks.sourceFragments} onChange={() => toggleCanvasTrack('sourceFragments')} />
                <span>Source fragments</span>
              </label>
              <label className="toggle-card">
                <input type="checkbox" checked={canvasTracks.finalConstruct} onChange={() => toggleCanvasTrack('finalConstruct')} />
                <span>Final construct</span>
              </label>
              <label className="toggle-card">
                <input type="checkbox" checked={canvasTracks.primerOverlays} onChange={() => toggleCanvasTrack('primerOverlays')} />
                <span>Primer overlays</span>
              </label>
              <label className="toggle-card">
                <input type="checkbox" checked={canvasTracks.gcAndTm} onChange={() => toggleCanvasTrack('gcAndTm')} />
                <span>GC and Tm</span>
              </label>
              <label className="toggle-card">
                <input type="checkbox" checked={canvasTracks.stageProducts} onChange={() => toggleCanvasTrack('stageProducts')} />
                <span>Stage products</span>
              </label>
              <label className="toggle-card">
                <input type="checkbox" checked={canvasTracks.translation} onChange={() => toggleCanvasTrack('translation')} />
                <span>Translation</span>
              </label>
              <label className="toggle-card">
                <input type="checkbox" checked={canvasTracks.features} onChange={() => toggleCanvasTrack('features')} />
                <span>Feature track</span>
              </label>
              <label className="toggle-card">
                <input type="checkbox" checked={canvasTracks.riskSummary} onChange={() => toggleCanvasTrack('riskSummary')} />
                <span>Risk summary</span>
              </label>
            </div>

            {canvasTracks.sourceFragments ? (
              <div className="canvas-stack">
                <SequenceRail
                  label={project.fragmentA.label}
                  sequenceLength={fragmentAMetrics.length}
                  start={design.project.fragmentA.start}
                  end={design.project.fragmentA.end}
                  topology={design.project.fragmentA.topology}
                  accentClass="rail-a"
                />
                <SequenceRail
                  label={project.fragmentB.label}
                  sequenceLength={fragmentBMetrics.length}
                  start={design.project.fragmentB.start}
                  end={design.project.fragmentB.end}
                  topology={design.project.fragmentB.topology}
                  accentClass="rail-b"
                />
              </div>
            ) : null}

            {canvasTracks.finalConstruct ? (
              <>
                <div className="construct-strip">
                  <button
                    type="button"
                    className={`construct-block block-a construct-button ${inspectorFocus === 'fragment-a' ? 'construct-active' : ''}`}
                    style={{ flexGrow: Math.max(design.selectedA.length, 1) }}
                    onClick={() => setInspectorFocus('fragment-a')}
                    aria-pressed={inspectorFocus === 'fragment-a'}
                  >
                    <span>{project.fragmentA.label}</span>
                    <strong>{design.selectedA.length} bp</strong>
                  </button>
                  <button
                    type="button"
                    className={`construct-block block-insert construct-button ${inspectorFocus === 'junction' ? 'construct-active' : ''}`}
                    style={{ flexGrow: Math.max(design.insertSequence.length, 1) }}
                    onClick={() => setInspectorFocus('junction')}
                    aria-pressed={inspectorFocus === 'junction'}
                  >
                    <span>{design.insertSequence ? 'Junction 1' : 'Direct join'}</span>
                    <strong>{design.insertSequence.length || 0} bp</strong>
                  </button>
                  <button
                    type="button"
                    className={`construct-block block-b construct-button ${inspectorFocus === 'fragment-b' ? 'construct-active' : ''}`}
                    style={{ flexGrow: Math.max(design.selectedB.length, 1) }}
                    onClick={() => setInspectorFocus('fragment-b')}
                    aria-pressed={inspectorFocus === 'fragment-b'}
                  >
                    <span>{project.fragmentB.label}</span>
                    <strong>{design.selectedB.length} bp</strong>
                  </button>
                </div>

                <p className="canvas-caption">
                  The center block is the selectable junction node. Selecting fragments or the junction updates the right-hand inspector without hiding the underlying sequence changes.
                </p>
              </>
            ) : null}

            {canvasTracks.primerOverlays ? (
              <div className="canvas-track-block">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Primer Overlays</p>
                    <h3>{selectedReaction ? selectedReaction.name : 'All primer placements'}</h3>
                  </div>
                  <span className="pill pill-muted">{visiblePrimers.length} primer(s)</span>
                </div>
                <div className="primer-overlay-grid">
                  {visiblePrimers.map((primer) => (
                    <article key={primer.name} className="metric">
                      <span>{primer.name}</span>
                      <strong>{primer.reaction}</strong>
                      <p className="field-helper">
                        Tail {primer.tail.length || 0} nt, body {primer.bodyLength} nt, body Tm {primer.bodyTm.toFixed(1)} C
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {canvasTracks.gcAndTm ? (
              <div className="metric-grid">
                <div className="metric">
                  <span>Fragment A slice</span>
                  <strong>{design.effectiveSelectedA.length} bp</strong>
                </div>
                <div className="metric">
                  <span>Fragment B slice</span>
                  <strong>{design.effectiveSelectedB.length} bp</strong>
                </div>
                <div className="metric">
                  <span>Overlap sequence</span>
                  <strong>{design.overlapSequence.length} nt</strong>
                </div>
                <div className="metric">
                  <span>Overlap Tm</span>
                  <strong>{comparisonMetrics.overlapTm !== null ? `${comparisonMetrics.overlapTm.toFixed(1)} C` : 'n/a'}</strong>
                </div>
                <div className="metric">
                  <span>Fragment A GC</span>
                  <strong>{fragmentAMetrics.gcPercentage.toFixed(1)}%</strong>
                </div>
                <div className="metric">
                  <span>Fragment B GC</span>
                  <strong>{fragmentBMetrics.gcPercentage.toFixed(1)}%</strong>
                </div>
              </div>
            ) : null}

            {canvasTracks.features ? (
              <div className="canvas-track-block">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Feature Track</p>
                    <h3>Imported annotations and sequence identity</h3>
                  </div>
                </div>
                <div className="metric-grid compact-grid">
                  <div className="metric">
                    <span>{project.fragmentA.label}</span>
                    <strong>{project.fragmentA.features.length} features</strong>
                  </div>
                  <div className="metric">
                    <span>{project.fragmentB.label}</span>
                    <strong>{project.fragmentB.features.length} features</strong>
                  </div>
                  <div className="metric">
                    <span>Fragment A checksum</span>
                    <strong>{project.fragmentA.checksum}</strong>
                  </div>
                  <div className="metric">
                    <span>Fragment B checksum</span>
                    <strong>{project.fragmentB.checksum}</strong>
                  </div>
                </div>
              </div>
            ) : null}

            {canvasTracks.stageProducts ? stageSequencePreviews.map((preview) => <SequencePreview key={preview.label} title={preview.label} sequence={preview.sequence} />) : null}

            {canvasTracks.riskSummary ? (
              <div className="status-block">
                <p className="status-title">Risk highlighting</p>
                <ul className="status-list">
                  <li>{design.offTargetAmplicons.length} local off-target amplicon candidate(s), {comparisonMetrics.highRiskOffTargets} high-risk.</li>
                  <li>{design.warnings.length} workflow warning(s) are attached to the current design.</li>
                  <li>Worst pairwise dimer delta G: {comparisonMetrics.worstDimerDeltaG !== null ? `${comparisonMetrics.worstDimerDeltaG.toFixed(1)} kcal/mol` : 'n/a'}.</li>
                </ul>
              </div>
            ) : null}

            {canvasTracks.translation && design.proteinValidation ? (
              <section className="protein-panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Protein Readout</p>
                    <h3>Translation and frame audit</h3>
                  </div>
                </div>
                <div className="metric-grid compact-grid">
                  <div className="metric">
                    <span>Protein length</span>
                    <strong>{design.proteinValidation.proteinLength} aa</strong>
                  </div>
                  <div className="metric">
                    <span>Frame</span>
                    <strong>{design.proteinValidation.framePreserved ? 'Preserved' : 'Shifted'}</strong>
                  </div>
                  <div className="metric">
                    <span>Junction window</span>
                    <strong>{design.proteinValidation.junctionAminoAcids || 'n/a'}</strong>
                  </div>
                  <div className="metric">
                    <span>Linker aa</span>
                    <strong>{design.proteinValidation.linkerAminoAcids || 'none'}</strong>
                  </div>
                  <div className="metric">
                    <span>Synonymous optimization</span>
                    <strong>
                      {design.proteinValidation.synonymousOptimization
                        ? design.proteinValidation.synonymousOptimization.applied
                          ? 'Applied'
                          : design.proteinValidation.synonymousOptimization.changed
                            ? 'Proposed'
                            : 'Evaluated'
                        : 'Off'}
                    </strong>
                  </div>
                  <div className="metric">
                    <span>Codon changes</span>
                    <strong>{design.proteinValidation.synonymousOptimization?.changes.length ?? 0}</strong>
                  </div>
                </div>
                <p className={`status-note ${design.proteinValidation.framePreserved ? 'status-note-success' : 'status-note-alert'}`}>
                  {design.proteinValidation.frameMessage}
                </p>
                {design.proteinValidation.synonymousOptimization ? (
                  <div className="status-block">
                    <p className="status-title">Synonymous optimization</p>
                    <p>{design.proteinValidation.synonymousOptimization.summary}</p>
                    {design.proteinValidation.synonymousOptimization.changes.length ? (
                      <ul className="status-list">
                        {design.proteinValidation.synonymousOptimization.changes.map((change) => (
                          <li key={`${change.fragment}-${change.codonIndex}-${change.from}-${change.to}`}>
                            {change.fragment} codon {change.codonIndex + 1} at base {change.start}: {change.from} to {change.to} ({change.aminoAcid})
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
                <SequencePreview title="Upstream translation" sequence={design.proteinValidation.upstreamTranslation} />
                <SequencePreview title="Insert translation" sequence={design.proteinValidation.insertTranslation} />
                <SequencePreview title="Downstream translation" sequence={design.proteinValidation.downstreamTranslation} />
                <SequencePreview title="Fused translation" sequence={design.proteinValidation.finalTranslation} />
              </section>
            ) : null}
          </section>

          <section className="panel inspector-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Inspector</p>
                <h2>Verification, junctions, and workflow</h2>
              </div>
              <span className={`pill ${design.issues.length ? 'pill-alert' : 'pill-success'}`}>
                {design.issues.length ? `${design.issues.length} issue(s)` : 'Design runnable'}
              </span>
            </div>

            <div className="inspector-tabs">
              <button type="button" className={`button ${inspectorFocus === 'junction' ? 'button-primary' : 'button-secondary'}`} onClick={() => setInspectorFocus('junction')}>
                Junction
              </button>
              <button type="button" className={`button ${inspectorFocus === 'fragment-a' ? 'button-primary' : 'button-secondary'}`} onClick={() => setInspectorFocus('fragment-a')}>
                Fragment A
              </button>
              <button type="button" className={`button ${inspectorFocus === 'fragment-b' ? 'button-primary' : 'button-secondary'}`} onClick={() => setInspectorFocus('fragment-b')}>
                Fragment B
              </button>
              <button type="button" className={`button ${inspectorFocus === 'warnings' ? 'button-primary' : 'button-secondary'}`} onClick={() => setInspectorFocus('warnings')}>
                Warnings
              </button>
              <button type="button" className={`button ${inspectorFocus === 'protocol' ? 'button-primary' : 'button-secondary'}`} onClick={() => setInspectorFocus('protocol')}>
                Protocol
              </button>
            </div>

            {inspectorFocus === 'junction' ? (
              <div className="status-block">
                <p className="status-title">Junction 1</p>
                <div className="junction-segments" aria-label="Junction sequence provenance">
                  <div className="junction-segment junction-upstream">
                    <span>Upstream fragment</span>
                    <code>{junctionSummary.upstreamFlank || 'n/a'}</code>
                  </div>
                  <div className="junction-segment junction-insert">
                    <span>Inserted or mutated bases</span>
                    <code>{junctionSummary.insertSequence || 'direct join'}</code>
                  </div>
                  <div className="junction-segment junction-downstream">
                    <span>Downstream fragment</span>
                    <code>{junctionSummary.downstreamFlank || 'n/a'}</code>
                  </div>
                </div>
                <SequencePreview title="Final junction window" sequence={junctionSummary.finalJunction || design.finalProduct} />
                <ul className="status-list">
                  <li>A inner R 3 prime annealing region: {junctionSummary.upstreamAnnealRegion || 'n/a'}</li>
                  <li>B inner F 3 prime annealing region: {junctionSummary.downstreamAnnealRegion || 'n/a'}</li>
                  <li>A inner R 5 prime tail contribution in construct orientation: {junctionSummary.aInnerTailContribution || 'none'}</li>
                  <li>B inner F 5 prime tail contribution: {junctionSummary.bInnerTailContribution || 'none'}</li>
                </ul>
              </div>
            ) : null}

            {inspectorFocus === 'fragment-a' ? (
              <div className="status-block">
                <p className="status-title">{project.fragmentA.label}</p>
                <ul className="status-list">
                  <li>Selected coordinates: {design.project.fragmentA.start}-{design.project.fragmentA.end}</li>
                  <li>Source format: {project.fragmentA.sourceFormat}</li>
                  <li>Topology: {project.fragmentA.topology}</li>
                  <li>Checksum: {project.fragmentA.checksum}</li>
                  <li>Features: {project.fragmentA.features.length}</li>
                </ul>
              </div>
            ) : null}

            {inspectorFocus === 'fragment-b' ? (
              <div className="status-block">
                <p className="status-title">{project.fragmentB.label}</p>
                <ul className="status-list">
                  <li>Selected coordinates: {design.project.fragmentB.start}-{design.project.fragmentB.end}</li>
                  <li>Source format: {project.fragmentB.sourceFormat}</li>
                  <li>Topology: {project.fragmentB.topology}</li>
                  <li>Checksum: {project.fragmentB.checksum}</li>
                  <li>Features: {project.fragmentB.features.length}</li>
                </ul>
              </div>
            ) : null}

            {inspectorFocus === 'warnings' ? (
            <div className="status-block">
              <p className="status-title">Warning focus</p>
              <ul className="status-list">
                  <li>{design.warnings.length} warning(s) currently attached to the design.</li>
                  <li>{design.offTargetAmplicons.length} local off-target amplicon candidate(s) were found.</li>
                  <li>{design.primerPairInteractions.filter((pair) => pair.interaction?.risk === 'High').length} high-risk primer pair interaction(s) were detected.</li>
                  <li>Design quality score: {design.qualityScore.toFixed(3)}</li>
                </ul>
              </div>
            ) : null}

            {inspectorFocus === 'protocol' ? (
              <div className="status-block">
                <p className="status-title">Protocol focus</p>
                <ul className="status-list">
                  <li>Active workflow stage: {getWorkflowStageLabel(selectedStage)}</li>
                  <li>Reaction plan entries: {design.reactions.length}</li>
                  <li>Primer working-stock prep: {design.protocolPlan.workingStockStockVolumeUl.toFixed(2)} uL stock + {design.protocolPlan.workingStockDiluentVolumeUl.toFixed(2)} uL diluent</li>
                  <li>Final product target: {design.finalProduct.length} bp</li>
                </ul>
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
              <p className="status-title">Local specificity</p>
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
            </div>

            <div className="status-block">
              <p className="status-title">Primer pair interactions</p>
              <ul className="status-list">
                {design.primerPairInteractions.length ? (
                  design.primerPairInteractions.slice(0, 8).map((pair) => (
                    <li key={`${pair.primerAName}-${pair.primerBName}`}>
                      {pair.primerAName}/{pair.primerBName}: {pair.interaction ? `${pair.interaction.risk}, dG ${pair.interaction.deltaG} kcal/mol, 3 prime ${Math.max(pair.interaction.threePrimePairedBasesA, pair.interaction.threePrimePairedBasesB)}` : 'none'}{pair.intended ? ' (intended overlap pair)' : ''}
                    </li>
                  ))
                ) : (
                  <li>No pairwise interactions were computed.</li>
                )}
              </ul>
            </div>

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
              <p className="status-title">Primer-BLAST handoff</p>
              <ul className="status-list">
                <li>Organism: {design.project.genomicSpecificity.organism || 'Not set'}</li>
                <li>Database: {design.project.genomicSpecificity.database || 'Not set'}</li>
                <li>Notes: {design.project.genomicSpecificity.notes || 'None'}</li>
              </ul>
              <p className="field-helper">
                Exporting a handoff package keeps the app local by default, but the resulting submission to Primer-BLAST is an external genomic-specificity check.
              </p>
            </div>

            <div className="status-block">
              <p className="status-title">Protocol plan</p>
              <ul className="status-list">
                {design.protocolPlan.stageMixEntries.map((entry) => (
                  <li key={entry.label}>
                    {entry.label}: {entry.targetPmol.toFixed(3)} pmol, {entry.requiredMassNg.toFixed(2)} ng, {entry.requiredVolumeUl.toFixed(2)} uL at {entry.concentrationNgPerUl} ng/uL
                  </li>
                ))}
                <li>
                  Working stock prep: {design.protocolPlan.workingStockStockVolumeUl.toFixed(2)} uL stock + {design.protocolPlan.workingStockDiluentVolumeUl.toFixed(2)} uL diluent
                </li>
              </ul>
            </div>

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
              <p className="status-title">Reaction mixes</p>
              <ul className="status-list">
                {design.protocolPlan.reactionMixes.map((mix) => (
                  <li key={mix.name}>
                    {mix.name}: {mix.totalMasterMixVolumeUl.toFixed(2)} uL total master mix, {mix.cycleCount} cycles, {mix.overfilledReactionCount.toFixed(2)} effective reactions
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
                      {recipe.note ? <span className="pill pill-watch">Volume check</span> : null}
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

            <div className="export-grid">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadText('fusionpcr-project.json', buildProjectJson(design.project), 'application/json')}
              >
                Export project JSON
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadText('fusionpcr-primers.csv', buildPrimerCsv(design), 'text/csv')}
                disabled={!hasExportableDesign}
              >
                Export oligo-ordering CSV
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadText('fusionpcr-primers.fasta', buildPrimerFasta(design), 'text/plain')}
                disabled={!hasExportableDesign}
              >
                Export primer FASTA
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadText('fusionpcr-final-construct.fasta', buildFinalConstructFasta(design), 'text/plain')}
                disabled={!hasExportableDesign}
              >
                Export final FASTA
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadText('fusionpcr-stage-products.fasta', buildStageProductFasta(design), 'text/plain')}
                disabled={!hasExportableDesign}
              >
                Export stage-product FASTA
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadText('fusionpcr-construct.gb', buildAnnotatedGenbank(design), 'text/plain')}
                disabled={!hasExportableDesign}
              >
                Export annotated GenBank
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadText('fusionpcr-protocol.txt', buildProtocolText(design), 'text/plain')}
                disabled={!hasExportableDesign}
              >
                Export protocol
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadText('fusionpcr-pipetting-table.csv', buildPipettingTableCsv(design), 'text/csv')}
                disabled={!hasExportableDesign}
              >
                Export pipetting table
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadText('fusionpcr-thermocycler-program.txt', buildThermocyclerProgram(design), 'text/plain')}
                disabled={!hasExportableDesign}
              >
                Export thermocycler program
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadText('fusionpcr-junction-report.txt', buildJunctionReport(design), 'text/plain')}
                disabled={!hasExportableDesign}
              >
                Export junction report
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadText('fusionpcr-validation-report.txt', buildValidationReport(design), 'text/plain')}
                disabled={!hasExportableDesign}
              >
                Export validation report
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadText('fusionpcr-expected-gel.txt', buildExpectedGelDiagram(design), 'text/plain')}
                disabled={!hasExportableDesign}
              >
                Export expected gel
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadText('fusionpcr-calculation-manifest.json', buildCalculationManifest(design), 'application/json')}
                disabled={!hasExportableDesign}
              >
                Export calculation manifest
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => downloadText('fusionpcr-primer-blast-handoff.txt', buildPrimerBlastPackage(design), 'text/plain')}
                disabled={!hasExportableDesign}
              >
                Export Primer-BLAST handoff
              </button>
            </div>

            <div className="reaction-stack">
              {design.reactions.map((reaction) => (
                <ReactionCard key={reaction.name} reaction={reaction} />
              ))}
            </div>
          </section>
        </section>

        <section className="panel workflow-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Workflow</p>
              <h2>Experimental stage filter and compare mode</h2>
            </div>
            <div className="panel-actions">
              <button type="button" className="button button-secondary" onClick={captureComparisonSnapshot}>
                {comparisonSnapshot ? 'Refresh pinned design' : 'Pin current design'}
              </button>
              {comparisonSnapshot ? (
                <button type="button" className="button button-secondary" onClick={() => setComparisonSnapshot(null)}>
                  Clear compare
                </button>
              ) : null}
            </div>
          </div>

          <div className="workflow-stage-row">
            {(['overview', 'pcr1a', 'pcr1b', 'fusion', 'verification'] as WorkflowStage[]).map((stage) => (
              <button
                key={stage}
                type="button"
                className={`button ${selectedStage === stage ? 'button-primary' : 'button-secondary'}`}
                onClick={() => {
                  setSelectedStage(stage);
                  setInspectorFocus(stage === 'overview' || stage === 'verification' ? 'junction' : 'protocol');
                }}
              >
                {getWorkflowStageLabel(stage)}
              </button>
            ))}
          </div>

            <div className="workflow-grid">
              <div className="reaction-stack">
                {selectedReaction ? (
                  <ReactionCard reaction={selectedReaction} />
                ) : (
                design.reactions.map((reaction) => <ReactionCard key={reaction.name} reaction={reaction} />)
              )}
            </div>

            <div className="status-block">
              <p className="status-title">Stage detail</p>
                <ul className="status-list">
                  <li>Stage: {getWorkflowStageLabel(selectedStage)}</li>
                  <li>Visible primers: {stagePrimerNames.join(', ') || 'All primers in view'}</li>
                  <li>Sequence previews in canvas: {stageSequencePreviews.length}</li>
                  <li>Exact verification: {design.finalProductVerified ? 'pass' : 'pending'}</li>
                  <li>Quality score: {design.qualityScore.toFixed(3)}</li>
                </ul>
              </div>

              {comparisonSnapshot ? (
              <div className="status-block compare-block">
                <p className="status-title">Compare mode</p>
                <p className="field-helper">Pinned snapshot captured {new Date(comparisonSnapshot.capturedAt).toLocaleString()}.</p>
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
              </div>
              ) : (
                <div className="status-block">
                  <p className="status-title">Compare mode</p>
                  <p>Pin the current design to compare total oligo length, dimer severity, Tm spread, overlap Tm, and local off-target counts after each edit.</p>
                </div>
              )}

              <div className="status-block">
                <p className="status-title">Optimized alternatives</p>
                <div className="candidate-stack">
                  {design.alternativeDesigns.map((candidate) => (
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
                  ))}
                </div>
              </div>
            </div>
          </section>

        <section className="panel primer-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Primer Set</p>
              <h2>Tail and annealing-body separation</h2>
            </div>
            <span className="pill pill-muted">{getWorkflowStageLabel(selectedStage)}</span>
          </div>
          <div className="primer-grid">
            {visiblePrimers.map((primer) => (
              <PrimerCard key={primer.name} primer={primer} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
