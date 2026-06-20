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
  downloadUrl: string;
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
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Lezárva</td><td style="padding: 4px 0;">${submittedAt.toLocaleString("hu-HU")}</td></tr>
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
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Elkészült</td><td style="padding: 4px 0;">${generatedAt.toLocaleString("hu-HU")}</td></tr>
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
        `Elkészült: ${payload.generatedAt.toLocaleString("hu-HU")}`,
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
  expiresAt,
  photoCount,
  fileSizeBytes
}: GuestGalleryDownloadReadyEmail) {
  const formattedSize = formatBytes(fileSizeBytes);

  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Dein Galerie-Download ist bereit</h1>
      <p style="margin: 0 0 18px;">Die ZIP-Datei für <strong>${escapeHtml(galleryTitle)}</strong> wurde erstellt.</p>
      <table style="border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Galerie</td><td style="padding: 4px 0;"><strong>${escapeHtml(galleryTitle)}</strong></td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Medien</td><td style="padding: 4px 0;">${photoCount}</td></tr>
        ${formattedSize ? `<tr><td style="padding: 4px 16px 4px 0; color: #777;">ZIP-Größe</td><td style="padding: 4px 0;">${escapeHtml(formattedSize)}</td></tr>` : ""}
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">Link gültig bis</td><td style="padding: 4px 0;">${expiresAt.toLocaleString("de-AT")}</td></tr>
      </table>
      <p style="margin: 0 0 18px;">
        <a href="${escapeHtml(downloadUrl)}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">ZIP herunterladen</a>
      </p>
      <p style="margin: 0; color: #777; font-size: 13px;">Falls der Button nicht funktioniert, kopiere diesen Link in den Browser:<br>${escapeHtml(downloadUrl)}</p>
    </div>
  `;
}

export async function sendGuestGalleryDownloadReadyEmail(payload: GuestGalleryDownloadReadyEmail) {
  const { apiKey, from } = emailConfig();
  const formattedSize = formatBytes(payload.fileSizeBytes);

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
        `Link gültig bis: ${payload.expiresAt.toLocaleString("de-AT")}`,
        "",
        `Download: ${payload.downloadUrl}`
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
      <h1 style="font-size: 22px; margin: 0 0 12px;">Szerződés megtekintése</h1>
      <p style="margin: 0 0 18px;">Kedves ${escapeHtml(coupleName)},</p>
      <p style="margin: 0 0 18px;">Elkészült a(z) <strong>${escapeHtml(contractTitle)}</strong> dokumentum. Az alábbi gombbal meg tudjátok nyitni.</p>
      <p style="margin: 0 0 20px;">
        <a href="${escapeHtml(contractUrl)}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">Szerződés megnyitása</a>
      </p>
      <p style="margin: 0; color: #777; font-size: 13px;">Ha a gomb nem működik, másoljátok be ezt a linket a böngészőbe:<br>${escapeHtml(contractUrl)}</p>
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
      subject: `Szerződés megtekintése: ${payload.contractTitle}`,
      html: contractSignatureRequestHtml(payload),
      text: [
        `Kedves ${payload.coupleName},`,
        "",
        `Elkészült a(z) ${payload.contractTitle} dokumentum.`,
        `Szerződés megnyitása: ${payload.contractUrl}`
      ].join("\n")
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Contract email failed: ${response.status} ${errorText}`);
  }
}

export function contractPublicUrl(token: string) {
  return `${appBaseUrl()}/contracts/${token}`;
}
