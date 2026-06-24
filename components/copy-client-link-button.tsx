"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/button";

export function CopyClientLinkButton({
  slug,
  token,
  label = "Privát kezelő link másolása"
}: {
  slug: string;
  token: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const clientUrl = new URL(`/client/${slug}`, window.location.origin);
    clientUrl.searchParams.set("token", token);

    try {
      await window.navigator.clipboard.writeText(clientUrl.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={handleCopy}>
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? "Másolva" : label}
    </Button>
  );
}
