"use client";

import { Check, ChevronDown, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ThoughtStep = {
  label: string;
  done?: boolean;
};

type Props = {
  label?: string;
  doneLabel?: string;
  steps?: ThoughtStep[];
  working?: boolean;
  showTimer?: boolean;
  collapsible?: boolean;
  collapseOnSettle?: boolean;
  className?: string;
};

function fmt(ds: number) {
  return ds < 600
    ? `${(ds / 10).toFixed(1)}s`
    : `${Math.floor(ds / 600)}m ${((ds % 600) / 10).toFixed(1)}s`;
}

/**
 * Slim ThoughtLine (React Bits–inspired). Lucide + CSS only — no motion/hugeicons.
 */
export function ThoughtLine({
  label = "Searching…",
  doneLabel = "Thought for",
  steps = [],
  working = true,
  showTimer = true,
  collapsible = true,
  collapseOnSettle = true,
  className = "",
}: Props) {
  const [open, setOpen] = useState(true);
  const [elapsedDs, setElapsedDs] = useState(0);
  const started = useRef<number | null>(null);
  const hasTrace = steps.length > 0;
  const toggle = hasTrace && collapsible;

  useEffect(() => {
    if (working) {
      setOpen(true);
      started.current = performance.now();
      setElapsedDs(0);
      const id = setInterval(() => {
        if (started.current == null) return;
        setElapsedDs(Math.floor((performance.now() - started.current) / 100));
      }, 100);
      return () => clearInterval(id);
    }
    if (collapseOnSettle) setOpen(false);
    return undefined;
  }, [working, collapseOnSettle]);

  const head = (
    <>
      <span className="thought-line__glyph" aria-hidden>
        {working ? (
          <Sparkles className="h-full w-full" strokeWidth={1.75} />
        ) : (
          <Check className="h-full w-full" strokeWidth={1.75} />
        )}
      </span>
      <span className="thought-line__label" aria-hidden>
        <span
          className="thought-line__text"
          data-active={working ? "" : undefined}
        >
          <span
            className="thought-line__breath"
            data-shimmer={working ? "" : undefined}
          >
            {label}
          </span>
        </span>
        <span
          className="thought-line__text thought-line__text--done"
          data-active={working ? undefined : ""}
        >
          {doneLabel}
        </span>
      </span>
      {showTimer ? (
        <span
          className="thought-line__timer"
          data-done={working ? undefined : ""}
          aria-hidden
        >
          {fmt(elapsedDs)}
        </span>
      ) : null}
      {collapsible ? (
        <span
          className="thought-line__chevron"
          data-on={hasTrace ? "" : undefined}
          aria-hidden
        >
          <ChevronDown className="h-[0.9em] w-[0.9em]" strokeWidth={1.75} />
        </span>
      ) : null}
    </>
  );

  return (
    <div
      className={`thought-line${className ? ` ${className}` : ""}`}
      data-working={working ? "" : undefined}
      data-open={open ? "" : undefined}
    >
      {toggle ? (
        <button
          type="button"
          className="thought-line__head"
          data-toggle=""
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {head}
        </button>
      ) : (
        <div className="thought-line__head">{head}</div>
      )}
      <span className="thought-line__sr">
        {working ? label : `${doneLabel} ${fmt(elapsedDs)}`}
      </span>
      {hasTrace ? (
        <div className="thought-line__trace" data-open={open ? "" : undefined}>
          <div className="thought-line__fold">
            <ol className="thought-line__steps">
              {steps.map((step, i) => (
                <li key={`${i}-${step.label}`} className="thought-line__step">
                  <span
                    className="thought-line__step-mark"
                    data-done={step.done || !working ? "" : undefined}
                    aria-hidden
                  >
                    {step.done || !working ? (
                      <Check className="h-3 w-3" strokeWidth={2} />
                    ) : (
                      <span className="thought-line__step-dot" />
                    )}
                  </span>
                  <span>{step.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  );
}
