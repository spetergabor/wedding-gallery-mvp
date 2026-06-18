"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { createSignedContractObjectKey, getPhotoPublicUrl, savePhotoObject } from "@/lib/storage";

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
    timeStyle: "short"
  });
}

function pdfText(value: string) {
  return value
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
    .replace(/[^\x20-\x7E]/g, "");
}

async function createSignedPdf({
  sourcePdfUrl,
  signatureBytes,
  coupleName,
  contractTitle,
  signedAt
}: {
  sourcePdfUrl: string;
  signatureBytes: Buffer;
  coupleName: string;
  contractTitle: string;
  signedAt: Date;
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
  signaturePage.drawText("Dieses Dokument wurde elektronisch signiert.", {
    x: 56,
    y: 72,
    size: 10,
    font,
    color: rgb(0.45, 0.45, 0.45)
  });

  return Buffer.from(await pdf.save());
}

export async function signContractAction(token: string, formData: FormData) {
  const signatureBytes = parseSignatureDataUrl(formData.get("signatureData"));

  if (!signatureBytes || signatureBytes.length < 500) {
    redirect(`/contracts/${token}?signError=missing`);
  }

  const contract = await prisma.contract.findUnique({
    where: { accessToken: token },
    include: {
      customer: {
        select: {
          coupleName: true
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

  try {
    const signedPdfBytes = await createSignedPdf({
      sourcePdfUrl: contract.fileUrl,
      signatureBytes,
      coupleName: contract.customer.coupleName,
      contractTitle: contract.title,
      signedAt
    });
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
        signedFileUrl: getPhotoPublicUrl(signedR2Key)
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
