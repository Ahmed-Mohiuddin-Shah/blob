"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Explicit busy; if omitted, uses parent form `useFormStatus().pending` */
  busy?: boolean;
};

/** Async / API buttons — always show `.btn-busy` gradient while pending. */
export function BusyButton({ busy, className = "", children, disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  const isBusy = busy ?? pending;

  return (
    <button
      {...props}
      disabled={disabled || isBusy}
      aria-busy={isBusy || undefined}
      className={`${className}${isBusy ? " btn-busy" : ""}`}
    >
      {children}
    </button>
  );
}
