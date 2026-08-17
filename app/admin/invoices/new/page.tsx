import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { CustomerInvoiceComposer } from "@/components/customer-invoice-composer";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { inputDate, loadInvoiceWorkspaceSettings } from "@/lib/customer-invoices";
import { prisma } from "@/lib/prisma";

export default async function NewCustomerInvoicePage({ searchParams }: { searchParams: Promise<{ customerId?: string; projectId?: string }> }) {
  const session = await requireAdmin();
  const adminId = ownerAdminId(session);
  const query = await searchParams;
  const workspace = await loadInvoiceWorkspaceSettings(adminId);
  if (!workspace) return null;
  const today = new Date();
  const due = new Date(today); due.setUTCDate(due.getUTCDate() + workspace.invoiceSettings.invoiceDueDays);
  const year = today.getUTCFullYear();
  const numberPrefix = `${workspace.invoiceSettings.invoicePrefix}-${year}-`;
  const [customers, numberedInvoices] = await Promise.all([
    prisma.customer.findMany({ where: { adminId }, orderBy: { updatedAt: "desc" }, take: 300, include: { projects: { orderBy: { eventDate: "desc" }, select: { id: true, title: true, eventDate: true } } } }),
    prisma.customerInvoice.findMany({ where: { adminId, number: { startsWith: numberPrefix } }, select: { number: true } })
  ]);
  const highest = numberedInvoices.reduce((max, invoice) => { const value = Number(invoice.number?.slice(numberPrefix.length)); return Number.isInteger(value) ? Math.max(max, value) : max; }, 0);
  const suggestedNumber = `${numberPrefix}${String(Math.max(highest + 1, workspace.invoiceSettings.invoiceSequenceStart)).padStart(3, "0")}`;
  const candidates = customers.map((customer) => ({ id: customer.id, name: customer.coupleName, primaryEmail: customer.primaryEmail, secondaryEmail: customer.secondaryEmail ?? "", addressLine1: customer.weddingAddress ?? "", postalCode: "", city: "", country: "Österreich", uid: "" }));
  const projects = customers.flatMap((customer) => customer.projects.map((project) => ({ id: project.id, customerId: customer.id, title: project.title, eventDate: project.eventDate?.toLocaleDateString("de-AT", { timeZone: "UTC" }) ?? "" })));
  const initialCustomer = candidates.find((candidate) => candidate.id === query.customerId);
  const initialProjectId = projects.some((project) => project.id === query.projectId && project.customerId === initialCustomer?.id) ? query.projectId : "";
  return <AdminShell><div className="mb-7 flex items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-brass"><ReceiptText size={14}/> Számlakészítő</p><h1 className="mt-2 text-3xl font-semibold">Új számla</h1><p className="mt-2 text-sm text-graphite/70">Válassz ügyfelet, add meg a tételeket, majd mentsd vagy véglegesítsd.</p></div><Link href="/admin/invoices" className="inline-flex h-11 items-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium"><ArrowLeft size={16}/> Számlák</Link></div><CustomerInvoiceComposer candidates={candidates} projects={projects} suggestedNumber={suggestedNumber} today={inputDate(today)} dueDate={inputDate(due)} issuer={workspace.issuer} initialTaxMode={workspace.invoiceSettings.invoiceTaxMode === "taxable" ? "taxable" : "small_business"} defaultVatRate={workspace.invoiceSettings.invoiceDefaultVatRate} initialCustomer={initialCustomer} initialProjectId={initialProjectId}/></AdminShell>;
}
