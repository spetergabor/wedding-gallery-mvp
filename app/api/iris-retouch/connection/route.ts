import { NextRequest, NextResponse } from "next/server";
import { authenticateIrisRetouch } from "@/lib/iris-retouch-auth";
import { loadInvoiceWorkspaceSettings } from "@/lib/customer-invoices";
import { IRISMOMENT_INVOICE_PRICING } from "@/lib/irismoment-pricing";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const integration = await authenticateIrisRetouch(request);
  if (!integration) {
    return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  }
  const invoiceWorkspace = await loadInvoiceWorkspaceSettings(integration.adminId);
  return NextResponse.json({
    ok: true,
    workspace: {
      id: integration.admin.id,
      name: integration.admin.siteSettings?.businessName || integration.admin.name,
      email: integration.admin.email
    },
    invoiceIssuers: (invoiceWorkspace?.issuerChoices ?? []).map((choice) => ({
      id: choice.id,
      label: choice.label,
      name: choice.issuer.name,
      taxMode: choice.invoiceSettings.invoiceTaxMode
    })),
    invoicePricing: IRISMOMENT_INVOICE_PRICING,
    connectedAt: integration.createdAt.toISOString(),
    lastUsedAt: integration.lastUsedAt?.toISOString() ?? null
  });
}
