import type { RefObject } from 'react';

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelButtonRef?: RefObject<HTMLButtonElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelButtonRef,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog panel" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-dialog-title">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Confirm action</p>
            <h2 id="confirmation-dialog-title">{title}</h2>
          </div>
        </div>
        <p>{message}</p>
        <div className="action-row">
          <button ref={cancelButtonRef} type="button" className="button button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="button button-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
