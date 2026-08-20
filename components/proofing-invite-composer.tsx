"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Mail, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { sendProofingInviteDraftAction } from "@/lib/gallery-actions";

type ProofingInviteComposerProps = {
  galleryId: string;
  recipient: string | null;
  galleryUrl: string;
  defaultSubject: string;
  defaultMessage: string;
  autoOpen?: boolean;
  alreadySent?: boolean;
  showTrigger?: boolean;
};

export function ProofingInviteComposer({
  galleryId,
  recipient,
  galleryUrl,
  defaultSubject,
  defaultMessage,
  autoOpen = false,
  alreadySent = false,
  showTrigger = true
}: ProofingInviteComposerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(autoOpen);
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

  function clearPromptFlag() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("proofingInvitePrompt")) {
      return;
    }

    url.searchParams.delete("proofingInvitePrompt");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function openComposer() {
    setSubject(defaultSubject);
    setMessage(defaultMessage);
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

    if (!recipient) {
      setError("Hiányzik az ügyfél e-mail címe. Add meg a galéria beállításaiban, majd próbáld újra.");
      return;
    }

    if (!subject.trim() || !message.trim()) {
      setError("A tárgy és az üzenet nem lehet üres.");
      return;
    }

    setIsSending(true);
    setError("");

    try {
      const result = await sendProofingInviteDraftAction(galleryId, { subject, message });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setIsOpen(false);
      clearPromptFlag();
      router.push(`/admin/galleries/${galleryId}?tab=activity&proofingInvite=sent`);
      router.refresh();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "A válogató e-mail küldése nem sikerült.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      {showTrigger ? (
        <Button type="button" variant="secondary" disabled={!recipient} onClick={openComposer} className={!recipient ? "opacity-60" : ""}>
          <Mail size={16} />
          {alreadySent ? "Válogató e-mail újraküldése" : "Válogató e-mail küldése"}
        </Button>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation" onMouseDown={closeComposer}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="proofing-invite-title"
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-brass">Válogató e-mail</p>
                <h2 id="proofing-invite-title" className="mt-2 text-xl font-semibold text-ink">Mehet az e-mail az ügyfélnek?</h2>
                <p className="mt-1 text-sm leading-6 text-graphite/70">
                  Ellenőrizd és szerkeszd a levelet. Küldés nélkül is bezárhatod, később a Válogatás fülről újra megnyitható.
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
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/60">Címzett</p>
                <p className="mt-1 break-all text-sm font-medium text-ink">{recipient || "Nincs megadva ügyfél e-mail"}</p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Tárgy</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={200}
                  disabled={isSending}
                  className="h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50 disabled:bg-paper"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Üzenet</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={5000}
                  rows={8}
                  disabled={isSending}
                  className="w-full resize-y rounded-md border border-ink/15 bg-white px-3 py-3 text-sm leading-6 text-ink outline-none transition focus:border-ink/50 disabled:bg-paper"
                />
                <span className="block text-xs leading-5 text-graphite/60">
                  A galéria neve és a válogató gomb automatikusan a levélben marad.
                </span>
              </label>

              <a href={galleryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-graphite underline-offset-4 hover:text-ink hover:underline">
                <ExternalLink size={15} />
                Válogató link ellenőrzése
              </a>

              {error ? (
                <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-ink/10 bg-paper/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Button type="button" variant="ghost" disabled={isSending} onClick={closeComposer}>
                Most nem küldöm
              </Button>
              <Button type="button" disabled={isSending || !recipient} onClick={() => void sendEmail()}>
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
