type WelcomeScreenProps = {
  onImportSequences: () => void;
  onLoadExactExample: () => void;
  onLoadProteinExample: () => void;
  onOpenProject: () => void;
};

export function WelcomeScreen({
  onImportSequences,
  onLoadExactExample,
  onLoadProteinExample,
  onOpenProject,
}: WelcomeScreenProps) {
  return (
    <section className="empty-state panel">
      <div className="empty-state-copy">
        <p className="eyebrow">FusionPCR Studio</p>
        <h1>
          Design primers and protocols for two-fragment overlap-extension PCR.
        </h1>
        <p className="hero-text">
          Load two sequences or start from a built-in example to enter the
          workbench.
        </p>
      </div>
      <div className="empty-state-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={onImportSequences}
        >
          Import sequences
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={onLoadExactExample}
        >
          Load exact fusion example
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={onLoadProteinExample}
        >
          Load protein fusion example
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={onOpenProject}
        >
          Open project
        </button>
      </div>
    </section>
  );
}
