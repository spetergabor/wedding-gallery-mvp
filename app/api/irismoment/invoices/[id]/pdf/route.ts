import { NextRequest } from "next/server";
import { authenticateIrisRetouch } from "@/lib/iris-retouch-auth";
import { persistGeneratedInvoicePdf } from "@/lib/generated-invoice-service";
import { prisma } from "@/lib/prisma";
import { loadPhotoObjectBuffer } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const integration = await authenticateIrisRetouch(request);
  if (!integration) return new Response("Unauthorized", { status: 401 });

  const { id } = await context.params;
  const invoice = await prisma.customerInvoice.findFirst({
    where: { id, adminId: integration.adminId, status: { not: "draft" } },
    select: { id: true, number: true, r2Key: true, fileUrl: true, originalFilename: true }
  });
  if (!invoice?.number) return new Response("Not found", { status: 404 });

  const storedBuffer = invoice.r2Key
    ? await loadPhotoObjectBuffer({ r2Key: invoice.r2Key, publicUrl: invoice.fileUrl }).catch(() => null)
    : null;
  const generated = storedBuffer
    ? null
    : await persistGeneratedInvoicePdf(invoice.id, integration.adminId);
  const buffer = storedBuffer ?? generated?.buffer;
  if (!buffer) return new Response("Invoice PDF unavailable", { status: 409 });

  const filename = invoice.originalFilename || generated?.filename ||
    `${invoice.number.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(/["\\]/g, "-")}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
