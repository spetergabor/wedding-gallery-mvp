import Link from "next/link";
import { CircleDollarSign, Download, Plus, ReceiptText, Search, Users, WalletCards } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { GeneratedInvoiceRowMenu } from "@/components/generated-invoice-row-menu";
import { ButtonLink } from "@/components/button";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { formatInvoiceMoney, invoiceStatusLabel, parseInvoiceParty } from "@/lib/customer-invoices";
import { prisma } from "@/lib/prisma";

function statusTone(status: string, documentType: string) {
  if (documentType === "cancellation" || status === "cancelled") return "border-ink/10 bg-white";
  if (status === "paid") return "border-emerald-200 bg-emerald-50/55";
  if (["open", "final", "sent", "partial"].includes(status)) return "border-red-200 bg-red-50/45";
  return "border-ink/10 bg-white";
}

export default async function AdminInvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; result?: string }> }) {
  const session = await requireAdmin();
  const adminId = ownerAdminId(session);
  const params = await searchParams;
  const [rows, customerCount] = await Promise.all([
    prisma.customerInvoice.findMany({
      where: { adminId },
      include: { customer: { select: { id: true, coupleName: true } } },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      take: 500
    }),
    prisma.customer.count({ where: { adminId } })
  ]);
  const query = params.q?.trim().toLocaleLowerCase("hu") ?? "";
  const invoices = rows.filter((invoice) => {
    const party = parseInvoiceParty(invoice.customerSnapshot);
    const matchesSearch = !query || `${invoice.number ?? ""} ${invoice.title} ${party.name} ${invoice.customer?.coupleName ?? ""}`.toLocaleLowerCase("hu").includes(query);
    const matchesStatus = !params.status || params.status === "all" || (params.status === "open" ? ["open", "final", "sent", "partial"].includes(invoice.status) : invoice.status === params.status);
    return matchesSearch && matchesStatus;
  });
  const totalFinalized = rows.filter((invoice) => invoice.documentType !== "cancellation" && !["draft", "cancelled"].includes(invoice.status)).reduce((sum, invoice) => sum + (invoice.totalCents ?? invoice.amountCents ?? 0), 0);
  const openCount = rows.filter((invoice) => invoice.documentType !== "cancellation" && ["open", "final", "sent", "partial"].includes(invoice.status)).length;
  const currentYear = new Date().getFullYear();

  return <AdminShell>
    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Rechnungen</p><h1 className="mt-2 text-3xl font-semibold text-ink">Számlázás</h1><p className="mt-3 max-w-2xl text-sm text-graphite/70">Számlakészítés, PDF, kiküldés, fizetések és emlékeztetők egy helyen.</p></div><div className="flex flex-wrap gap-2"><ButtonLink href="/admin/settings/invoices" variant="secondary">Számlázási beállítások</ButtonLink><ButtonLink href="/admin/invoices/new"><Plus size={17}/> Új számla</ButtonLink></div></div>
    {params.result ? <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">A számla művelete sikeresen befejeződött.</div> : null}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{ icon: ReceiptText, value: rows.length, label: "Összes számla" }, { icon: Users, value: customerCount, label: "Mentett ügyfél" }, { icon: WalletCards, value: openCount, label: "Nyitott számla" }, { icon: CircleDollarSign, value: formatInvoiceMoney(totalFinalized), label: "Véglegesített összeg" }].map((kpi) => <div key={kpi.label} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft"><kpi.icon size={19} className="text-brass"/><strong className="mt-4 block text-2xl text-ink">{kpi.value}</strong><span className="mt-1 block text-xs uppercase tracking-[0.14em] text-graphite/55">{kpi.label}</span></div>)}
    </section>
    <section className="mt-6 rounded-lg border border-ink/10 bg-white shadow-soft">
      <div className="flex flex-col justify-between gap-4 border-b border-ink/10 p-5 lg:flex-row lg:items-center"><div><p className="text-xs uppercase tracking-[0.14em] text-graphite/55">Számlák</p><h2 className="mt-1 text-xl font-semibold">Legutóbbi bizonylatok</h2></div><div className="flex flex-col gap-2 sm:flex-row"><form className="flex gap-2"><label className="relative"><Search className="absolute left-3 top-3 text-graphite/45" size={16}/><input name="q" defaultValue={params.q} placeholder="Számlaszám vagy ügyfél" className="h-11 w-full min-w-64 rounded-md border border-ink/15 pl-9 pr-3 text-sm outline-none focus:border-ink/50"/></label><select name="status" defaultValue={params.status ?? "all"} className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm"><option value="all">Minden státusz</option><option value="draft">Piszkozat</option><option value="open">Nyitott</option><option value="paid">Fizetett</option><option value="cancelled">Sztornózott</option></select><button className="h-11 rounded-md border border-ink/15 px-4 text-sm font-medium">Szűrés</button></form><a href={`/api/admin/invoices/export?year=${currentYear}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 px-4 text-sm font-medium"><Download size={16}/> CSV</a></div></div>
      {invoices.length ? <div className="space-y-2 p-3 sm:p-5">{invoices.map((invoice) => { const party = parseInvoiceParty(invoice.customerSnapshot); const total = invoice.totalCents ?? invoice.amountCents; return <article key={invoice.id} className={`grid items-center gap-3 rounded-md border p-4 lg:grid-cols-[1.15fr_1.2fr_.75fr_.75fr_.8fr_.8fr_42px] ${statusTone(invoice.status, invoice.documentType)}`}><Link href={`/admin/invoices/${invoice.id}`} className="font-semibold text-ink hover:underline">{invoice.number || invoice.title}</Link><div><p className="font-medium">{party.name || invoice.customer?.coupleName || "Kézi ügyfél"}</p><p className="text-xs text-graphite/60">{invoice.documentType === "cancellation" ? "Stornorechnung" : invoice.originalFilename && !invoice.number ? "Feltöltött PDF" : party.email || "Nincs e-mail"}</p></div><div><span className="block text-xs uppercase tracking-[0.1em] text-graphite/50">Kiállítás</span><time className="text-sm">{(invoice.issueDate ?? invoice.createdAt).toLocaleDateString("de-AT", { timeZone: "UTC" })}</time></div><div><span className="block text-xs uppercase tracking-[0.1em] text-graphite/50">Határidő</span><time className="text-sm">{invoice.dueDate?.toLocaleDateString("de-AT", { timeZone: "UTC" }) ?? "–"}</time></div><strong className="lg:text-right">{total === null ? "–" : formatInvoiceMoney(total, invoice.currency)}</strong><span className="rounded-full bg-white/80 px-2.5 py-1 text-center text-xs font-medium">{invoiceStatusLabel(invoice.status, invoice.documentType)}</span><GeneratedInvoiceRowMenu invoice={{ id: invoice.id, number: invoice.number || invoice.title, status: invoice.status, documentType: invoice.documentType, publicToken: invoice.publicToken, generated: Boolean(invoice.number) }}/></article>; })}</div> : <div className="p-12 text-center"><ReceiptText className="mx-auto text-graphite/35" size={36}/><h3 className="mt-4 font-semibold">Nincs találat</h3><p className="mt-2 text-sm text-graphite/65">Készíts új számlát, vagy módosítsd a keresést.</p></div>}
    </section>
  </AdminShell>;
}
