"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Camera, CheckCircle2, Heart, Mail, Plus, Upload, X } from "lucide-react";
import type { CustomerWorkflowIconKey } from "@/lib/customer-workflow";

const workflowIconMap: Record<CustomerWorkflowIconKey, typeof Camera> = {
  camera: Camera,
  check: CheckCircle2,
  heart: Heart,
  mail: Mail,
  plus: Plus,
  upload: Upload
};

type DismissibleNextActionProps = {
  customerId: string;
  title: string;
  description: string;
  buttonLabel: string;
  href: string;
  iconKey: CustomerWorkflowIconKey;
};

export function DismissibleNextAction({
  customerId,
  title,
  description,
  buttonLabel,
  href,
  iconKey
}: DismissibleNextActionProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const storageKey = useMemo(() => `speter-next-action:${customerId}:${href}:${title}`, [customerId, href, title]);
  const NextActionIcon = workflowIconMap[iconKey] ?? Camera;

  useEffect(() => {
    setIsDismissed(window.localStorage.getItem(storageKey) === "dismissed");
  }, [storageKey]);

  function dismiss() {
    window.localStorage.setItem(storageKey, "dismissed");
    setIsDismissed(true);
  }

  if (isDismissed) {
    return null;
  }

  return (
    <section className="mb-6 rounded-lg border border-brass/25 bg-brass/10 p-5 shadow-soft">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white text-brass shadow-sm">
            <NextActionIcon size={20} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brass">Következő teendő</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-graphite/75">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={href} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite">
            {buttonLabel}
            <ArrowRight size={16} />
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Következő teendő bezárása"
            className="inline-flex size-11 items-center justify-center rounded-md border border-ink/10 bg-white text-graphite transition hover:border-ink/25 hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
