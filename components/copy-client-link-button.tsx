"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/button";

export function CopyClientLinkButton({
  slug,
  token,
  url,
  label = "Privát kezelő link másolása",
  variant = "secondary",
  className
}: {
  slug: string;
  token: string;
  url?: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const clientUrl = url ?? (() => {
      const fallbackUrl = new URL(`/client/${slug}`, window.location.origin);
      fallbackUrl.searchParams.set("token", token);
      return fallbackUrl.toString();
    })();

    try {
      await window.navigator.clipboard.writeText(clientUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant={variant} className={className} onClick={handleCopy}>
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? "Másolva" : label}
    </Button>
  );
}
