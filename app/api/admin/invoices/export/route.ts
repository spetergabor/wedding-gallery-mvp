import { getAdminSession } from "@/lib/auth";
import { ownerAdminId } from "@/lib/admin-scope";
import { parseInvoiceParty } from "@/lib/customer-invoices";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
function cell(value: string | number | null | undefined) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function date(value: Date | null) { return value?.toISOString().slice(0, 10) ?? ""; }
function money(cents: number | null) { return cents === null ? "" : (cents / 100).toFixed(2).replace(".", ","); }

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const requested = Number(new URL(request.url).searchParams.get("year"));
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2200 ? requested : new Date().getFullYear();
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const invoices = await prisma.customerInvoice.findMany({ where: { adminId: ownerAdminId(session), OR: [{ issueDate: { gte: from, lt: to } }, { issueDate: null, createdAt: { gte: from, lt: to } }] }, orderBy: [{ issueDate: "asc" }, { createdAt: "asc" }] });
  const header = ["Rechnungsnummer", "Belegart", "Status", "Steuermodus", "Kunde", "E-Mail", "Kunden-UID", "Rechnungsdatum", "Fälligkeitsdatum", "Leistung von", "Leistung bis", "Netto EUR", "USt EUR", "Gesamt EUR", "Bezahlt EUR", "Offen EUR", "Bezahlt am", "Storniert am"].map(cell).join(";");
  const rows = invoices.map((invoice) => { const party = parseInvoiceParty(invoice.customerSnapshot); const total = invoice.totalCents ?? invoice.amountCents; return [invoice.number ?? invoice.title, invoice.documentType, invoice.status, invoice.taxMode, party.name, party.email, party.uid, date(invoice.issueDate ?? invoice.createdAt), date(invoice.dueDate), date(invoice.serviceDateFrom), date(invoice.serviceDateTo), money(invoice.subtotalCents ?? total), money(invoice.taxCents), money(total), money(invoice.paidCents), money(total === null ? null : Math.max(0, total - invoice.paidCents)), date(invoice.paidAt), date(invoice.cancelledAt)].map(cell).join(";"); });
  return new Response(`\uFEFF${[header, ...rows].join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="Rechnungen-${year}.csv"`, "Cache-Control": "private, no-store" } });
}
