import { getAdminSession } from "@/lib/auth";
import { ownerAdminId } from "@/lib/admin-scope";
import { createCustomerInvoicePdf } from "@/lib/customer-invoice-pdf";
import { INVOICE_TAX_NOTICE, parseInvoiceIssuer, parseInvoiceParty } from "@/lib/customer-invoices";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const invoice = await prisma.customerInvoice.findFirst({ where: { id, adminId: ownerAdminId(session), status: { not: "draft" } }, include: { items: { orderBy: { position: "asc" } }, relatedInvoice: { select: { number: true } } } });
  if (!invoice?.number || !invoice.issueDate || !invoice.dueDate || !invoice.customerSnapshot || !invoice.issuerSnapshot || invoice.totalCents === null || !invoice.items.length) return new Response("Not found", { status: 404 });
  const buffer = await createCustomerInvoicePdf({ number: invoice.number, issueDate: invoice.issueDate, dueDate: invoice.dueDate, serviceDateFrom: invoice.serviceDateFrom, serviceDateTo: invoice.serviceDateTo, currency: invoice.currency, taxMode: invoice.taxMode, taxNotice: invoice.taxNotice || INVOICE_TAX_NOTICE, subtotalCents: invoice.subtotalCents ?? invoice.totalCents, taxCents: invoice.taxCents ?? 0, totalCents: invoice.totalCents, documentType: invoice.documentType, relatedNumber: invoice.relatedInvoice?.number, cancellationReason: invoice.cancellationReason, issuer: parseInvoiceIssuer(invoice.issuerSnapshot), customer: parseInvoiceParty(invoice.customerSnapshot), items: invoice.items.map((item) => ({ description: item.description, quantity: Number(item.quantity), unit: item.unit, unitPriceCents: item.unitPriceCents, vatRate: item.vatRate, amountCents: item.amountCents })) });
  const filename = `${invoice.number.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
}
