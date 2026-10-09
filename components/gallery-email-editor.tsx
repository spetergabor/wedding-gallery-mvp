"use client";

import { useId, useRef, useState } from "react";
import { galleryEmailHtml, safeMessageLink } from "@/lib/gallery-email-template";
import type { GalleryEmailCover } from "@/lib/gallery-email-cover";
import type { CustomerLanguage } from "@/lib/customer-language";

export type GalleryEmailPreview = {
  galleryTitle: string;
  senderName: string;
  replyTo: string;
  url: string;
  cta: string;
  language?: CustomerLanguage;
  cover?: GalleryEmailCover | null;
};

export function GalleryEmailEditor({ subject, message, onSubjectChange, onMessageChange, preview, disabled = false }: {
  subject: string;
  message: string;
  onSubjectChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  preview: GalleryEmailPreview;
  disabled?: boolean;
}) {
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const previewScroll = useRef(0);
  const selection = useRef({ start: 0, end: 0 });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [mobile, setMobile] = useState(false);
  const captureSelection = () => {
    if (textarea.current) selection.current = { start: textarea.current.selectionStart, end: textarea.current.selectionEnd };
  };
  const insert = (value: string) => {
    const { start, end } = selection.current;
    const next = message.slice(0, start) + value + message.slice(end);
    if (next.length > 5000) { setLinkError("Az üzenet legfeljebb 5000 karakter lehet."); return false; }
    onMessageChange(next);
    requestAnimationFrame(() => { textarea.current?.focus(); textarea.current?.setSelectionRange(start + value.length, start + value.length); });
    return true;
  };
  const format = (mark: string, fallback: string) => {
    captureSelection();
    const selected = message.slice(selection.current.start, selection.current.end) || fallback;
    insert(mark + selected + mark);
  };
  const addLink = () => {
    const href = safeMessageLink(linkUrl);
    if (!href || !linkLabel.trim()) { setLinkError("Adj meg linkfeliratot és teljes https://, http:// vagy mailto: címet."); return; }
    if (insert(`[${linkLabel.trim().replace(/[\[\]\r\n]/g, " ")}](${href.replace(/\(/g, "%28").replace(/\)/g, "%29")})`)) { setLinkOpen(false); setLinkError(""); }
  };
  const html = galleryEmailHtml({ ...preview, message });
  const document = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http:; style-src 'unsafe-inline'"><style>body{margin:0}</style></head><body>${html}</body></html>`;
  const toolClass = "rounded border border-ink/15 bg-white px-3 py-2 text-xs font-medium disabled:opacity-50";
  return <div className="grid gap-6 xl:grid-cols-2">
    <div className="space-y-4">
      <label className="block space-y-2"><span className="text-sm font-medium">Tárgy</span><input name="subject" required value={subject} maxLength={200} disabled={disabled} onChange={e => onSubjectChange(e.target.value)} className="h-12 w-full rounded-md border border-ink/15 px-3 text-sm" /></label>
      <div className="space-y-2">
        <label htmlFor={id} className="text-sm font-medium">Üzenet</label>
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Üzenet formázása">
          <button type="button" disabled={disabled} className={toolClass} onClick={() => format("**", "kiemelt szöveg")}><strong>Félkövér</strong></button>
          <button type="button" disabled={disabled} className={toolClass} onClick={() => format("*", "dőlt szöveg")}><em>Dőlt</em></button>
          <button type="button" disabled={disabled} className={toolClass} onClick={() => { captureSelection(); const selected = message.slice(selection.current.start, selection.current.end) || "Első pont\nMásodik pont"; insert("\n\n" + selected.split("\n").map(line => "- " + line).join("\n") + "\n\n"); }}>Felsorolás</button>
          <button type="button" disabled={disabled} className={toolClass} onClick={() => { captureSelection(); setLinkLabel(message.slice(selection.current.start, selection.current.end)); setLinkUrl(""); setLinkError(""); setLinkOpen(true); }}>Link beszúrása</button>
        </div>
        {linkOpen ? <div className="space-y-3 rounded-md border border-ink/15 bg-paper p-3">
          <label className="block text-sm">Link felirata<input value={linkLabel} disabled={disabled} onChange={e => setLinkLabel(e.target.value)} className="mt-1 h-10 w-full rounded border border-ink/15 px-3" /></label>
          <label className="block text-sm">Link címe<input value={linkUrl} placeholder="https://…" disabled={disabled} onChange={e => setLinkUrl(e.target.value)} className="mt-1 h-10 w-full rounded border border-ink/15 px-3" /></label>
          <div className="flex gap-2"><button type="button" className={toolClass} disabled={disabled} onClick={addLink}>Link beillesztése</button><button type="button" className={toolClass} onClick={() => { setLinkOpen(false); setLinkError(""); }}>Mégse</button></div>
        </div> : null}
        {linkError ? <p role="alert" className="text-sm text-red-700">{linkError}</p> : null}
        <textarea id={id} ref={textarea} name="message" required value={message} maxLength={5000} rows={14} disabled={disabled} onChange={e => onMessageChange(e.target.value)} className="w-full resize-y rounded-md border border-ink/15 px-3 py-3 text-sm leading-6" />
        <p className="text-xs leading-5 text-graphite/60">A formázási jelek az előnézetben már formázott szövegként jelennek meg. A beillesztett webcímek automatikusan kattinthatóak lesznek.</p>
      </div>
    </div>
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Élő e-mail-előnézet</p><div className="flex gap-2"><button type="button" aria-pressed={!mobile} className={toolClass} onClick={() => setMobile(false)}>Asztali</button><button type="button" aria-pressed={mobile} className={toolClass} onClick={() => setMobile(true)}>Mobil</button></div></div>
      <p className="break-words text-sm text-graphite/70">Tárgy: <strong>{subject}</strong></p>
      <div className="rounded-md border border-ink/10 bg-paper p-1"><iframe title="A kiküldendő e-mail élő előnézete" sandbox="allow-same-origin" srcDoc={document} onLoad={event => {
        const frame = event.currentTarget;
        const content = frame.contentWindow;
        if (!content || !frame.contentDocument) return;
        content.scrollTo(0, previewScroll.current);
        content.addEventListener("scroll", () => { previewScroll.current = content.scrollY; }, { passive: true });
        frame.contentDocument.addEventListener("click", event => { event.preventDefault(); });
      }} className="mx-auto block h-[620px] w-full border-0" style={{ maxWidth: mobile ? 360 : 600 }} /></div>
      <p className="text-xs text-graphite/60">A küldéshez használt sablon. A levelezőprogramok megjelenítése kis mértékben eltérhet.</p>
    </div>
  </div>;
}
