"use client";

import type { GalleryEmailCover } from "@/lib/gallery-email-cover";
import { useEffect, useState } from "react";
import { ExternalLink, Mail, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { GalleryEmailEditor } from "@/components/gallery-email-editor";
import { galleryEmailRecipient } from "@/lib/gallery-email-recipient";
import { galleryEmailCta } from "@/lib/gallery-email-template";
import type { CustomerLanguage } from "@/lib/customer-language";
import { sendFinalDeliveryEmailDraftAction, sendProofingInviteDraftAction } from "@/lib/gallery-actions";

type ProofingInviteComposerProps = {
  kind?: "proofing" | "final";
  galleryTitle: string;
  language?: CustomerLanguage;
  cover?: GalleryEmailCover | null;
  galleryId: string;
  recipient: string | null;
  senderName: string;
  replyTo: string;
  galleryUrl: string;
  defaultSubject: string;
  defaultMessage: string;
  autoOpen?: boolean;
  alreadySent?: boolean;
  showTrigger?: boolean;
};

export function ProofingInviteComposer({
  kind = "proofing",
  galleryTitle,
  language,
  cover,
  galleryId,
  recipient,
  senderName,
  replyTo,
  galleryUrl,
  defaultSubject,
  defaultMessage,
  autoOpen = false,
  alreadySent = false,
  showTrigger = true
}: ProofingInviteComposerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [recipientEmail, setRecipientEmail] = useState(recipient ?? "");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSending) {
        setIsOpen(false);
        clearPromptFlag();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSending]);

  const promptFlag = kind === "final" ? "finalDeliveryPrompt" : "proofingInvitePrompt";

  function clearPromptFlag() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(promptFlag)) {
      return;
    }

    url.searchParams.delete(promptFlag);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function openComposer() {
    setError("");
    setIsOpen(true);
  }

  function closeComposer() {
    if (isSending) {
      return;
    }

    setIsOpen(false);
    setError("");
    clearPromptFlag();
  }

  async function sendEmail() {
    if (isSending) {
      return;
    }

    if (!galleryEmailRecipient(recipientEmail)) {
      setError("Adj meg egy érvényes címzett e-mail-címet.");
      return;
    }

    if (!subject.trim() || !message.trim()) {
      setError("A tárgy és az üzenet nem lehet üres.");
      return;
    }

    setIsSending(true);
    setError("");

    try {
      const result = await (kind === "final" ? sendFinalDeliveryEmailDraftAction : sendProofingInviteDraftAction)(galleryId, { subject, message, recipient: recipientEmail });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setIsOpen(false);
      clearPromptFlag();
      router.push(`/admin/galleries/${galleryId}?tab=activity&${kind === "final" ? "deliveryEmail" : "proofingInvite"}=sent`);
      router.refresh();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Az e-mail küldése nem sikerült.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      {showTrigger ? (
        <Button type="button" variant="secondary" onClick={openComposer}>
          <Mail size={16} />
          {kind === "final" ? (alreadySent ? "Átadó e-mail szerkesztése és újraküldése" : "Átadó e-mail szerkesztése") : (alreadySent ? "Válogató e-mail újraküldése" : "Válogató e-mail küldése")}
        </Button>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation" onMouseDown={closeComposer}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`gallery-email-title-${kind}`}
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-2xl sm:max-w-6xl sm:rounded-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-brass">{kind === "final" ? "Átadó e-mail" : "Válogató e-mail"}</p>
                <h2 id={`gallery-email-title-${kind}`} className="mt-2 text-xl font-semibold text-ink">Mehet az e-mail az ügyfélnek?</h2>
                <p className="mt-1 text-sm leading-6 text-graphite/70">
                  Szerkeszd a levelet, és ellenőrizd az élő előnézetet. Csak az E-mail küldése gombbal megy ki.
                </p>
              </div>
              <button
                type="button"
                aria-label="Ablak bezárása"
                disabled={isSending}
                onClick={closeComposer}
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-graphite transition hover:bg-ink/5 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-6">
              <div className="rounded-md border border-ink/10 bg-paper px-4 py-3">
                <label className="block text-sm font-medium text-ink">Címzett e-mail-címe
                  <input type="email" name="recipient" value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} disabled={isSending} maxLength={254} autoComplete="email" placeholder="nev@pelda.hu" className="mt-2 h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-sm" />
                </label>
                <p className="mt-2 text-xs leading-5 text-graphite/60">Ehhez a küldéshez szabadon átírhatod. Az ügyfél és a galéria mentett e-mail-címe nem változik.</p>
              </div>

              <div className="text-sm leading-6 text-graphite/70">
                <p>Feladó neve: <span className="font-medium text-ink">{senderName}</span></p>
                <p>Válaszok ide érkeznek: <span className="break-all font-medium text-ink">{replyTo}</span></p>
              </div>

              <GalleryEmailEditor subject={subject} message={message} onSubjectChange={setSubject} onMessageChange={setMessage} disabled={isSending} preview={{ galleryTitle, senderName, replyTo, url: galleryUrl, language, cover, cta: galleryEmailCta(kind, language) }} />

              <a href={galleryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-graphite underline-offset-4 hover:text-ink hover:underline">
                <ExternalLink size={15} />
                Galérialink ellenőrzése
              </a>

              {error ? (
                <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-ink/10 bg-paper px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Button type="button" variant="ghost" disabled={isSending} onClick={closeComposer}>
                Most nem küldöm
              </Button>
              <Button type="button" disabled={isSending || !recipientEmail.trim()} onClick={() => void sendEmail()}>
                <Send size={16} />
                {isSending ? "Küldés..." : "E-mail küldése"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
