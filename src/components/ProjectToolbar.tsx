type ProjectToolbarProps = {
  projectName: string;
  showWorkbench: boolean;
  readOnlyReviewMode: boolean;
  saveStateLabel: string;
  persistenceState: 'idle' | 'saving' | 'saved' | 'failed';
  calculationStateLabel: string;
  calculationStateTone: 'success' | 'watch' | 'alert';
  canUndo: boolean;
  canRedo: boolean;
  showMenu: boolean;
  hasRecoverableProject: boolean;
  onProjectNameChange: (value: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenProject: () => void;
  onToggleMenu: () => void;
  onLoadExactExample: () => void;
  onLoadProteinExample: () => void;
  onRestorePreviousProject: () => void;
  onClearProject: () => void;
};

export function ProjectToolbar({
  projectName,
  showWorkbench,
  readOnlyReviewMode,
  saveStateLabel,
  persistenceState,
  calculationStateLabel,
  calculationStateTone,
  canUndo,
  canRedo,
  showMenu,
  hasRecoverableProject,
  onProjectNameChange,
  onUndo,
  onRedo,
  onOpenProject,
  onToggleMenu,
  onLoadExactExample,
  onLoadProteinExample,
  onRestorePreviousProject,
  onClearProject,
}: ProjectToolbarProps) {
  return (
    <header className="app-topbar panel">
      <div className="topbar-brand">
        <div className="product-mark" aria-hidden="true">
          FP
        </div>
        <div>
          <strong>FusionPCR Studio</strong>
          <span className="topbar-subtitle">Two-fragment OE-PCR workbench</span>
        </div>
      </div>

      <div className="topbar-actions">
        {!showWorkbench ? (
          <button
            type="button"
            className="button button-secondary"
            onClick={onOpenProject}
          >
            Open project
          </button>
        ) : null}
        {showWorkbench ? (
          <>
            {readOnlyReviewMode ? (
              <div
                className="topbar-project topbar-project-readonly"
                aria-label="Project name"
              >
                <span className="eyebrow">Project</span>
                <strong>{projectName}</strong>
              </div>
            ) : (
              <label className="topbar-project">
                <span className="sr-only">Project name</span>
                <input
                  aria-label="Project name"
                  className="text-input"
                  value={projectName}
                  onChange={(event) => onProjectNameChange(event.target.value)}
                />
              </label>
            )}
            <div className="topbar-status">
              <span
                className={`pill ${persistenceState === 'failed' ? 'pill-alert' : persistenceState === 'saved' ? 'pill-success' : 'pill-watch'}`}
              >
                {saveStateLabel}
              </span>
              <span
                className={`pill ${calculationStateTone === 'alert' ? 'pill-alert' : calculationStateTone === 'success' ? 'pill-success' : 'pill-watch'}`}
              >
                {calculationStateLabel}
              </span>
            </div>
            {!readOnlyReviewMode ? (
              <>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={onUndo}
                  disabled={!canUndo}
                >
                  Undo
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={onRedo}
                  disabled={!canRedo}
                >
                  Redo
                </button>
              </>
            ) : null}
          </>
        ) : null}
        <div className="topbar-menu">
          <button
            type="button"
            className="button button-secondary"
            aria-expanded={showMenu}
            onClick={onToggleMenu}
          >
            Menu
          </button>
          {showMenu ? (
            <div
              className="menu-panel panel"
              role="menu"
              aria-label="Project actions"
            >
              <button
                type="button"
                className="button button-secondary"
                role="menuitem"
                onClick={onOpenProject}
              >
                Import project JSON
              </button>
              <button
                type="button"
                className="button button-secondary"
                role="menuitem"
                onClick={onLoadExactExample}
              >
                Load exact fusion example
              </button>
              <button
                type="button"
                className="button button-secondary"
                role="menuitem"
                onClick={onLoadProteinExample}
              >
                Load protein fusion example
              </button>
              {hasRecoverableProject ? (
                <button
                  type="button"
                  className="button button-secondary"
                  role="menuitem"
                  onClick={onRestorePreviousProject}
                >
                  Restore previous project
                </button>
              ) : null}
              {showWorkbench ? (
                <button
                  type="button"
                  className="button button-secondary"
                  role="menuitem"
                  onClick={onClearProject}
                >
                  Clear project
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
