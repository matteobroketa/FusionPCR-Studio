import { getWorkflowStageLabel, type WorkflowStage } from '../utils/review';

type ReactionTimelineProps = {
  selectedStage: WorkflowStage;
  onSelectStage: (stage: WorkflowStage) => void;
};

const workflowStages: WorkflowStage[] = ['overview', 'pcr1a', 'pcr1b', 'fusion', 'verification'];

export function ReactionTimeline({ selectedStage, onSelectStage }: ReactionTimelineProps) {
  return (
    <section className="timeline-dock panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Reaction timeline</p>
          <h2>Stage filter</h2>
        </div>
      </div>
      <div className="workflow-stage-row">
        {workflowStages.map((stage) => (
          <button
            key={stage}
            type="button"
            className={`timeline-step ${selectedStage === stage ? 'timeline-step-active' : ''}`}
            onClick={() => onSelectStage(stage)}
          >
            {getWorkflowStageLabel(stage)}
          </button>
        ))}
      </div>
    </section>
  );
}
