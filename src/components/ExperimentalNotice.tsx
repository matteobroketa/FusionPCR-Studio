type ExperimentalNoticeProps = {
  onDismiss: () => void;
};

export function ExperimentalNotice({ onDismiss }: ExperimentalNoticeProps) {
  return (
    <div className="notice-banner panel" role="status">
      <span>Experimental alpha — independently review primers and protocols.</span>
      <details className="notice-details">
        <summary>Details</summary>
        <p className="field-helper">
          Primer ranking, structure review, specificity review, and protocol suggestions remain computational aids.
          Independently review every primer, reconstructed product, and protocol before experimental use.
        </p>
      </details>
      <button type="button" className="button button-secondary" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
