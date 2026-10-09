import type { GalleryEmailCover } from "@/lib/gallery-email-cover";
import type { CustomerLanguage } from "@/lib/customer-language";
import { emailImageUrl } from "@/lib/email-image-url";

function asEmailLanguage(language?: CustomerLanguage) { return language === "hu" ? "hu" : "de"; }
function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

export function safeMessageLink(value: string) {
  try {
    const url = new URL(value.trim());
    return ["http:", "https:", "mailto:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
// A small, explicit formatting vocabulary. Raw HTML is always escaped.
function inlineMessage(text: string, depth = 0): string {
  if (depth > 3) return escapeHtml(text);
  const tokens = /\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|(https?:\/\/[^\s<>]+|mailto:[^\s<>]+)/g;
  let html = "";
  let end = 0;
  for (const match of text.matchAll(tokens)) {
    html += escapeHtml(text.slice(end, match.index));
    if (match[1]) {
      const href = safeMessageLink(match[2]);
      html += href ? `<a href="${escapeHtml(href)}" style="color: #363b35; text-decoration: underline;">${escapeHtml(match[1])}</a>` : escapeHtml(match[1]);
    } else if (match[3]) html += `<strong>${inlineMessage(match[3], depth + 1)}</strong>`;
    else if (match[4]) html += `<em>${inlineMessage(match[4], depth + 1)}</em>`;
    else {
      const raw = match[5];
      const trimmed = raw.replace(/[.,!?;:]+$/, "");
      const href = safeMessageLink(trimmed);
      html += href ? `<a href="${escapeHtml(href)}" style="color: #363b35; text-decoration: underline;">${escapeHtml(trimmed)}</a>${escapeHtml(raw.slice(trimmed.length))}` : escapeHtml(raw);
    }
    end = match.index! + match[0].length;
  }
  return html + escapeHtml(text.slice(end));
}

export function galleryMessageHtml(message: string) {
  return message.trim().replace(/\r\n?/g, "\n").split(/\n[ \t]*\n+/).map(block => {
    const lines = block.split("\n");
    if (lines.every(line => /^[-*] /.test(line))) return `<ul style="margin: 0 0 24px; padding-left: 24px;">${lines.map(line => `<li>${inlineMessage(line.slice(2))}</li>`).join("")}</ul>`;
    return `<p style="margin: 0 0 24px;">${lines.map(line => inlineMessage(line)).join("<br>")}</p>`;
  }).join("");
}

export function galleryMessageText(message: string) {
  return message.replace(/\[([^\]\n]+)\]\(([^\s)]+)\)/g, (_, label, url) => safeMessageLink(url) ? `${label} (${url})` : label).replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/\*([^*\n]+)\*/g, "$1");
}

export function getFinalGalleryEmailDraft(title: string, language?: CustomerLanguage, downloadsEnabled = true) {
  const hu = language === "hu";
  return {
    subject: `${title} – ${hu ? "Elkészültek a képeid" : "Deine fertigen Bilder sind bereit"}`,
    message: hu
      ? `Szia!\n\nA galéria végleges képei már elérhetők számodra.\n\n${downloadsEnabled ? "Az alábbi linken megtekintheted és letöltheted őket." : "Az alábbi linken megtekintheted a képeket."}`
      : `Hallo,\n\ndie fertig bearbeiteten Bilder der Galerie sind jetzt für dich bereit.\n\n${downloadsEnabled ? "Über den folgenden Link kannst du die Bilder ansehen und herunterladen." : "Über den folgenden Link kannst du die Bilder ansehen."}`
  };
}

export function galleryEmailCta(kind: "proofing" | "final", language?: CustomerLanguage) {
  return kind === "proofing" ? (language === "hu" ? "Képek kiválasztása" : "Bildauswahl öffnen") : (language === "hu" ? "Galéria megnyitása" : "Galerie öffnen");
}

export function galleryEmailHtml({ galleryTitle, senderName, replyTo, message, url, cta, language, cover }: {
  cover?: GalleryEmailCover | null;
  galleryTitle: string;
  senderName: string;
  replyTo: string;
  message: string;
  url: string;
  cta: string;
  language?: CustomerLanguage;
}) {
  const coverUrl = cover ? emailImageUrl(cover.url, url) : null;
  const coverAlt = `${galleryTitle} – ${asEmailLanguage(language) === "hu" ? "a galéria borítóképe" : "Titelbild der Galerie"}`;
  const replyHint = asEmailLanguage(language) === "hu"
    ? "Ha kérdésed van, egyszerűen válaszolj erre a levélre."
    : "Wenn du Fragen hast, antworte einfach auf diese E-Mail.";
  const paragraphs = galleryMessageHtml(message);
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f2f2" style="width: 100%; background: #f2f2f2; border-collapse: collapse;">
      <tr><td align="center" style="padding: 24px 12px 40px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width: 100%; max-width: 600px; background: #ffffff; border-collapse: collapse;">
          ${coverUrl ? `<tr><td style="padding: 0;"><a href="${escapeHtml(url)}" style="text-decoration: none;"><img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(coverAlt)}" width="600" border="0" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; color: #666; font-family: Arial, sans-serif; font-size: 14px;"></a></td></tr>` : ""}
          <tr><td style="padding: 48px 10% 44px; font-family: Arial, sans-serif; color: #555555; font-size: 16px; line-height: 1.8; overflow-wrap: anywhere;">
            ${paragraphs}
            <p style="margin: 32px 0 16px; color: #333333; font-size: 18px; font-weight: 600;">${escapeHtml(galleryTitle)}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 32px;"><tr><td bgcolor="#363b35" style="background: #363b35; border: 1px solid #363b35; text-align: center; mso-padding-alt: 12px 24px;">
              <a href="${escapeHtml(url)}" style="display: inline-block; padding: 12px 24px; color: #ffffff; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; font-weight: 600; text-decoration: none;">${escapeHtml(cta)}</a>
            </td></tr></table>
            <p style="margin: 0 0 24px; font-size: 14px; color: #777777;">${escapeHtml(replyHint)}</p>
            <p style="margin: 0; color: #444444;">${escapeHtml(senderName || galleryTitle)}<br><a href="mailto:${escapeHtml(replyTo)}" style="color: #777777; text-decoration: none; font-size: 13px;">${escapeHtml(replyTo)}</a></p>
          </td></tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td></tr>
    </table>
  `;
}
