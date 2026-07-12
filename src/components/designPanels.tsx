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

export function PrimerCard({
  primer,
  selected = false,
  onSelect,
}: {
  primer: PrimerDesign;
  selected?: boolean;
  onSelect?: (() => void) | undefined;
}) {
  return (
    <article className={`primer-card ${selected ? 'object-selected' : ''}`}>
      <div className="primer-card-header">
        <div>
          <h3>{primer.name}</h3>
          <p>{primer.role}</p>
        </div>
        <span className={`pill ${primer.structure.risk === 'High' ? 'pill-alert' : primer.structure.risk === 'Watch' ? 'pill-watch' : 'pill-success'}`}>
          {primer.structure.risk}
        </span>
      </div>

      {onSelect ? (
        <button type="button" className="object-select-button" onClick={onSelect} aria-pressed={selected}>
          Inspect primer
        </button>
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
          <span>Body Tm</span>
          <strong>{primer.bodyTm.toFixed(1)} C</strong>
        </div>
        <div className="metric">
          <span>Full oligo Tm</span>
          <strong>{primer.fullOligoTm.toFixed(1)} C</strong>
        </div>
        <div className="metric">
          <span>Overlap Tm</span>
          <strong>{primer.overlapTm !== null ? `${primer.overlapTm.toFixed(1)} C` : 'n/a'}</strong>
        </div>
        <div className="metric">
          <span>Body GC</span>
          <strong>{primer.bodyGcPercentage.toFixed(1)}%</strong>
        </div>
        <div className="metric">
          <span>Body length</span>
          <strong>{primer.bodyLength} nt</strong>
        </div>
        <div className="metric">
          <span>Delta H</span>
          <strong>{primer.bodyThermodynamics.deltaHKcalPerMol.toFixed(1)} kcal/mol</strong>
        </div>
        <div className="metric">
          <span>Delta S</span>
          <strong>{primer.bodyThermodynamics.deltaSCalPerMolK.toFixed(1)} cal/mol/K</strong>
        </div>
        <div className="metric">
          <span>Hairpin</span>
          <strong>{primer.structure.hairpin?.longestContiguousStem ?? 0} stem</strong>
        </div>
        <div className="metric">
          <span>3 prime dimer</span>
          <strong>{primer.structure.threePrimeHomodimer?.threePrimePairedBasesA ?? 0} paired</strong>
        </div>
        <div className="metric">
          <span>Specificity hits</span>
          <strong>{primer.specificitySites.filter((site) => site.risk !== 'low').length}</strong>
        </div>
      </div>

      <div className="status-block">
        <p className="status-title">Approximate structure summary</p>
        <ul className="status-list">
          <li>
            Hairpin: {primer.structure.hairpin ? `${primer.structure.hairpin.deltaG} kcal/mol, Tm ${primer.structure.hairpin.predictedTm} C` : 'none'}
          </li>
          <li>
            Homodimer: {primer.structure.homodimer ? `${primer.structure.homodimer.deltaG} kcal/mol, stem ${primer.structure.homodimer.longestContiguousStem}` : 'none'}
          </li>
          <li>
            3 prime homodimer: {primer.structure.threePrimeHomodimer ? `${primer.structure.threePrimeHomodimer.deltaG} kcal/mol, 3 prime ${primer.structure.threePrimeHomodimer.threePrimePairedBasesA}` : 'none'}
          </li>
        </ul>
      </div>

      <div className="status-block">
        <p className="status-title">Local specificity</p>
        <ul className="status-list">
          {primer.specificitySites.slice(0, 4).map((site) => (
            <li key={`${primer.name}-${site.templateId}-${site.start}`}>
              {site.templateName} {site.start}-{site.end}, {site.risk} risk, {site.mismatchCount} mismatch(es), 3 prime match {site.threePrimeMatchedBases} nt
            </li>
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
