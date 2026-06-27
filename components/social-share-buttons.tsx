"use client";

import { useState } from "react";
import { Check, Copy, Facebook, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/button";
import type { CustomerLanguage } from "@/lib/customer-language";

export function SocialShareButtons({
  path,
  title,
  variant = "light",
  language = "de"
}: {
  path: string;
  title: string;
  variant?: "light" | "card";
  language?: CustomerLanguage;
}) {
  const [copied, setCopied] = useState(false);
  const copy =
    language === "hu"
      ? {
          shareSuffix: "galéria",
          shareText: "Nézd meg a galériánkat.",
          share: "Megosztás",
          copied: "Másolva"
        }
      : {
          shareSuffix: "Galerie",
          shareText: "Schau dir unsere Hochzeitsgalerie an.",
          share: "Teilen",
          copied: "Kopiert"
        };
  const shareText = `${title} ${copy.shareSuffix}`;
  const buttonClass = variant === "light" ? "border-white/25 bg-white/15 text-white hover:bg-white/25" : "";

  function getShareUrl() {
    return new URL(path, window.location.origin).toString();
  }

  async function copyLink() {
    try {
      await window.navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({
        title: shareText,
        text: copy.shareText,
        url: getShareUrl()
      });
    } catch {
      // Closing the share sheet is not an error from the visitor's perspective.
    }
  }

  function openShareWindow(url: string) {
    window.open(url, "_blank", "noopener,noreferrer,width=720,height=640");
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button type="button" variant={variant === "light" ? "secondary" : "primary"} onClick={nativeShare} className={buttonClass}>
        <Share2 size={16} />
        {copy.share}
      </Button>
      <button
        type="button"
        onClick={() => openShareWindow(`https://wa.me/?text=${encodeURIComponent(`${shareText}: ${getShareUrl()}`)}`)}
        className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition ${
          variant === "light" ? "border-white/25 bg-white/15 text-white hover:bg-white/25" : "border-ink/15 bg-white text-ink hover:border-ink/30"
        }`}
      >
        <MessageCircle size={16} />
        WhatsApp
      </button>
      <button
        type="button"
        onClick={() => openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`)}
        className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition ${
          variant === "light" ? "border-white/25 bg-white/15 text-white hover:bg-white/25" : "border-ink/15 bg-white text-ink hover:border-ink/30"
        }`}
      >
        <Facebook size={16} />
        Facebook
      </button>
      <Button type="button" variant="secondary" onClick={copyLink} className={buttonClass}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? copy.copied : "Link"}
      </Button>
    </div>
  );
}
