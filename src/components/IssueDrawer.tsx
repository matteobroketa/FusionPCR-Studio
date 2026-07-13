import { useState, type RefObject } from 'react';
import type { ReviewItem } from '../utils/fusion';
import { filterActionableReviewItems } from '../utils/review-items';

type IssueDrawerProps = {
  reviewItems: ReviewItem[];
  headingRef?: RefObject<HTMLHeadingElement | null>;
};

const severityLabels: Record<ReviewItem['severity'], string> = {
  blocking: 'Blocking',
  warning: 'Warning',
  review: 'Review',
  information: 'Information',
};

const severityPillClass: Record<ReviewItem['severity'], string> = {
  blocking: 'pill-alert',
  warning: 'pill-watch',
  review: 'pill-watch',
  information: 'pill-muted',
};

export function IssueDrawer({ reviewItems, headingRef }: IssueDrawerProps) {
  const [open, setOpen] = useState(false);
  const actionableItems = filterActionableReviewItems(reviewItems);
  const previewItems = actionableItems.slice(0, 3);

  if (!reviewItems.length) {
    return null;
  }

  return (
    <section className="panel workspace-section issue-drawer">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Review issues</p>
          <h2 ref={headingRef} tabIndex={-1}>
            {actionableItems.length} item(s) need review
          </h2>
        </div>
        <button type="button" className="button button-secondary" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
          {open ? 'Hide issue list' : 'Show all issues'}
        </button>
      </div>

      <div className="issue-preview-list" role="list" aria-label="Top design issues">
        {previewItems.map((item) => (
          <div key={item.id} className="issue-preview-item" role="listitem">
            <span className={`pill ${severityPillClass[item.severity]}`}>{severityLabels[item.severity]}</span>
            <strong>{item.title}</strong>
            <p>{item.explanation}</p>
          </div>
        ))}
      </div>

      {open ? (
        <div className="issue-sections">
          {(['blocking', 'warning', 'review', 'information'] as const).map((severity) => {
            const scopedItems = reviewItems.filter((item) => item.severity === severity);
            if (!scopedItems.length) {
              return null;
            }

            return (
              <div key={severity} className="status-block">
                <p className="status-title">{severityLabels[severity]} items</p>
                <div className="issue-sections">
                  {scopedItems.map((item) => (
                    <div key={item.id} className="issue-preview-item">
                      <div className="panel-header">
                        <strong>{item.title}</strong>
                        <span className={`pill ${severityPillClass[item.severity]}`}>{severityLabels[item.severity]}</span>
                      </div>
                      <p>{item.explanation}</p>
                      <p className="field-helper">Recommended action: {item.recommendedAction}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
