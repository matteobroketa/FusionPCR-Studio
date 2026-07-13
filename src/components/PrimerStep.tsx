import { useState } from 'react';
import { PrimerDetailPanel, summarizePrimerStatus } from './designPanels';
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
  phoneReviewMode: boolean;
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
  phoneReviewMode,
  comparisonSnapshot,
  compareRows,
  onPrimerResultTabChange,
  onSelectPrimer,
}: PrimerStepProps) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const selectedPrimer =
    visiblePrimers.find((primer) => primer.name === selectedPrimerName) ??
    visiblePrimers[0] ??
    null;
  const copyStatusId = 'primer-copy-status';

  const writeClipboard = async (content: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return;
    }

    const fallbackInput = document.createElement('textarea');
    fallbackInput.value = content;
    fallbackInput.setAttribute('readonly', 'true');
    fallbackInput.style.position = 'absolute';
    fallbackInput.style.left = '-9999px';
    document.body.appendChild(fallbackInput);
    fallbackInput.select();
    document.execCommand('copy');
    document.body.removeChild(fallbackInput);
  };

  const handleCopyPrimer = async (primer: PrimerDesign | null) => {
    if (!primer) {
      return;
    }

    await writeClipboard(primer.sequence);
    setCopyStatus(`Copied ${primer.name} primer sequence.`);
  };

  const handleCopyAllPrimers = async () => {
    const fasta = visiblePrimers.map((primer) => `>${primer.name}\n${primer.sequence}`).join('\n');
    await writeClipboard(fasta);
    setCopyStatus(`Copied all ${visiblePrimers.length} primer sequence(s).`);
  };

  if (phoneReviewMode) {
    return (
      <div className="workspace-stack">
        <section className="panel workspace-section">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Primers</p>
              <h2>Primer review</h2>
            </div>
            <span className="pill pill-muted">{visiblePrimers.length} primer(s)</span>
          </div>

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
            <div className="metric">
              <span>Sequence reconstruction</span>
              <strong>{design.finalProductVerified ? 'Pass' : 'Pending'}</strong>
            </div>
          </div>

          <div className="action-row">
            <button type="button" className="button button-secondary" onClick={() => void handleCopyAllPrimers()} disabled={!visiblePrimers.length}>
              Copy all primers
            </button>
          </div>

          {copyStatus ? (
            <p id={copyStatusId} className="status-note status-note-success">
              {copyStatus}
            </p>
          ) : null}

          <div className="phone-primer-selector" role="tablist" aria-label="Primer selector">
            {visiblePrimers.map((primer) => (
              <button
                key={primer.name}
                type="button"
                className={`phone-primer-chip ${selectedPrimer?.name === primer.name ? 'phone-primer-chip-active' : ''}`}
                aria-pressed={selectedPrimer?.name === primer.name}
                onClick={() => onSelectPrimer(primer.name)}
              >
                {primer.name}
              </button>
            ))}
          </div>

          {selectedPrimer ? (
            <div className="phone-primer-detail">
              <PrimerDetailPanel primer={selectedPrimer} selected onCopy={() => void handleCopyPrimer(selectedPrimer)} />
            </div>
          ) : (
            <div className="status-block">
              <p className="status-title">No primer set</p>
              <p>No primer details are available for the current review state.</p>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="workspace-stack">
      <section className="panel workspace-section">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Primers</p>
            <h2>Primer review</h2>
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
              <div className="metric">
                <span>Sequence reconstruction</span>
                <strong>{design.finalProductVerified ? 'Pass' : 'Pending'}</strong>
              </div>
            </div>

            <div className="action-row">
              <button type="button" className="button button-secondary" onClick={() => void handleCopyAllPrimers()} disabled={!visiblePrimers.length}>
                Copy all primers
              </button>
            </div>

            {copyStatus ? (
              <p id={copyStatusId} className="status-note status-note-success">
                {copyStatus}
              </p>
            ) : null}

            <div className="primer-review-layout">
              <div className="primer-review-table-wrap">
                <table className="primer-review-table" aria-label="Primer review table">
                  <thead>
                    <tr>
                      <th scope="col">Primer</th>
                      <th scope="col">Reaction</th>
                      <th scope="col">Length</th>
                      <th scope="col">Annealing-body Tm</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePrimers.map((primer) => {
                      const status = summarizePrimerStatus(primer);
                      return (
                        <tr key={primer.name} className={selectedPrimerName === primer.name ? 'primer-review-row-selected' : ''}>
                          <th scope="row">
                            <button
                              type="button"
                              className={`primer-row-button ${selectedPrimerName === primer.name ? 'primer-row-button-selected' : ''}`}
                              onClick={() => onSelectPrimer(primer.name)}
                              aria-pressed={selectedPrimerName === primer.name}
                            >
                              {primer.name}
                            </button>
                          </th>
                          <td>{primer.reaction}</td>
                          <td>{primer.fullLength} nt</td>
                          <td>{primer.bodyTm.toFixed(1)} C</td>
                          <td>
                            <span className={`pill ${status.tone === 'alert' ? 'pill-alert' : status.tone === 'watch' ? 'pill-watch' : 'pill-success'}`}>
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {selectedPrimer ? (
                <PrimerDetailPanel primer={selectedPrimer} selected onCopy={() => void handleCopyPrimer(selectedPrimer)} />
              ) : (
                <div className="status-block">
                  <p className="status-title">No primer selected</p>
                  <p>Select a primer row to inspect one detail panel.</p>
                </div>
              )}
            </div>
          </>
        ) : null}

        {primerResultTab === 'sequences' ? (
          <div className="workspace-two-column">
            <div className="status-block">
              <p className="status-title">Primer sequences</p>
              <ul className="status-list">
                {visiblePrimers.map((primer) => (
                  <li key={`${primer.name}-sequence-tab`}>
                    <button type="button" className="inline-link-button" onClick={() => onSelectPrimer(primer.name)}>
                      {primer.name}
                    </button>{' '}
                    {primer.tail.length ? `${primer.tail.length} nt tail + ` : ''}
                    {primer.bodyLength} nt annealing body
                  </li>
                ))}
              </ul>
            </div>
            {selectedPrimer ? <PrimerDetailPanel primer={selectedPrimer} selected onCopy={() => void handleCopyPrimer(selectedPrimer)} /> : null}
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
            {selectedPrimer ? <PrimerDetailPanel primer={selectedPrimer} selected onCopy={() => void handleCopyPrimer(selectedPrimer)} /> : null}
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
            {selectedPrimer ? <PrimerDetailPanel primer={selectedPrimer} selected onCopy={() => void handleCopyPrimer(selectedPrimer)} /> : null}
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
