"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Eye, FileCheck2, Mail, Plus, Save, Search, Trash2, UserRound } from "lucide-react";
import { CustomerInvoiceDocument } from "@/components/customer-invoice-document";
import { saveGeneratedInvoiceAction, updateGeneratedInvoiceAction, type GeneratedInvoiceActionState } from "@/lib/generated-invoice-actions";
import { formatInvoiceMoney, INVOICE_STANDARD_TAX_NOTICE, INVOICE_TAX_NOTICE, type InvoiceIssuer } from "@/lib/customer-invoice-shared";

type Candidate = {
  id: string;
  name: string;
  primaryEmail: string;
  secondaryEmail: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  country: string;
  uid: string;
};

type Project = { id: string; customerId: string; title: string; eventDate: string };
type CustomerState = Candidate & { selected: boolean };
type LineItem = { id: number; description: string; quantity: string; unit: string; unitPrice: string; vatRate: string };

const units = [
  ["Stk", "Darab (Stk)"], ["pauschal", "Átalány (pauschal)"], ["Std", "Óra (Std)"], ["UE", "Tanóra (UE)"], ["%", "Százalék (%)"],
  ["Tag(e)", "Nap (Tag(e))"], ["m²", "m²"], ["m", "m"], ["kg", "kg"], ["t", "t"], ["lfm", "lfm"], ["m³", "m³"], ["km", "km"], ["L", "L"]
] as const;

function amounts(item: LineItem, taxMode: string) {
  const quantity = Number(item.quantity.replace(",", ".")) || 0;
  const unitPriceCents = Math.round((Number(item.unitPrice.replace(",", ".")) || 0) * 100);
  const net = Math.round(quantity * unitPriceCents);
  const tax = taxMode === "taxable" ? Math.round(net * (Number(item.vatRate) || 0) / 100) : 0;
  return { quantity, unitPriceCents, net, tax, total: net + tax };
}

const fieldClass = "h-11 min-w-0 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50";

export function CustomerInvoiceComposer({
  candidates,
  projects,
  suggestedNumber,
  today,
  dueDate,
  issuer,
  initialTaxMode,
  defaultVatRate,
  invoiceId,
  documentType = "invoice",
  relatedNumber,
  initialCustomer,
  initialProjectId = "",
  initialItems,
  initialServiceFrom,
  initialServiceTo,
  initialNotes = ""
}: {
  candidates: Candidate[];
  projects: Project[];
  suggestedNumber: string;
  today: string;
  dueDate: string;
  issuer: InvoiceIssuer;
  initialTaxMode: "small_business" | "taxable";
  defaultVatRate: number;
  invoiceId?: string;
  documentType?: string;
  relatedNumber?: string | null;
  initialCustomer?: Candidate;
  initialProjectId?: string;
  initialItems?: Array<Omit<LineItem, "id">>;
  initialServiceFrom?: string;
  initialServiceTo?: string;
  initialNotes?: string;
}) {
  const action = useMemo(() => invoiceId ? updateGeneratedInvoiceAction.bind(null, invoiceId) : saveGeneratedInvoiceAction, [invoiceId]);
  const [state, formAction, pending] = useActionState<GeneratedInvoiceActionState, FormData>(action, {});
  const [customer, setCustomer] = useState<CustomerState>(() => ({
    id: initialCustomer?.id ?? "",
    name: initialCustomer?.name ?? "",
    primaryEmail: initialCustomer?.primaryEmail ?? "",
    secondaryEmail: initialCustomer?.secondaryEmail ?? "",
    addressLine1: initialCustomer?.addressLine1 ?? "",
    postalCode: initialCustomer?.postalCode ?? "",
    city: initialCustomer?.city ?? "",
    country: initialCustomer?.country ?? "Österreich",
    uid: initialCustomer?.uid ?? "",
    selected: Boolean(initialCustomer?.id)
  }));
  const [projectId, setProjectId] = useState(initialProjectId);
  const [dates, setDates] = useState({ issueDate: today, dueDate, from: initialServiceFrom ?? today, to: initialServiceTo ?? today });
  const [taxMode, setTaxMode] = useState<"small_business" | "taxable">(initialTaxMode);
  const normalizedVat = [10, 13, 20].includes(defaultVatRate) ? String(defaultVatRate) : "20";
  const [items, setItems] = useState<LineItem[]>(() => initialItems?.length ? initialItems.map((item, index) => ({ id: index + 1, ...item })) : [{ id: 1, description: "Fotografische Leistungen", quantity: "1", unit: "pauschal", unitPrice: "", vatRate: normalizedVat }]);
  const [nextId, setNextId] = useState((initialItems?.length ?? 1) + 1);
  const [focused, setFocused] = useState(false);
  const matches = useMemo(() => {
    const query = customer.name.trim().toLocaleLowerCase("de");
    if (query.length < 3) return [];
    return candidates.filter((candidate) => `${candidate.name} ${candidate.primaryEmail} ${candidate.secondaryEmail}`.toLocaleLowerCase("de").includes(query)).slice(0, 8);
  }, [candidates, customer.name]);
  const availableProjects = useMemo(() => projects.filter((project) => project.customerId === customer.id), [projects, customer.id]);
  const subtotal = items.reduce((sum, item) => sum + amounts(item, taxMode).net, 0);
  const tax = items.reduce((sum, item) => sum + amounts(item, taxMode).tax, 0);
  const total = subtotal + tax;
  const itemsJson = JSON.stringify(items.map((item) => ({ description: item.description, quantity: Number(item.quantity.replace(",", ".")) || 0, unit: item.unit, unitPrice: Number(item.unitPrice.replace(",", ".")) || 0, vatRate: Number(item.vatRate) })));

  function choose(candidate: Candidate) {
    setCustomer({ ...candidate, selected: true });
    setProjectId("");
    setFocused(false);
  }

  function editCustomer(key: keyof Omit<CustomerState, "selected" | "id">, fieldValue: string) {
    setCustomer((current) => key === "name" ? { ...current, id: "", selected: false, [key]: fieldValue } : { ...current, [key]: fieldValue });
    if (key === "name") setProjectId("");
  }

  function editItem(id: number, key: keyof Omit<LineItem, "id">, fieldValue: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [key]: fieldValue } : item));
  }

  function changeIssueDate(fieldValue: string) {
    const issue = new Date(`${fieldValue}T12:00:00Z`);
    const originalIssue = new Date(`${dates.issueDate}T12:00:00Z`);
    const originalDue = new Date(`${dates.dueDate}T12:00:00Z`);
    const days = Math.max(0, Math.round((originalDue.getTime() - originalIssue.getTime()) / 86_400_000));
    const nextDue = new Date(issue); nextDue.setUTCDate(nextDue.getUTCDate() + days);
    setDates((current) => ({ ...current, issueDate: fieldValue, dueDate: Number.isNaN(nextDue.getTime()) ? current.dueDate : nextDue.toISOString().slice(0, 10) }));
  }

  const preview = {
    number: suggestedNumber,
    issueDate: new Date(`${dates.issueDate}T12:00:00Z`),
    dueDate: new Date(`${dates.dueDate}T12:00:00Z`),
    serviceDateFrom: new Date(`${dates.from}T12:00:00Z`),
    serviceDateTo: new Date(`${dates.to}T12:00:00Z`),
    currency: "EUR",
    taxNotice: taxMode === "taxable" ? INVOICE_STANDARD_TAX_NOTICE : INVOICE_TAX_NOTICE,
    taxMode,
    subtotalCents: subtotal,
    taxCents: tax,
    totalCents: total,
    documentType,
    relatedNumber,
    customer: { name: customer.name || "Kundenname", email: customer.primaryEmail, secondaryEmail: customer.secondaryEmail, addressLine1: customer.addressLine1, postalCode: customer.postalCode, city: customer.city, country: customer.country, uid: customer.uid },
    issuer,
    items: items.map((item) => ({ id: item.id, description: item.description || "Leistung", quantity: amounts(item, taxMode).quantity, unit: item.unit, unitPriceCents: amounts(item, taxMode).unitPriceCents, vatRate: Number(item.vatRate), amountCents: amounts(item, taxMode).total }))
  };

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="customerId" value={customer.selected ? customer.id : ""} />
      <input type="hidden" name="itemsJson" value={itemsJson} />
      <input type="hidden" name="taxMode" value={taxMode} />
      <div className="grid min-w-0 items-start gap-6 2xl:grid-cols-[minmax(0,1.05fr)_minmax(460px,.95fr)]">
        <div className="min-w-0 space-y-5">
          {state.error ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</div> : null}
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
            <header className="flex gap-3 border-b border-ink/10 pb-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">1</span><div><h2 className="font-semibold text-ink">Ügyfél és projekt</h2><p className="mt-1 text-sm text-graphite/65">Keress Spetly-ügyfelet, vagy írj be teljesen kézi adatokat.</p></div></header>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="relative space-y-2 sm:col-span-2"><span className="text-sm font-medium text-graphite">Ügyfél neve *</span><div className="relative"><Search className="absolute left-3 top-3 text-graphite/45" size={17}/><input name="customerName" required autoComplete="off" value={customer.name} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 160)} onChange={(event) => editCustomer("name", event.target.value)} className={`${fieldClass} pl-10 pr-24`} placeholder="3 karakter után keresünk…" />{customer.selected ? <span className="absolute right-3 top-2.5 inline-flex items-center gap-1 rounded-full bg-sage/15 px-2 py-1 text-xs font-medium text-sage"><Check size={12}/> Spetly</span> : null}</div>
                {focused && matches.length ? <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-ink/10 bg-white p-1 shadow-xl">{matches.map((candidate) => <button key={candidate.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(candidate)} className="flex w-full items-center gap-3 rounded px-3 py-2 text-left hover:bg-paper"><UserRound size={17}/><span><strong className="block text-sm">{candidate.name}</strong><small className="text-graphite/60">{candidate.primaryEmail || "Nincs e-mail"}</small></span></button>)}</div> : null}
              </label>
              <label className="space-y-2"><span className="text-sm font-medium text-graphite">Elsődleges e-mail</span><input name="customerEmail" type="email" value={customer.primaryEmail} onChange={(event) => editCustomer("primaryEmail", event.target.value)} className={fieldClass}/></label>
              <label className="space-y-2"><span className="text-sm font-medium text-graphite">Másodlagos e-mail</span><input name="secondaryEmail" type="email" value={customer.secondaryEmail} onChange={(event) => editCustomer("secondaryEmail", event.target.value)} className={fieldClass}/></label>
              <label className="space-y-2 sm:col-span-2"><span className="text-sm font-medium text-graphite">Projekt</span><select name="projectId" value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={!customer.selected} className={fieldClass}><option value="">Nincs projekthez kapcsolva</option>{availableProjects.map((project) => <option value={project.id} key={project.id}>{project.title}{project.eventDate ? ` · ${project.eventDate}` : ""}</option>)}</select></label>
              <label className="space-y-2 sm:col-span-2"><span className="text-sm font-medium text-graphite">Utca, házszám</span><input name="addressLine1" value={customer.addressLine1} onChange={(event) => editCustomer("addressLine1", event.target.value)} className={fieldClass}/></label>
              <label className="space-y-2"><span className="text-sm font-medium text-graphite">Irányítószám</span><input name="postalCode" value={customer.postalCode} onChange={(event) => editCustomer("postalCode", event.target.value)} className={fieldClass}/></label>
              <label className="space-y-2"><span className="text-sm font-medium text-graphite">Város</span><input name="city" value={customer.city} onChange={(event) => editCustomer("city", event.target.value)} className={fieldClass}/></label>
              <label className="space-y-2"><span className="text-sm font-medium text-graphite">Ország</span><input name="country" value={customer.country} onChange={(event) => editCustomer("country", event.target.value)} className={fieldClass}/></label>
              <label className="space-y-2"><span className="text-sm font-medium text-graphite">Ügyfél UID</span><input name="customerUid" value={customer.uid} onChange={(event) => editCustomer("uid", event.target.value)} className={fieldClass}/></label>
            </div>
          </section>

          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
            <header className="flex gap-3 border-b border-ink/10 pb-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">2</span><div><h2 className="font-semibold text-ink">Rechnungsdetails</h2><p className="mt-1 text-sm text-graphite/65">A hivatalos sorszámot csak véglegesítéskor foglaljuk le.</p></div></header>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2"><span className="text-sm font-medium text-graphite">Rechnungsnummer</span><input value={suggestedNumber} readOnly className={`${fieldClass} bg-paper`}/></label>
              <label className="space-y-2"><span className="text-sm font-medium text-graphite">Rechnungsdatum</span><input name="issueDate" type="date" required value={dates.issueDate} onChange={(event) => changeIssueDate(event.target.value)} className={fieldClass}/></label>
              <label className="space-y-2"><span className="text-sm font-medium text-graphite">Fälligkeitsdatum</span><input name="dueDate" type="date" required value={dates.dueDate} onChange={(event) => setDates((current) => ({ ...current, dueDate: event.target.value }))} className={fieldClass}/></label>
              <label className="space-y-2"><span className="text-sm font-medium text-graphite">Leistung von</span><input name="serviceDateFrom" type="date" required value={dates.from} onChange={(event) => setDates((current) => ({ ...current, from: event.target.value, to: current.to < event.target.value ? event.target.value : current.to }))} className={fieldClass}/></label>
              <label className="space-y-2"><span className="text-sm font-medium text-graphite">Leistung bis</span><input name="serviceDateTo" type="date" required min={dates.from} value={dates.to} onChange={(event) => setDates((current) => ({ ...current, to: event.target.value }))} className={fieldClass}/></label>
              <label className="space-y-2 sm:col-span-2 xl:col-span-1"><span className="text-sm font-medium text-graphite">Belső megjegyzés</span><input name="notes" defaultValue={initialNotes} className={fieldClass}/></label>
            </div>
            <fieldset className="mt-5"><legend className="text-sm font-medium text-graphite">Adózási mód</legend><div className="mt-2 grid gap-3 sm:grid-cols-2"><button type="button" aria-pressed={taxMode === "small_business"} onClick={() => setTaxMode("small_business")} className={`rounded-md border p-4 text-left transition ${taxMode === "small_business" ? "border-ink bg-ink text-white" : "border-ink/10 hover:border-ink/30"}`}><strong className="block">Kleinunternehmer</strong><span className={`mt-1 block text-xs ${taxMode === "small_business" ? "text-white/70" : "text-graphite/60"}`}>Umsatzsteuerbefreit</span></button><button type="button" aria-pressed={taxMode === "taxable"} onClick={() => setTaxMode("taxable")} className={`rounded-md border p-4 text-left transition ${taxMode === "taxable" ? "border-ink bg-ink text-white" : "border-ink/10 hover:border-ink/30"}`}><strong className="block">Áfás számla</strong><span className={`mt-1 block text-xs ${taxMode === "taxable" ? "text-white/70" : "text-graphite/60"}`}>Tételenként 10%, 13% vagy 20%</span></button></div></fieldset>
          </section>

          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
            <header className="flex gap-3 border-b border-ink/10 pb-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">3</span><div><h2 className="font-semibold text-ink">Számlatételek</h2><p className="mt-1 text-sm text-graphite/65">Mennyiség, egység, ár és szükség esetén USt.</p></div></header>
            <div className="mt-5 space-y-3">{items.map((item, index) => <div key={item.id} className="grid min-w-0 grid-cols-1 gap-3 rounded-md border border-ink/10 bg-paper p-4 sm:grid-cols-2 2xl:grid-cols-12">
              <label className="min-w-0 space-y-1 sm:col-span-2 2xl:col-span-4"><span className="text-xs font-medium text-graphite/70">Beschreibung</span><input required value={item.description} onChange={(event) => editItem(item.id, "description", event.target.value)} className={fieldClass}/></label>
              <label className="min-w-0 space-y-1 2xl:col-span-2"><span className="text-xs font-medium text-graphite/70">Menge</span><input required inputMode="decimal" value={item.quantity} onChange={(event) => editItem(item.id, "quantity", event.target.value)} className={fieldClass}/></label>
              <label className="min-w-0 space-y-1 2xl:col-span-2"><span className="text-xs font-medium text-graphite/70">Egység</span><select value={item.unit} onChange={(event) => editItem(item.id, "unit", event.target.value)} className={fieldClass}>{units.map(([unit, label]) => <option key={unit} value={unit}>{label}</option>)}</select></label>
              <label className="min-w-0 space-y-1 2xl:col-span-2"><span className="text-xs font-medium text-graphite/70">Preis EUR</span><input required inputMode="decimal" value={item.unitPrice} onChange={(event) => editItem(item.id, "unitPrice", event.target.value)} className={fieldClass}/></label>
              <label className="min-w-0 space-y-1 2xl:col-span-1"><span className="text-xs font-medium text-graphite/70">USt.</span><select disabled={taxMode !== "taxable"} value={item.vatRate} onChange={(event) => editItem(item.id, "vatRate", event.target.value)} className={fieldClass}><option value="20">20%</option><option value="13">13%</option><option value="10">10%</option></select></label>
              <button type="button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))} aria-label={`${index + 1}. tétel törlése`} className="mt-auto flex size-11 items-center justify-center justify-self-end rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-30 2xl:col-span-1"><Trash2 size={17}/></button>
              <p className="text-right text-sm font-semibold sm:col-span-2 2xl:col-span-12">Betrag: {formatInvoiceMoney(amounts(item, taxMode).total)}</p>
            </div>)}</div>
            <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><button type="button" onClick={() => { setItems((current) => [...current, { id: nextId, description: "", quantity: "1", unit: "Stk", unitPrice: "", vatRate: normalizedVat }]); setNextId((current) => current + 1); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/15 px-4 text-sm font-medium hover:bg-paper"><Plus size={16}/> Új tétel</button><div className="text-right text-sm text-graphite/70">{taxMode === "taxable" ? <p>Netto {formatInvoiceMoney(subtotal)} · USt. {formatInvoiceMoney(tax)}</p> : null}<p className="mt-1 text-lg font-semibold text-ink">Gesamtbetrag {formatInvoiceMoney(total)}</p></div></div>
          </section>
        </div>

        <aside id="invoice-live-preview" className="min-w-0 self-start 2xl:sticky 2xl:top-6"><div className="mb-2 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-graphite/55">Élő előnézet</p><p className="mt-1 text-sm text-graphite/65">A PDF tartalmának megfelelő nézet</p></div></div><div className="overflow-hidden rounded-lg border border-ink/10 bg-paper p-2"><CustomerInvoiceDocument invoice={preview} compact/></div></aside>
      </div>

      <div className="sticky bottom-3 z-10 flex flex-wrap justify-end gap-2 rounded-lg border border-ink/10 bg-white/95 p-3 shadow-xl backdrop-blur">
        <button type="button" onClick={() => document.getElementById("invoice-live-preview")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="inline-flex h-11 items-center gap-2 rounded-md border border-ink/15 px-4 text-sm font-medium"><Eye size={17}/> Előnézet</button>
        <button type="submit" name="intent" value="draft" disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-md border border-ink/15 px-4 text-sm font-medium disabled:opacity-50"><Save size={17}/>{pending ? "Mentés…" : "Mentés"}</button>
        <details className="relative"><summary className="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white marker:hidden"><FileCheck2 size={17}/> Ellenőrzés és küldés</summary><div className="absolute bottom-14 right-0 w-[min(420px,calc(100vw-2rem))] rounded-lg border border-ink/10 bg-white p-5 shadow-2xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">Számla ellenőrzése</p><h3 className="mt-2 text-lg font-semibold">Készen áll a véglegesítésre?</h3><p className="mt-2 text-sm leading-6 text-graphite/70">Véglegesítés után a tartalom és a hivatalos számlaszám már nem módosítható.</p><div className="mt-4 rounded-md bg-paper p-3"><strong className="block">{suggestedNumber}</strong><span className="mt-1 block text-sm text-graphite/65">{customer.name || "Nincs ügyfél"} · {formatInvoiceMoney(total)}</span></div><div className="mt-4 grid gap-2"><button type="submit" name="intent" value="finalize" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 px-4 text-sm font-medium"><FileCheck2 size={16}/> Véglegesítés e-mail nélkül</button><button type="submit" name="intent" value="send" disabled={pending || (!customer.primaryEmail && !customer.secondaryEmail)} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white disabled:opacity-40"><Mail size={16}/> Véglegesítés és küldés</button></div></div></details>
      </div>
    </form>
  );
}
