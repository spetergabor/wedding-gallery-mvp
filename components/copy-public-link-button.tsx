"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/button";

export function CopyPublicLinkButton({
  slug,
  url,
  label = "Publikus link másolása",
  variant = "secondary",
  className
}: {
  slug: string;
  url?: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const publicUrl = url ?? new URL(`/g/${slug}`, window.location.origin).toString();

    try {
      await window.navigator.clipboard.writeText(publicUrl);
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
