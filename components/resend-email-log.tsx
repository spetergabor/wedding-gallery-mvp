"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Download, LoaderCircle, Mail, Search } from "lucide-react";
import { APP_TIME_ZONE } from "@/lib/date-format";
import type { ResendSentEmailDetail, ResendSentEmailSummary } from "@/lib/resend-email-log";

type EmailState =
  | { status: "idle"; email: null; error: null }
  | { status: "loading"; email: null; error: null }
  | { status: "loaded"; email: ResendSentEmailDetail; error: null }
  | { status: "error"; email: null; error: string };

type HistoryImportState =
  | { status: "idle"; imported: 0; failed: 0; error: null }
  | { status: "running"; imported: number; failed: number; error: null }
  | { status: "success"; imported: number; failed: number; error: null }
  | { status: "error"; imported: number; failed: number; error: string };

type HistoryImportResponse = {
  message?: unknown;
  imported?: unknown;
  failed?: unknown;
  hasMore?: unknown;
  nextCursor?: unknown;
};

const COPY = {
  hu: {
    eyebrow: "Resend",
    title: "Kiküldött e-mailek",
    description: "A Spetly által a Resendnek átadott levelek, küldési állapottal és teljes tartalommal.",
    latest: (count: number) => `Legutóbbi ${count} e-mail`,
    search: "Keresés címzett vagy tárgy alapján",
    empty: "Nincs a keresésnek megfelelő e-mail.",
    noEmails: "Még nincs megjeleníthető elküldött e-mail.",
    notConfigured: "A RESEND_API_KEY nincs beállítva, ezért az e-mail napló nem tölthető be.",
    loadListError: "A Resend e-mail naplója most nem tölthető be.",
    loadDetail: "A levél tartalmának betöltése…",
    loadDetailError: "A levél tartalma nem tölthető be.",
    retry: "Újrapróbálás",
    from: "Feladó",
    to: "Címzett",
    cc: "Másolat",
    bcc: "Titkos másolat",
    replyTo: "Válaszcím",
    providerId: "E-mail azonosító",
    content: "Levél tartalma",
    textContent: "Szöveges tartalom",
    noContent: "A Resend nem adott vissza megjeleníthető levéltartalmat.",
    more: "További régebbi e-mailek is vannak a Resendben; itt a legutóbbi 50 látható.",
    importHistory: "Korábbi e-mailek importálása",
    importingHistory: (count: number) => `Importálás folyamatban · ${count} e-mail mentve`,
    importComplete: (count: number) => `${count} korábbi e-mail importálva. A lista frissül…`,
    importFailed: "A korábbi e-mailek importálása nem sikerült.",
    status: {
      delivered: "Kézbesítve",
      opened: "Megnyitva",
      clicked: "Kattintva",
      bounced: "Visszapattant",
      complained: "Spamnek jelölve",
      failed: "Sikertelen",
      canceled: "Törölve",
      delivery_delayed: "Késik",
      queued: "Sorban áll",
      scheduled: "Ütemezve",
      sent: "Elküldve"
    }
  },
  de: {
    eyebrow: "Resend",
    title: "Gesendete E-Mails",
    description: "Von Spetly an Resend übergebene E-Mails mit Sendestatus und vollständigem Inhalt.",
    latest: (count: number) => `Letzte ${count} E-Mails`,
    search: "Nach Empfänger oder Betreff suchen",
    empty: "Keine E-Mail entspricht der Suche.",
    noEmails: "Noch keine gesendeten E-Mails verfügbar.",
    notConfigured: "RESEND_API_KEY ist nicht konfiguriert; das E-Mail-Protokoll kann nicht geladen werden.",
    loadListError: "Das Resend-E-Mail-Protokoll kann gerade nicht geladen werden.",
    loadDetail: "E-Mail-Inhalt wird geladen…",
    loadDetailError: "Der E-Mail-Inhalt konnte nicht geladen werden.",
    retry: "Erneut versuchen",
    from: "Absender",
    to: "Empfänger",
    cc: "Kopie",
    bcc: "Blindkopie",
    replyTo: "Antwortadresse",
    providerId: "E-Mail-ID",
    content: "E-Mail-Inhalt",
    textContent: "Textinhalt",
    noContent: "Resend hat keinen darstellbaren E-Mail-Inhalt zurückgegeben.",
    more: "In Resend sind weitere ältere E-Mails vorhanden; hier werden die letzten 50 angezeigt.",
    importHistory: "Frühere E-Mails importieren",
    importingHistory: (count: number) => `Import läuft · ${count} E-Mails gespeichert`,
    importComplete: (count: number) => `${count} frühere E-Mails importiert. Die Liste wird aktualisiert…`,
    importFailed: "Frühere E-Mails konnten nicht importiert werden.",
    status: {
      delivered: "Zugestellt",
      opened: "Geöffnet",
      clicked: "Angeklickt",
      bounced: "Zurückgewiesen",
      complained: "Als Spam markiert",
      failed: "Fehlgeschlagen",
      canceled: "Abgebrochen",
      delivery_delayed: "Verzögert",
      queued: "In Warteschlange",
      scheduled: "Geplant",
      sent: "Gesendet"
    }
  },
  en: {
    eyebrow: "Resend",
    title: "Sent e-mails",
    description: "E-mails submitted by Spetly to Resend, including send status and full content.",
    latest: (count: number) => `Latest ${count} e-mails`,
    search: "Search by recipient or subject",
    empty: "No e-mail matches this search.",
    noEmails: "No sent e-mails are available yet.",
    notConfigured: "RESEND_API_KEY is not configured, so the e-mail log cannot be loaded.",
    loadListError: "The Resend e-mail log cannot be loaded right now.",
    loadDetail: "Loading e-mail content…",
    loadDetailError: "The e-mail content could not be loaded.",
    retry: "Try again",
    from: "From",
    to: "To",
    cc: "CC",
    bcc: "BCC",
    replyTo: "Reply to",
    providerId: "E-mail ID",
    content: "E-mail content",
    textContent: "Text content",
    noContent: "Resend did not return displayable e-mail content.",
    more: "More older e-mails are available in Resend; the latest 50 are shown here.",
    importHistory: "Import previous e-mails",
    importingHistory: (count: number) => `Import in progress · ${count} e-mails saved`,
    importComplete: (count: number) => `${count} previous e-mails imported. Refreshing the list…`,
    importFailed: "Previous e-mails could not be imported.",
    status: {
      delivered: "Delivered",
      opened: "Opened",
      clicked: "Clicked",
      bounced: "Bounced",
      complained: "Marked as spam",
      failed: "Failed",
      canceled: "Canceled",
      delivery_delayed: "Delayed",
      queued: "Queued",
      scheduled: "Scheduled",
      sent: "Sent"
    }
  }
} as const;

function statusClass(status: string) {
  if (["delivered", "opened", "clicked"].includes(status)) {
    return "border-sage/25 bg-sage/10 text-sage";
  }

  if (["bounced", "complained", "failed", "canceled"].includes(status)) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "delivery_delayed") {
    return "border-brass/25 bg-brass/10 text-brass";
  }

  return "border-ink/10 bg-ink/5 text-graphite";
}

function previewDocument(html: string) {
  const policy = "default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:;";
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;

  if (/<head(?:\s[^>]*)?>/i.test(html)) {
    return html.replace(/<head(\s[^>]*)?>/i, (head) => `${head}${meta}`);
  }

  return `<!doctype html><html><head>${meta}<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`;
}

function formatEmailDate(value: string, language: "hu" | "de" | "en") {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "-";
  }

  const locale = language === "de" ? "de-DE" : language === "en" ? "en-US" : "hu-HU";

  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE
  });
}

function addressList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "-";
}

function EmailDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-graphite/45">{label}</span>
      <span className="mt-1 block break-all text-xs font-medium text-graphite">{value || "-"}</span>
    </div>
  );
}

function ResendEmailRow({ email, language }: { email: ResendSentEmailSummary; language: "hu" | "de" | "en" }) {
  const copy = COPY[language];
  const [state, setState] = useState<EmailState>({ status: "idle", email: null, error: null });

  async function loadEmail(force = false) {
    if (!force && state.status !== "idle") {
      return;
    }

    setState({ status: "loading", email: null, error: null });

    try {
      const response = await fetch(`/api/admin/resend-emails/${encodeURIComponent(email.id)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.email) {
        throw new Error(typeof payload?.message === "string" ? payload.message : copy.loadDetailError);
      }

      setState({ status: "loaded", email: payload.email as ResendSentEmailDetail, error: null });
    } catch (error) {
      setState({
        status: "error",
        email: null,
        error: error instanceof Error ? error.message : copy.loadDetailError
      });
    }
  }

  const statusLabel = copy.status[email.lastEvent as keyof typeof copy.status] ?? email.lastEvent;
  const deliveryError = state.status === "loaded" ? state.email.tags.find((tag) => tag.name === "error")?.value : null;

  return (
    <details
      className="group bg-white"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          void loadEmail();
        }
      }}
    >
      <summary className="grid cursor-pointer list-none gap-3 px-4 py-3 transition hover:bg-paper/70 md:min-h-14 md:grid-cols-[minmax(0,1fr)_180px_155px_24px] md:items-center [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md border ${statusClass(email.lastEvent)}`}>
            <Mail size={15} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{email.subject || "(nincs tárgy)"}</p>
            <p className="mt-0.5 truncate text-xs text-graphite/55">{addressList(email.to)}</p>
          </div>
        </div>
        <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(email.lastEvent)}`}>
          {statusLabel}
        </span>
        <time className="text-sm text-graphite/60" dateTime={email.createdAt}>
          {formatEmailDate(email.createdAt, language)}
        </time>
        <ChevronDown className="justify-self-end self-center text-graphite/45 transition group-open:rotate-180 group-hover:text-ink" size={18} />
      </summary>

      <div className="border-t border-ink/10 bg-paper/55 px-4 py-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <EmailDetailRow label={copy.from} value={email.from} />
          <EmailDetailRow label={copy.to} value={addressList(email.to)} />
          <EmailDetailRow label={copy.replyTo} value={addressList(email.replyTo)} />
          {email.cc.length > 0 ? <EmailDetailRow label={copy.cc} value={addressList(email.cc)} /> : null}
          {email.bcc.length > 0 ? <EmailDetailRow label={copy.bcc} value={addressList(email.bcc)} /> : null}
          <EmailDetailRow label={copy.providerId} value={email.id} />
        </div>

        {state.status === "loading" ? (
          <div className="mt-4 flex min-h-36 items-center justify-center gap-2 rounded-md border border-ink/10 bg-white text-sm text-graphite/65">
            <LoaderCircle className="animate-spin" size={18} />
            {copy.loadDetail}
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="mt-4 flex flex-col items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2"><AlertTriangle size={16} />{state.error}</span>
            <button type="button" onClick={() => void loadEmail(true)} className="h-9 rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 transition hover:bg-red-100">
              {copy.retry}
            </button>
          </div>
        ) : null}

        {state.status === "loaded" ? (
          <div className="mt-4">
            {deliveryError ? (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                <span className="break-words">{deliveryError}</span>
              </div>
            ) : null}
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/45">
              {state.email.html ? copy.content : copy.textContent}
            </p>
            {state.email.html ? (
              <iframe
                title={`${copy.content}: ${email.subject}`}
                srcDoc={previewDocument(state.email.html)}
                sandbox=""
                referrerPolicy="no-referrer"
                className="mt-2 h-[620px] w-full rounded-md border border-ink/10 bg-white"
              />
            ) : state.email.text ? (
              <pre className="mt-2 max-h-[620px] overflow-auto whitespace-pre-wrap rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-graphite/80">{state.email.text}</pre>
            ) : (
              <p className="mt-2 rounded-md border border-dashed border-ink/15 bg-white px-4 py-6 text-center text-sm text-graphite/60">{copy.noContent}</p>
            )}
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function ResendEmailLog({
  emails,
  hasMore,
  configured,
  error,
  language
}: {
  emails: ResendSentEmailSummary[];
  hasMore: boolean;
  configured: boolean;
  error: string | null;
  language: "hu" | "de" | "en";
}) {
  const copy = COPY[language];
  const [query, setQuery] = useState("");
  const [importState, setImportState] = useState<HistoryImportState>({ status: "idle", imported: 0, failed: 0, error: null });
  const filteredEmails = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();

    if (!needle) {
      return emails;
    }

    return emails.filter((email) =>
      [email.subject, email.from, ...email.to, ...email.cc, ...email.bcc]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle)
    );
  }, [emails, query]);

  async function importHistory() {
    if (importState.status === "running") {
      return;
    }

    let cursor: string | null = null;
    let imported = 0;
    let failed = 0;
    let pageCount = 0;
    setImportState({ status: "running", imported, failed, error: null });

    try {
      while (pageCount < 500) {
        const response: Response = await fetch("/api/admin/resend-emails/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor }),
          cache: "no-store"
        });
        const rawPayload: unknown = await response.json().catch(() => null);
        const payload: HistoryImportResponse | null = rawPayload && typeof rawPayload === "object" ? rawPayload : null;

        if (!response.ok) {
          throw new Error(typeof payload?.message === "string" ? payload.message : copy.importFailed);
        }

        imported += typeof payload?.imported === "number" ? payload.imported : 0;
        failed += typeof payload?.failed === "number" ? payload.failed : 0;
        pageCount += 1;
        setImportState({ status: "running", imported, failed, error: null });

        if (!payload?.hasMore) {
          break;
        }

        if (typeof payload.nextCursor !== "string" || payload.nextCursor === cursor) {
          throw new Error(copy.importFailed);
        }

        cursor = payload.nextCursor;
      }

      if (pageCount >= 500) {
        throw new Error(copy.importFailed);
      }

      setImportState({ status: "success", imported, failed, error: null });
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      window.location.reload();
    } catch (error) {
      setImportState({
        status: "error",
        imported,
        failed,
        error: error instanceof Error ? error.message : copy.importFailed
      });
    }
  }

  return (
    <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-brass">
            <Mail size={15} />
            {copy.eyebrow}
          </div>
          <h2 className="mt-2 text-lg font-semibold text-ink">{copy.title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-graphite/65">{copy.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void importHistory()}
            disabled={importState.status === "running"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 bg-white px-3 text-xs font-medium text-ink transition hover:bg-ink/5 disabled:cursor-wait disabled:opacity-60"
          >
            {importState.status === "running" ? <LoaderCircle className="animate-spin" size={15} /> : <Download size={15} />}
            {copy.importHistory}
          </button>
          <span className="inline-flex w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
            {copy.latest(emails.length)}
          </span>
        </div>
      </div>

      {importState.status === "running" ? (
        <div className="mt-5 flex items-center gap-2 rounded-md border border-brass/25 bg-brass/[0.06] px-4 py-3 text-sm text-graphite/75">
          <LoaderCircle className="shrink-0 animate-spin text-brass" size={17} />
          {copy.importingHistory(importState.imported)}
        </div>
      ) : null}

      {importState.status === "success" ? (
        <div className="mt-5 flex items-center gap-2 rounded-md border border-sage/25 bg-sage/10 px-4 py-3 text-sm text-sage">
          <CheckCircle2 className="shrink-0" size={17} />
          {copy.importComplete(importState.imported)}
        </div>
      ) : null}

      {importState.status === "error" ? (
        <div className="mt-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} />
          <span>{importState.error}</span>
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 flex items-start gap-3 rounded-md border border-brass/25 bg-brass/[0.06] px-4 py-3 text-sm text-graphite/75">
          <AlertTriangle className="mt-0.5 shrink-0 text-brass" size={17} />
          <div>
            <p className="font-medium text-ink">{configured ? copy.loadListError : copy.notConfigured}</p>
            {configured ? <p className="mt-1 break-words text-xs text-graphite/55">{error}</p> : null}
          </div>
        </div>
      ) : null}

      {emails.length > 0 ? (
        <label className="relative mt-5 block">
          <span className="sr-only">{copy.search}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite/45" size={17} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search}
            className="h-11 w-full rounded-md border border-ink/10 bg-white pl-10 pr-3 text-sm text-ink outline-none transition placeholder:text-graphite/40 focus:border-ink/30"
          />
        </label>
      ) : null}

      {!error && emails.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-ink/15 bg-paper px-5 py-8 text-center text-sm text-graphite/65">
          {copy.noEmails}
        </div>
      ) : null}

      {emails.length > 0 && filteredEmails.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-ink/15 bg-paper px-5 py-8 text-center text-sm text-graphite/65">
          {copy.empty}
        </div>
      ) : null}

      {filteredEmails.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-md border border-ink/10 bg-white">
          <div className="divide-y divide-ink/10">
            {filteredEmails.map((email) => <ResendEmailRow key={email.id} email={email} language={language} />)}
          </div>
        </div>
      ) : null}

      {hasMore ? <p className="mt-3 text-xs text-graphite/55">{copy.more}</p> : null}
    </section>
  );
}
