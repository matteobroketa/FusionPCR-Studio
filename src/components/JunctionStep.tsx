import type { RefObject } from 'react';
import { SequencePreview, SequenceRail } from './designPanels';
import type { CanvasTracks, ComparisonSnapshot } from '../hooks/useProjectController';
import type { FusionDesign, PrimerDesign, ProteinValidation } from '../utils/fusion';
import type { WorkflowStage } from '../utils/review';

type CompareRow = {
  label: string;
  current: string;
  baseline: string;
};

function focusCompactInspectorHeading() {
  window.setTimeout(() => {
    const heading = document.querySelector('.inspector-pane h2');
    if (heading instanceof HTMLElement) {
      heading.focus();
    }
  }, 220);
}

type JunctionStepProps = {
  design: FusionDesign;
  projectNameA: string;
  projectNameB: string;
  fragmentALength: number;
  fragmentBLength: number;
  selectedStageLabel: string;
  canvasTracks: CanvasTracks;
  inspectorFocus: 'junction' | 'fragment-a' | 'fragment-b' | 'primer' | 'reaction';
  visiblePrimers: PrimerDesign[];
  selectedPrimerName: string | null;
  stageSequencePreviews: Array<{ label: string; sequence: string }>;
  comparisonSnapshot: ComparisonSnapshot | null;
  compareRows: CompareRow[];
  headingRef?: RefObject<HTMLHeadingElement | null>;
  onInspectorFocusChange: (focus: 'junction' | 'fragment-a' | 'fragment-b' | 'primer' | 'reaction') => void;
  onSelectPrimer: (primerName: string) => void;
  onShowInspector: () => void;
  onToggleCanvasTrack: (track: keyof CanvasTracks) => void;
  onCaptureComparisonSnapshot: () => void;
  onClearComparisonSnapshot: () => void;
};

export function JunctionStep({
  design,
  projectNameA,
  projectNameB,
  fragmentALength,
  fragmentBLength,
  selectedStageLabel,
  canvasTracks,
  inspectorFocus,
  visiblePrimers,
  selectedPrimerName,
  stageSequencePreviews,
  comparisonSnapshot,
  compareRows,
  headingRef,
  onInspectorFocusChange,
  onSelectPrimer,
  onShowInspector,
  onToggleCanvasTrack,
  onCaptureComparisonSnapshot,
  onClearComparisonSnapshot,
}: JunctionStepProps) {
  const proteinValidation: ProteinValidation | null = design.proteinValidation;

  return (
    <div className="workspace-stack">
      <section className="panel workspace-section canvas-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Construct workspace</p>
            <h2 ref={headingRef} tabIndex={-1}>
              Stage-aware assembly map
            </h2>
          </div>
          <div className="panel-actions">
            <span className="pill pill-muted">{selectedStageLabel}</span>
            <span className={`pill ${design.finalProductVerified ? 'pill-success' : 'pill-watch'}`}>{design.finalProductVerified ? 'Sequence reconstruction verified.' : 'Calculation pending'}</span>
          </div>
        </div>

        {canvasTracks.sourceFragments ? (
          <div className="canvas-stack">
            <SequenceRail label={projectNameA} sequenceLength={fragmentALength} start={design.project.fragmentA.start} end={design.project.fragmentA.end} topology={design.project.fragmentA.topology} accentClass="rail-a" />
            <SequenceRail label={projectNameB} sequenceLength={fragmentBLength} start={design.project.fragmentB.start} end={design.project.fragmentB.end} topology={design.project.fragmentB.topology} accentClass="rail-b" />
          </div>
        ) : null}

        <div className="construct-workspace">
          <div className="construct-label-row">
            <span>Fragment A</span>
            <span>Fragment B</span>
          </div>
          <div className="construct-strip">
            <button
              type="button"
              className={`construct-block block-a construct-button ${inspectorFocus === 'fragment-a' ? 'construct-active' : ''}`}
              style={{ flexGrow: Math.max(design.selectedA.length, 1) }}
              onClick={() => {
                onInspectorFocusChange('fragment-a');
                onShowInspector();
                focusCompactInspectorHeading();
              }}
              aria-label={`Fragment A block: ${projectNameA}, ${design.selectedA.length} base pairs`}
              aria-pressed={inspectorFocus === 'fragment-a'}
            >
              <span>{projectNameA}</span>
              <strong>{design.selectedA.length} bp</strong>
            </button>
            <button
              type="button"
              className={`construct-block block-insert construct-button ${inspectorFocus === 'junction' ? 'construct-active' : ''}`}
              style={{ flexGrow: Math.max(design.insertSequence.length || design.overlapSequence.length, 1) }}
              onClick={() => {
                onInspectorFocusChange('junction');
                onShowInspector();
                focusCompactInspectorHeading();
              }}
              aria-label={
                design.insertSequence.length
                  ? `Inserted sequence block at the junction, ${design.insertSequence.length} base pairs`
                  : `Overlap junction block, ${design.overlapSequence.length} base pair overlap`
              }
              aria-pressed={inspectorFocus === 'junction'}
            >
              <span>{design.insertSequence ? 'J1' : 'Join'}</span>
              <strong>{design.insertSequence.length ? `${design.insertSequence.length} bp` : `${design.overlapSequence.length} bp overlap`}</strong>
            </button>
            <button
              type="button"
              className={`construct-block block-b construct-button ${inspectorFocus === 'fragment-b' ? 'construct-active' : ''}`}
              style={{ flexGrow: Math.max(design.selectedB.length, 1) }}
              onClick={() => {
                onInspectorFocusChange('fragment-b');
                onShowInspector();
                focusCompactInspectorHeading();
              }}
              aria-label={`Fragment B block: ${projectNameB}, ${design.selectedB.length} base pairs`}
              aria-pressed={inspectorFocus === 'fragment-b'}
            >
              <span>{projectNameB}</span>
              <strong>{design.selectedB.length} bp</strong>
            </button>
          </div>
        </div>

        <div className="primer-direction-grid">
          {visiblePrimers.map((primer) => (
            <button
              key={primer.name}
              type="button"
              className={`primer-direction-card ${selectedPrimerName === primer.name ? 'primer-direction-card-active' : ''}`}
              aria-label={`Primer arrow ${primer.name}, ${primer.bodyLength} base body in ${primer.reaction}`}
              onClick={() => {
                onSelectPrimer(primer.name);
                onShowInspector();
                focusCompactInspectorHeading();
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

        {canvasTracks.translation && proteinValidation ? (
          <div className="status-block">
            <p className="status-title">Protein readout</p>
            <ul className="status-list">
              <li>{proteinValidation.frameMessage}</li>
              <li>Junction window: {proteinValidation.junctionAminoAcids || 'n/a'}</li>
              <li>Linker aa: {proteinValidation.linkerAminoAcids || 'none'}</li>
            </ul>
          </div>
        ) : null}
      </section>

      <details className="panel workspace-section advanced-disclosure">
        <summary>Advanced settings</summary>
        <div className="toggle-grid canvas-toggle-grid">
          <label className="toggle-card"><input type="checkbox" checked={canvasTracks.sourceFragments} onChange={() => onToggleCanvasTrack('sourceFragments')} /><span>Source fragments</span></label>
          <label className="toggle-card"><input type="checkbox" checked={canvasTracks.finalConstruct} onChange={() => onToggleCanvasTrack('finalConstruct')} /><span>Final construct</span></label>
          <label className="toggle-card"><input type="checkbox" checked={canvasTracks.primerOverlays} onChange={() => onToggleCanvasTrack('primerOverlays')} /><span>Primer overlays</span></label>
          <label className="toggle-card"><input type="checkbox" checked={canvasTracks.gcAndTm} onChange={() => onToggleCanvasTrack('gcAndTm')} /><span>GC and Tm</span></label>
          <label className="toggle-card"><input type="checkbox" checked={canvasTracks.stageProducts} onChange={() => onToggleCanvasTrack('stageProducts')} /><span>Stage products</span></label>
          <label className="toggle-card"><input type="checkbox" checked={canvasTracks.translation} onChange={() => onToggleCanvasTrack('translation')} /><span>Translation</span></label>
          <label className="toggle-card"><input type="checkbox" checked={canvasTracks.features} onChange={() => onToggleCanvasTrack('features')} /><span>Feature track</span></label>
          <label className="toggle-card"><input type="checkbox" checked={canvasTracks.riskSummary} onChange={() => onToggleCanvasTrack('riskSummary')} /><span>Risk summary</span></label>
        </div>

        <div className="action-row">
          <button type="button" className="button button-secondary" onClick={onCaptureComparisonSnapshot}>
            {comparisonSnapshot ? 'Refresh pinned design' : 'Pin current design'}
          </button>
          {comparisonSnapshot ? (
            <button type="button" className="button button-secondary" onClick={onClearComparisonSnapshot}>
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
  );
}
