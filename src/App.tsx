import { useEffect, useRef, useState } from 'react';
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
import { useAppFocusManagement } from './hooks/useAppFocusManagement';
import { useProjectController } from './hooks/useProjectController';
import { useProjectPersistence } from './hooks/useProjectPersistence';
import { useViewportMode } from './hooks/useViewportMode';
import { buildCompareRows, buildStepStatuses, focusInspectorPanel, formatStepStatus, getActiveFocusableElement, isEditableElement } from './utils/app-ui';
import { countPrimerScopedReviewItems, filterActionableReviewItems } from './utils/review-items';
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
  const workspaceHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const issueDrawerHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const inspectorHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const retryCalculationButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileInspectorToggleRef = useRef<HTMLButtonElement | null>(null);
  const confirmationCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const viewportMode = useViewportMode();
  const { design, calculationState, isDesignPending, isDesignCurrent, workerError, retry } = useFusionDesign(project);
  const { persistenceState, persistenceError, retryPersistence } = useProjectPersistence(STORAGE_KEY, project);
  const { inspectorTriggerRef, confirmationTriggerRef } = useAppFocusManagement({
    showInspector,
    workerError,
    confirmationState,
    issueCount: design.issues.length,
    showWorkbench,
    calculationState,
    isDesignCurrent,
    issueDrawerHeadingRef,
    workspaceHeadingRef,
    inspectorHeadingRef,
    retryCalculationButtonRef,
    confirmationCancelButtonRef,
  });
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
  const actionableReviewItems = filterActionableReviewItems(design.reviewItems);
  const blockingReviewCount = design.reviewItems.filter((item) => item.severity === 'blocking').length;
  const primerScopedReviewCount = countPrimerScopedReviewItems(design);
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
  const { sequenceStepStatus, constructStepStatus, primerStepStatus, protocolStepStatus } = buildStepStatuses({
    project,
    design,
    blockingReviewCount,
    actionableReviewCount: actionableReviewItems.length,
    primerScopedReviewCount,
  });
  const compareRows = buildCompareRows(comparisonMetrics, comparisonSnapshot);

  useEffect(() => {
    if (!visiblePrimers.length) {
      setSelectedPrimerName(null);
      return;
    }

    setSelectedPrimerName((current) => (current && visiblePrimers.some((primer) => primer.name === current) ? current : visiblePrimers[0].name));
  }, [visiblePrimers]);

  const openInspector = () => {
    inspectorTriggerRef.current = getActiveFocusableElement();
    setShowInspector(true);
    focusInspectorPanel();
  };

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
              <button
                ref={mobileInspectorToggleRef}
                type="button"
                className="button button-secondary"
                onClick={() => {
                  if (showInspector) {
                    setShowInspector(false);
                    return;
                  }
                  inspectorTriggerRef.current = getActiveFocusableElement() ?? mobileInspectorToggleRef.current;
                  setShowInspector(true);
                  window.setTimeout(() => {
                    const heading = document.querySelector('.inspector-pane h2');
                    if (heading instanceof HTMLElement) {
                      heading.focus();
                    }
                  }, 220);
                }}
              >
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
                <IssueDrawer reviewItems={design.reviewItems} headingRef={issueDrawerHeadingRef} />

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
                    headingRef={workspaceHeadingRef}
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
                    headingRef={workspaceHeadingRef}
                    onInspectorFocusChange={setInspectorFocus}
                    onSelectPrimer={(primerName) => {
                      setSelectedPrimerName(primerName);
                      setInspectorFocus('primer');
                    }}
                    onShowInspector={openInspector}
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
                    headingRef={workspaceHeadingRef}
                    onPrimerResultTabChange={setPrimerResultTab}
                    onSelectPrimer={(primerName) => {
                      setSelectedPrimerName(primerName);
                      setInspectorFocus('primer');
                      openInspector();
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
                    headingRef={workspaceHeadingRef}
                    onProtocolResultTabChange={setProtocolResultTab}
                    onSelectOverviewReaction={(reactionName) => {
                      setSelectedStage(reactionName === 'PCR 1A' ? 'pcr1a' : reactionName === 'PCR 1B' ? 'pcr1b' : 'fusion');
                      setInspectorFocus('reaction');
                      openInspector();
                    }}
                    onInspectReaction={() => {
                      setInspectorFocus('reaction');
                      openInspector();
                    }}
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
                headingRef={inspectorHeadingRef}
                retryCalculationButtonRef={retryCalculationButtonRef}
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
          cancelButtonRef={confirmationCancelButtonRef}
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
