"use client";

import Link from "next/link";
import {
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";

export type BranchedLeaf = {
  value: string;
  label: string;
  href?: string;
  icon?: LucideIcon | ReactNode;
  badge?: number;
};

export type BranchedItem = {
  label: string;
  value?: string;
  href?: string;
  children?: BranchedLeaf[];
};

type Props = {
  items: BranchedItem[];
  defaultOpen?: number | number[];
  activeValue?: string;
  onSelect?: (value: string, item: BranchedLeaf | BranchedItem) => void;
  className?: string;
};

const PAD = 6;
const MARK = 16;
const ROW = 36;
const INDENT = 40;
const TRUNK = 14;
const RADIUS = 10;

const toSet = (open: number | number[]) =>
  new Set(Array.isArray(open) ? open : open >= 0 ? [open] : []);

function renderIcon(icon: LucideIcon | ReactNode) {
  if (isValidElement(icon)) return icon;
  const Icon = icon as LucideIcon;
  return <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />;
}

/**
 * Slim BranchedMenu (React Bits–inspired). Lucide + CSS/SVG — for profile nav.
 */
export function BranchedMenu({
  items,
  defaultOpen = 0,
  activeValue = "",
  onSelect,
  className = "",
}: Props) {
  const [open, setOpen] = useState(() => toSet(defaultOpen));
  const [active, setActive] = useState(activeValue);
  const navRef = useRef<HTMLElement>(null);
  const heads = useRef<(HTMLButtonElement | null)[]>([]);
  const markerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setActive(activeValue);
  }, [activeValue]);

  useEffect(() => {
    const idx = items.findIndex((it) =>
      it.children?.some((kid) => kid.value === activeValue),
    );
    if (idx >= 0) {
      setOpen((prev) => {
        if (prev.has(idx)) return prev;
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
    }
  }, [activeValue, items]);

  const activeSection = items.findIndex((it) =>
    it.children?.some((kid) => kid.value === active),
  );
  const markerShown = activeSection >= 0 && open.has(activeSection);

  useLayoutEffect(() => {
    const place = (glide: boolean) => {
      const m = markerRef.current;
      const el = heads.current[activeSection];
      if (!m) return;
      const on = markerShown && el;
      if (!glide) m.style.transition = "none";
      if (on) {
        m.style.top = `${el.offsetTop + (el.offsetHeight - MARK) / 2}px`;
      }
      m.toggleAttribute("data-on", Boolean(on));
      if (!glide) {
        void m.offsetHeight;
        m.style.transition = "";
      }
    };
    place(true);
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      place(false);
    });
    if (navRef.current) ro.observe(navRef.current);
    return () => ro.disconnect();
  }, [activeSection, markerShown, items]);

  const select = (value: string, item: BranchedLeaf | BranchedItem) => {
    setActive(value);
    onSelect?.(value, item);
  };

  const toggle = (i: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const r = Math.min(RADIUS, ROW / 2 - 2);
  const endX = INDENT - 8;
  const rowY = (k: number) => PAD + k * ROW + ROW / 2;
  const branch = (k: number) =>
    `M ${TRUNK} ${rowY(k) - r} A ${r} ${r} 0 0 0 ${TRUNK + r} ${rowY(k)} H ${endX}`;
  const reach = (k: number) =>
    `M ${TRUNK} 0 V ${rowY(k) - r} A ${r} ${r} 0 0 0 ${TRUNK + r} ${rowY(k)} H ${endX}`;
  const length = (k: number) =>
    rowY(k) - r + (Math.PI * r) / 2 + (endX - TRUNK - r);

  return (
    <nav
      ref={navRef}
      className={`branched-menu${className ? ` ${className}` : ""}`}
    >
      <span ref={markerRef} className="branched-menu__marker" aria-hidden />
      {items.map((item, i) => {
        const kids = item.children;
        const isOpen = kids ? open.has(i) : false;
        const leafValue = item.value ?? item.label;
        const leafActive = !kids && leafValue === active;
        const bodyH = kids ? PAD * 2 + kids.length * ROW : 0;
        return (
          <div
            key={item.value ?? item.label}
            className="branched-menu__section"
            data-open={isOpen ? "" : undefined}
          >
            <button
              ref={(el) => {
                heads.current[i] = el;
              }}
              type="button"
              className="branched-menu__head"
              aria-expanded={kids ? isOpen : undefined}
              aria-current={leafActive ? "true" : undefined}
              data-active={leafActive ? "" : undefined}
              onClick={() => (kids ? toggle(i) : select(leafValue, item))}
            >
              {item.label}
            </button>
            {kids ? (
              <div className="branched-menu__body">
                <div className="branched-menu__fold">
                  <div className="branched-menu__tree" style={{ height: bodyH }}>
                    <svg
                      className="branched-menu__lines"
                      width={INDENT}
                      height={bodyH}
                      aria-hidden
                    >
                      <path
                        className="branched-menu__base"
                        d={`M ${TRUNK} 0 V ${rowY(kids.length - 1) - r}`}
                      />
                      {kids.map((kid, k) => (
                        <path
                          key={`${kid.value}-b`}
                          className="branched-menu__base"
                          d={branch(k)}
                        />
                      ))}
                      {kids.map((kid, k) => (
                        <path
                          key={`${kid.value}-r`}
                          className="branched-menu__reach"
                          d={reach(k)}
                          style={{
                            strokeDasharray: length(k),
                            strokeDashoffset:
                              kid.value === active ? 0 : length(k),
                          }}
                        />
                      ))}
                    </svg>
                    {kids.map((kid) => {
                      const content = (
                        <>
                          {kid.icon ? (
                            <span className="branched-menu__icon" aria-hidden>
                              {renderIcon(kid.icon)}
                            </span>
                          ) : null}
                          <span className="branched-menu__label">
                            {kid.label}
                          </span>
                          {kid.badge && kid.badge > 0 ? (
                            <span className="branched-menu__badge">
                              {kid.badge}
                            </span>
                          ) : null}
                        </>
                      );
                      const activeLeaf = kid.value === active;
                      if (kid.href) {
                        return (
                          <Link
                            key={kid.value}
                            href={kid.href}
                            className="branched-menu__item"
                            aria-current={activeLeaf ? "page" : undefined}
                            data-active={activeLeaf ? "" : undefined}
                            tabIndex={isOpen ? 0 : -1}
                            onClick={() => select(kid.value, kid)}
                          >
                            {content}
                          </Link>
                        );
                      }
                      return (
                        <button
                          key={kid.value}
                          type="button"
                          className="branched-menu__item"
                          aria-current={activeLeaf ? "true" : undefined}
                          data-active={activeLeaf ? "" : undefined}
                          tabIndex={isOpen ? 0 : -1}
                          onClick={() => select(kid.value, kid)}
                        >
                          {content}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
