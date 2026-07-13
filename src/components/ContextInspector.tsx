import { useEffect, type RefObject } from 'react';
import { SequencePreview } from './designPanels';
import type { FusionDesign, PrimerDesign, ReactionPlan } from '../utils/fusion';

type InspectorFocus =
  'junction' | 'fragment-a' | 'fragment-b' | 'primer' | 'reaction';

type JunctionSummaryProps = {
  insertSequence: string;
  finalJunction: string | null;
  upstreamAnnealRegion: string | null;
  downstreamAnnealRegion: string | null;
  aInnerTailContribution: string | null;
  bInnerTailContribution: string | null;
};

type ContextInspectorProps = {
  design: FusionDesign;
  project: FusionDesign['project'];
  inspectorFocus: InspectorFocus;
  selectedPrimer: PrimerDesign | null;
  activeReaction: ReactionPlan | null;
  junctionSummary: JunctionSummaryProps;
  overlapTmLabel: string;
  workerError: string | null;
  persistenceError: string | null;
  importError: string;
  onRetryCalculation: () => void;
  onRetryPersistence: () => void;
  showInspector: boolean;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  retryCalculationButtonRef?: RefObject<HTMLButtonElement | null>;
};

export function ContextInspector({
  design,
  project,
  inspectorFocus,
  selectedPrimer,
  activeReaction,
  junctionSummary,
  overlapTmLabel,
  workerError,
  persistenceError,
  importError,
  onRetryCalculation,
  onRetryPersistence,
  showInspector,
  headingRef,
  retryCalculationButtonRef,
}: ContextInspectorProps) {
  const headerTone =
    workerError || persistenceError || importError
      ? 'pill-alert'
      : 'pill-muted';
  const headerLabel = workerError
    ? 'Calculation failed'
    : persistenceError
      ? 'Local save failed'
      : importError
        ? 'Import error'
        : 'Context details';
  const heading =
    inspectorFocus === 'fragment-a'
      ? project.fragmentA.label
      : inspectorFocus === 'fragment-b'
        ? project.fragmentB.label
        : inspectorFocus === 'primer'
          ? (selectedPrimer?.name ?? 'Primer')
          : inspectorFocus === 'reaction'
            ? (activeReaction?.name ?? 'Reaction')
            : 'Junction 1';

  useEffect(() => {
    if (!showInspector) {
      return;
    }

    window.setTimeout(() => {
      if (workerError) {
        const retryButton = Array.from(
          document.querySelectorAll('.inspector-pane button'),
        ).find((button) => button.textContent?.includes('Retry'));
        if (retryButton instanceof HTMLElement) {
          retryButton.focus();
          return;
        }
      }

      const heading = document.querySelector('.inspector-pane h2');
      if (heading instanceof HTMLElement) {
        heading.focus();
        return;
      }
    }, 180);
  }, [headingRef, retryCalculationButtonRef, showInspector, workerError]);

  return (
    <aside className={`inspector-pane panel ${showInspector ? 'is-open' : ''}`}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Inspector</p>
          <h2 ref={headingRef} tabIndex={-1}>
            {heading}
          </h2>
        </div>
        <span className={`pill ${headerTone}`}>{headerLabel}</span>
      </div>

      {inspectorFocus === 'junction' ? (
        <div className="status-block">
          <p className="status-title">Junction 1</p>
          <div className="property-list">
            <div className="property-row">
              <span>Mode</span>
              <strong>{project.mode}</strong>
            </div>
            <div className="property-row">
              <span>Inserted sequence</span>
              <code>{junctionSummary.insertSequence || 'Direct join'}</code>
            </div>
            <div className="property-row">
              <span>Reading frame</span>
              <strong>
                {design.proteinValidation
                  ? design.proteinValidation.framePreserved
                    ? 'Preserved'
                    : 'Shifted'
                  : 'n/a'}
              </strong>
            </div>
            <div className="property-row">
              <span>Overlap</span>
              <strong>
                {design.overlapSequence.length} bp · {overlapTmLabel}
              </strong>
            </div>
          </div>
          <SequencePreview
            title="Final junction window"
            sequence={junctionSummary.finalJunction || design.finalProduct}
          />
          <ul className="status-list">
            <li>
              A inner R 3 prime annealing region:{' '}
              {junctionSummary.upstreamAnnealRegion || 'n/a'}
            </li>
            <li>
              B inner F 3 prime annealing region:{' '}
              {junctionSummary.downstreamAnnealRegion || 'n/a'}
            </li>
            <li>
              A inner R tail contribution:{' '}
              {junctionSummary.aInnerTailContribution || 'none'}
            </li>
            <li>
              B inner F tail contribution:{' '}
              {junctionSummary.bInnerTailContribution || 'none'}
            </li>
          </ul>
        </div>
      ) : null}

      {inspectorFocus === 'fragment-a' ? (
        <div className="status-block">
          <div className="property-list">
            <div className="property-row">
              <span>Selected coordinates</span>
              <strong>
                {design.project.fragmentA.start}-{design.project.fragmentA.end}
              </strong>
            </div>
            <div className="property-row">
              <span>Source format</span>
              <strong>{project.fragmentA.sourceFormat}</strong>
            </div>
            <div className="property-row">
              <span>Topology</span>
              <strong>{project.fragmentA.topology}</strong>
            </div>
            <div className="property-row">
              <span>Checksum</span>
              <strong>{project.fragmentA.checksum}</strong>
            </div>
            <div className="property-row">
              <span>Features</span>
              <strong>{project.fragmentA.features.length}</strong>
            </div>
          </div>
        </div>
      ) : null}

      {inspectorFocus === 'fragment-b' ? (
        <div className="status-block">
          <div className="property-list">
            <div className="property-row">
              <span>Selected coordinates</span>
              <strong>
                {design.project.fragmentB.start}-{design.project.fragmentB.end}
              </strong>
            </div>
            <div className="property-row">
              <span>Source format</span>
              <strong>{project.fragmentB.sourceFormat}</strong>
            </div>
            <div className="property-row">
              <span>Topology</span>
              <strong>{project.fragmentB.topology}</strong>
            </div>
            <div className="property-row">
              <span>Checksum</span>
              <strong>{project.fragmentB.checksum}</strong>
            </div>
            <div className="property-row">
              <span>Features</span>
              <strong>{project.fragmentB.features.length}</strong>
            </div>
          </div>
        </div>
      ) : null}

      {inspectorFocus === 'primer' && selectedPrimer ? (
        <div className="status-block">
          <div className="property-list">
            <div className="property-row">
              <span>Reaction</span>
              <strong>{selectedPrimer.reaction}</strong>
            </div>
            <div className="property-row">
              <span>Role</span>
              <strong>{selectedPrimer.role}</strong>
            </div>
            <div className="property-row">
              <span>Body Tm</span>
              <strong>{selectedPrimer.bodyTm.toFixed(1)} C</strong>
            </div>
            <div className="property-row">
              <span>Overlap Tm</span>
              <strong>
                {selectedPrimer.overlapTm !== null
                  ? `${selectedPrimer.overlapTm.toFixed(1)} C`
                  : 'n/a'}
              </strong>
            </div>
            <div className="property-row">
              <span>Approximate risk</span>
              <strong>{selectedPrimer.structure.risk}</strong>
            </div>
          </div>
          <code className="primer-sequence">
            {selectedPrimer.tail ? (
              <span className="primer-tail">{selectedPrimer.tail}</span>
            ) : null}
            <span className="primer-body">{selectedPrimer.body}</span>
          </code>
          <ul className="status-list">
            <li>Tail: {selectedPrimer.tail.length || 0} nt</li>
            <li>Annealing body: {selectedPrimer.bodyLength} nt</li>
            <li>
              Local specificity hits:{' '}
              {
                selectedPrimer.specificitySites.filter(
                  (site) => site.risk !== 'low',
                ).length
              }
            </li>
          </ul>
        </div>
      ) : null}

      {inspectorFocus === 'reaction' && activeReaction ? (
        <div className="status-block">
          <div className="property-list">
            <div className="property-row">
              <span>Primers</span>
              <strong>{activeReaction.primerNames.join(' + ')}</strong>
            </div>
            <div className="property-row">
              <span>Product</span>
              <strong>{activeReaction.productLength} bp</strong>
            </div>
            <div className="property-row">
              <span>Anneal</span>
              <strong>{activeReaction.annealingTemperature} C</strong>
            </div>
            <div className="property-row">
              <span>Extend</span>
              <strong>{activeReaction.extensionSeconds} s</strong>
            </div>
            <div className="property-row">
              <span>Gradient</span>
              <strong>
                {activeReaction.gradientRecommendation ?? 'Not needed'}
              </strong>
            </div>
          </div>
        </div>
      ) : null}

      {workerError ? (
        <div className="status-block">
          <p className="status-note status-note-alert">{workerError}</p>
          <div className="action-row">
            <button
              ref={retryCalculationButtonRef}
              type="button"
              className="button button-secondary"
              onClick={onRetryCalculation}
            >
              Retry calculation
            </button>
          </div>
        </div>
      ) : null}
      {persistenceError ? (
        <div className="status-block">
          <p className="status-note status-note-alert">{persistenceError}</p>
          <div className="action-row">
            <button
              type="button"
              className="button button-secondary"
              onClick={onRetryPersistence}
            >
              Retry save
            </button>
          </div>
        </div>
      ) : null}
      {importError ? (
        <p className="status-note status-note-alert">{importError}</p>
      ) : null}
    </aside>
  );
}
