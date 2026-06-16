"use client";

import { useState } from "react";
import { Check, Copy, Facebook, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/button";

export function SocialShareButtons({
  path,
  title,
  variant = "light"
}: {
  path: string;
  title: string;
  variant?: "light" | "card";
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();
  const shareText = `${title} galéria`;
  const buttonClass = variant === "light" ? "border-white/25 bg-white/15 text-white hover:bg-white/25" : "";

  async function copyLink() {
    try {
      await window.navigator.clipboard.writeText(shareUrl);
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
        text: "Nézd meg az esküvői galériánkat.",
        url: shareUrl
      });
    } catch {
      // A share sheet bezárása nem hiba a felhasználó szempontjából.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant={variant === "light" ? "secondary" : "primary"} onClick={nativeShare} className={buttonClass}>
        <Share2 size={16} />
        Megosztás
      </Button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${shareText}: ${shareUrl}`)}`}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition ${
          variant === "light" ? "border-white/25 bg-white/15 text-white hover:bg-white/25" : "border-ink/15 bg-white text-ink hover:border-ink/30"
        }`}
      >
        <MessageCircle size={16} />
        WhatsApp
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition ${
          variant === "light" ? "border-white/25 bg-white/15 text-white hover:bg-white/25" : "border-ink/15 bg-white text-ink hover:border-ink/30"
        }`}
      >
        <Facebook size={16} />
        Facebook
      </a>
      <Button type="button" variant="secondary" onClick={copyLink} className={buttonClass}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Másolva" : "Link"}
      </Button>
    </div>
  );
}
