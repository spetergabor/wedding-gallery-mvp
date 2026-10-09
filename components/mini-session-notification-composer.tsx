"use client";

import { GalleryEmailEditor, type GalleryEmailPreview } from "@/components/gallery-email-editor";
import { useEffect, useState } from "react";
import { ExternalLink, Mail, Send, X } from "lucide-react";
import { Button } from "@/components/button";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  deliverMiniSessionFinalGalleryAction,
  sendMiniSessionWorkflowNotificationAction
} from "@/lib/mini-session-actions";

type NotificationKind = "shoot_completed" | "post_production" | "final_delivery";

export function MiniSessionNotificationComposer({
  galleryPreview,
  bookingId,
  kind,
  recipient,
  previewUrl,
  defaultSubject,
  defaultMessage,
  triggerLabel,
  autoOpen = false
}: {
  galleryPreview?: GalleryEmailPreview;
  bookingId: string;
  kind: NotificationKind;
  recipient: string;
  previewUrl: string;
  defaultSubject: string;
  defaultMessage: string;
  triggerLabel: string;
  autoOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [recipientEmail, setRecipientEmail] = useState(recipient);
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeComposer();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSending]);

  function clearPromptFlag() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("notify")) return;
    url.searchParams.delete("notify");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function openComposer() {
    setIsOpen(true);
  }

  function closeComposer() {
    if (isSending) return;
    setIsOpen(false);
    clearPromptFlag();
  }

  const action = kind === "final_delivery"
    ? deliverMiniSessionFinalGalleryAction.bind(null, bookingId)
    : sendMiniSessionWorkflowNotificationAction.bind(null, bookingId, kind);

  return (
    <>
      <Button type="button" variant={kind === "final_delivery" ? "primary" : "secondary"} onClick={openComposer}>
        <Mail size={16} />
        {triggerLabel}
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation" onMouseDown={closeComposer}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`mini-session-email-${kind}`}
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-2xl sm:max-w-6xl sm:rounded-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-brass">Resend ügyfélértesítés</p>
                <h2 id={`mini-session-email-${kind}`} className="mt-2 text-xl font-semibold text-ink">
                  {kind === "final_delivery" ? "Mehet a kész galéria az ügyfélnek?" : "Értesíted az ügyfelet erről a lépésről?"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-graphite/70">Küldés előtt szabadon átírhatod a tárgyat és az üzenetet. Bezáráskor nem küldünk semmit.</p>
              </div>
              <button type="button" disabled={isSending} aria-label="Ablak bezárása" onClick={closeComposer} className="flex size-10 shrink-0 items-center justify-center rounded-full text-graphite transition hover:bg-ink/5">
                <X size={19} />
              </button>
            </div>

            <form action={action} onSubmit={() => setIsSending(true)} onKeyDown={event => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault(); }}>
              <div inert={isSending} className="space-y-5 px-5 py-5 sm:px-6">
                <div className="rounded-md border border-ink/10 bg-paper px-4 py-3">
                  {kind === "final_delivery" ? <>
                    <label className="block text-sm font-medium text-ink">Címzett e-mail-címe
                      <input name="recipient" type="email" required value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} maxLength={254} autoComplete="email" className="mt-2 h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-sm" />
                    </label>
                    <p className="mt-2 text-xs leading-5 text-graphite/60">Csak ennél a küldésnél használjuk ezt a címet. Az ügyfél mentett adatai nem változnak.</p>
                  </> : <><p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/60">Címzett</p><p className="mt-1 break-all text-sm font-medium text-ink">{recipient}</p></>}
                </div>

                {kind === "final_delivery" && galleryPreview ? <GalleryEmailEditor subject={subject} message={message} onSubjectChange={setSubject} onMessageChange={setMessage} preview={galleryPreview} /> : <>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">Tárgy</span>
                  <input name="subject" required maxLength={200} defaultValue={defaultSubject} className="h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50" />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">Üzenet</span>
                  <textarea name="message" required maxLength={5000} rows={8} defaultValue={defaultMessage} className="w-full resize-y rounded-md border border-ink/15 bg-white px-3 py-3 text-sm leading-6 text-ink outline-none transition focus:border-ink/50" />
                  <span className="block text-xs leading-5 text-graphite/60">A gomb és a biztonságos ügyféllink automatikusan a levélben marad.</span>
                </label>

                </>}
                <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-graphite underline-offset-4 hover:text-ink hover:underline">
                  <ExternalLink size={15} />
                  A levélben szereplő oldal ellenőrzése
                </a>
              </div>

              <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-ink/10 bg-paper px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Button type="button" variant="ghost" disabled={isSending} onClick={closeComposer}>Most nem küldöm</Button>
                <FormSubmitButton pendingLabel="Küldés...">
                  <Send size={16} />
                  {kind === "final_delivery" ? "E-mail küldése és átadás" : "E-mail küldése"}
                </FormSubmitButton>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
