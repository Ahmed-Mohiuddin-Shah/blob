"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

const LONG_PRESS_MS = 400;

type Side = "top" | "bottom";

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: string;
  children: ReactNode;
  side?: Side;
}) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  useEffect(() => () => clearPress(), []);

  const tipClass =
    side === "bottom"
      ? "absolute top-full left-1/2 z-20 mt-2 -translate-x-1/2"
      : "absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2";

  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
        "aria-describedby": open ? tipId : undefined,
      })
    : children;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        clearPress();
        setOpen(false);
      }}
      onTouchStart={() => {
        clearPress();
        pressTimer.current = setTimeout(() => setOpen(true), LONG_PRESS_MS);
      }}
      onTouchEnd={() => {
        clearPress();
        setOpen(false);
      }}
      onTouchCancel={() => {
        clearPress();
        setOpen(false);
      }}
      onPointerLeave={() => {
        clearPress();
        setOpen(false);
      }}
    >
      {child}
      {open && content ? (
        <span
          id={tipId}
          role="tooltip"
          className={`${tipClass} max-w-[14rem] whitespace-nowrap rounded-2xl border border-divider bg-surface px-3 py-1.5 text-[11px] leading-snug text-secondary shadow-lg`}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
