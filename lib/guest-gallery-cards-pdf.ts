import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";
import { guestGalleryCardText } from "@/lib/guest-gallery-card-text";

// Break long words too, so custom titles and domains stay inside the card.
function linesFor(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.replace(/[\u0000-\u001f]/g, " ").split(/\s+/)) {
    if (line && font.widthOfTextAtSize(`${line} ${word}`, size) > width) {
      lines.push(line);
      line = "";
    }
    for (const character of (line ? " " : "") + word) {
      if (line && font.widthOfTextAtSize(line + character, size) > width) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function createGuestGalleryCardsPdf(input: {
  title: string;
  businessName: string;
  publicUrl: string;
  language?: string | null;
}) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile(path.join(process.cwd(), "public/fonts/album-export/montserrat-600.ttf")), { subset: true });
  const qr = await pdf.embedPng(await QRCode.toBuffer(`${input.publicUrl}#guest-photos`, {
    errorCorrectionLevel: "M", margin: 1, width: 600,
    color: { dark: "#111111", light: "#ffffff" }
  }));
  const mm = (value: number) => value * 72 / 25.4;
  const page = pdf.addPage([mm(210), mm(297)]);
  const ink = rgb(0.067, 0.067, 0.067);
  const muted = rgb(0.4, 0.4, 0.4);
  const textWidth = mm(41);
  const url = new URL(input.publicUrl);
  const fitLines = (text: string, size: number, max: number) => {
    const lines = linesFor(text, font, size, textWidth);
    if (lines.length <= max) return lines;
    const result = lines.slice(0, max);
    let last = result[max - 1];
    while (last && font.widthOfTextAtSize(last + "…", size) > textWidth) last = last.slice(0, -1);
    result[max - 1] = last.trimEnd() + "…";
    return result;
  };
  for (let index = 0; index < 8; index++) {
    const x = mm(17.5 + (index % 2) * 90);
    const y = mm(297 - 10 - Math.floor(index / 2) * 60 - 55);
    page.drawRectangle({ x, y, width: mm(85), height: mm(55), borderWidth: 0.5, borderColor: rgb(0.84, 0.84, 0.84), color: rgb(1, 1, 1) });
    const draw = (lines: string[], size: number, top: number, leading: number, color = ink) => {
      lines.forEach((text, i) => page.drawText(text, { x: x + mm(5), y: y + mm(55 - top) - size - i * leading, font, size, color }));
    };
    draw(fitLines(input.businessName.toUpperCase(), 7, 1), 7, 5, 9, muted);
    draw(fitLines(input.title, 13, 2), 13, 10, 15);
    const body = guestGalleryCardText(input.language);
    let bodySize = 8;
    while (linesFor(body, font, bodySize, textWidth).length * bodySize * 1.35 > mm(18) && bodySize > 6) bodySize -= 0.25;
    draw(linesFor(body, font, bodySize, textWidth), bodySize, 23, bodySize * 1.35, muted);
    draw(fitLines(url.host + url.pathname, 6.5, 1), 6.5, 47, 8, muted);
    page.drawImage(qr, { x: x + mm(50), y: y + mm(13), width: mm(29), height: mm(29) });
  }
  pdf.setTitle(`${input.title} – QR-kártyák`);
  return pdf.save();
}
