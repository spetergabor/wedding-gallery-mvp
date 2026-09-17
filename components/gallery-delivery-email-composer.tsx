"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ExternalLink, Mail, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { sendGalleryDeliveryEmailDraftAction } from "@/lib/gallery-actions";

type GalleryDeliveryEmailComposerProps = {
  galleryId: string;
  galleryTitle: string;
  galleryUrl: string;
  recipient: string;
  replyTo: string;
  defaultSubject: string;
  defaultMessage: string;
  coverImageUrl: string | null;
  coverPositionX: number;
  coverPositionY: number;
  logoUrl: string | null;
  photographerName: string;
  language: "de" | "hu";
  hasPhotos: boolean;
};

export function GalleryDeliveryEmailComposer({
  galleryId,
  galleryTitle,
  galleryUrl,
  recipient: initialRecipient,
  replyTo: initialReplyTo,
  defaultSubject,
  defaultMessage,
  coverImageUrl,
  coverPositionX,
  coverPositionY,
  logoUrl,
  photographerName,
  language,
  hasPhotos
}: GalleryDeliveryEmailComposerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [recipient, setRecipient] = useState(initialRecipient);
  const [replyTo, setReplyTo] = useState(initialReplyTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const ctaLabel = language === "hu" ? "Galéria megnyitása" : "Galerie öffnen";

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSending) setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSending]);

  function openComposer() {
    setRecipient(initialRecipient);
    setReplyTo(initialReplyTo);
    setSubject(defaultSubject);
    setMessage(defaultMessage);
    setError("");
    setSuccess("");
    setIsOpen(true);
  }

  function closeComposer() {
    if (isSending) return;
    setIsOpen(false);
  }

  async function sendEmail() {
    if (isSending) return;
    setIsSending(true);
    setError("");
    setSuccess("");

    try {
      const result = await sendGalleryDeliveryEmailDraftAction(galleryId, {
        recipient,
        replyTo,
        subject,
        message
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setSuccess(result.message);
      router.refresh();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Az e-mail küldése nem sikerült.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={!hasPhotos}
        title={hasPhotos ? undefined : "Az e-mail küldése előtt tölts fel legalább egy kész képet."}
        className={!hasPhotos ? "opacity-60" : ""}
        onClick={openComposer}
      >
        <Mail size={16} />
        Küldés e-mailben
      </Button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
          role="presentation"
          onMouseDown={closeComposer}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-delivery-email-title"
            className="max-h-[94vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-2xl sm:max-w-6xl sm:rounded-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-brass">Galéria átadása</p>
                <h2 id="gallery-delivery-email-title" className="mt-2 text-xl font-semibold text-ink">
                  Küldés e-mailben
                </h2>
                <p className="mt-1 text-sm leading-6 text-graphite/70">
                  Ellenőrizd a címzettet, a válaszcímet és a levelet. A jobb oldali előnézet az elküldött e-mail felépítését mutatja.
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

            <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
              <div className="space-y-5 border-b border-ink/10 px-5 py-5 sm:px-6 lg:border-b-0 lg:border-r">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">Címzett e-mail</span>
                  <input
                    type="email"
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    placeholder="ugyfel@email.hu"
                    disabled={isSending || Boolean(success)}
                    className="h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50 disabled:bg-paper"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">Válaszcím</span>
                  <input
                    type="email"
                    value={replyTo}
                    onChange={(event) => setReplyTo(event.target.value)}
                    placeholder="foto@email.hu"
                    disabled={isSending || Boolean(success)}
                    className="h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50 disabled:bg-paper"
                  />
                  <span className="block text-xs leading-5 text-graphite/60">
                    Az ügyfél válasza erre a címre érkezik. Alapból a fotós e-mail címe.
                  </span>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">Tárgy</span>
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    maxLength={200}
                    disabled={isSending || Boolean(success)}
                    className="h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50 disabled:bg-paper"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">E-mail szövege</span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    maxLength={5000}
                    rows={10}
                    disabled={isSending || Boolean(success)}
                    className="w-full resize-y rounded-md border border-ink/15 bg-white px-3 py-3 text-sm leading-6 text-ink outline-none transition focus:border-ink/50 disabled:bg-paper"
                  />
                  <span className="block text-xs leading-5 text-graphite/60">
                    A borítókép, a logó és a galériagomb automatikusan az e-mailben marad.
                  </span>
                </label>

                <a
                  href={galleryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-graphite underline-offset-4 hover:text-ink hover:underline"
                >
                  <ExternalLink size={15} />
                  Publikus galéria ellenőrzése
                </a>

                {error ? (
                  <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
                {success ? (
                  <div role="status" className="rounded-md border border-sage/25 bg-sage/10 px-4 py-3 text-sm font-medium text-sage">
                    {success}
                  </div>
                ) : null}
              </div>

              <div className="bg-paper/80 p-4 sm:p-6">
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-graphite/60">E-mail előnézet</p>
                <div className="mx-auto max-w-[640px] overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
                  {logoUrl ? (
                    <div className="flex min-h-24 items-center justify-center px-7 py-5">
                      <Image src={logoUrl} alt={`${photographerName} logó`} width={220} height={84} unoptimized className="max-h-20 w-auto max-w-[220px] object-contain" />
                    </div>
                  ) : (
                    <div className="px-7 py-5 text-center text-sm font-semibold tracking-[0.12em] text-ink">{photographerName}</div>
                  )}
                  {coverImageUrl ? (
                    <div className="relative aspect-[16/9] w-full bg-paper">
                      <Image
                        src={coverImageUrl}
                        alt={`${galleryTitle} borítókép`}
                        fill
                        unoptimized
                        className="object-cover"
                        style={{ objectPosition: `${coverPositionX}% ${coverPositionY}%` }}
                        sizes="640px"
                      />
                    </div>
                  ) : null}
                  <div className="px-6 py-7 sm:px-8">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brass">{galleryTitle}</p>
                    <h3 className="mt-2 text-2xl font-semibold leading-tight text-ink">{subject}</h3>
                    <div className="mt-5 whitespace-pre-wrap text-sm leading-6 text-graphite">{message}</div>
                    <span className="mt-6 inline-flex h-11 items-center rounded-md bg-ink px-5 text-sm font-semibold text-white">{ctaLabel}</span>
                    <p className="mt-6 break-all text-[11px] leading-5 text-graphite/55">{galleryUrl}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-ink/10 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Button type="button" variant="ghost" disabled={isSending} onClick={closeComposer}>
                {success ? "Bezárás" : "Mégse"}
              </Button>
              {!success ? (
                <Button type="button" disabled={isSending} onClick={() => void sendEmail()}>
                  <Send size={16} />
                  {isSending ? "Küldés..." : "E-mail küldése"}
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
