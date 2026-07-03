"use client";

import { useEffect, useRef, useState } from "react";
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
  const [isOpen, setIsOpen] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const copy =
    language === "hu"
      ? {
          shareSuffix: "galéria",
          shareText: "Nézd meg a galériánkat.",
          share: "Megosztás",
          system: "Rendszer megosztás",
          whatsapp: "WhatsApp",
          facebook: "Facebook",
          link: "Link",
          copied: "Másolva"
        }
      : {
          shareSuffix: "Galerie",
          shareText: "Schau dir unsere Hochzeitsgalerie an.",
          share: "Teilen",
          system: "System teilen",
          whatsapp: "WhatsApp",
          facebook: "Facebook",
          link: "Link",
          copied: "Kopiert"
        };
  const shareText = `${title} ${copy.shareSuffix}`;
  const buttonClass = variant === "light" ? "border-white/25 bg-white/15 text-white hover:bg-white/25" : "";
  const menuClass =
    variant === "light"
      ? "border-white/25 bg-white/95 text-ink shadow-soft"
      : "border-ink/10 bg-white text-ink shadow-soft";

  useEffect(() => {
    setCanNativeShare(Boolean(navigator.share));
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("pointerdown", handlePointerDown);
    }

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  function getShareUrl() {
    return new URL(path, window.location.origin).toString();
  }

  async function copyLink() {
    try {
      await window.navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      setIsOpen(false);
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

    setIsOpen(false);

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
    setIsOpen(false);
  }

  return (
    <div ref={menuRef} className="relative inline-flex justify-center">
      <Button
        type="button"
        variant={variant === "light" ? "secondary" : "primary"}
        onClick={() => setIsOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={buttonClass}
      >
        <Share2 size={16} />
        {copy.share}
      </Button>
      {isOpen ? (
        <div
          role="menu"
          className={`absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 overflow-hidden rounded-lg border p-1 ${menuClass}`}
        >
          {canNativeShare ? (
            <button
              type="button"
              role="menuitem"
              onClick={nativeShare}
              className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-medium transition hover:bg-ink/5"
            >
              <Share2 size={16} />
              {copy.system}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => openShareWindow(`https://wa.me/?text=${encodeURIComponent(`${shareText}: ${getShareUrl()}`)}`)}
            className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-medium transition hover:bg-ink/5"
          >
            <MessageCircle size={16} />
            {copy.whatsapp}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`)}
            className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-medium transition hover:bg-ink/5"
          >
            <Facebook size={16} />
            {copy.facebook}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={copyLink}
            className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-medium transition hover:bg-ink/5"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? copy.copied : copy.link}
          </button>
        </div>
      ) : null}
    </div>
  );
}
