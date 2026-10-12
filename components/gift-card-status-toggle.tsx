"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { updateGiftCardOrderStatus } from "@/lib/gift-card-order-actions";

type EditableStatusField = "delivered" | "paid" | "photographed";

type GiftCardStatusToggleProps = {
  orderId: string;
  field: EditableStatusField;
  checked: boolean;
  activeLabel: string;
  inactiveLabel: string;
  errorLabel: string;
};

export function GiftCardStatusToggle({
  orderId,
  field,
  checked,
  activeLabel,
  inactiveLabel,
  errorLabel
}: GiftCardStatusToggleProps) {
  const router = useRouter();
  const [value, setValue] = useState(checked);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => setValue(checked), [checked]);

  function toggle() {
    if (pending) return;
    const nextValue = !value;
    setValue(nextValue);
    setError(false);

    startTransition(async () => {
      try {
        const result = await updateGiftCardOrderStatus({ orderId, field, value: nextValue });
        if (!result.ok) {
          setValue(!nextValue);
          setError(true);
          return;
        }
        router.refresh();
      } catch {
        setValue(!nextValue);
        setError(true);
      }
    });
  }

  const label = value ? activeLabel : inactiveLabel;

  return (
    <div className="flex min-w-[7.5rem] flex-col items-start gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={pending}
        onClick={toggle}
        className={`inline-flex min-h-8 items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:cursor-wait disabled:opacity-75 ${
          value
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-ink/15 bg-white text-graphite/65 hover:border-ink/30 hover:bg-canvas"
        }`}
      >
        <span
          className={`grid size-4 shrink-0 place-items-center rounded border ${
            value ? "border-emerald-600 bg-emerald-600 text-white" : "border-ink/25 bg-white"
          }`}
          aria-hidden="true"
        >
          {pending ? <LoaderCircle size={11} className="animate-spin" /> : value ? <Check size={11} strokeWidth={3} /> : null}
        </span>
        <span>{label}</span>
      </button>
      {error ? <span className="text-[11px] text-red-600">{errorLabel}</span> : null}
    </div>
  );
}
