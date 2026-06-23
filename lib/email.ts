import { APP_TIME_ZONE } from "@/lib/date-format";

type AdminFavoriteListSubmittedEmail = {
  to?: string;
  galleryTitle: string;
  galleryAdminUrl: string;
  clientEmail: string;
  listName: string;
  filenames: string[];
  submittedAt: Date;
};

type ContractSignatureRequestEmail = {
  to: string[];
  coupleName: string;
  contractTitle: string;
  contractUrl: string;
};

type CustomerInvoiceEmail = {
  to: string[];
  coupleName: string;
  invoiceTitle: string;
  invoiceUrl: string;
  amountLabel?: string | null;
  dueDateLabel?: string | null;
};

type ClientProofingInviteEmail = {
  to: string;
  galleryTitle: string;
  proofingGalleryUrl: string;
};

type ClientFinalDeliveryEmail = {
  to: string;
  galleryTitle: string;
  galleryUrl: string;
  downloadsEnabled: boolean;
};

type AdminGalleryZipReadyEmail = {
  to?: string;
  galleryTitle: string;
  galleryAdminUrl: string;
  galleryPublicUrl: string;
  photoCount: number;
  fileSizeBytes?: bigint | number | null;
  generatedAt: Date;
};

type GuestGalleryDownloadReadyEmail = {
  to: string;
  galleryTitle: string;
  downloadUrl?: string;
  downloadLinks?: Array<{
    label: string;
    url: string;
    fileSizeBytes?: bigint | number | null;
  }>;
  expiresAt: Date;
  photoCount: number;
  fileSizeBytes?: bigint | number | null;
};

export function appBaseUrl() {
  const rawUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "https://gallery.hochzeitsfotografgraz.at"
  ).replace(/\/$/, "");

  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }

  return `https://${rawUrl}`;
}

function emailConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM ?? "Wedding Gallery <onboarding@resend.dev>",
    adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function filenamesText(filenames: string[]) {
  return filenames.join("\n");
}

function formatBytes(value?: bigint | number | null) {
  if (value === undefined || value === null) {
    return null;
  }

  const bytes = typeof value === "bigint" ? Number(value) : value;

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function favoriteListSubmittedHtml({
  galleryTitle,
  galleryAdminUrl,
  clientEmail,
  listName,
  filenames,
  submittedAt
}: AdminFavoriteListSubmittedEmail) {
  const escapedFilenames = escapeHtml(filenamesText(filenames));

  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Kedvenc lista lezárva</h1>
      <p style="margin: 0 0 18px;">Egy ügyfél lezárta a válogatását.</p>
      <table style="border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Galéria</td><td style="padding: 4px 0;"><strong>${escapeHtml(galleryTitle)}</strong></td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Lista</td><td style="padding: 4px 0;">${escapeHtml(listName)}</td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Email</td><td style="padding: 4px 0;">${escapeHtml(clientEmail)}</td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Képek</td><td style="padding: 4px 0;">${filenames.length}</td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Lezárva</td><td style="padding: 4px 0;">${submittedAt.toLocaleString("hu-HU", { timeZone: APP_TIME_ZONE })}</td></tr>
      </table>
      <p style="margin: 0 0 16px;">
        <a href="${escapeHtml(galleryAdminUrl)}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">Admin galéria megnyitása</a>
      </p>
      <h2 style="font-size: 16px; margin: 24px 0 8px;">Fájlnevek Lightroomhoz</h2>
      <pre style="white-space: pre-wrap; word-break: break-all; background: #f8f7f4; border: 1px solid #e7e3da; padding: 14px; border-radius: 6px; font-family: Menlo, Consolas, monospace; font-size: 13px;">${escapedFilenames}</pre>
    </div>
  `;
}

export async function sendAdminFavoriteListSubmittedEmail(payload: AdminFavoriteListSubmittedEmail) {
  const { apiKey, from, adminEmail } = emailConfig();
  const recipient = payload.to ?? adminEmail;

  if (!apiKey || !recipient) {
    console.warn("Admin email notification skipped. Missing RESEND_API_KEY or ADMIN_NOTIFICATION_EMAIL.");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: recipient,
      subject: `Kedvenc lista lezárva: ${payload.galleryTitle}`,
      html: favoriteListSubmittedHtml(payload),
      text: [
        "Kedvenc lista lezárva",
        "",
        `Galéria: ${payload.galleryTitle}`,
        `Lista: ${payload.listName}`,
        `Email: ${payload.clientEmail}`,
        `Képek: ${payload.filenames.length}`,
        `Admin: ${payload.galleryAdminUrl}`,
        "",
        "Fájlnevek:",
        filenamesText(payload.filenames)
      ].join("\n")
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Admin email notification failed: ${response.status} ${errorText}`);
  }
}

export function adminGalleryUrl(galleryId: string) {
  return `${appBaseUrl()}/admin/galleries/${galleryId}`;
}

export function publicGalleryUrl(slug: string) {
  return `${appBaseUrl()}/g/${slug}`;
}

export function galleryDownloadUrl(token: string) {
  return `${appBaseUrl()}/download/${token}`;
}

function clientProofingInviteHtml({
  galleryTitle,
  proofingGalleryUrl
}: ClientProofingInviteEmail) {
  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Deine Bildauswahl ist bereit</h1>
      <p style="margin: 0 0 18px;">Hallo,</p>
      <p style="margin: 0 0 18px;">die Galerie <strong>${escapeHtml(galleryTitle)}</strong> ist zur Auswahl vorbereitet. Über den folgenden Link kannst du deine Favoriten markieren und die Auswahl anschließend abschicken.</p>
      <p style="margin: 0 0 20px;">
        <a href="${escapeHtml(proofingGalleryUrl)}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">Bildauswahl öffnen</a>
      </p>
      <p style="margin: 0; color: #777; font-size: 13px;">Falls der Button nicht funktioniert, kopiere diesen Link in den Browser:<br>${escapeHtml(proofingGalleryUrl)}</p>
    </div>
  `;
}

export async function sendClientProofingInviteEmail(payload: ClientProofingInviteEmail) {
  const { apiKey, from } = emailConfig();

  if (!apiKey) {
    console.warn("Client proofing invite email skipped. Missing RESEND_API_KEY.");
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: `Deine Bildauswahl ist bereit: ${payload.galleryTitle}`,
      html: clientProofingInviteHtml(payload),
      text: [
        "Deine Bildauswahl ist bereit",
        "",
        `Galerie: ${payload.galleryTitle}`,
        "Öffne den folgenden Link, markiere deine Favoriten und schicke die Auswahl anschließend ab.",
        "",
        `Bildauswahl öffnen: ${payload.proofingGalleryUrl}`
      ].join("\n")
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Client proofing invite email failed: ${response.status} ${errorText}`);
  }

  return true;
}

function clientFinalDeliveryHtml({
  galleryTitle,
  galleryUrl,
  downloadsEnabled
}: ClientFinalDeliveryEmail) {
  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Deine fertigen Bilder sind bereit</h1>
      <p style="margin: 0 0 18px;">Hallo,</p>
      <p style="margin: 0 0 18px;">die fertig bearbeiteten Bilder der Galerie <strong>${escapeHtml(galleryTitle)}</strong> sind jetzt für dich bereit.</p>
      <p style="margin: 0 0 18px;">${downloadsEnabled ? "Über den folgenden Link kannst du die Bilder ansehen und herunterladen." : "Über den folgenden Link kannst du die Bilder ansehen."}</p>
      <p style="margin: 0 0 20px;">
        <a href="${escapeHtml(galleryUrl)}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">Galerie öffnen</a>
      </p>
      <p style="margin: 0; color: #777; font-size: 13px;">Falls der Button nicht funktioniert, kopiere diesen Link in den Browser:<br>${escapeHtml(galleryUrl)}</p>
    </div>
  `;
}

export async function sendClientFinalDeliveryEmail(payload: ClientFinalDeliveryEmail) {
  const { apiKey, from } = emailConfig();

  if (!apiKey) {
    console.warn("Client final delivery email skipped. Missing RESEND_API_KEY.");
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: `Deine fertigen Bilder sind bereit: ${payload.galleryTitle}`,
      html: clientFinalDeliveryHtml(payload),
      text: [
        "Deine fertigen Bilder sind bereit",
        "",
        `Galerie: ${payload.galleryTitle}`,
        payload.downloadsEnabled
          ? "Du kannst die Bilder jetzt ansehen und herunterladen."
          : "Du kannst die Bilder jetzt ansehen.",
        "",
        `Galerie öffnen: ${payload.galleryUrl}`
      ].join("\n")
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Client final delivery email failed: ${response.status} ${errorText}`);
  }

  return true;
}

function galleryZipReadyHtml({
  galleryTitle,
  galleryAdminUrl,
  galleryPublicUrl,
  photoCount,
  fileSizeBytes,
  generatedAt
}: AdminGalleryZipReadyEmail) {
  const formattedSize = formatBytes(fileSizeBytes);

  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Galéria ZIP elkészült</h1>
      <p style="margin: 0 0 18px;">A galéria letölthető ZIP fájlja elkészült, így küldés előtt minden készen áll.</p>
      <table style="border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Galéria</td><td style="padding: 4px 0;"><strong>${escapeHtml(galleryTitle)}</strong></td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Képek</td><td style="padding: 4px 0;">${photoCount}</td></tr>
        ${formattedSize ? `<tr><td style="padding: 4px 16px 4px 0; color: #777;">ZIP méret</td><td style="padding: 4px 0;">${escapeHtml(formattedSize)}</td></tr>` : ""}
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Elkészült</td><td style="padding: 4px 0;">${generatedAt.toLocaleString("hu-HU", { timeZone: APP_TIME_ZONE })}</td></tr>
      </table>
      <p style="margin: 0 0 12px;">
        <a href="${escapeHtml(galleryAdminUrl)}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">Admin galéria megnyitása</a>
      </p>
      <p style="margin: 0; color: #777; font-size: 13px;">Publikus galéria:<br>${escapeHtml(galleryPublicUrl)}</p>
    </div>
  `;
}

export async function sendAdminGalleryZipReadyEmail(payload: AdminGalleryZipReadyEmail) {
  const { apiKey, from, adminEmail } = emailConfig();
  const recipient = payload.to ?? adminEmail;
  const formattedSize = formatBytes(payload.fileSizeBytes);

  if (!apiKey || !recipient) {
    console.warn("Gallery ZIP ready email skipped. Missing RESEND_API_KEY or recipient.");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: recipient,
      subject: `Galéria ZIP elkészült: ${payload.galleryTitle}`,
      html: galleryZipReadyHtml(payload),
      text: [
        "Galéria ZIP elkészült",
        "",
        `Galéria: ${payload.galleryTitle}`,
        `Képek: ${payload.photoCount}`,
        ...(formattedSize ? [`ZIP méret: ${formattedSize}`] : []),
        `Elkészült: ${payload.generatedAt.toLocaleString("hu-HU", { timeZone: APP_TIME_ZONE })}`,
        `Admin: ${payload.galleryAdminUrl}`,
        `Publikus galéria: ${payload.galleryPublicUrl}`
      ].join("\n")
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Gallery ZIP ready email failed: ${response.status} ${errorText}`);
  }
}

function guestGalleryDownloadReadyHtml({
  galleryTitle,
  downloadUrl,
  downloadLinks,
  expiresAt,
  photoCount,
  fileSizeBytes
}: GuestGalleryDownloadReadyEmail) {
  const formattedSize = formatBytes(fileSizeBytes);
  const links =
    downloadLinks && downloadLinks.length > 0
      ? downloadLinks
      : downloadUrl
        ? [{ label: "ZIP herunterladen", url: downloadUrl, fileSizeBytes }]
        : [];

  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Dein Galerie-Download ist bereit</h1>
      <p style="margin: 0 0 18px;">${links.length > 1 ? "Die ZIP-Dateien" : "Die ZIP-Datei"} für <strong>${escapeHtml(galleryTitle)}</strong> ${links.length > 1 ? "wurden" : "wurde"} erstellt.</p>
      <table style="border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Galerie</td><td style="padding: 4px 0;"><strong>${escapeHtml(galleryTitle)}</strong></td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Medien</td><td style="padding: 4px 0;">${photoCount}</td></tr>
        ${formattedSize ? `<tr><td style="padding: 4px 16px 4px 0; color: #777;">ZIP-Größe</td><td style="padding: 4px 0;">${escapeHtml(formattedSize)}</td></tr>` : ""}
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Link gültig bis</td><td style="padding: 4px 0;">${expiresAt.toLocaleString("de-AT", { timeZone: APP_TIME_ZONE })}</td></tr>
      </table>
      <div style="margin: 0 0 18px;">
        ${links
          .map((link) => {
            const linkSize = formatBytes(link.fileSizeBytes);
            return `<p style="margin: 0 0 10px;"><a href="${escapeHtml(link.url)}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">${escapeHtml(link.label)}</a>${linkSize ? ` <span style="color: #777; font-size: 13px;">${escapeHtml(linkSize)}</span>` : ""}</p>`;
          })
          .join("")}
      </div>
      <p style="margin: 0; color: #777; font-size: 13px;">Falls ein Button nicht funktioniert, kopiere den jeweiligen Link in den Browser:<br>${links.map((link) => escapeHtml(link.url)).join("<br>")}</p>
    </div>
  `;
}

export async function sendGuestGalleryDownloadReadyEmail(payload: GuestGalleryDownloadReadyEmail) {
  const { apiKey, from } = emailConfig();
  const formattedSize = formatBytes(payload.fileSizeBytes);
  const links =
    payload.downloadLinks && payload.downloadLinks.length > 0
      ? payload.downloadLinks
      : payload.downloadUrl
        ? [{ label: "Download", url: payload.downloadUrl, fileSizeBytes: payload.fileSizeBytes }]
        : [];

  if (!apiKey) {
    console.warn("Guest ZIP download email skipped. Missing RESEND_API_KEY.");
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: `Dein Galerie-Download ist bereit: ${payload.galleryTitle}`,
      html: guestGalleryDownloadReadyHtml(payload),
      text: [
        "Dein Galerie-Download ist bereit",
        "",
        `Galerie: ${payload.galleryTitle}`,
        `Medien: ${payload.photoCount}`,
        ...(formattedSize ? [`ZIP-Größe: ${formattedSize}`] : []),
        `Link gültig bis: ${payload.expiresAt.toLocaleString("de-AT", { timeZone: APP_TIME_ZONE })}`,
        "",
        ...links.map((link) => `${link.label}: ${link.url}`)
      ].join("\n")
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Guest ZIP download email failed: ${response.status} ${errorText}`);
  }

  return true;
}

function contractSignatureRequestHtml({
  coupleName,
  contractTitle,
  contractUrl
}: ContractSignatureRequestEmail) {
  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Vertrag ansehen</h1>
      <p style="margin: 0 0 18px;">Hallo ${escapeHtml(coupleName)},</p>
      <p style="margin: 0 0 18px;">Das Dokument <strong>${escapeHtml(contractTitle)}</strong> ist bereit. Über die folgende Schaltfläche könnt ihr es öffnen.</p>
      <p style="margin: 0 0 20px;">
        <a href="${escapeHtml(contractUrl)}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">Vertrag öffnen</a>
      </p>
      <p style="margin: 0; color: #777; font-size: 13px;">Falls der Button nicht funktioniert, kopiert diesen Link in den Browser:<br>${escapeHtml(contractUrl)}</p>
    </div>
  `;
}

export async function sendContractSignatureRequestEmail(payload: ContractSignatureRequestEmail) {
  const { apiKey, from } = emailConfig();

  if (!apiKey) {
    console.warn("Contract email skipped. Missing RESEND_API_KEY.");
    return;
  }

  const recipients = [...new Set(payload.to.map((email) => email.trim().toLowerCase()).filter(Boolean))];

  if (recipients.length === 0) {
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `Vertrag ansehen: ${payload.contractTitle}`,
      html: contractSignatureRequestHtml(payload),
      text: [
        `Hallo ${payload.coupleName},`,
        "",
        `Das Dokument ${payload.contractTitle} ist bereit.`,
        `Vertrag öffnen: ${payload.contractUrl}`
      ].join("\n")
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Contract email failed: ${response.status} ${errorText}`);
  }
}

function customerInvoiceHtml({
  coupleName,
  invoiceTitle,
  invoiceUrl,
  amountLabel,
  dueDateLabel
}: CustomerInvoiceEmail) {
  const metaLines = [
    amountLabel ? `<p style="margin: 0 0 8px;"><strong>Betrag:</strong> ${escapeHtml(amountLabel)}</p>` : "",
    dueDateLabel ? `<p style="margin: 0 0 18px;"><strong>Fällig bis:</strong> ${escapeHtml(dueDateLabel)}</p>` : ""
  ].join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Rechnung</h1>
      <p style="margin: 0 0 18px;">Hallo ${escapeHtml(coupleName)},</p>
      <p style="margin: 0 0 18px;">Die Rechnung <strong>${escapeHtml(invoiceTitle)}</strong> ist bereit.</p>
      ${metaLines}
      <p style="margin: 0 0 20px;">
        <a href="${escapeHtml(invoiceUrl)}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">Rechnung öffnen</a>
      </p>
      <p style="margin: 0; color: #777; font-size: 13px;">Falls der Button nicht funktioniert, kopiert diesen Link in den Browser:<br>${escapeHtml(invoiceUrl)}</p>
    </div>
  `;
}

export async function sendCustomerInvoiceEmail(payload: CustomerInvoiceEmail) {
  const { apiKey, from } = emailConfig();

  if (!apiKey) {
    console.warn("Invoice email skipped. Missing RESEND_API_KEY.");
    return;
  }

  const recipients = [...new Set(payload.to.map((email) => email.trim().toLowerCase()).filter(Boolean))];

  if (recipients.length === 0) {
    return;
  }

  const textLines = [
    `Hallo ${payload.coupleName},`,
    "",
    `Die Rechnung ${payload.invoiceTitle} ist bereit.`,
    payload.amountLabel ? `Betrag: ${payload.amountLabel}` : "",
    payload.dueDateLabel ? `Fällig bis: ${payload.dueDateLabel}` : "",
    `Rechnung öffnen: ${payload.invoiceUrl}`
  ].filter(Boolean);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `Rechnung: ${payload.invoiceTitle}`,
      html: customerInvoiceHtml(payload),
      text: textLines.join("\n")
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Invoice email failed: ${response.status} ${errorText}`);
  }
}

export function contractPublicUrl(token: string) {
  return `${appBaseUrl()}/contracts/${token}`;
}
