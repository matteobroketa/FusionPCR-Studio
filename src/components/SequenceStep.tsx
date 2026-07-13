import type { RefObject } from 'react';
import { SequencePreview } from './designPanels';
import type { useProjectController } from '../hooks/useProjectController';
import { CODING_OPTIMIZATION_UI_ENABLED, EXPERIMENTAL_SEQUENCE_WORKFLOWS_ENABLED } from '../utils/feature-flags';
import { describeFeatureSelection, parseFeatureSelection } from '../utils/features';
import { createEmptyFragment, polymeraseProfiles, type DesignMode, type FusionDesign, type FusionProjectInput } from '../utils/fusion';
import { flipImportedSource, type ImportedSource } from '../utils/import';
import type { MutationPlan, MutationPlannerMode } from '../utils/mutation';

const PUBLIC_DESIGN_MODES: DesignMode[] = ['exact', 'protein-fusion'];

type ProjectController = ReturnType<typeof useProjectController>;
type SequenceStepController = Pick<
  ProjectController,
  | 'project'
  | 'sequenceImportText'
  | 'setSequenceImportText'
  | 'sequenceImportError'
  | 'setSequenceImportError'
  | 'sequenceImportResult'
  | 'setSequenceImportResult'
  | 'featureSelectionMessage'
  | 'activeFragmentKey'
  | 'setActiveFragmentKey'
  | 'editPayload'
  | 'setEditPayload'
  | 'editPosition'
  | 'setEditPosition'
  | 'trimAmount'
  | 'setTrimAmount'
  | 'mutationRecipientKey'
  | 'setMutationRecipientKey'
  | 'mutationDonorKey'
  | 'setMutationDonorKey'
  | 'mutationStart'
  | 'setMutationStart'
  | 'mutationEnd'
  | 'setMutationEnd'
  | 'mutationCoordinate'
  | 'setMutationCoordinate'
  | 'mutationPayloadSource'
  | 'setMutationPayloadSource'
  | 'mutationPayloadInput'
  | 'setMutationPayloadInput'
  | 'canUndo'
  | 'canRedo'
  | 'updateProject'
  | 'updateFragment'
  | 'updateFragmentSequence'
  | 'updateCoding'
  | 'updateReactionCondition'
  | 'updateGenomicSpecificity'
  | 'handleSequenceImportClick'
  | 'applyFeatureSelection'
  | 'toggleEditorLock'
  | 'toggleChangeApproval'
  | 'toggleSynonymousChangeApproval'
  | 'reverseComplementFragment'
  | 'handleTrim'
  | 'handleExtractSelection'
  | 'handleDeleteSelection'
  | 'handleDuplicateSelection'
  | 'handleReplaceSelection'
  | 'handleInsertPayload'
  | 'handleSplitActiveFragment'
  | 'handleDuplicateSelectionToInsert'
  | 'parseSequenceImportText'
>;

type SequenceMetrics = {
  length: number;
  gcPercentage: number;
  tm: number;
};

type SequenceStepProps = {
  controller: ProjectController;
  design: FusionDesign;
  selectedPublicExampleDescription: string;
  phoneReviewMode: boolean;
  fragmentAMetrics: SequenceMetrics;
  fragmentBMetrics: SequenceMetrics;
  mutationMode: MutationPlannerMode | null;
  mutationPayload: string;
  mutationPreview: MutationPlan | null;
  isFragmentALocked: boolean;
  isFragmentBLocked: boolean;
  isInsertLocked: boolean;
  isPolymeraseLocked: boolean;
  activeFragmentLocked: boolean;
  counterpartFragmentLocked: boolean;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  onApplyImportedSource: (fragmentKey: 'fragmentA' | 'fragmentB', source: ImportedSource) => void;
  onApplyFirstTwoImportedSources: () => void;
  onApplyMutationWorkflow: () => void;
};

function isPublicDesignMode(mode: DesignMode) {
  return PUBLIC_DESIGN_MODES.includes(mode);
}

export function SequenceStep({
  controller,
  design,
  selectedPublicExampleDescription,
  phoneReviewMode,
  fragmentAMetrics,
  fragmentBMetrics,
  mutationMode,
  mutationPayload,
  mutationPreview,
  isFragmentALocked,
  isFragmentBLocked,
  isInsertLocked,
  isPolymeraseLocked,
  activeFragmentLocked,
  counterpartFragmentLocked,
  headingRef,
  onApplyImportedSource,
  onApplyFirstTwoImportedSources,
  onApplyMutationWorkflow,
}: SequenceStepProps) {
  const { project } = controller;

  if (phoneReviewMode) {
    return (
      <div className="workspace-stack">
        <section className="panel workspace-section">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Sequence review</p>
              <h2 ref={headingRef} tabIndex={-1}>
                Read-only project summary
              </h2>
            </div>
            <span className="pill pill-watch">Phone review mode</span>
          </div>

          <p className="status-note status-note-alert">Use a tablet or desktop to edit sequence designs.</p>

          <div className="metric-grid">
            <div className="metric">
              <span>Built-in example</span>
              <strong>{selectedPublicExampleDescription}</strong>
            </div>
            <div className="metric">
              <span>Design mode</span>
              <strong>{project.mode}</strong>
            </div>
            <div className="metric">
              <span>Polymerase</span>
              <strong>{polymeraseProfiles[project.polymeraseId].label}</strong>
            </div>
            <div className="metric">
              <span>Inserted sequence</span>
              <strong>{project.insertSequence.length} bp</strong>
            </div>
          </div>

          <div className="workspace-two-column">
            <div className="status-block">
              <p className="status-title">Fragment A</p>
              <ul className="status-list">
                <li>{project.fragmentA.label}</li>
                <li>Selected range: {project.fragmentA.start}-{project.fragmentA.end}</li>
                <li>Full length: {fragmentAMetrics.length} bp</li>
                <li>Selected contribution: {design.selectedA.length} bp</li>
              </ul>
            </div>
            <div className="status-block">
              <p className="status-title">Fragment B</p>
              <ul className="status-list">
                <li>{project.fragmentB.label}</li>
                <li>Selected range: {project.fragmentB.start}-{project.fragmentB.end}</li>
                <li>Full length: {fragmentBMetrics.length} bp</li>
                <li>Selected contribution: {design.selectedB.length} bp</li>
              </ul>
            </div>
          </div>

          <div className="workspace-two-column">
            <SequencePreview title={`${project.fragmentA.label} selected slice`} sequence={design.selectedA} />
            <SequencePreview title={`${project.fragmentB.label} selected slice`} sequence={design.selectedB} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="workspace-stack">
      <section className="panel workspace-section">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Project setup</p>
            <h2 ref={headingRef} tabIndex={-1}>
              Sequences and construct definition
            </h2>
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
              onChange={(event) => controller.updateProject('polymeraseId', event.target.value as FusionProjectInput['polymeraseId'])}
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
              onChange={(event) => {
                const nextMode = event.target.value as DesignMode;
                controller.updateProject('mode', nextMode);
                if (nextMode === 'protein-fusion') {
                  controller.updateProject('coding', {
                    ...project.coding,
                    retainUpstreamStop: true,
                    retainDownstreamStart: true,
                    linkerRequired: false,
                    preserveProtein: false,
                    flexibleCodons: 0,
                  });
                }
              }}
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
          <span className="field-label">Linker or inserted sequence</span>
          <textarea
            className="sequence-input short-input"
            value={project.insertSequence}
            disabled={isInsertLocked}
            onChange={(event) => controller.updateProject('insertSequence', event.target.value)}
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
            onChange={(event) => controller.updateProject('notes', event.target.value)}
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
            value={controller.sequenceImportText}
            onChange={(event) => controller.setSequenceImportText(event.target.value)}
            placeholder="Paste plain DNA, FASTA, or a GenBank record here"
            spellCheck={false}
          />
        </label>

        <div className="action-row">
          <button
            type="button"
            className="button button-primary"
            onClick={() => controller.parseSequenceImportText(controller.sequenceImportText)}
          >
            Parse import text
          </button>
          <button type="button" className="button button-secondary" onClick={controller.handleSequenceImportClick}>
            Load sequence file
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={onApplyFirstTwoImportedSources}
            disabled={!controller.sequenceImportResult?.records.length || (isFragmentALocked && isFragmentBLocked)}
          >
            Apply first two records
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              controller.setSequenceImportText('');
              controller.setSequenceImportError('');
              controller.setSequenceImportResult(null);
            }}
          >
            Clear import
          </button>
        </div>

        {controller.sequenceImportError ? <p className="status-note status-note-alert">{controller.sequenceImportError}</p> : null}
        {controller.sequenceImportResult ? (
          <div className="import-result-stack">
            <p className="status-note status-note-success">
              Parsed {controller.sequenceImportResult.records.length} record(s) as {controller.sequenceImportResult.format}.
            </p>
            {controller.sequenceImportResult.warnings.length ? (
              <div className="status-block">
                <p className="status-title">Import warnings</p>
                <ul className="status-list">
                  {controller.sequenceImportResult.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="import-record-grid">
              {controller.sequenceImportResult.records.map((record) => (
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
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => onApplyImportedSource('fragmentA', record)}
                      disabled={isFragmentALocked}
                    >
                      Use for fragment A
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => onApplyImportedSource('fragmentB', record)}
                      disabled={isFragmentBLocked}
                    >
                      Use for fragment B
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() =>
                        controller.setSequenceImportResult((current) =>
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

      {EXPERIMENTAL_SEQUENCE_WORKFLOWS_ENABLED && mutationMode && !isPublicDesignMode(project.mode) ? (
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
                value={controller.mutationRecipientKey}
                onChange={(event) => {
                  const nextRecipient = event.target.value as 'fragmentA' | 'fragmentB';
                  controller.setMutationRecipientKey(nextRecipient);
                  if (nextRecipient === controller.mutationDonorKey) {
                    controller.setMutationDonorKey(nextRecipient === 'fragmentA' ? 'fragmentB' : 'fragmentA');
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
                value={controller.mutationPayloadSource}
                disabled={mutationMode === 'deletion'}
                onChange={(event) => controller.setMutationPayloadSource(event.target.value as ProjectController['mutationPayloadSource'])}
              >
                <option value="manual">Manual payload</option>
                <option value="donor-selection">Donor selected range</option>
              </select>
            </label>

            {mutationMode === 'insertion' ? (
              <label className="field-card">
                <span className="field-label">Insertion coordinate</span>
                <input
                  aria-label="Insertion coordinate"
                  className="text-input"
                  type="number"
                  min={1}
                  step="1"
                  value={controller.mutationCoordinate}
                  onChange={(event) => controller.setMutationCoordinate(Math.max(1, Number(event.target.value) || 1))}
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
                    value={controller.mutationStart}
                    onChange={(event) => controller.setMutationStart(Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
                <label className="field-card">
                  <span className="field-label">Mutation end</span>
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    step="1"
                    value={controller.mutationEnd}
                    onChange={(event) => controller.setMutationEnd(Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
              </>
            )}
          </div>

          {controller.mutationPayloadSource === 'donor-selection' && mutationMode !== 'deletion' ? (
            <div className="field-grid">
              <label className="field-card">
                <span className="field-label">Donor fragment</span>
                <select
                  className="text-input"
                  value={controller.mutationDonorKey}
                  onChange={(event) => controller.setMutationDonorKey(event.target.value as 'fragmentA' | 'fragmentB')}
                >
                  <option value="fragmentA" disabled={controller.mutationRecipientKey === 'fragmentA'}>
                    Fragment A
                  </option>
                  <option value="fragmentB" disabled={controller.mutationRecipientKey === 'fragmentB'}>
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

          {controller.mutationPayloadSource === 'manual' && mutationMode !== 'deletion' ? (
            <label className="field-card">
              <span className="field-label">{mutationMode === 'domain-swap' ? 'Swap payload' : 'Mutation payload'}</span>
              <textarea
                aria-label="Mutation payload"
                className="sequence-input short-input"
                value={controller.mutationPayloadInput}
                onChange={(event) => controller.setMutationPayloadInput(event.target.value)}
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

          <button type="button" className="button button-secondary" onClick={onApplyMutationWorkflow} disabled={!mutationPreview}>
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
              <input
                className="text-input"
                value={project.fragmentA.label}
                disabled={isFragmentALocked}
                onChange={(event) => controller.updateFragment('fragmentA', 'label', event.target.value)}
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
              onChange={(event) => controller.updateFragmentSequence('fragmentA', event.target.value)}
              placeholder="Paste fragment A DNA sequence"
              spellCheck={false}
            />
          </label>

          <div className="action-row">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => controller.reverseComplementFragment('fragmentA')}
              disabled={isFragmentALocked}
            >
              Reverse complement A
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => controller.updateProject('fragmentA', createEmptyFragment('Fragment A'))}
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
                onChange={(event) => controller.updateFragment('fragmentA', 'start', Number(event.target.value) || 1)}
              />
            </label>
            <label className="field-card">
              <span className="field-label">End</span>
              <input
                className="text-input"
                type="number"
                value={project.fragmentA.end}
                disabled={isFragmentALocked || project.editorLocks.fragmentABoundaries}
                onChange={(event) => controller.updateFragment('fragmentA', 'end', Number(event.target.value) || 1)}
              />
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
                      <button
                        type="button"
                        className="button button-secondary inline-button"
                        onClick={() => controller.applyFeatureSelection('fragmentA', index)}
                        disabled={isFragmentALocked || project.editorLocks.fragmentABoundaries || !parsed?.supported}
                      >
                        Use feature range
                      </button>
                    </li>
                  );
                })}
                {controller.featureSelectionMessage ? <li>{controller.featureSelectionMessage}</li> : null}
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
              <input
                className="text-input"
                value={project.fragmentB.label}
                disabled={isFragmentBLocked}
                onChange={(event) => controller.updateFragment('fragmentB', 'label', event.target.value)}
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
              onChange={(event) => controller.updateFragmentSequence('fragmentB', event.target.value)}
              placeholder="Paste fragment B DNA sequence"
              spellCheck={false}
            />
          </label>

          <div className="action-row">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => controller.reverseComplementFragment('fragmentB')}
              disabled={isFragmentBLocked}
            >
              Reverse complement B
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => controller.updateProject('fragmentB', createEmptyFragment('Fragment B'))}
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
                onChange={(event) => controller.updateFragment('fragmentB', 'start', Number(event.target.value) || 1)}
              />
            </label>
            <label className="field-card">
              <span className="field-label">End</span>
              <input
                className="text-input"
                type="number"
                value={project.fragmentB.end}
                disabled={isFragmentBLocked || project.editorLocks.fragmentBBoundaries}
                onChange={(event) => controller.updateFragment('fragmentB', 'end', Number(event.target.value) || 1)}
              />
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
                      <button
                        type="button"
                        className="button button-secondary inline-button"
                        onClick={() => controller.applyFeatureSelection('fragmentB', index)}
                        disabled={isFragmentBLocked || project.editorLocks.fragmentBBoundaries || !parsed?.supported}
                      >
                        Use feature range
                      </button>
                    </li>
                  );
                })}
                {controller.featureSelectionMessage ? <li>{controller.featureSelectionMessage}</li> : null}
              </ul>
            </div>
          ) : null}
        </section>
      </section>

      <details className="panel workspace-section advanced-disclosure">
        <summary>Advanced settings</summary>

        {EXPERIMENTAL_SEQUENCE_WORKFLOWS_ENABLED ? (
        <section className="editor-panel advanced-section">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Editing workspace</p>
              <h3>Explicit reversible fragment operations</h3>
            </div>
            <span className="pill pill-muted">{controller.canUndo || controller.canRedo ? 'Undo history available' : 'No undo history yet'}</span>
          </div>

          <div className="field-grid">
            <label className="field-card">
              <span className="field-label">Active fragment</span>
              <select
                className="text-input"
                value={controller.activeFragmentKey}
                onChange={(event) => controller.setActiveFragmentKey(event.target.value as 'fragmentA' | 'fragmentB')}
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
                value={controller.trimAmount}
                onChange={(event) => controller.setTrimAmount(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <label className="field-card">
              <span className="field-label">Edit position</span>
              <input
                className="text-input"
                type="number"
                min={1}
                step="1"
                value={controller.editPosition}
                onChange={(event) => controller.setEditPosition(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <label className="field-card">
              <span className="field-label">Payload / linker / tag</span>
              <input
                className="text-input"
                value={controller.editPayload}
                onChange={(event) => controller.setEditPayload(event.target.value)}
                placeholder="DNA payload for insert or replace"
              />
            </label>
          </div>

          <div className="toggle-grid">
            <label className="toggle-card">
              <input type="checkbox" checked={project.editorLocks.fragmentA} onChange={() => controller.toggleEditorLock('fragmentA')} />
              <span>Lock fragment A</span>
            </label>
            <label className="toggle-card">
              <input type="checkbox" checked={project.editorLocks.fragmentB} onChange={() => controller.toggleEditorLock('fragmentB')} />
              <span>Lock fragment B</span>
            </label>
            <label className="toggle-card">
              <input
                type="checkbox"
                checked={project.editorLocks.fragmentABoundaries}
                onChange={() => controller.toggleEditorLock('fragmentABoundaries')}
              />
              <span>Lock A boundaries</span>
            </label>
            <label className="toggle-card">
              <input
                type="checkbox"
                checked={project.editorLocks.fragmentBBoundaries}
                onChange={() => controller.toggleEditorLock('fragmentBBoundaries')}
              />
              <span>Lock B boundaries</span>
            </label>
            <label className="toggle-card">
              <input type="checkbox" checked={project.editorLocks.insertSequence} onChange={() => controller.toggleEditorLock('insertSequence')} />
              <span>Lock inserted sequence</span>
            </label>
            <label className="toggle-card">
              <input
                type="checkbox"
                checked={project.editorLocks.polymeraseSettings}
                onChange={() => controller.toggleEditorLock('polymeraseSettings')}
              />
              <span>Lock polymerase settings</span>
            </label>
          </div>

          <div className="action-row">
            <button type="button" className="button button-secondary" onClick={() => controller.handleTrim('left')} disabled={activeFragmentLocked}>
              Trim left
            </button>
            <button type="button" className="button button-secondary" onClick={() => controller.handleTrim('right')} disabled={activeFragmentLocked}>
              Trim right
            </button>
            <button type="button" className="button button-secondary" onClick={controller.handleExtractSelection} disabled={activeFragmentLocked}>
              Extract selection
            </button>
            <button type="button" className="button button-secondary" onClick={controller.handleDuplicateSelection} disabled={activeFragmentLocked}>
              Duplicate selection
            </button>
            <button type="button" className="button button-secondary" onClick={controller.handleDeleteSelection} disabled={activeFragmentLocked}>
              Delete selection
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={controller.handleReplaceSelection}
              disabled={activeFragmentLocked || !controller.editPayload.trim()}
            >
              Replace selection
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={controller.handleInsertPayload}
              disabled={activeFragmentLocked || !controller.editPayload.trim()}
            >
              Insert payload
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={controller.handleSplitActiveFragment}
              disabled={activeFragmentLocked || counterpartFragmentLocked}
            >
              Split to A/B
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={controller.handleDuplicateSelectionToInsert}
              disabled={isInsertLocked}
            >
              Duplicate to insert
            </button>
          </div>
        </section>
        ) : null}

        {project.mode === 'protein-fusion' ? (
          <section className="advanced-section protein-form">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Coding intent</p>
                <h3>Reading-frame checks</h3>
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
                  onChange={(event) => controller.updateCoding('upstreamFrame', Number(event.target.value) as 0 | 1 | 2)}
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
                  onChange={(event) => controller.updateCoding('downstreamFrame', Number(event.target.value) as 0 | 1 | 2)}
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </label>
            </div>

            <div className="status-block">
              <p className="status-title">Protein-fusion checks</p>
              <ul className="status-list">
                <li>{design.proteinValidation?.frameMessage ?? 'No protein-fusion validation is available for the current design.'}</li>
                <li>Junction amino-acid window: {design.proteinValidation?.junctionAminoAcids || 'n/a'}</li>
                <li>Inserted amino acids: {design.proteinValidation?.linkerAminoAcids || 'none'}</li>
              </ul>
            </div>

            {CODING_OPTIMIZATION_UI_ENABLED ? (
              <div className="status-block">
                <p className="status-title">Sequence change approvals</p>
                <p>Hidden experimental coding-optimization UI.</p>
              </div>
            ) : null}
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
            <label className="field-card">
              <span className="field-label">Monovalent ions (mM)</span>
              <input
                className="text-input"
                type="number"
                min={0}
                step="0.1"
                value={project.reactionConditions.monovalentMillimolar}
                disabled={isPolymeraseLocked}
                onChange={(event) =>
                  controller.updateReactionCondition('monovalentMillimolar', Math.max(0, Number(event.target.value) || 0))
                }
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
                onChange={(event) =>
                  controller.updateReactionCondition('magnesiumMillimolar', Math.max(0, Number(event.target.value) || 0))
                }
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
                onChange={(event) =>
                  controller.updateReactionCondition('dntpMillimolar', Math.max(0, Number(event.target.value) || 0))
                }
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
                onChange={(event) =>
                  controller.updateReactionCondition('oligoNanomolar', Math.max(0.001, Number(event.target.value) || 0.001))
                }
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
                onChange={(event) => controller.updateReactionCondition('dmsoPercent', Math.max(0, Number(event.target.value) || 0))}
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
                onChange={(event) => controller.updateReactionCondition('dmsoFactor', Math.max(0, Number(event.target.value) || 0))}
              />
            </label>
          </div>
        </section>

      </details>
    </div>
  );
}
