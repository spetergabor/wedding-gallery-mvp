"use client";

import { useEffect, useRef } from "react";
import { ShieldCheck } from "lucide-react";

export function AutoAuthorizeIrismomentDevice({
  action
}: {
  action: () => void | Promise<void>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (submitted.current) return;
      submitted.current = true;
      form.current?.requestSubmit();
    }, 150);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <form ref={form} action={action} className="mt-6">
      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/90"
      >
        <ShieldCheck size={16} /> Kapcsolódás az irismomenthez
      </button>
      <p className="mt-2 text-xs text-graphite/60">
        A kapcsolat automatikusan létrejön. Ha nem indul el, kattints a gombra.
      </p>
    </form>
  );
}
