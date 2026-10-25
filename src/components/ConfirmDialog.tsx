'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
};

type ConfirmDialogProps = ConfirmOptions & {
  open: boolean;
  onAnswer: (confirmed: boolean) => void;
};

function ConfirmDialog({ open, title, description, confirmLabel = '확인', danger = false, onAnswer }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); onAnswer(false); }}
      onClick={(event) => { if (event.target === event.currentTarget) onAnswer(false); }}
    >
      <div className="confirm-dialog-panel">
        <span className="confirm-dialog-signal" aria-hidden="true" />
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="button button-ghost" autoFocus onClick={() => onAnswer(false)}>취소</button>
          <button type="button" className={`button ${danger ? 'button-danger' : 'button-primary'}`} onClick={() => onAnswer(true)}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((nextOptions: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setOptions(nextOptions);
  }), []);

  const answer = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setOptions(null);
  }, []);

  useEffect(() => () => resolver.current?.(false), []);

  return {
    confirm,
    confirmation: options ? <ConfirmDialog {...options} open onAnswer={answer} /> : null,
  };
}
