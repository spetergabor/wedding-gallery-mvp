import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatInvoiceDate, formatInvoiceMoney, invoiceTitle, type InvoiceIssuer, type InvoiceParty } from "@/lib/customer-invoice-shared";

type PdfLineItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  vatRate: number;
  amountCents: number;
};

export type InvoicePdfInput = {
  number: string;
  issueDate: Date;
  dueDate: Date;
  serviceDateFrom: Date | null;
  serviceDateTo: Date | null;
  currency: string;
  taxMode: string;
  taxNotice: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  documentType: string;
  relatedNumber?: string | null;
  cancellationReason?: string | null;
  issuer: InvoiceIssuer;
  customer: InvoiceParty;
  items: PdfLineItem[];
};

const A4 = { width: 595.28, height: 841.89 };
const ink = rgb(0.09, 0.09, 0.09);
const muted = rgb(0.39, 0.38, 0.36);
const brass = rgb(0.65, 0.5, 0.27);
const paper = rgb(0.96, 0.95, 0.92);

function safeText(value: string | null | undefined) {
  return (value ?? "").replace(/[\u0000-\u001f]/g, " ");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function right(page: PDFPage, text: string, x: number, y: number, width: number, font: PDFFont, size: number, color = ink) {
  page.drawText(text, { x: x + width - font.widthOfTextAtSize(text, size), y, font, size, color });
}

export async function createCustomerInvoicePdf(invoice: InvoicePdfInput) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await readFile(path.join(process.cwd(), "public/fonts/album-export/montserrat-600.ttf"));
  const regular = await pdf.embedFont(fontBytes, { subset: true });
  const bold = regular;
  let page = pdf.addPage([A4.width, A4.height]);
  const margin = 48;
  const contentWidth = A4.width - margin * 2;
  let y = A4.height - 55;

  const drawPageHeader = (continuation = false) => {
    page.drawText(invoiceTitle(invoice.documentType).toUpperCase(), { x: margin, y, size: 9, font: bold, color: brass });
    page.drawText(invoice.number, { x: margin, y: y - 28, size: continuation ? 18 : 26, font: bold, color: ink });
    right(page, invoice.issuer.name, margin, y, contentWidth, bold, 10);
    if (!continuation) {
      right(page, `${invoice.issuer.addressLine1}`, margin, y - 16, contentWidth, regular, 8, muted);
      right(page, `${invoice.issuer.postalCode} ${invoice.issuer.city} · ${invoice.issuer.country}`, margin, y - 28, contentWidth, regular, 8, muted);
    }
    page.drawLine({ start: { x: margin, y: y - 48 }, end: { x: A4.width - margin, y: y - 48 }, thickness: 1.2, color: ink });
    y -= 78;
  };

  const newPage = () => {
    page = pdf.addPage([A4.width, A4.height]);
    y = A4.height - 55;
    drawPageHeader(true);
  };

  drawPageHeader();
  page.drawText("RECHNUNG AN", { x: margin, y, size: 8, font: bold, color: brass });
  page.drawText(invoice.customer.name, { x: margin, y: y - 17, size: 11, font: bold, color: ink });
  const address = [invoice.customer.addressLine1, [invoice.customer.postalCode, invoice.customer.city].filter(Boolean).join(" "), invoice.customer.country, invoice.customer.uid ? `UID: ${invoice.customer.uid}` : null, invoice.customer.email].filter(Boolean) as string[];
  address.forEach((line, index) => page.drawText(safeText(line), { x: margin, y: y - 34 - index * 13, size: 8.5, font: regular, color: muted }));

  const detailX = 342;
  page.drawText("RECHNUNGSDETAILS", { x: detailX, y, size: 8, font: bold, color: brass });
  const period = invoice.serviceDateFrom ? `${formatInvoiceDate(invoice.serviceDateFrom)}${invoice.serviceDateTo && invoice.serviceDateTo.getTime() !== invoice.serviceDateFrom.getTime() ? ` – ${formatInvoiceDate(invoice.serviceDateTo)}` : ""}` : "–";
  const details = [
    ["Rechnungsnummer", invoice.number],
    ...(invoice.relatedNumber ? [["Originalrechnung", invoice.relatedNumber]] : []),
    ["Rechnungsdatum", formatInvoiceDate(invoice.issueDate)],
    ["Fälligkeitsdatum", formatInvoiceDate(invoice.dueDate)],
    ["Leistungszeitraum", period]
  ];
  details.forEach(([label, value], index) => {
    const lineY = y - 18 - index * 16;
    page.drawText(label, { x: detailX, y: lineY, size: 8, font: regular, color: muted });
    right(page, safeText(value), detailX, lineY, A4.width - margin - detailX, bold, 8, ink);
  });
  y -= Math.max(112, 52 + address.length * 13);

  const columns = invoice.taxMode === "taxable"
    ? { description: 205, quantity: 62, price: 76, vat: 45, amount: 111 }
    : { description: 245, quantity: 70, price: 82, vat: 0, amount: 102 };
  const drawTableHeader = () => {
    page.drawRectangle({ x: margin, y: y - 25, width: contentWidth, height: 25, color: ink });
    let x = margin + 8;
    page.drawText("Beschreibung", { x, y: y - 16, size: 8, font: bold, color: rgb(1, 1, 1) }); x += columns.description;
    right(page, "Menge", x, y - 16, columns.quantity - 7, bold, 8, rgb(1, 1, 1)); x += columns.quantity;
    right(page, invoice.taxMode === "taxable" ? "Netto" : "Preis", x, y - 16, columns.price - 7, bold, 8, rgb(1, 1, 1)); x += columns.price;
    if (invoice.taxMode === "taxable") { right(page, "USt.", x, y - 16, columns.vat - 7, bold, 8, rgb(1, 1, 1)); x += columns.vat; }
    right(page, "Betrag", x, y - 16, columns.amount - 8, bold, 8, rgb(1, 1, 1));
    y -= 25;
  };
  drawTableHeader();
  for (const item of invoice.items) {
    const lines = wrap(item.description, regular, 8.5, columns.description - 16);
    const height = Math.max(34, lines.length * 11 + 15);
    if (y - height < 150) { newPage(); drawTableHeader(); }
    let x = margin + 8;
    lines.forEach((line, index) => page.drawText(line, { x, y: y - 14 - index * 11, size: 8.5, font: regular, color: ink })); x += columns.description;
    right(page, `${item.quantity.toLocaleString("de-AT")} ${item.unit}`, x, y - 16, columns.quantity - 7, regular, 8); x += columns.quantity;
    right(page, formatInvoiceMoney(item.unitPriceCents, invoice.currency), x, y - 16, columns.price - 7, regular, 8); x += columns.price;
    if (invoice.taxMode === "taxable") { right(page, `${item.vatRate}%`, x, y - 16, columns.vat - 7, regular, 8); x += columns.vat; }
    right(page, formatInvoiceMoney(item.amountCents, invoice.currency), x, y - 16, columns.amount - 8, bold, 8);
    y -= height;
    page.drawLine({ start: { x: margin, y }, end: { x: A4.width - margin, y }, thickness: 0.5, color: rgb(0.84, 0.82, 0.78) });
  }

  if (y < 180) newPage();
  y -= 24;
  const totalsX = 340;
  if (invoice.taxMode === "taxable") {
    page.drawText("Netto", { x: totalsX, y, size: 8, font: regular, color: muted });
    right(page, formatInvoiceMoney(invoice.subtotalCents, invoice.currency), totalsX, y, A4.width - margin - totalsX, regular, 8); y -= 15;
    page.drawText("USt.", { x: totalsX, y, size: 8, font: regular, color: muted });
    right(page, formatInvoiceMoney(invoice.taxCents, invoice.currency), totalsX, y, A4.width - margin - totalsX, regular, 8); y -= 20;
  }
  page.drawText(invoice.documentType === "cancellation" ? "STORNOBETRAG" : "GESAMTBETRAG", { x: totalsX, y, size: 9, font: bold, color: muted });
  right(page, formatInvoiceMoney(invoice.totalCents, invoice.currency), totalsX, y - 3, A4.width - margin - totalsX, bold, 15); y -= 42;

  if (invoice.cancellationReason) {
    page.drawText(`Stornogrund: ${safeText(invoice.cancellationReason)}`, { x: margin, y, size: 8.5, font: regular, color: muted }); y -= 24;
  }
  const noticeLines = wrap(`Hinweis: ${invoice.taxNotice}`, regular, 8, contentWidth - 20);
  const noticeHeight = noticeLines.length * 11 + 18;
  page.drawRectangle({ x: margin, y: y - noticeHeight + 8, width: contentWidth, height: noticeHeight, color: paper });
  noticeLines.forEach((line, index) => page.drawText(line, { x: margin + 10, y: y - 5 - index * 11, size: 8, font: regular, color: muted })); y -= noticeHeight + 14;
  page.drawText(invoice.issuer.name, { x: margin, y, size: 8.5, font: bold, color: ink }); y -= 13;
  const footer = `${invoice.issuer.addressLine1} · ${invoice.issuer.postalCode} ${invoice.issuer.city} · IBAN: ${invoice.issuer.iban}${invoice.issuer.bic ? ` · BIC: ${invoice.issuer.bic}` : ""}`;
  wrap(footer, regular, 7.5, contentWidth).forEach((line, index) => page.drawText(line, { x: margin, y: y - index * 10, size: 7.5, font: regular, color: muted }));
  page.drawText(`Steuernummer: ${invoice.issuer.taxNumber}${invoice.issuer.uid ? ` · UID: ${invoice.issuer.uid}` : ""}`, { x: margin, y: y - 20, size: 7.5, font: regular, color: muted });

  pdf.setTitle(`${invoiceTitle(invoice.documentType)} ${invoice.number}`);
  pdf.setAuthor(invoice.issuer.name);
  return Buffer.from(await pdf.save());
}
