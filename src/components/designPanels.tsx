import type { PrimerDesign, ReactionPlan } from '../utils/fusion';

export function SequenceRail({
  label,
  sequenceLength,
  start,
  end,
  topology,
  accentClass,
}: {
  label: string;
  sequenceLength: number;
  start: number;
  end: number;
  topology: 'linear' | 'circular';
  accentClass: string;
}) {
  const safeLength = Math.max(sequenceLength, 1);
  const wrapsOrigin = topology === 'circular' && sequenceLength > 0 && start > end;
  const selectionSegments = wrapsOrigin
    ? [
        {
          width: ((safeLength - start + 1) / safeLength) * 100,
          left: ((start - 1) / safeLength) * 100,
        },
        {
          width: (end / safeLength) * 100,
          left: 0,
        },
      ]
    : [
        {
          width: sequenceLength ? ((end - start + 1) / safeLength) * 100 : 0,
          left: sequenceLength ? ((start - 1) / safeLength) * 100 : 0,
        },
      ];

  return (
    <div className="rail-card">
      <div className="rail-meta">
        <span>{label}</span>
        <strong>{sequenceLength} bp</strong>
      </div>
      <div className="rail-track">
        {selectionSegments.map((segment) => (
          <div
            key={`${label}-${segment.left}-${segment.width}`}
            className={`rail-selection ${accentClass}`}
            style={{ width: `${segment.width}%`, left: `${segment.left}%` }}
          />
        ))}
      </div>
      <div className="rail-caption">
        Selected bases {start}-{end}
        {wrapsOrigin ? ' (wraparound)' : ''}
      </div>
    </div>
  );
}

export function SequencePreview({
  title,
  sequence,
}: {
  title: string;
  sequence: string;
}) {
  return (
    <div className="preview-block">
      <span className="preview-label">{title}</span>
      <code className="sequence-preview">{sequence || 'No sequence available for the current state.'}</code>
    </div>
  );
}

type PrimerStatusTone = 'success' | 'watch' | 'alert';

export function summarizePrimerStatus(primer: PrimerDesign): { label: string; tone: PrimerStatusTone } {
  const nonIntendedSpecificityHits = primer.specificitySites.filter(
    (site) => site.risk !== 'low' && site.templateId !== primer.expectedTemplateId,
  );
  if (nonIntendedSpecificityHits.some((site) => site.risk === 'high')) {
    return { label: 'Review off-targets', tone: 'alert' };
  }
  if (primer.structure.risk === 'High') {
    return { label: 'Review structure', tone: 'alert' };
  }
  if (nonIntendedSpecificityHits.length || primer.structure.risk === 'Watch') {
    return { label: 'Watch', tone: 'watch' };
  }
  return { label: 'Ready', tone: 'success' };
}

function summarizeStructureFindings(primer: PrimerDesign): string[] {
  const findings: string[] = [];

  if (primer.structure.hairpin && primer.structure.hairpin.risk !== 'Low') {
    findings.push(
      `Hairpin ${primer.structure.hairpin.risk.toLowerCase()}: dG ${primer.structure.hairpin.deltaG} kcal/mol, Tm ${primer.structure.hairpin.predictedTm} C.`,
    );
  }
  if (primer.structure.homodimer && primer.structure.homodimer.risk !== 'Low') {
    findings.push(
      `Homodimer ${primer.structure.homodimer.risk.toLowerCase()}: dG ${primer.structure.homodimer.deltaG} kcal/mol, stem ${primer.structure.homodimer.longestContiguousStem}.`,
    );
  }
  if (primer.structure.threePrimeHomodimer && primer.structure.threePrimeHomodimer.risk !== 'Low') {
    findings.push(
      `3 prime homodimer ${primer.structure.threePrimeHomodimer.risk.toLowerCase()}: dG ${primer.structure.threePrimeHomodimer.deltaG} kcal/mol, ${primer.structure.threePrimeHomodimer.threePrimePairedBasesA} paired 3 prime bases.`,
    );
  }

  return findings.length ? findings : ['No watch/high findings in the approximate structure model.'];
}

function summarizeSpecificityFindings(primer: PrimerDesign): string[] {
  const findings = primer.specificitySites
    .filter((site) => site.risk !== 'low' && site.templateId !== primer.expectedTemplateId)
    .slice(0, 4)
    .map(
      (site) =>
        `${site.templateName} ${site.start}-${site.end}: ${site.risk} risk, ${site.mismatchCount} mismatch(es), 3 prime match ${site.threePrimeMatchedBases} nt.`,
    );

  return findings.length ? findings : ['No elevated local specificity findings beyond the intended template site.'];
}

export function PrimerDetailPanel({
  primer,
  selected = false,
  onCopy,
}: {
  primer: PrimerDesign;
  selected?: boolean;
  onCopy?: (() => void) | undefined;
}) {
  const status = summarizePrimerStatus(primer);
  const structureFindings = summarizeStructureFindings(primer);
  const specificityFindings = summarizeSpecificityFindings(primer);

  return (
    <article className={`primer-detail-panel ${selected ? 'object-selected' : ''}`}>
      <div className="primer-card-header">
        <div>
          <h3>{primer.name}</h3>
          <p>{primer.role}</p>
        </div>
        <span className={`pill ${status.tone === 'alert' ? 'pill-alert' : status.tone === 'watch' ? 'pill-watch' : 'pill-success'}`}>
          {status.label}
        </span>
      </div>

      {onCopy ? (
        <div className="action-row">
          <button type="button" className="button button-secondary" onClick={onCopy}>
            Copy primer
          </button>
        </div>
      ) : null}

      <code className="primer-sequence">
        {primer.tail ? <span className="primer-tail">{primer.tail}</span> : null}
        <span className="primer-body">{primer.body}</span>
      </code>

      <div className="metric-grid compact-grid">
        <div className="metric">
          <span>Reaction</span>
          <strong>{primer.reaction}</strong>
        </div>
        <div className="metric">
          <span>Length</span>
          <strong>{primer.fullLength} nt</strong>
        </div>
        <div className="metric">
          <span>Annealing-body Tm</span>
          <strong>{primer.bodyTm.toFixed(1)} C</strong>
        </div>
        <div className="metric">
          <span>Body GC</span>
          <strong>{primer.bodyGcPercentage.toFixed(1)}%</strong>
        </div>
        <div className="metric">
          <span>Body length</span>
          <strong>{primer.bodyLength} nt</strong>
        </div>
      </div>

      <div className="status-block">
        <p className="status-title">Approximate structure findings</p>
        <ul className="status-list">
          {structureFindings.map((finding) => (
            <li key={`${primer.name}-structure-${finding}`}>{finding}</li>
          ))}
        </ul>
      </div>

      <div className="status-block">
        <p className="status-title">Local specificity findings</p>
        <ul className="status-list">
          {specificityFindings.map((finding) => (
            <li key={`${primer.name}-specificity-${finding}`}>{finding}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function ReactionCard({
  reaction,
  selected = false,
  onSelect,
}: {
  reaction: ReactionPlan;
  selected?: boolean;
  onSelect?: (() => void) | undefined;
}) {
  return (
    <article className={`reaction-card ${selected ? 'object-selected' : ''}`}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">{reaction.name}</p>
          <h3>{reaction.primerNames.join(' + ')}</h3>
        </div>
        {onSelect ? (
          <button type="button" className="object-select-button" onClick={onSelect} aria-pressed={selected}>
            Inspect stage
          </button>
        ) : null}
      </div>
      <div className="metric-grid compact-grid">
        <div className="metric">
          <span>Product</span>
          <strong>{reaction.productLength} bp</strong>
        </div>
        <div className="metric">
          <span>Anneal</span>
          <strong>{reaction.annealingTemperature} C</strong>
        </div>
        <div className="metric">
          <span>Extend</span>
          <strong>{reaction.extensionSeconds} s</strong>
        </div>
        <div className="metric">
          <span>Gradient</span>
          <strong>{reaction.gradientRecommendation ?? 'Not needed'}</strong>
        </div>
      </div>
    </article>
  );
}
