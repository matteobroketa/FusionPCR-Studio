import { useState } from 'react';

type IssueDrawerProps = {
  issues: string[];
  warnings: string[];
};

export function IssueDrawer({ issues, warnings }: IssueDrawerProps) {
  const [open, setOpen] = useState(false);
  const items = [
    ...issues.map((message) => ({ severity: 'blocking' as const, message })),
    ...warnings.map((message) => ({ severity: 'warning' as const, message })),
  ];

  if (!items.length) {
    return null;
  }

  return (
    <section className="panel workspace-section issue-drawer">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Review issues</p>
          <h2>{items.length} item(s) need review</h2>
        </div>
        <button type="button" className="button button-secondary" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
          {open ? 'Hide issue list' : 'Show all issues'}
        </button>
      </div>

      <div className="issue-preview-list" role="list" aria-label="Top design issues">
        {items.slice(0, 3).map((item) => (
          <div key={`${item.severity}-${item.message}`} className="issue-preview-item" role="listitem">
            <span className={`pill ${item.severity === 'blocking' ? 'pill-alert' : 'pill-watch'}`}>{item.severity === 'blocking' ? 'Blocking' : 'Review'}</span>
            <p>{item.message}</p>
          </div>
        ))}
      </div>

      {open ? (
        <div className="issue-sections">
          {issues.length ? (
            <div className="status-block">
              <p className="status-title">Blocking issues</p>
              <ul className="status-list">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {warnings.length ? (
            <div className="status-block">
              <p className="status-title">Design warnings</p>
              <ul className="status-list">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
