import { Download, ExternalLink, Mail, ReceiptText, UploadCloud } from "lucide-react";
import { Button } from "@/components/button";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { sendInvoiceAction, updateInvoiceStatusAction, uploadInvoiceAction } from "@/lib/invoice-actions";

type Invoice = {
  id: string;
  title: string;
  status: string;
  originalFilename: string;
  fileUrl: string;
  fileSize: number;
  amountCents: number | null;
  currency: string;
  dueDate: Date | null;
  notes: string | null;
  sentAt: Date | null;
  sentTo: string | null;
  emailError: string | null;
  paidAt: Date | null;
  createdAt: Date;
  project: {
    id: string;
    title: string;
  } | null;
};

type InvoiceProject = {
  id: string;
  title: string;
  eventDate: Date | null;
};

function formatFileSize(bytes: number) {
  if (bytes <= 0) {
    return "0 MB";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function formatDate(date: Date | null) {
  if (!date) {
    return null;
  }

  return date.toLocaleString("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE
  });
}

function formatDateOnly(date: Date | null) {
  if (!date) {
    return null;
  }

  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

function formatAmount(amountCents: number | null, currency: string) {
  if (amountCents === null) {
    return "Nincs összeg";
  }

  return new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency
  }).format(amountCents / 100);
}

function statusClass(status: string) {
  return status === "paid" ? "bg-sage/15 text-sage" : "bg-brass/10 text-brass";
}

export function InvoiceManager({
  customerId,
  invoices,
  projects
}: {
  customerId: string;
  invoices: Invoice[];
  projects: InvoiceProject[];
}) {
  const openCount = invoices.filter((invoice) => invoice.status !== "paid").length;
  const paidCount = invoices.filter((invoice) => invoice.status === "paid").length;

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
      <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-5 md:flex-row md:items-start">
        <div>
          <div className="flex size-11 items-center justify-center rounded-md bg-paper text-graphite">
            <ReceiptText size={20} />
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-ink">Számlák</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">
            Külső számlázóval elkészített PDF számlák feltöltése, emailes kiküldése és fizetési státusz követése.
          </p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-ink/10 rounded-md bg-paper text-sm text-graphite">
          <div className="px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-graphite/55">Nyitott</p>
            <p className="mt-1 text-lg font-semibold text-ink">{openCount}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-graphite/55">Fizetett</p>
            <p className="mt-1 text-lg font-semibold text-ink">{paidCount}</p>
          </div>
        </div>
      </div>

      <form action={uploadInvoiceAction.bind(null, customerId)} className="mt-6 grid gap-4 rounded-md border border-ink/10 bg-paper p-5 xl:grid-cols-4">
        <div className="xl:col-span-4">
          <div className="flex items-center gap-2 text-base font-semibold text-ink">
            <UploadCloud size={18} />
            Számla PDF feltöltése
          </div>
          <p className="mt-1 text-sm text-graphite/70">
            A számla az ügyfélhez kerül, opcionálisan konkrét projekthez kapcsolva.
          </p>
        </div>
        <label className="space-y-2 xl:col-span-2">
          <span className="text-sm font-medium text-graphite">Számla neve</span>
          <input
            name="title"
            required
            placeholder="pl. Jegyesfotózás számla"
            className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
          />
        </label>
        <label className="space-y-2 xl:col-span-2">
          <span className="text-sm font-medium text-graphite">Projekt</span>
          <select
            name="projectId"
            className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
          >
            <option value="">Nincs projekthez kötve</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
                {project.eventDate ? ` · ${formatDateOnly(project.eventDate)}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Összeg</span>
          <input
            name="amount"
            inputMode="decimal"
            placeholder="pl. 350"
            className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Pénznem</span>
          <select
            name="currency"
            defaultValue="EUR"
            className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
          >
            <option value="EUR">EUR</option>
            <option value="HUF">HUF</option>
          </select>
        </label>
        <label className="space-y-2 xl:col-span-2">
          <span className="text-sm font-medium text-graphite">Fizetési határidő</span>
          <input
            name="dueDate"
            type="date"
            className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
          />
        </label>
        <label className="space-y-2 xl:col-span-4">
          <span className="text-sm font-medium text-graphite">PDF fájl</span>
          <input
            name="invoicePdf"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="block w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
          />
        </label>
        <label className="space-y-2 xl:col-span-4">
          <span className="text-sm font-medium text-graphite">Belső megjegyzés</span>
          <textarea
            name="notes"
            rows={3}
            placeholder="pl. utalás után kész galéria átadása"
            className="w-full rounded-md border border-ink/15 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-ink/50"
          />
        </label>
        <div className="xl:col-span-4">
          <Button type="submit">
            <UploadCloud size={16} />
            Számla feltöltése
          </Button>
        </div>
      </form>

      {invoices.length > 0 ? (
        <div className="mt-5 space-y-3">
          {invoices.map((invoice) => (
            <article key={invoice.id} className="rounded-md border border-ink/10 p-4">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{invoice.title}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(invoice.status)}`}>
                      {invoice.status === "paid" ? "Fizetett" : "Nyitott"}
                    </span>
                    {invoice.project ? (
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                        {invoice.project.title}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-graphite/70">{invoice.originalFilename}</p>
                  <p className="mt-1 text-xs text-graphite/60">
                    {formatAmount(invoice.amountCents, invoice.currency)} · {formatFileSize(invoice.fileSize)} · feltöltve: {formatDate(invoice.createdAt)}
                  </p>
                  {invoice.dueDate ? (
                    <p className="mt-1 text-xs text-graphite/60">Határidő: {formatDateOnly(invoice.dueDate)}</p>
                  ) : null}
                  {invoice.notes ? <p className="mt-2 text-sm text-graphite/70">{invoice.notes}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <form action={sendInvoiceAction.bind(null, customerId, invoice.id)}>
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-graphite transition hover:bg-ink/5"
                      title="Számla kiküldése emailben"
                    >
                      <Mail size={16} />
                      Küldés
                    </button>
                  </form>
                  <a
                    href={invoice.fileUrl}
                    target="_blank"
                    className="inline-flex size-10 items-center justify-center rounded-md border border-ink/10 text-graphite transition hover:bg-ink/5"
                    title="PDF megnyitása"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <a
                    href={invoice.fileUrl}
                    download={invoice.originalFilename}
                    className="inline-flex size-10 items-center justify-center rounded-md border border-ink/10 text-graphite transition hover:bg-ink/5"
                    title="PDF letöltése"
                  >
                    <Download size={16} />
                  </a>
                </div>
              </div>

              <form action={updateInvoiceStatusAction.bind(null, customerId, invoice.id)} className="mt-4 flex flex-col gap-2 rounded-md bg-paper p-3 sm:flex-row sm:items-end">
                <label className="flex-1 space-y-2">
                  <span className="text-sm font-medium text-graphite">Fizetési státusz</span>
                  <select
                    name="status"
                    defaultValue={invoice.status === "paid" ? "paid" : "open"}
                    className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                  >
                    <option value="open">Nyitott</option>
                    <option value="paid">Fizetett</option>
                  </select>
                </label>
                <Button type="submit" variant="secondary" className="h-10">
                  Státusz mentése
                </Button>
              </form>

              <div className="mt-3 grid gap-2 text-xs text-graphite/60">
                <p>Elküldve: {formatDate(invoice.sentAt) ?? "még nincs"}</p>
                <p>Címzett: {invoice.sentTo || "még nincs"}</p>
                <p>Fizetve: {formatDate(invoice.paidAt) ?? "még nincs"}</p>
                {invoice.emailError ? <p className="text-red-700">Email hiba: {invoice.emailError}</p> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-md bg-paper px-4 py-3 text-sm text-graphite/70">
          Még nincs feltöltött számla.
        </div>
      )}
    </section>
  );
}
