'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export default function ConfirmDialog({ titleId, onCancel, children }: {
  titleId: string;
  onCancel: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    dialog?.querySelector<HTMLButtonElement>('[data-dialog-cancel]')?.focus();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={onCancel}
      className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md max-h-[calc(100dvh_-_2rem)] overflow-y-auto border-0 bg-transparent p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm">
      {children}
    </dialog>
  );
}
