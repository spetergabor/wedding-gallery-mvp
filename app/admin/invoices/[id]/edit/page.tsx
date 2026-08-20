import Link from "next/link";
import { ArrowLeft, PencilLine } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { CustomerInvoiceComposer } from "@/components/customer-invoice-composer";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { inputDate, loadInvoiceWorkspaceSettings, parseInvoiceParty } from "@/lib/customer-invoices";
import { prisma } from "@/lib/prisma";

export default async function EditCustomerInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  const adminId = ownerAdminId(session);
  const { id } = await params;
  const [invoice, workspace, customers] = await Promise.all([
    prisma.customerInvoice.findFirst({ where: { id, adminId }, include: { items: { orderBy: { position: "asc" } }, relatedInvoice: { select: { number: true } } } }),
    loadInvoiceWorkspaceSettings(adminId),
    prisma.customer.findMany({ where: { adminId }, orderBy: { updatedAt: "desc" }, take: 300, include: { projects: { orderBy: { eventDate: "desc" }, select: { id: true, title: true, eventDate: true } } } })
  ]);
  if (!invoice || !workspace) notFound();
  if (invoice.status !== "draft") redirect(`/admin/invoices/${invoice.id}`);
  const party = parseInvoiceParty(invoice.customerSnapshot);
  const candidates = customers.map((customer) => ({
    id: customer.id,
    name: customer.billingName ?? customer.coupleName,
    primaryEmail: customer.primaryEmail,
    secondaryEmail: customer.secondaryEmail ?? "",
    addressLine1: customer.billingAddressLine1 ?? customer.weddingAddress ?? "",
    postalCode: customer.billingPostalCode ?? "",
    city: customer.billingCity ?? "",
    country: customer.billingCountry ?? "Österreich",
    uid: customer.billingUid ?? ""
  }));
  const projects = customers.flatMap((customer) => customer.projects.map((project) => ({ id: project.id, customerId: customer.id, title: project.title, eventDate: project.eventDate?.toLocaleDateString("de-AT", { timeZone: "UTC" }) ?? "" })));
  const selectedCustomer = candidates.find((candidate) => candidate.id === invoice.customerId);
  const initialCustomer = { id: selectedCustomer?.id ?? "", name: party.name, primaryEmail: party.email ?? "", secondaryEmail: party.secondaryEmail ?? "", addressLine1: party.addressLine1 ?? "", postalCode: party.postalCode ?? "", city: party.city ?? "", country: party.country ?? "", uid: party.uid ?? "" };
  const issueDate = invoice.issueDate ?? invoice.createdAt;
  const dueDate = invoice.dueDate ?? issueDate;
  return <AdminShell><div className="mb-7 flex items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-brass"><PencilLine size={14}/> Piszkozat szerkesztése</p><h1 className="mt-2 text-3xl font-semibold">{invoice.number}</h1><p className="mt-2 text-sm text-graphite/70">A piszkozat minden tartalma módosítható a véglegesítésig.</p></div><Link href={`/admin/invoices/${invoice.id}`} className="inline-flex h-11 items-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium"><ArrowLeft size={16}/> Vissza</Link></div><CustomerInvoiceComposer invoiceId={invoice.id} candidates={candidates} projects={projects} suggestedNumber={invoice.number || "ENTWURF"} today={inputDate(issueDate)} dueDate={inputDate(dueDate)} initialServiceFrom={inputDate(invoice.serviceDateFrom ?? issueDate)} initialServiceTo={inputDate(invoice.serviceDateTo ?? issueDate)} issuer={workspace.issuer} initialTaxMode={invoice.taxMode === "taxable" ? "taxable" : "small_business"} defaultVatRate={workspace.invoiceSettings.invoiceDefaultVatRate} documentType={invoice.documentType} relatedNumber={invoice.relatedInvoice?.number} initialCustomer={initialCustomer} initialProjectId={invoice.projectId ?? ""} initialItems={invoice.items.map((item) => ({ description: item.description, quantity: String(item.quantity), unit: item.unit, unitPrice: (item.unitPriceCents / 100).toFixed(2).replace(".", ","), vatRate: String(item.vatRate || workspace.invoiceSettings.invoiceDefaultVatRate) }))} initialNotes={invoice.notes ?? ""}/></AdminShell>;
}
