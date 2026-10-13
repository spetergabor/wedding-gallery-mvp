"use client";

import { useEffect } from "react";

const POPUP_STORAGE_KEY = "spetly:mini-session-confirmation-popup";

const POPUP_COPY = {
  hu: {
    title: "Foglalás feldolgozása",
    text: "A foglalásodat feldolgozzuk. A visszaigazolás hamarosan megjelenik ezen a lapon."
  },
  de: {
    title: "Buchung wird verarbeitet",
    text: "Deine Buchung wird verarbeitet. Die Bestätigung erscheint gleich auf dieser Seite."
  }
} as const;

type MiniSessionPopupLanguage = keyof typeof POPUP_COPY;

function storedPopupName() {
  try {
    return window.sessionStorage.getItem(POPUP_STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearStoredPopupName() {
  try {
    window.sessionStorage.removeItem(POPUP_STORAGE_KEY);
  } catch {
    // The booking still completes when session storage is unavailable.
  }
}

export function prepareMiniSessionConfirmationPopup(language: MiniSessionPopupLanguage) {
  const existingName = storedPopupName();

  if (existingName) {
    window.open("", existingName)?.focus();
    return;
  }

  const popupName = `spetly-booking-confirmation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const popup = window.open("about:blank", popupName);

  if (!popup) {
    return;
  }

  try {
    window.sessionStorage.setItem(POPUP_STORAGE_KEY, popupName);
  } catch {
    popup.close();
    return;
  }

  const copy = POPUP_COPY[language];
  popup.document.title = copy.title;
  popup.document.documentElement.lang = language;
  popup.document.body.style.cssText =
    "margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f1ea;color:#171a18;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";

  const panel = popup.document.createElement("main");
  panel.style.cssText =
    "box-sizing:border-box;width:min(560px,calc(100% - 32px));padding:32px;border:1px solid rgba(23,26,24,.12);border-radius:18px;background:#fff;box-shadow:0 18px 50px rgba(23,26,24,.12);text-align:center;";

  const title = popup.document.createElement("h1");
  title.textContent = copy.title;
  title.style.cssText = "margin:0;font-size:28px;line-height:1.2;";

  const text = popup.document.createElement("p");
  text.textContent = copy.text;
  text.style.cssText = "margin:14px 0 0;color:rgba(23,26,24,.7);font-size:16px;line-height:1.6;";

  panel.append(title, text);
  popup.document.body.replaceChildren(panel);
  popup.focus();
}

export function MiniSessionEmbedConfirmationPopup({
  confirmationHref,
  hasError,
  embeddedOnly = false
}: {
  confirmationHref?: string | null;
  hasError?: boolean;
  embeddedOnly?: boolean;
}) {
  useEffect(() => {
    const popupName = storedPopupName();

    if (!popupName) {
      return;
    }

    if (confirmationHref) {
      if (embeddedOnly && window.self === window.top) {
        clearStoredPopupName();
        return;
      }

      const popup = window.open(confirmationHref, popupName);
      popup?.focus();
      clearStoredPopupName();
      return;
    }

    if (hasError) {
      window.open("", popupName)?.close();
      clearStoredPopupName();
    }
  }, [confirmationHref, embeddedOnly, hasError]);

  return null;
}
