"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";
import {
  contractFieldDisplayLabel,
  contractFieldInputName,
  fieldKeysInContractTemplate,
  parseContractFields,
  renderContractTemplateText
} from "@/lib/contract-fields";
import { contractBodyToPlainText } from "@/lib/contract-rich-text";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { prisma } from "@/lib/prisma";
import { createSignedContractObjectKey, getPhotoPublicUrl, savePhotoObject } from "@/lib/storage";

type ContractAuditEvidence = {
  contractId: string;
  contractTitle: string;
  customerName: string;
  signedAtIso: string;
  documentHash: string;
  signedPdfHash?: string;
  ipAddress: string | null;
  userAgent: string | null;
  acceptedTermsAtIso: string;
  acceptedPrivacyAtIso: string;
  signatureMethod: "drawn_signature";
  tokenHash: string;
};

function parseSignatureDataUrl(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);

  if (!match) {
    return null;
  }

  return Buffer.from(match[1], "base64");
}

function formatDate(date: Date) {
  return date.toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE
  });
}

function sha256Hex(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

async function readSignatureRequestMetadata() {
  const headerStore = await headers();

  return {
    ipAddress: firstForwardedIp(headerStore.get("x-forwarded-for")) ?? headerStore.get("x-real-ip"),
    userAgent: headerStore.get("user-agent")
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));

    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`).join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}

function pdfText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[őöó]/g, "o")
    .replace(/[ŐÖÓ]/g, "O")
    .replace(/[űüú]/g, "u")
    .replace(/[ŰÜÚ]/g, "U")
    .replace(/[áä]/g, "a")
    .replace(/[ÁÄ]/g, "A")
    .replace(/[é]/g, "e")
    .replace(/[É]/g, "E")
    .replace(/[í]/g, "i")
    .replace(/[Í]/g, "I")
    .replace(/[^\x09\x0A\x20-\x7E]/g, "");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];

  for (const paragraph of pdfText(text).split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;

      if (font.widthOfTextAtSize(testLine, size) <= maxWidth) {
        line = testLine;
      } else {
        if (line) {
          lines.push(line);
        }
        line = word;
      }
    }

    if (line) {
      lines.push(line);
    }
  }

  return lines;
}

function drawWrappedText({
  page,
  text,
  x,
  y,
  maxWidth,
  font,
  size,
  lineHeight,
  color = rgb(0.12, 0.12, 0.12)
}: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  font: PDFFont;
  size: number;
  lineHeight: number;
  color?: ReturnType<typeof rgb>;
}) {
  let cursorY = y;

  for (const line of wrapText(text, font, size, maxWidth)) {
    if (line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
    }
    cursorY -= lineHeight;
  }

  return cursorY;
}

async function drawAuditPage(pdf: PDFDocument, evidence: ContractAuditEvidence) {
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const rows = [
    ["Vertrag", evidence.contractTitle],
    ["Kunde", evidence.customerName],
    ["Unterzeichnet am", formatDate(new Date(evidence.signedAtIso))],
    ["Signaturmethode", "Gezeichnete elektronische Unterschrift"],
    ["Dokument SHA-256", evidence.documentHash],
    ["Signiertes PDF SHA-256", evidence.signedPdfHash ?? "wird nach Erstellung gespeichert"],
    ["Token SHA-256", evidence.tokenHash],
    ["IP-Adresse", evidence.ipAddress ?? "nicht verfügbar"],
    ["User-Agent", evidence.userAgent ?? "nicht verfügbar"],
    ["Vertragsannahme", formatDate(new Date(evidence.acceptedTermsAtIso))],
    ["Datenschutz-Hinweis", formatDate(new Date(evidence.acceptedPrivacyAtIso))]
  ];
  let y = height - 72;

  page.drawText("Audit Trail", {
    x: 56,
    y,
    size: 22,
    font: boldFont,
    color: rgb(0.09, 0.09, 0.09)
  });
  y -= 28;
  y = drawWrappedText({
    page,
    text: "Dieses Blatt dokumentiert die elektronische Annahme des Vertrags. Es dient als technischer Nachweis der Version, der Unterschrift und der Annahmeerklärungen.",
    x: 56,
    y,
    maxWidth: width - 112,
    font,
    size: 10,
    lineHeight: 14,
    color: rgb(0.35, 0.35, 0.35)
  });
  y -= 22;

  for (const [label, value] of rows) {
    page.drawText(pdfText(label), {
      x: 56,
      y,
      size: 9,
      font: boldFont,
      color: rgb(0.35, 0.35, 0.35)
    });
    y -= 14;
    y = drawWrappedText({
      page,
      text: value,
      x: 56,
      y,
      maxWidth: width - 112,
      font,
      size: 9,
      lineHeight: 12,
      color: rgb(0.12, 0.12, 0.12)
    });
    y -= 10;
  }
}

async function fetchSignaturePngBytes(signatureUrl: string | null | undefined) {
  if (!signatureUrl) {
    return null;
  }

  const response = await fetch(signatureUrl, { cache: "no-store" });

  if (!response.ok) {
    console.warn("Photographer signature could not be downloaded", {
      signatureUrl,
      status: response.status
    });
    return null;
  }

  return Buffer.from(await response.arrayBuffer());
}

async function createSignedUploadedPdf({
  sourcePdfUrl,
  photographerSignatureBytes,
  photographerName,
  signatureBytes,
  coupleName,
  contractTitle,
  signedAt,
  evidence
}: {
  sourcePdfUrl: string;
  photographerSignatureBytes: Buffer | null;
  photographerName: string;
  signatureBytes: Buffer;
  coupleName: string;
  contractTitle: string;
  signedAt: Date;
  evidence: ContractAuditEvidence;
}) {
  const sourceResponse = await fetch(sourcePdfUrl, { cache: "no-store" });

  if (!sourceResponse.ok) {
    throw new Error(`Original contract PDF could not be downloaded: ${sourceResponse.status}`);
  }

  const sourceBytes = Buffer.from(await sourceResponse.arrayBuffer());
  const pdf = await PDFDocument.load(sourceBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const signatureImage = await pdf.embedPng(signatureBytes);
  const signaturePage = pdf.addPage([595.28, 841.89]);
  const { width, height } = signaturePage.getSize();
  const signatureSize = signatureImage.scaleToFit(360, 130);

  signaturePage.drawText("Digitale Unterschrift", {
    x: 56,
    y: height - 96,
    size: 22,
    font: boldFont,
    color: rgb(0.09, 0.09, 0.09)
  });
  signaturePage.drawText(pdfText(contractTitle), {
    x: 56,
    y: height - 128,
    size: 12,
    font,
    color: rgb(0.35, 0.35, 0.35)
  });
  signaturePage.drawText(pdfText(`Paar / Kunde: ${coupleName}`), {
    x: 56,
    y: height - 168,
    size: 12,
    font,
    color: rgb(0.12, 0.12, 0.12)
  });
  signaturePage.drawText(pdfText(`Unterzeichnet am: ${formatDate(signedAt)}`), {
    x: 56,
    y: height - 188,
    size: 12,
    font,
    color: rgb(0.12, 0.12, 0.12)
  });

  signaturePage.drawRectangle({
    x: 56,
    y: height - 380,
    width: width - 112,
    height: 170,
    borderColor: rgb(0.86, 0.84, 0.78),
    borderWidth: 1,
    color: rgb(0.98, 0.97, 0.94)
  });
  signaturePage.drawImage(signatureImage, {
    x: 80,
    y: height - 345,
    width: signatureSize.width,
    height: signatureSize.height
  });
  signaturePage.drawLine({
    start: { x: 80, y: height - 360 },
    end: { x: 410, y: height - 360 },
    thickness: 1,
    color: rgb(0.25, 0.25, 0.25)
  });
  signaturePage.drawText("Unterschrift", {
    x: 80,
    y: height - 382,
    size: 10,
    font,
    color: rgb(0.45, 0.45, 0.45)
  });

  if (photographerSignatureBytes) {
    const photographerSignatureImage = await pdf.embedPng(photographerSignatureBytes);
    const photographerSignatureSize = photographerSignatureImage.scaleToFit(240, 80);
    const blockY = height - 560;

    signaturePage.drawText("Fotograf", {
      x: 56,
      y: blockY + 96,
      size: 14,
      font: boldFont,
      color: rgb(0.09, 0.09, 0.09)
    });
    signaturePage.drawImage(photographerSignatureImage, {
      x: 56,
      y: blockY + 28,
      width: photographerSignatureSize.width,
      height: photographerSignatureSize.height
    });
    signaturePage.drawLine({
      start: { x: 56, y: blockY + 18 },
      end: { x: 300, y: blockY + 18 },
      thickness: 1,
      color: rgb(0.25, 0.25, 0.25)
    });
    signaturePage.drawText(pdfText(photographerName), {
      x: 56,
      y: blockY,
      size: 11,
      font,
      color: rgb(0.45, 0.45, 0.45)
    });
  }

  signaturePage.drawText("Dieses Dokument wurde elektronisch signiert.", {
    x: 56,
    y: 72,
    size: 10,
    font,
    color: rgb(0.45, 0.45, 0.45)
  });

  await drawAuditPage(pdf, evidence);

  return Buffer.from(await pdf.save());
}

async function createSignedWrittenPdf({
  bodyText,
  answers,
  photographerSignatureBytes,
  photographerName,
  signatureBytes,
  coupleName,
  contractTitle,
  signedAt,
  evidence
}: {
  bodyText: string;
  answers: Array<{ label: string; value: string }>;
  photographerSignatureBytes: Buffer | null;
  photographerName: string;
  signatureBytes: Buffer;
  coupleName: string;
  contractTitle: string;
  signedAt: Date;
  evidence: ContractAuditEvidence;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const signatureImage = await pdf.embedPng(signatureBytes);
  const margin = 56;
  const pageSize: [number, number] = [595.28, 841.89];
  let page = pdf.addPage(pageSize);
  let { width, height } = page.getSize();
  let y = height - 72;

  function ensureSpace(requiredHeight: number) {
    if (y - requiredHeight >= margin) {
      return;
    }

    page = pdf.addPage(pageSize);
    ({ width, height } = page.getSize());
    y = height - 72;
  }

  function drawWrappedTextOnPages({
    text,
    x,
    maxWidth,
    font,
    size,
    lineHeight,
    color = rgb(0.12, 0.12, 0.12)
  }: {
    text: string;
    x: number;
    maxWidth: number;
    font: PDFFont;
    size: number;
    lineHeight: number;
    color?: ReturnType<typeof rgb>;
  }) {
    for (const line of wrapText(text, font, size, maxWidth)) {
      ensureSpace(lineHeight);

      if (line) {
        page.drawText(line, { x, y, size, font, color });
      }

      y -= lineHeight;
    }
  }

  page.drawText(pdfText(contractTitle), {
    x: margin,
    y,
    size: 22,
    font: boldFont,
    color: rgb(0.09, 0.09, 0.09)
  });
  y -= 30;
  page.drawText(pdfText(`Paar / Kunde: ${coupleName}`), {
    x: margin,
    y,
    size: 11,
    font,
    color: rgb(0.35, 0.35, 0.35)
  });
  y -= 34;
  drawWrappedTextOnPages({
    text: bodyText,
    x: margin,
    maxWidth: width - margin * 2,
    font,
    size: 11,
    lineHeight: 16
  });

  if (answers.length > 0) {
    ensureSpace(80);
    y -= 18;
    page.drawText("Ausgefüllte Kundendaten", {
      x: margin,
      y,
      size: 15,
      font: boldFont,
      color: rgb(0.09, 0.09, 0.09)
    });
    y -= 24;

    for (const answer of answers) {
      ensureSpace(42);
      page.drawText(pdfText(answer.label), {
        x: margin,
        y,
        size: 9,
        font: boldFont,
        color: rgb(0.35, 0.35, 0.35)
      });
      y -= 14;
      drawWrappedTextOnPages({
        text: answer.value || "-",
        x: margin,
        maxWidth: width - margin * 2,
        font,
        size: 11,
        lineHeight: 15
      });
      y -= 8;
    }
  }

  ensureSpace(250);
  y -= 18;
  page.drawText("Digitale Unterschrift", {
    x: margin,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0.09, 0.09, 0.09)
  });
  y -= 22;
  page.drawText(pdfText(`Unterzeichnet am: ${formatDate(signedAt)}`), {
    x: margin,
    y,
    size: 11,
    font,
    color: rgb(0.12, 0.12, 0.12)
  });
  y -= 170;

  const signatureSize = signatureImage.scaleToFit(360, 120);
  page.drawRectangle({
    x: margin,
    y,
    width: width - margin * 2,
    height: 145,
    borderColor: rgb(0.86, 0.84, 0.78),
    borderWidth: 1,
    color: rgb(0.98, 0.97, 0.94)
  });
  page.drawImage(signatureImage, {
    x: margin + 24,
    y: y + 34,
    width: signatureSize.width,
    height: signatureSize.height
  });
  page.drawLine({
    start: { x: margin + 24, y: y + 22 },
    end: { x: margin + 354, y: y + 22 },
    thickness: 1,
    color: rgb(0.25, 0.25, 0.25)
  });
  page.drawText("Unterschrift", {
    x: margin + 24,
    y: y + 5,
    size: 10,
    font,
    color: rgb(0.45, 0.45, 0.45)
  });

  if (photographerSignatureBytes) {
    ensureSpace(170);
    y -= 48;

    const photographerSignatureImage = await pdf.embedPng(photographerSignatureBytes);
    const photographerSignatureSize = photographerSignatureImage.scaleToFit(240, 80);

    page.drawText("Fotograf", {
      x: margin,
      y,
      size: 15,
      font: boldFont,
      color: rgb(0.09, 0.09, 0.09)
    });
    y -= 88;
    page.drawImage(photographerSignatureImage, {
      x: margin,
      y,
      width: photographerSignatureSize.width,
      height: photographerSignatureSize.height
    });
    y -= 12;
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + 250, y },
      thickness: 1,
      color: rgb(0.25, 0.25, 0.25)
    });
    y -= 20;
    page.drawText(pdfText(photographerName), {
      x: margin,
      y,
      size: 11,
      font,
      color: rgb(0.45, 0.45, 0.45)
    });
  }

  await drawAuditPage(pdf, evidence);

  return Buffer.from(await pdf.save());
}

function readClientFieldAnswers(formData: FormData, fields: ReturnType<typeof parseContractFields>) {
  return Object.fromEntries(
    fields.map((field) => {
      const value = formData.get(contractFieldInputName(field.key));

      return [field.key, typeof value === "string" ? value.trim() : ""];
    })
  );
}

export async function signContractAction(token: string, formData: FormData) {
  const signatureBytes = parseSignatureDataUrl(formData.get("signatureData"));
  const acceptedTerms = formData.get("acceptedTerms") === "on";
  const acceptedPrivacy = formData.get("acceptedPrivacy") === "on";

  if (!signatureBytes || signatureBytes.length < 500) {
    redirect(`/contracts/${token}?signError=missing`);
  }

  if (!acceptedTerms || !acceptedPrivacy) {
    redirect(`/contracts/${token}?signError=consent`);
  }

  const contract = await prisma.contract.findUnique({
    where: { accessToken: token },
    include: {
      customer: {
        select: {
          coupleName: true,
          adminId: true,
          admin: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  if (!contract || !contract.accessTokenExpiresAt || contract.accessTokenExpiresAt < new Date()) {
    redirect(`/contracts/${token}?signError=expired`);
  }

  if (contract.signedAt && contract.signedFileUrl) {
    redirect(`/contracts/${token}?signed=1`);
  }

  const signedAt = new Date();
  const acceptedTermsAt = signedAt;
  const acceptedPrivacyAt = signedAt;

  try {
    const requestMetadata = await readSignatureRequestMetadata();
    const settings = await prisma.siteSettings.findFirst({
      where: contract.customer.adminId
        ? { adminId: contract.customer.adminId }
        : { id: "default" },
      select: { businessName: true, signatureUrl: true }
    });
    const photographerSignatureBytes = await fetchSignaturePngBytes(settings?.signatureUrl);
    const photographerName = contract.customer.admin?.name?.trim() || settings?.businessName?.trim() || "Fotograf";
    const clientFields = parseContractFields(contract.clientFields);
    const completedFields = contract.sourceType === "written" ? readClientFieldAnswers(formData, clientFields) : {};
    const templateFieldKeys = fieldKeysInContractTemplate(contract.bodyText ?? "");
    const renderedBodyText = renderContractTemplateText(contract.bodyText ?? "", completedFields);
    const renderedPlainText = contract.sourceType === "written" ? contractBodyToPlainText(renderedBodyText) : renderedBodyText;
    const documentHash =
      contract.sourceType === "written"
        ? sha256Hex(canonicalJson({ title: contract.title, renderedBodyText, renderedPlainText, completedFields }))
        : contract.documentHash ??
          sha256Hex(
            canonicalJson({
              contractId: contract.id,
              title: contract.title,
              sourceType: contract.sourceType,
              fileUrl: contract.fileUrl
            })
          );
    const evidence: ContractAuditEvidence = {
      contractId: contract.id,
      contractTitle: contract.title,
      customerName: contract.customer.coupleName,
      signedAtIso: signedAt.toISOString(),
      documentHash,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      acceptedTermsAtIso: acceptedTermsAt.toISOString(),
      acceptedPrivacyAtIso: acceptedPrivacyAt.toISOString(),
      signatureMethod: "drawn_signature",
      tokenHash: sha256Hex(token)
    };
    const signedPdfBytes =
      contract.sourceType === "written"
        ? await createSignedWrittenPdf({
            bodyText: renderedPlainText,
            answers: clientFields
              .filter((field) => !templateFieldKeys.has(field.key))
              .map((field) => ({
                label: contractFieldDisplayLabel(field),
                value: completedFields[field.key] ?? ""
              })),
            photographerSignatureBytes,
            photographerName,
            signatureBytes,
            coupleName: contract.customer.coupleName,
            contractTitle: contract.title,
            signedAt,
            evidence
          })
        : await createSignedUploadedPdf({
            sourcePdfUrl: contract.fileUrl,
            photographerSignatureBytes,
            photographerName,
            signatureBytes,
            coupleName: contract.customer.coupleName,
            contractTitle: contract.title,
            signedAt,
            evidence
          });
    const signedPdfHash = sha256Hex(signedPdfBytes);
    const auditTrail = {
      ...evidence,
      signedPdfHash,
      evidenceHash: sha256Hex(canonicalJson({ ...evidence, signedPdfHash }))
    };
    const signedR2Key = createSignedContractObjectKey({
      customerId: contract.customerId,
      contractId: contract.id
    });

    await savePhotoObject({
      r2Key: signedR2Key,
      bytes: signedPdfBytes,
      contentType: "application/pdf"
    });

    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: "signed",
        signedAt,
        signedR2Key,
        signedFileUrl: getPhotoPublicUrl(signedR2Key),
        completedFields,
        documentHash,
        signedPdfHash,
        signatureIpAddress: requestMetadata.ipAddress,
        signatureUserAgent: requestMetadata.userAgent,
        acceptedTermsAt,
        acceptedPrivacyAt,
        auditTrail
      }
    });
  } catch (error) {
    console.error("Contract signing failed", {
      contractId: contract.id,
      customerId: contract.customerId,
      fileUrl: contract.fileUrl,
      error
    });
    redirect(`/contracts/${token}?signError=server`);
  }

  revalidatePath(`/contracts/${token}`);
  redirect(`/contracts/${token}?signed=1`);
}
