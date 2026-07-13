import { useEffect, useState } from 'react';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { ContextInspector } from './components/ContextInspector';
import { ExperimentalNotice } from './components/ExperimentalNotice';
import { IssueDrawer } from './components/IssueDrawer';
import { JunctionStep } from './components/JunctionStep';
import { PrimerStep, type PrimerResultTab } from './components/PrimerStep';
import { ProtocolExportStep, type ProtocolResultTab } from './components/ProtocolExportStep';
import { ProjectToolbar } from './components/ProjectToolbar';
import { ReactionTimeline } from './components/ReactionTimeline';
import { SequenceStep } from './components/SequenceStep';
import { StepNavigation } from './components/StepNavigation';
import { WelcomeScreen } from './components/WelcomeScreen';
import { exampleProjectOptions } from './data/example';
import { useFusionDesign } from './hooks/useFusionDesign';
import { useProjectController } from './hooks/useProjectController';
import { useProjectPersistence } from './hooks/useProjectPersistence';
import { useViewportMode } from './hooks/useViewportMode';
import { summarizeSequenceMetrics } from './utils/fusion';
import { buildMutationPlan, selectedFragmentSequence, type MutationPlannerMode } from './utils/mutation';
import {
  buildJunctionSummary,
  getStagePrimerNames,
  getStageSequencePreviews,
  getWorkflowStageLabel,
  summarizeDesignComparison,
  type WorkflowStage,
} from './utils/review';

const STORAGE_KEY = 'fusionpcr-studio-project';

type InspectorFocus = 'junction' | 'fragment-a' | 'fragment-b' | 'primer' | 'reaction';
type WorkbenchStep = 'sequences' | 'construct' | 'primers' | 'protocol';

type StepStatusLevel = 'complete' | 'warning' | 'error' | 'pending';

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
  const [selectedStage, setSelectedStage] = useState<WorkflowStage>('overview');
  const [inspectorFocus, setInspectorFocus] = useState<InspectorFocus>('junction');
  const projectController = useProjectController();
  const {
    project,
    importError,
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
    selectedExampleId,
    fileInputRef,
    sequenceFileInputRef,
  } = projectController;
  const [activeStep, setActiveStep] = useState<WorkbenchStep>(() => (showWorkbench ? 'construct' : 'sequences'));
  const [primerResultTab, setPrimerResultTab] = useState<PrimerResultTab>('overview');
  const [protocolResultTab, setProtocolResultTab] = useState<ProtocolResultTab>('overview');
  const [selectedPrimerName, setSelectedPrimerName] = useState<string | null>(null);
  const viewportMode = useViewportMode();
  const { design, calculationState, isDesignPending, isDesignCurrent, workerError, retry } = useFusionDesign(project);
  const { persistenceState, persistenceError, retryPersistence } = useProjectPersistence(STORAGE_KEY, project);
  const fragmentAMetrics = summarizeSequenceMetrics(project.fragmentA.sequence);
  const fragmentBMetrics = summarizeSequenceMetrics(project.fragmentB.sequence);
  const isPhoneViewport = viewportMode === 'phone';
  const isCompactViewport = viewportMode !== 'desktop';
  const activeFragment = project[projectController.activeFragmentKey];
  const isFragmentALocked = project.editorLocks.fragmentA;
  const isFragmentBLocked = project.editorLocks.fragmentB;
  const isInsertLocked = project.editorLocks.insertSequence;
  const isPolymeraseLocked = project.editorLocks.polymeraseSettings;
  const activeFragmentLocked = projectController.activeFragmentKey === 'fragmentA' ? isFragmentALocked : isFragmentBLocked;
  const counterpartFragmentLocked = projectController.activeFragmentKey === 'fragmentA' ? isFragmentBLocked : isFragmentALocked;
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
  const mutationRecipient = project[projectController.mutationRecipientKey];
  const mutationDonor = project[projectController.mutationDonorKey];
  const mutationPayload =
    projectController.mutationPayloadSource === 'donor-selection'
      ? selectedFragmentSequence(mutationDonor)
      : projectController.mutationPayloadInput;
  const mutationPreview =
    mutationMode === null
      ? null
      : (() => {
          try {
            return buildMutationPlan({
              mode: mutationMode,
              recipient: mutationRecipient,
              coordinate: projectController.mutationCoordinate,
              start: projectController.mutationStart,
              end: projectController.mutationEnd,
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
  const activeReaction = selectedReaction ?? design.reactions[0] ?? null;
  const saveStateLabel =
    persistenceState === 'saving'
      ? 'Saving locally'
      : persistenceState === 'saved'
        ? 'Saved locally'
        : persistenceState === 'failed'
          ? 'Local save failed'
          : 'Autosave pending';
  const calculationStateLabel =
    workerError ? 'Calculation failed' : calculationState === 'complete' && isDesignCurrent ? 'Calculation complete' : 'Calculating';
  const calculationStateTone: 'success' | 'watch' | 'alert' =
    workerError ? 'alert' : calculationState === 'complete' && isDesignCurrent ? 'success' : 'watch';
  const publicExampleOptions = exampleProjectOptions.filter((option) => option.id === 'protein-fusion' || option.id === 'exact-fusion');
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

  useEffect(() => {
    if (!visiblePrimers.length) {
      setSelectedPrimerName(null);
      return;
    }

    setSelectedPrimerName((current) => (current && visiblePrimers.some((primer) => primer.name === current) ? current : visiblePrimers[0].name));
  }, [visiblePrimers]);

  const handleLoadExample = (exampleId = selectedExampleId) => {
    projectController.loadExample(exampleId);
    setActiveStep('construct');
    setInspectorFocus('junction');
    setPrimerResultTab('overview');
    setProtocolResultTab('overview');
  };

  const handleResetProject = () => {
    projectController.resetProject();
    setActiveStep('sequences');
    setInspectorFocus('junction');
    setSelectedPrimerName(null);
  };

  const handleRestorePreviousProject = () => {
    projectController.restorePreviousProject();
    setActiveStep('construct');
    setInspectorFocus('junction');
  };

  const handleImportedSourceSelection = (
    fragmentKey: 'fragmentA' | 'fragmentB',
    source: Parameters<typeof projectController.applyImportedSource>[1],
  ) => {
    projectController.applyImportedSource(fragmentKey, source);
    setActiveStep('construct');
  };

  const handleApplyFirstTwoImportedSources = () => {
    projectController.applyFirstTwoImportedSources();
    setActiveStep('construct');
  };

  const handleApplyMutationWorkflow = () => {
    projectController.applyMutationWorkflow(mutationMode);
    setInspectorFocus('junction');
    setActiveStep('construct');
  };

  const handleProjectFileChange = (event: Parameters<typeof projectController.handleImportFile>[0]) => {
    void projectController.handleImportFile(event);
    setActiveStep('construct');
    setInspectorFocus('junction');
  };

  return (
    <div className="app-shell">
      <main className="app">
        <ProjectToolbar
          projectName={project.name}
          showWorkbench={showWorkbench}
          readOnlyReviewMode={isPhoneViewport && showWorkbench}
          saveStateLabel={saveStateLabel}
          persistenceState={persistenceState}
          calculationStateLabel={calculationStateLabel}
          calculationStateTone={calculationStateTone}
          canUndo={projectController.canUndo}
          canRedo={projectController.canRedo}
          showMenu={showMenu}
          hasRecoverableProject={recoverableProjectSnapshot !== null}
          onProjectNameChange={(value) => projectController.updateProject('name', value)}
          onUndo={projectController.undoProject}
          onRedo={projectController.redoProject}
          onOpenProject={projectController.handleImportClick}
          onToggleMenu={() => setShowMenu((current) => !current)}
          onLoadExactExample={() => handleLoadExample('exact-fusion')}
          onLoadProteinExample={() => handleLoadExample('protein-fusion')}
          onRestorePreviousProject={handleRestorePreviousProject}
          onClearProject={handleResetProject}
        />

        {showExperimentalNotice ? <ExperimentalNotice onDismiss={() => setShowExperimentalNotice(false)} /> : null}

        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleProjectFileChange} />
        <input
          ref={sequenceFileInputRef}
          type="file"
          accept=".txt,.fa,.fasta,.gb,.gbk,.gbff"
          hidden
          onChange={projectController.handleSequenceFileImport}
        />

        {!showWorkbench ? (
          <WelcomeScreen
            onImportSequences={() => {
              setShowWorkbench(true);
              setActiveStep('sequences');
            }}
            onLoadExactExample={() => handleLoadExample('exact-fusion')}
            onLoadProteinExample={() => handleLoadExample('protein-fusion')}
            onOpenProject={projectController.handleImportClick}
          />
        ) : (
          <>
            <div className="workbench-mobile-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowInspector((current) => !current)}>
                {showInspector ? 'Hide inspector' : 'Show inspector'}
              </button>
            </div>

            <section className="workbench-layout">
              <StepNavigation
                activeStep={activeStep as 'sequences' | 'construct' | 'primers' | 'protocol'}
                showSidebar={isCompactViewport ? true : showSidebar}
                targetLength={design.targetSequence.length}
                exactVerification={design.finalProductVerified}
                canUndo={projectController.canUndo}
                canRedo={projectController.canRedo}
                sequenceStepStatus={sequenceStepStatus}
                constructStepStatus={constructStepStatus}
                primerStepStatus={primerStepStatus}
                protocolStepStatus={protocolStepStatus}
                onSelectStep={(step) => {
                  setActiveStep(step);
                  setShowSidebar(false);
                }}
                onClearProject={handleResetProject}
                formatStepStatus={formatStepStatus}
              />

              <section className="workspace-pane">
                <IssueDrawer issues={design.issues} warnings={design.warnings} />

                {activeStep === 'sequences' ? (
                  <SequenceStep
                    controller={projectController}
                    design={design}
                    selectedPublicExampleDescription={selectedPublicExampleDescription}
                    phoneReviewMode={isPhoneViewport}
                    fragmentAMetrics={fragmentAMetrics}
                    fragmentBMetrics={fragmentBMetrics}
                    mutationMode={mutationMode}
                    mutationPayload={mutationPayload}
                    mutationPreview={mutationPreview}
                    isFragmentALocked={isFragmentALocked}
                    isFragmentBLocked={isFragmentBLocked}
                    isInsertLocked={isInsertLocked}
                    isPolymeraseLocked={isPolymeraseLocked}
                    activeFragmentLocked={activeFragmentLocked}
                    counterpartFragmentLocked={counterpartFragmentLocked}
                    onApplyImportedSource={handleImportedSourceSelection}
                    onApplyFirstTwoImportedSources={handleApplyFirstTwoImportedSources}
                    onApplyMutationWorkflow={handleApplyMutationWorkflow}
                  />
                ) : null}

                {activeStep === 'construct' ? (
                  <JunctionStep
                    design={design}
                    projectNameA={project.fragmentA.label}
                    projectNameB={project.fragmentB.label}
                    fragmentALength={fragmentAMetrics.length}
                    fragmentBLength={fragmentBMetrics.length}
                    selectedStageLabel={getWorkflowStageLabel(selectedStage)}
                    canvasTracks={canvasTracks}
                    inspectorFocus={inspectorFocus}
                    visiblePrimers={visiblePrimers}
                    selectedPrimerName={selectedPrimer?.name ?? null}
                    stageSequencePreviews={stageSequencePreviews}
                    comparisonSnapshot={comparisonSnapshot}
                    compareRows={compareRows}
                    onInspectorFocusChange={setInspectorFocus}
                    onSelectPrimer={(primerName) => {
                      setSelectedPrimerName(primerName);
                      setInspectorFocus('primer');
                    }}
                    onShowInspector={() => setShowInspector(true)}
                    onToggleCanvasTrack={projectController.toggleCanvasTrack}
                    onCaptureComparisonSnapshot={() => projectController.captureComparisonSnapshot(comparisonMetrics)}
                    onClearComparisonSnapshot={() => setComparisonSnapshot(null)}
                  />
                ) : null}

                {activeStep === 'primers' ? (
                  <PrimerStep
                    design={design}
                    visiblePrimers={visiblePrimers}
                    selectedPrimerName={selectedPrimer?.name ?? null}
                    primerResultTab={primerResultTab}
                    phoneReviewMode={isPhoneViewport}
                    comparisonSnapshot={comparisonSnapshot}
                    compareRows={compareRows}
                    onPrimerResultTabChange={setPrimerResultTab}
                    onSelectPrimer={(primerName) => {
                      setSelectedPrimerName(primerName);
                      setInspectorFocus('primer');
                      setShowInspector(true);
                    }}
                  />
                ) : null}

                {activeStep === 'protocol' ? (
                  <ProtocolExportStep
                    controller={projectController}
                    project={project}
                    design={design}
                    protocolResultTab={protocolResultTab}
                    selectedStage={selectedStage}
                    activeReactionName={activeReaction?.name ?? null}
                    selectedReactionName={selectedReaction?.name ?? null}
                    hasExportableDesign={hasExportableDesign}
                    isPolymeraseLocked={isPolymeraseLocked}
                    onProtocolResultTabChange={setProtocolResultTab}
                    onSelectOverviewReaction={(reactionName) => {
                      setSelectedStage(reactionName === 'PCR 1A' ? 'pcr1a' : reactionName === 'PCR 1B' ? 'pcr1b' : 'fusion');
                      setInspectorFocus('reaction');
                      setShowInspector(true);
                    }}
                    onInspectReaction={() => setInspectorFocus('reaction')}
                  />
                ) : null}
              </section>

              <ContextInspector
                design={design}
                project={project}
                inspectorFocus={inspectorFocus}
                selectedPrimer={selectedPrimer}
                activeReaction={activeReaction}
                junctionSummary={{
                  insertSequence: junctionSummary.insertSequence,
                  finalJunction: junctionSummary.finalJunction,
                  upstreamAnnealRegion: junctionSummary.upstreamAnnealRegion,
                  downstreamAnnealRegion: junctionSummary.downstreamAnnealRegion,
                  aInnerTailContribution: junctionSummary.aInnerTailContribution,
                  bInnerTailContribution: junctionSummary.bInnerTailContribution,
                }}
                overlapTmLabel={comparisonMetrics.overlapTm !== null ? `${comparisonMetrics.overlapTm.toFixed(1)} C` : 'n/a'}
                workerError={workerError}
                persistenceError={persistenceError}
                importError={importError}
                onRetryCalculation={retry}
                onRetryPersistence={retryPersistence}
                showInspector={showInspector}
              />
            </section>

            <ReactionTimeline
              selectedStage={selectedStage}
              onSelectStage={(stage) => {
                setSelectedStage(stage);
                setInspectorFocus(stage === 'overview' || stage === 'verification' ? 'junction' : 'reaction');
              }}
            />
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
