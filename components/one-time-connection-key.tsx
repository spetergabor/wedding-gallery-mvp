"use client";

import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function OneTimeConnectionKey({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  function legacyCopy() {
    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    const wasCopied = document.execCommand("copy");
    textArea.remove();

    if (!wasCopied) {
      throw new Error("Clipboard copy failed.");
    }
  }

  async function copyKey() {
    try {
      if (window.navigator.clipboard?.writeText) {
        try {
          await window.navigator.clipboard.writeText(value);
        } catch {
          legacyCopy();
        }
      } else {
        legacyCopy();
      }

      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <input
            type={isVisible ? "text" : "password"}
            readOnly
            value={value}
            aria-label="Egyszer használható irismoment kapcsolódási kulcs"
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 pr-11 font-mono text-sm text-ink"
          />
          <button
            type="button"
            onClick={() => setIsVisible((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-graphite/60 transition hover:text-ink focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brass/40"
            aria-label={isVisible ? "Kulcs elrejtése" : "Kulcs megjelenítése"}
            title={isVisible ? "Kulcs elrejtése" : "Kulcs megjelenítése"}
          >
            {isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <button
          type="button"
          onClick={copyKey}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-ink/90 focus:outline-none focus:ring-2 focus:ring-brass/50"
          aria-live="polite"
        >
          {copied ? <Check size={17} /> : <Copy size={17} />}
          {copied ? "Másolva" : "Kulcs másolása"}
        </button>
      </div>
      {copyFailed ? (
        <p className="mt-2 text-xs font-medium text-red-700">
          Az automatikus másolás nem sikerült. Jelenítsd meg a kulcsot, majd jelöld ki és másold ki kézzel.
        </p>
      ) : null}
    </div>
  );
}
