import { formatInvoiceDate, formatInvoiceMoney, invoiceTitle, type InvoiceIssuer, type InvoiceParty } from "@/lib/customer-invoice-shared";

export type InvoiceDocumentData = {
  number: string;
  issueDate: Date;
  dueDate: Date;
  serviceDateFrom?: Date | null;
  serviceDateTo?: Date | null;
  currency: string;
  taxNotice: string;
  taxMode: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  documentType: string;
  relatedNumber?: string | null;
  status?: string;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  customer: InvoiceParty;
  issuer: InvoiceIssuer;
  items: Array<{ id?: string | number; description: string; quantity: number; unit: string; unitPriceCents: number; vatRate: number; amountCents: number }>;
};

export function CustomerInvoiceDocument({ invoice, compact = false }: { invoice: InvoiceDocumentData; compact?: boolean }) {
  const taxable = invoice.taxMode === "taxable";
  return (
    <article className={`invoice-document-root relative mx-auto w-full overflow-hidden bg-white text-ink shadow-soft ${compact ? "p-5 text-[10px]" : "max-w-[900px] p-7 sm:p-10 lg:p-12"}`}>
      {invoice.status === "cancelled" ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 text-5xl font-bold uppercase tracking-[0.18em] text-red-700/10 sm:text-7xl">Storniert</div>
      ) : null}
      <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-7">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brass">{invoiceTitle(invoice.documentType)}</p>
          <h1 className={`${compact ? "mt-2 text-lg" : "mt-3 text-3xl"} font-semibold`}>{invoice.number}</h1>
        </div>
        <div className="max-w-[45%] text-right">
          <strong className="block">{invoice.issuer.name}</strong>
          <span className="mt-2 block leading-relaxed text-graphite/70">
            {invoice.issuer.addressLine1}<br />{invoice.issuer.postalCode} {invoice.issuer.city}<br />{invoice.issuer.country}
          </span>
        </div>
      </header>

      <section className="grid gap-8 py-8 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brass">Rechnung an</p>
          <strong className="mt-3 block text-base">{invoice.customer.name}</strong>
          <span className="mt-2 block leading-relaxed text-graphite/70">
            {invoice.customer.addressLine1 ? <>{invoice.customer.addressLine1}<br /></> : null}
            {invoice.customer.postalCode || invoice.customer.city ? <>{invoice.customer.postalCode} {invoice.customer.city}<br /></> : null}
            {invoice.customer.country || null}
            {invoice.customer.uid ? <><br />UID: {invoice.customer.uid}</> : null}
            {invoice.customer.email ? <><br />{invoice.customer.email}</> : null}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brass sm:text-right">Rechnungsdetails</p>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-graphite/70">
            <dt>Rechnungsnummer</dt><dd className="font-medium text-ink">{invoice.number}</dd>
            {invoice.relatedNumber ? <><dt>Originalrechnung</dt><dd className="font-medium text-ink">{invoice.relatedNumber}</dd></> : null}
            <dt>Rechnungsdatum</dt><dd className="font-medium text-ink">{formatInvoiceDate(invoice.issueDate)}</dd>
            <dt>Fälligkeitsdatum</dt><dd className="font-medium text-ink">{formatInvoiceDate(invoice.dueDate)}</dd>
            {invoice.serviceDateFrom ? <><dt>Leistungszeitraum</dt><dd className="font-medium text-ink">{formatInvoiceDate(invoice.serviceDateFrom)}{invoice.serviceDateTo && invoice.serviceDateTo.getTime() !== invoice.serviceDateFrom.getTime() ? ` – ${formatInvoiceDate(invoice.serviceDateTo)}` : ""}</dd></> : null}
          </dl>
        </div>
      </section>

      <div className="overflow-x-auto">
        <div className="min-w-[590px]">
          <div className={`grid ${taxable ? "grid-cols-[minmax(200px,1fr)_90px_100px_65px_110px]" : "grid-cols-[minmax(220px,1fr)_100px_110px_120px]"} bg-ink px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-white`}>
            <span>Beschreibung</span><span className="text-right">Menge</span><span className="text-right">{taxable ? "Netto" : "Preis"}</span>{taxable ? <span className="text-right">USt.</span> : null}<span className="text-right">Betrag</span>
          </div>
          {invoice.items.map((item, index) => (
            <div key={item.id ?? index} className={`grid ${taxable ? "grid-cols-[minmax(200px,1fr)_90px_100px_65px_110px]" : "grid-cols-[minmax(220px,1fr)_100px_110px_120px]"} border-b border-ink/10 px-3 py-4`}>
              <span>{item.description}</span><span className="text-right">{item.quantity.toLocaleString("de-AT")} {item.unit}</span><span className="text-right">{formatInvoiceMoney(item.unitPriceCents, invoice.currency)}</span>{taxable ? <span className="text-right">{item.vatRate}%</span> : null}<strong className="text-right">{formatInvoiceMoney(item.amountCents, invoice.currency)}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="ml-auto mt-7 w-full max-w-sm space-y-2 text-right">
        {taxable ? <><p className="flex justify-between text-graphite/70"><span>Netto</span><span>{formatInvoiceMoney(invoice.subtotalCents, invoice.currency)}</span></p><p className="flex justify-between text-graphite/70"><span>USt.</span><span>{formatInvoiceMoney(invoice.taxCents, invoice.currency)}</span></p></> : null}
        <p className="flex items-baseline justify-between border-t border-ink/15 pt-3"><span className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/70">{invoice.documentType === "cancellation" ? "Stornobetrag" : "Gesamtbetrag"}</span><strong className="text-xl">{formatInvoiceMoney(invoice.totalCents, invoice.currency)}</strong></p>
      </div>

      <footer className="mt-9 space-y-5">
        {invoice.cancellationReason ? <p className="text-sm text-graphite/75"><strong>Stornogrund:</strong> {invoice.cancellationReason}</p> : null}
        <p className="rounded-md bg-paper p-4 text-xs leading-relaxed text-graphite/75"><strong>Hinweis:</strong> {invoice.taxNotice}</p>
        <div className="text-xs leading-relaxed text-graphite/70">
          <strong className="text-ink">{invoice.issuer.name}</strong><br />
          {invoice.issuer.addressLine1} · {invoice.issuer.postalCode} {invoice.issuer.city}<br />
          IBAN: {invoice.issuer.iban}{invoice.issuer.bic ? ` · BIC: ${invoice.issuer.bic}` : ""}<br />
          Steuernummer: {invoice.issuer.taxNumber}{invoice.issuer.uid ? ` · UID: ${invoice.issuer.uid}` : ""}
        </div>
      </footer>
    </article>
  );
}
