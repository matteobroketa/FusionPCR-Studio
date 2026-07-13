import { ReactionCard, SequencePreview } from './designPanels';
import type { useProjectController } from '../hooks/useProjectController';
import {
  buildFinalConstructFasta,
  buildPrimerCsv,
  buildPrimerFasta,
  buildProjectJson,
  buildProtocolText,
} from '../utils/export';
import type { FusionDesign, FusionProjectInput, ReactionPlan } from '../utils/fusion';
import { downloadText } from '../utils/project';
import { getStageSequencePreviews, type WorkflowStage } from '../utils/review';

export type ProtocolResultTab = 'overview' | 'setup' | 'cycling' | 'pipetting' | 'products';

type ProjectController = ReturnType<typeof useProjectController>;
type ProtocolExportStepProps = {
  controller: ProjectController;
  project: FusionProjectInput;
  design: FusionDesign;
  protocolResultTab: ProtocolResultTab;
  selectedStage: WorkflowStage;
  activeReactionName: string | null;
  selectedReactionName: string | null;
  hasExportableDesign: boolean;
  isPolymeraseLocked: boolean;
  onProtocolResultTabChange: (tab: ProtocolResultTab) => void;
  onSelectOverviewReaction: (reactionName: ReactionPlan['name']) => void;
  onInspectReaction: () => void;
};

const protocolTabs: Array<[ProtocolResultTab, string]> = [
  ['overview', 'Overview'],
  ['setup', 'Reaction setup'],
  ['cycling', 'Cycling'],
  ['pipetting', 'Pipetting'],
  ['products', 'Expected products'],
];

function ExportArtifactsPanel({
  project,
  design,
  hasExportableDesign,
}: {
  project: FusionProjectInput;
  design: FusionDesign;
  hasExportableDesign: boolean;
}) {
  return (
    <section className="panel workspace-section">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Export</p>
          <h2>Public MVP artifacts</h2>
        </div>
        <span className={`pill ${hasExportableDesign ? 'pill-success' : 'pill-watch'}`}>
          {hasExportableDesign ? 'Export ready' : 'Awaiting runnable design'}
        </span>
      </div>

      <div className="export-grid">
        <button
          type="button"
          className="button button-primary"
          onClick={() => downloadText('fusionpcr-primers.csv', buildPrimerCsv(design), 'text/csv')}
          disabled={!hasExportableDesign}
        >
          Download oligo CSV
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
          Export final construct FASTA
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => downloadText('fusionpcr-protocol.txt', buildProtocolText(design), 'text/plain')}
          disabled={!hasExportableDesign}
        >
          Export printable protocol
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => downloadText('fusionpcr-project.json', buildProjectJson(project), 'application/json')}
          disabled={!hasExportableDesign}
        >
          Export project JSON
        </button>
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
            <li>Sequence reconstruction verified: {design.finalProductVerified ? 'pass' : 'pending'}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function ProtocolExportStep({
  controller,
  project,
  design,
  protocolResultTab,
  selectedStage,
  activeReactionName,
  selectedReactionName,
  hasExportableDesign,
  isPolymeraseLocked,
  onProtocolResultTabChange,
  onSelectOverviewReaction,
  onInspectReaction,
}: ProtocolExportStepProps) {
  const stageSequencePreviews = getStageSequencePreviews(design, selectedStage);

  return (
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
          {protocolTabs.map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              className={`tab-button ${protocolResultTab === tab ? 'tab-button-active' : ''}`}
              onClick={() => onProtocolResultTabChange(tab)}
            >
              {label}
            </button>
          ))}
        </div>

        {protocolResultTab === 'overview' ? (
          <div className="reaction-stack">
            {(selectedReactionName ? design.reactions.filter((reaction) => reaction.name === selectedReactionName) : design.reactions).map(
              (reaction) => (
                <ReactionCard
                  key={reaction.name}
                  reaction={reaction}
                  selected={activeReactionName === reaction.name}
                  onSelect={() => onSelectOverviewReaction(reaction.name)}
                />
              ),
            )}
          </div>
        ) : null}

        {protocolResultTab === 'setup' ? (
          <>
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
                  onChange={(event) =>
                    controller.updateProtocolSetting('stageAConcentrationNgPerUl', Math.max(0.0001, Number(event.target.value) || 0.0001))
                  }
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
                  onChange={(event) =>
                    controller.updateProtocolSetting('stageBConcentrationNgPerUl', Math.max(0.0001, Number(event.target.value) || 0.0001))
                  }
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
                  onChange={(event) =>
                    controller.updateProtocolSetting('totalTemplatePmol', Math.max(0.000001, Number(event.target.value) || 0.000001))
                  }
                />
              </label>
              <label className="field-card">
                <span className="field-label">Mix strategy</span>
                <select
                  className="text-input"
                  value={project.protocolSettings.mixStrategy}
                  disabled={isPolymeraseLocked}
                  onChange={(event) => controller.updateProtocolSetting('mixStrategy', event.target.value as FusionProjectInput['protocolSettings']['mixStrategy'])}
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
                  onChange={(event) =>
                    controller.updateProtocolSetting('stageMixRatioA', Math.max(0.000001, Number(event.target.value) || 0.000001))
                  }
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
                  onChange={(event) =>
                    controller.updateProtocolSetting('stageMixRatioB', Math.max(0.000001, Number(event.target.value) || 0.000001))
                  }
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
                  onChange={(event) =>
                    controller.updateProtocolSetting('primerStockMicromolar', Math.max(0.000001, Number(event.target.value) || 0.000001))
                  }
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
                  onChange={(event) =>
                    controller.updateProtocolSetting('primerWorkingMicromolar', Math.max(0.000001, Number(event.target.value) || 0.000001))
                  }
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
                  onChange={(event) =>
                    controller.updateProtocolSetting(
                      'workingStockPrepMicroliters',
                      Math.max(0.000001, Number(event.target.value) || 0.000001),
                    )
                  }
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
                  onChange={(event) =>
                    controller.updateProtocolSetting(
                      'primerPerReactionMicroliters',
                      Math.max(0.000001, Number(event.target.value) || 0.000001),
                    )
                  }
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
                  onChange={(event) =>
                    controller.updateProtocolSetting(
                      'stage1TemplatePerReactionMicroliters',
                      Math.max(0.000001, Number(event.target.value) || 0.000001),
                    )
                  }
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
                  onChange={(event) =>
                    controller.updateProtocolSetting('reactionVolumeMicroliters', Math.max(0.000001, Number(event.target.value) || 0.000001))
                  }
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
                  onChange={(event) =>
                    controller.updateProtocolSetting('stage1ReactionCountPerProduct', Math.max(1, Number(event.target.value) || 1))
                  }
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
                  onChange={(event) => controller.updateProtocolSetting('finalReactionCount', Math.max(1, Number(event.target.value) || 1))}
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
                  onChange={(event) => controller.updateProtocolSetting('overfillPercent', Math.max(0, Number(event.target.value) || 0))}
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
                  onChange={(event) => controller.updateProtocolSetting('stage1Cycles', Math.max(1, Number(event.target.value) || 1))}
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
                  onChange={(event) => controller.updateProtocolSetting('finalCycles', Math.max(1, Number(event.target.value) || 1))}
                />
              </label>
            </div>

            <div className="workspace-two-column">
              <div className="status-block">
                <p className="status-title">Protocol plan</p>
                <ul className="status-list">
                  {design.protocolPlan.stageMixEntries.map((entry) => (
                    <li key={entry.label}>
                      {entry.label}: {entry.targetPmol.toFixed(3)} pmol, {entry.requiredMassNg.toFixed(2)} ng,{' '}
                      {entry.requiredVolumeUl.toFixed(2)} uL at {entry.concentrationNgPerUl} ng/uL
                    </li>
                  ))}
                </ul>
              </div>
              <div className="status-block">
                <p className="status-title">Reaction mixes</p>
                <ul className="status-list">
                  {design.protocolPlan.reactionMixes.map((mix) => (
                    <li key={mix.name}>
                      {mix.name}: {mix.totalMasterMixVolumeUl.toFixed(2)} uL total master mix, {mix.cycleCount} cycles,{' '}
                      {mix.overfilledReactionCount.toFixed(2)} effective reactions
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
              <ReactionCard
                key={reaction.name}
                reaction={reaction}
                selected={activeReactionName === reaction.name}
                onSelect={onInspectReaction}
              />
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
                    {entry.primerName}: {entry.totalWorkingVolumeUl.toFixed(2)} uL total working stock across{' '}
                    {entry.reactionsUsingPrimer} reactions
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
                          {entry.label}: {entry.perReactionVolumeUl.toFixed(2)} uL/reaction, {entry.totalVolumeUl.toFixed(2)}{' '}
                          uL total
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
            {stageSequencePreviews.map((preview) => (
              <SequencePreview key={preview.label} title={preview.label} sequence={preview.sequence} />
            ))}
          </div>
        ) : null}
      </section>

      <ExportArtifactsPanel project={project} design={design} hasExportableDesign={hasExportableDesign} />
    </div>
  );
}
