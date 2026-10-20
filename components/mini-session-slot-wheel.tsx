"use client";

import { useEffect, useRef } from "react";

const SLOT_ROW_HEIGHT = 56;
const VISIBLE_SLOT_ROWS = 5;
const WHEEL_HEIGHT = SLOT_ROW_HEIGHT * VISIBLE_SLOT_ROWS;
const WHEEL_PADDING = (WHEEL_HEIGHT - SLOT_ROW_HEIGHT) / 2;

type MiniSessionSlotWheelItem = {
  token: string;
  label: string;
};

export function MiniSessionSlotWheel({
  ariaLabel,
  onChange,
  slots,
  value
}: {
  ariaLabel: string;
  onChange: (token: string) => void;
  slots: MiniSessionSlotWheelItem[];
  value: string;
}) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const initialValueRef = useRef(value);

  useEffect(() => {
    const selectedIndex = Math.max(0, slots.findIndex((slot) => slot.token === initialValueRef.current));

    if (wheelRef.current) {
      wheelRef.current.scrollTop = selectedIndex * SLOT_ROW_HEIGHT;
    }
  }, [slots]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  function selectIndex(index: number, behavior: ScrollBehavior = "smooth") {
    const boundedIndex = Math.max(0, Math.min(slots.length - 1, index));
    const slot = slots[boundedIndex];

    if (!slot) {
      return;
    }

    onChange(slot.token);
    wheelRef.current?.scrollTo({ top: boundedIndex * SLOT_ROW_HEIGHT, behavior });
  }

  function handleScroll() {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      const wheel = wheelRef.current;

      if (!wheel) {
        return;
      }

      const selectedIndex = Math.max(0, Math.min(slots.length - 1, Math.round(wheel.scrollTop / SLOT_ROW_HEIGHT)));
      const slot = slots[selectedIndex];

      if (slot && slot.token !== value) {
        onChange(slot.token);
      }
    });
  }

  const selectedIndex = Math.max(0, slots.findIndex((slot) => slot.token === value));

  return (
    <div className="relative mx-auto w-full max-w-xs overflow-hidden rounded-xl border border-ink/10 bg-paper shadow-inner">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 top-1/2 z-0 h-14 -translate-y-1/2 rounded-lg border border-ink/10 bg-white/90 shadow-sm"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-paper via-paper/90 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-paper via-paper/90 to-transparent" />
      <div
        ref={wheelRef}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={`mini-session-wheel-slot-${selectedIndex}`}
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            selectIndex(selectedIndex + 1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            selectIndex(selectedIndex - 1);
          } else if (event.key === "Home") {
            event.preventDefault();
            selectIndex(0);
          } else if (event.key === "End") {
            event.preventDefault();
            selectIndex(slots.length - 1);
          }
        }}
        className="relative z-10 touch-pan-y snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/30 [&::-webkit-scrollbar]:hidden"
        style={{ height: WHEEL_HEIGHT, paddingBlock: WHEEL_PADDING }}
      >
        {slots.map((slot, index) => {
          const isSelected = slot.token === value;

          return (
            <button
              id={`mini-session-wheel-slot-${index}`}
              key={slot.token}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => selectIndex(index)}
              className={`flex w-full snap-center items-center justify-center px-6 text-center tabular-nums transition-all duration-200 ${
                isSelected
                  ? "scale-105 text-lg font-semibold text-ink"
                  : "scale-95 text-base font-medium text-graphite/45"
              }`}
              style={{ height: SLOT_ROW_HEIGHT }}
            >
              {slot.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
