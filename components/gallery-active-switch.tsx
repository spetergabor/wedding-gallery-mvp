"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

export function GalleryActiveSwitch({
  initialIsActive,
  title
}: {
  initialIsActive: boolean;
  title: string;
}) {
  const { pending } = useFormStatus();
  const [isActive, setIsActive] = useState(initialIsActive);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsActive(initialIsActive);
    setIsSubmitting(false);
  }, [initialIsActive]);

  return (
    <button
      type="submit"
      role="switch"
      aria-checked={isActive}
      aria-label={isActive ? `${title} kikapcsolása` : `${title} aktiválása`}
      disabled={pending || isSubmitting}
      onClick={(event) => {
        event.preventDefault();
        if (pending || isSubmitting) {
          return;
        }

        const form = event.currentTarget.form;
        setIsActive((current) => !current);
        setIsSubmitting(true);
        window.setTimeout(() => form?.requestSubmit(), 160);
      }}
      className={`group relative inline-flex h-8 w-20 items-center rounded-full border px-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 disabled:cursor-wait disabled:opacity-90 ${
        isActive
          ? "border-sage/30 bg-sage text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] hover:bg-sage/95"
          : "border-ink/10 bg-ink/5 text-graphite/55 hover:bg-ink/10"
      }`}
    >
      <span
        className={`absolute left-3.5 transition-opacity duration-200 ${isActive ? "opacity-90" : "opacity-0"}`}
        aria-hidden="true"
      >
        ON
      </span>
      <span
        className={`absolute right-3.5 transition-opacity duration-200 ${isActive ? "opacity-0" : "opacity-70"}`}
        aria-hidden="true"
      >
        OFF
      </span>
      <span
        className={`absolute left-1 top-1 size-6 rounded-full bg-white shadow-[0_2px_8px_rgba(25,25,25,0.18)] transition-transform duration-300 ease-out ${
          isActive ? "translate-x-12" : "translate-x-0"
        }`}
        aria-hidden="true"
      />
    </button>
  );
}
