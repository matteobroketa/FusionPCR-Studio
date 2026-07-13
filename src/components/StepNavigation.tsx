type WorkbenchStep = 'sequences' | 'construct' | 'primers' | 'protocol';
type StepStatus = {
  level: 'complete' | 'warning' | 'error' | 'pending';
  text: string;
};

type StepNavigationProps = {
  activeStep: WorkbenchStep;
  showSidebar: boolean;
  targetLength: number;
  exactVerification: boolean;
  canUndo: boolean;
  canRedo: boolean;
  sequenceStepStatus: StepStatus;
  constructStepStatus: StepStatus;
  primerStepStatus: StepStatus;
  protocolStepStatus: StepStatus;
  onSelectStep: (step: WorkbenchStep) => void;
  onClearProject: () => void;
  formatStepStatus: (level: StepStatus['level'], text: string) => string;
};

const workflowSteps: Array<{
  step: WorkbenchStep;
  label: string;
  index: number;
}> = [
  { step: 'sequences', label: 'Sequences', index: 1 },
  { step: 'construct', label: 'Junction', index: 2 },
  { step: 'primers', label: 'Primers', index: 3 },
  { step: 'protocol', label: 'Protocol & Export', index: 4 },
];

export function StepNavigation({
  activeStep,
  showSidebar,
  targetLength,
  exactVerification,
  canUndo,
  canRedo,
  sequenceStepStatus,
  constructStepStatus,
  primerStepStatus,
  protocolStepStatus,
  onSelectStep,
  onClearProject,
  formatStepStatus,
}: StepNavigationProps) {
  const stepStatuses: Record<WorkbenchStep, StepStatus> = {
    sequences: sequenceStepStatus,
    construct: constructStepStatus,
    primers: primerStepStatus,
    protocol: protocolStepStatus,
  };

  return (
    <aside className={`workflow-sidebar panel ${showSidebar ? 'is-open' : ''}`}>
      <div className="sidebar-header">
        <p className="eyebrow">Design steps</p>
        <h2>Workflow</h2>
      </div>

      <div className="workflow-step-list" aria-label="Design steps">
        {workflowSteps.map(({ step, label, index }) => {
          const status = stepStatuses[step];
          return (
            <button
              key={step}
              type="button"
              className={`workflow-step ${activeStep === step ? 'workflow-step-active' : ''}`}
              aria-label={`${label} step`}
              onClick={() => onSelectStep(step)}
            >
              <span className="workflow-step-index">{index}</span>
              <span className="workflow-step-copy">
                <strong>{label}</strong>
                <span className={`step-status step-status-${status.level}`}>
                  {formatStepStatus(status.level, status.text)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="sidebar-summary">
        <div className="metric compact-metric">
          <span>Target</span>
          <strong>{targetLength} bp</strong>
        </div>
        <div className="metric compact-metric">
          <span>Sequence reconstruction</span>
          <strong>{exactVerification ? 'Pass' : 'Pending'}</strong>
        </div>
        <div className="metric compact-metric">
          <span>Undo / redo</span>
          <strong>{canUndo || canRedo ? 'Available' : 'Idle'}</strong>
        </div>
      </div>

      <div className="sidebar-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onClearProject}
        >
          Clear project
        </button>
      </div>
    </aside>
  );
}
