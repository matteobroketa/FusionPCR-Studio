import { PrimerCard } from './designPanels';
import type { ComparisonSnapshot } from '../hooks/useProjectController';
import type { FusionDesign, PrimerDesign } from '../utils/fusion';

export type PrimerResultTab = 'overview' | 'sequences' | 'structures' | 'specificity' | 'alternatives';

type CompareRow = {
  label: string;
  current: string;
  baseline: string;
};

type PrimerStepProps = {
  design: FusionDesign;
  visiblePrimers: PrimerDesign[];
  selectedPrimerName: string | null;
  primerResultTab: PrimerResultTab;
  comparisonSnapshot: ComparisonSnapshot | null;
  compareRows: CompareRow[];
  onPrimerResultTabChange: (tab: PrimerResultTab) => void;
  onSelectPrimer: (primerName: string) => void;
};

const primerTabs: Array<[PrimerResultTab, string]> = [
  ['overview', 'Overview'],
  ['sequences', 'Primer sequences'],
  ['structures', 'Structures'],
  ['specificity', 'Specificity'],
  ['alternatives', 'Alternatives'],
];

export function PrimerStep({
  design,
  visiblePrimers,
  selectedPrimerName,
  primerResultTab,
  comparisonSnapshot,
  compareRows,
  onPrimerResultTabChange,
  onSelectPrimer,
}: PrimerStepProps) {
  return (
    <div className="workspace-stack">
      <section className="panel workspace-section">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Primers</p>
            <h2>Primer results</h2>
          </div>
          <span className="pill pill-muted">{visiblePrimers.length} primer(s)</span>
        </div>

        <div className="result-tabs">
          {primerTabs.map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              className={`tab-button ${primerResultTab === tab ? 'tab-button-active' : ''}`}
              onClick={() => onPrimerResultTabChange(tab)}
            >
              {label}
            </button>
          ))}
        </div>

        {primerResultTab === 'overview' ? (
          <>
            <div className="metric-grid">
              <div className="metric">
                <span>Primer count</span>
                <strong>{design.primers.length}</strong>
              </div>
              <div className="metric">
                <span>Overlap sequence</span>
                <strong>{design.overlapSequence.length} nt</strong>
              </div>
              <div className="metric">
                <span>Unintended products</span>
                <strong>{design.offTargetAmplicons.length}</strong>
              </div>
            </div>
            <div className="primer-grid">
              {visiblePrimers.map((primer) => (
                <PrimerCard
                  key={primer.name}
                  primer={primer}
                  selected={selectedPrimerName === primer.name}
                  onSelect={() => onSelectPrimer(primer.name)}
                />
              ))}
            </div>
          </>
        ) : null}

        {primerResultTab === 'sequences' ? (
          <div className="primer-grid">
            {visiblePrimers.map((primer) => (
              <PrimerCard
                key={primer.name}
                primer={primer}
                selected={selectedPrimerName === primer.name}
                onSelect={() => onSelectPrimer(primer.name)}
              />
            ))}
          </div>
        ) : null}

        {primerResultTab === 'structures' ? (
          <div className="workspace-two-column">
            <div className="status-block">
              <p className="status-title">Approximate structure summary</p>
              <ul className="status-list">
                {visiblePrimers.map((primer) => (
                  <li key={`${primer.name}-structure`}>
                    {primer.name}: hairpin {primer.structure.hairpin ? `${primer.structure.hairpin.deltaG} kcal/mol` : 'none'},
                    homodimer {primer.structure.homodimer ? `${primer.structure.homodimer.deltaG} kcal/mol` : 'none'}, 3
                    prime {primer.structure.threePrimeHomodimer?.threePrimePairedBasesA ?? 0}
                  </li>
                ))}
              </ul>
            </div>
            <div className="status-block">
              <p className="status-title">Primer pair interactions</p>
              <ul className="status-list">
                {design.primerPairInteractions.length ? (
                  design.primerPairInteractions.slice(0, 8).map((pair) => (
                    <li key={`${pair.primerAName}-${pair.primerBName}`}>
                      {pair.primerAName}/{pair.primerBName}:{' '}
                      {pair.interaction ? `${pair.interaction.risk}, dG ${pair.interaction.deltaG} kcal/mol` : 'none'}
                      {pair.intended ? ' (intended overlap pair)' : ''}
                    </li>
                  ))
                ) : (
                  <li>No pairwise interactions were computed.</li>
                )}
              </ul>
            </div>
          </div>
        ) : null}

        {primerResultTab === 'specificity' ? (
          <div className="workspace-two-column">
            <div className="status-block">
              <p className="status-title">Intended amplicons</p>
              <ul className="status-list">
                {design.intendedAmplicons.length ? (
                  design.intendedAmplicons.map((amplicon) => (
                    <li
                      key={`intended-${amplicon.templateId}-${amplicon.forwardPrimerName}-${amplicon.reversePrimerName}-${amplicon.start}`}
                    >
                      Intended: {amplicon.templateName} {amplicon.forwardPrimerName}/{amplicon.reversePrimerName} predicts{' '}
                      {amplicon.length} bp
                    </li>
                  ))
                ) : (
                  <li>No intended amplicon models were classified for the current design.</li>
                )}
              </ul>
            </div>
            <div className="status-block">
              <p className="status-title">Unintended amplicons</p>
              <ul className="status-list">
                {design.offTargetAmplicons.length ? (
                  design.offTargetAmplicons.slice(0, 8).map((amplicon) => (
                    <li
                      key={`${amplicon.templateId}-${amplicon.forwardPrimerName}-${amplicon.reversePrimerName}-${amplicon.start}`}
                    >
                      {amplicon.templateName}: {amplicon.forwardPrimerName}/{amplicon.reversePrimerName} predicts{' '}
                      {amplicon.length} bp ({amplicon.risk})
                    </li>
                  ))
                ) : (
                  <li>No unintended amplicons detected by the current local scan.</li>
                )}
              </ul>
            </div>
          </div>
        ) : null}

        {primerResultTab === 'alternatives' ? (
          <>
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
            ) : null}
            <div className="candidate-stack">
              {design.alternativeDesigns.length ? (
                design.alternativeDesigns.map((candidate) => (
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
                      <li>
                        Worst non-intended dimer dG:{' '}
                        {candidate.worstNonIntendedDimerDeltaG !== null
                          ? `${candidate.worstNonIntendedDimerDeltaG.toFixed(1)} kcal/mol`
                          : 'n/a'}
                      </li>
                      <li>High-risk off-targets: {candidate.highRiskOffTargets}</li>
                    </ul>
                  </article>
                ))
              ) : (
                <div className="status-block">
                  <p className="status-title">No alternatives</p>
                  <p>No ranked alternatives were generated for the current search space.</p>
                </div>
              )}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
