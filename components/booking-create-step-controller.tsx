"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type BookingCreateStepControllerProps = {
  children: ReactNode;
  submitLabel: string;
};

const steps = [
  "Alapadatok",
  "Időpontok",
  "Landing page",
  "Mentés"
];

function StepSubmitButton({ submitLabel }: { submitLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
    >
      <Check size={15} />
      {pending ? "Mentés..." : submitLabel}
    </button>
  );
}

export function BookingCreateStepController({ children, submitLabel }: BookingCreateStepControllerProps) {
  const [activeStep, setActiveStep] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === steps.length - 1;

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    root.querySelectorAll<HTMLElement>("[data-booking-create-step-panel]").forEach((panel, index) => {
      const isActive = index === activeStep;

      panel.hidden = !isActive;
      panel.setAttribute("aria-hidden", String(!isActive));
    });
  }, [activeStep]);

  return (
    <div ref={rootRef} className="space-y-5">
      <nav className="grid gap-2 md:grid-cols-4" aria-label="Létrehozás lépései">
        {steps.map((step, index) => {
          const isActive = index === activeStep;
          const isDone = index < activeStep;

          return (
            <button
              key={step}
              type="button"
              onClick={() => setActiveStep(index)}
              aria-current={isActive ? "step" : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-md border px-3 text-left text-sm font-medium transition ${
                isActive
                  ? "border-ink bg-ink text-white shadow-sm"
                  : isDone
                    ? "border-sage/25 bg-sage/10 text-sage hover:border-sage/40"
                    : "border-ink/10 bg-white text-graphite hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                isActive ? "bg-white text-ink" : isDone ? "bg-sage text-white" : "bg-paper text-graphite"
              }`}>
                {isDone ? <Check size={13} /> : index + 1}
              </span>
              <span className="truncate">{step}</span>
            </button>
          );
        })}
      </nav>

      <div>
        {children}
      </div>

      <div className="flex flex-col justify-between gap-3 border-t border-ink/10 pt-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
          disabled={isFirstStep}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-ink/10 px-4 text-sm font-medium text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          <ArrowLeft size={15} />
          Vissza
        </button>

        {isLastStep ? (
          <StepSubmitButton submitLabel={submitLabel} />
        ) : (
          <button
            type="button"
            onClick={() => setActiveStep((step) => Math.min(steps.length - 1, step + 1))}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite sm:w-auto"
          >
            Tovább
            <ArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
