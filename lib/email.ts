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
