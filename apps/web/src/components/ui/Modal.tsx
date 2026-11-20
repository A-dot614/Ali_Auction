"use client";

import { useRef, type ReactNode } from "react";

/** Accessible modal using the native dialog element; no focus trap library. */
export default function Modal({
  label,
  children,
  openLabel = "Open",
}: {
  label: string;
  children: ReactNode;
  openLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="ui-button ui-button--secondary" onClick={() => ref.current?.showModal()}>
        {openLabel}
      </button>
      <dialog ref={ref} aria-label={label} className="ui-modal">
        {children}
        <button type="button" className="ui-button ui-button--quiet" onClick={() => ref.current?.close()}>
          Close
        </button>
      </dialog>
    </>
  );
}
