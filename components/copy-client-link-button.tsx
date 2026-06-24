"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/button";
import type { CustomerLanguage } from "@/lib/customer-language";

export function CopyClientLinkButton({
  slug,
  token,
  lang
}: {
  slug: string;
  token: string;
  lang?: CustomerLanguage;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const clientUrl = new URL(`/client/${slug}`, window.location.origin);
    clientUrl.searchParams.set("token", token);
    if (lang) {
      clientUrl.searchParams.set("lang", lang);
    }

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
      {copied ? "Másolva" : "Ügyfél kezelő link másolása"}
    </Button>
  );
}
