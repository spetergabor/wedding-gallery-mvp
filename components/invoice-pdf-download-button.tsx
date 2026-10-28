"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";

type Props = {
  invoiceId: string;
  filename: string;
  label?: string;
  className?: string;
};

export function InvoicePdfDownloadButton({ invoiceId, filename, label = "PDF", className = "" }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function download() {
    if (state === "loading") return;
    setState("loading");
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/pdf`, {
        credentials: "same-origin",
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`PDF download failed (${response.status})`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
      setState("idle");
    } catch (error) {
      console.error(error);
      setState("error");
      window.setTimeout(() => setState("idle"), 4_000);
    }
  }

  return (
    <button type="button" onClick={download} disabled={state === "loading"} className={className}>
      {state === "loading" ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
      {state === "error" ? "A PDF letöltése nem sikerült" : state === "loading" ? "PDF készítése…" : label}
    </button>
  );
}
