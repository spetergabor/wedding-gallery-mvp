import { APP_TIME_ZONE } from "@/lib/date-format";
import { dateLocaleForCustomer, type CustomerLanguage } from "@/lib/customer-language";

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
  language?: CustomerLanguage;
};

type CustomerInvoiceEmail = {
  to: string[];
  coupleName: string;
  invoiceTitle: string;
  invoiceUrl: string;
  amountLabel?: string | null;
  dueDateLabel?: string | null;
  language?: CustomerLanguage;
};

type ClientProofingInviteEmail = {
  to: string;
  galleryTitle: string;
  proofingGalleryUrl: string;
  language?: CustomerLanguage;
};

type ClientFinalDeliveryEmail = {
  to: string;
  galleryTitle: string;
  galleryUrl: string;
  downloadsEnabled: boolean;
  language?: CustomerLanguage;
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
  language?: CustomerLanguage;
};

const CUSTOMER_EMAIL_COPY = {
  de: {
    proofingInvite: {
      subject: "Deine Bildauswahl ist bereit",
      heading: "Deine Bildauswahl ist bereit",
      intro: "Hallo,",
      body: "die Galerie ist zur Auswahl vorbereitet. Über den folgenden Link kannst du deine Favoriten markieren und die Auswahl anschließend abschicken.",
      cta: "Bildauswahl öffnen",
      fallback: "Falls der Button nicht funktioniert, kopiere diesen Link in den Browser:"
    },
    finalDelivery: {
      subject: "Deine fertigen Bilder sind bereit",
      heading: "Deine fertigen Bilder sind bereit",
      intro: "Hallo,",
      body: "die fertig bearbeiteten Bilder der Galerie sind jetzt für dich bereit.",
      linksEnabledBody: "Über den folgenden Link kannst du die Bilder ansehen und herunterladen.",
      linksDisabledBody: "Über den folgenden Link kannst du die Bilder ansehen.",
      fallback: "Falls der Button nicht funktioniert, kopiere diesen Link in den Browser:"
    },
    contract: {
      subjectPrefix: "Vertrag ansehen",
      heading: "Vertrag ansehen",
      intro: "Hallo",
      body: "Das Dokument ist bereit. Über die folgende Schaltfläche könnt ihr es öffnen.",
      cta: "Vertrag öffnen",
      fallback: "Falls der Button nicht funktioniert, kopiert diesen Link in den Browser:"
    },
    invoice: {
      subjectPrefix: "Rechnung",
      heading: "Rechnung",
      intro: "Hallo",
      body: "Die Rechnung ist bereit.",
      cta: "Rechnung öffnen",
      fallback: "Falls der Button nicht funktioniert, kopiert diesen Link in den Browser:",
      amountLabel: "Betrag:",
      dueLabel: "Fällig bis:"
    },
    guestDownload: {
      subjectSingle: "Dein Galerie-Download ist bereit",
      subjectMulti: "Deine Galerie-Downloads sind bereit",
      subjectSinglePrefix: "Dein Galerie-Download ist",
      heading: "Dein Galerie-Download ist bereit",
      headingMulti: "Deine Galerie-Downloads sind bereit",
      bodySingle: "Die ZIP-Datei für",
      bodyMulti: "Alle ZIP-Teile für",
      bodySuffixSingle: "ist fertig.",
      bodySuffixMulti: "sind fertig. Du findest alle Download-Links gesammelt in dieser E-Mail.",
      bodyIntro: "Du kannst die Bilder jetzt ansehen und herunterladen.",
      mediaLabel: "Medien",
      sizeLabel: "ZIP-Größe",
      expiresAtLabel: "Link gültig bis",
      downloadLabel: "ZIP herunterladen",
      fallback: "Falls ein Button nicht funktioniert, kopiere den jeweiligen Link in den Browser:"
    },
    adminZipReady: {
      heading: "Galéria ZIP elkészült",
      body: "A galéria letölthető ZIP fájlja elkészült, így küldés előtt minden készen áll.",
      photoLabel: "Képek",
      generatedAtLabel: "Elkészült",
      sizeLabel: "ZIP méret",
      linkLabel: "Admin galéria megnyitása",
      galleryLabel: "Galéria",
      publicLinkLabel: "Publikus galéria"
    },
    favoriteListSubmitted: {
      heading: "Kedvenc lista lezárva",
      intro: "Egy ügyfél lezárta a válogatását.",
      galleryLabel: "Galéria",
      listLabel: "Lista",
      emailLabel: "Email",
      countLabel: "Képek",
      closedAtLabel: "Lezárva",
      cta: "Admin galéria megnyitása",
      filenamesLabel: "Fájlnevek Lightroomhoz"
    },
    admin: "Galéria ZIP elkészült"
  },
  hu: {
    proofingInvite: {
      subject: "Kész a képeid kiválasztása",
      heading: "Kész a képek kiválasztása",
      intro: "Kedves vendég,",
      body: "Ez a galéria fel van készítve a kiválasztáshoz. A linkkel jelöld ki a kedvenceidet, majd küldd el a választásodat.",
      cta: "Képek kiválasztása",
      fallback: "Ha nem működik a gomb, ezt másold be a böngészőbe:"
    },
    finalDelivery: {
      subject: "A végleges képek készre vannak",
      heading: "A végleges képek készre vannak",
      intro: "Kedves vendég,",
      body: "A galéria végleges képei már elérhetők számodra.",
      linksEnabledBody: "Az alábbi linken megtekintheted és letöltheted őket.",
      linksDisabledBody: "Az alábbi linken megtekintheted a képeket.",
      fallback: "Ha nem működik a gomb, ezt másold be a böngészőbe:"
    },
    contract: {
      subjectPrefix: "Szerződés megtekintése",
      heading: "Szerződés megtekintése",
      intro: "Szia",
      body: "A dokumentum elkészült. A gombbal nyisd meg.",
      cta: "Szerződés megnyitása",
      fallback: "Ha nem működik a gomb, másold be ezt a linket:"
    },
    invoice: {
      subjectPrefix: "Számla",
      heading: "Számla",
      intro: "Szia",
      body: "A számla elkészült.",
      cta: "Számla megnyitása",
      fallback: "Ha nem működik a gomb, ezt másold be a böngészőbe:",
      amountLabel: "Összeg:",
      dueLabel: "Esedékesség:"
    },
    guestDownload: {
      subjectSingle: "A galériád letöltése kész",
      subjectMulti: "A galériád letöltési linkjei készültek",
      subjectSinglePrefix: "A galériád letöltése kész",
      heading: "A galériád letöltése kész",
      headingMulti: "A galéria letöltési linkjei készültek",
      bodySingle: "A ZIP csomag készült a",
      bodyMulti: "A ZIP darabok a",
      bodySuffixSingle: "hoz.",
      bodySuffixMulti: "hoz, és a teljes lista egy emailben található.",
      bodyIntro: "A képeket le tudod tölteni innen:",
      mediaLabel: "Média",
      sizeLabel: "ZIP méret",
      expiresAtLabel: "Link érvényessége",
      downloadLabel: "ZIP letöltése",
      fallback: "Ha a gomb nem működik, másold be ezt a linket a böngészőbe:"
    },
    adminZipReady: {
      heading: "A galéria ZIP elkészült",
      body: "A galéria letölthető ZIP fájlja elkészült.",
      photoLabel: "Képek",
      generatedAtLabel: "Elkészült",
      sizeLabel: "ZIP méret",
      linkLabel: "Admin galéria megnyitása",
      galleryLabel: "Galéria",
      publicLinkLabel: "Publikus galéria"
    },
    favoriteListSubmitted: {
      heading: "Kedvenc lista lezárva",
      intro: "A vendég lezárta a választását.",
      galleryLabel: "Galéria",
      listLabel: "Lista",
      emailLabel: "Email",
      countLabel: "Képek",
      closedAtLabel: "Lezárva",
      cta: "Admin galéria megnyitása",
      filenamesLabel: "Fájlnevek Lightroomhoz"
    },
    admin: "Galéria ZIP elkészült"
  }
};

function asEmailLanguage(language?: CustomerLanguage) {
  return language === "hu" ? "hu" : "de";
}

function copyForLanguage(language?: CustomerLanguage) {
  return CUSTOMER_EMAIL_COPY[asEmailLanguage(language)];
}

function dateLocale(language?: CustomerLanguage) {
  return dateLocaleForCustomer(asEmailLanguage(language));
}

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

export function publicGalleryUrl(slug: string, language?: CustomerLanguage) {
  const publicUrl = new URL(`/g/${slug}`, appBaseUrl());

  return publicUrl.toString();
}

export function galleryDownloadUrl(token: string) {
  return `${appBaseUrl()}/download/${token}`;
}

function clientProofingInviteHtml({
  galleryTitle,
  proofingGalleryUrl,
  language
}: ClientProofingInviteEmail) {
  const copy = copyForLanguage(language);

  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">${copy.proofingInvite.heading}</h1>
      <p style="margin: 0 0 18px;">${copy.proofingInvite.intro}</p>
      <p style="margin: 0 0 18px;">${copy.proofingInvite.body} <strong>${escapeHtml(galleryTitle)}</strong></p>
      <p style="margin: 0 0 20px;">
        <a href="${escapeHtml(proofingGalleryUrl)}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">${copy.proofingInvite.cta}</a>
      </p>
      <p style="margin: 0; color: #777; font-size: 13px;">${copy.proofingInvite.fallback}<br>${escapeHtml(proofingGalleryUrl)}</p>
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
      subject: `${copyForLanguage(payload.language).proofingInvite.subject}: ${payload.galleryTitle}`,
      html: clientProofingInviteHtml(payload),
      text: [
        copyForLanguage(payload.language).proofingInvite.subject,
        "",
        `${copyForLanguage(payload.language).proofingInvite.body} ${payload.galleryTitle}`,
        `${copyForLanguage(payload.language).proofingInvite.cta}: ${payload.proofingGalleryUrl}`
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
  downloadsEnabled,
  language
}: ClientFinalDeliveryEmail) {
  const copy = copyForLanguage(language);
  const body = copy.finalDelivery.body;
  const cta = copy.finalDelivery.linksEnabledBody;
  const ctaLabel = downloadsEnabled ? cta : copy.finalDelivery.linksDisabledBody;
  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">${copy.finalDelivery.heading}</h1>
      <p style="margin: 0 0 18px;">${copy.finalDelivery.intro}</p>
      <p style="margin: 0 0 18px;">${body} <strong>${escapeHtml(galleryTitle)}</strong>.</p>
      <p style="margin: 0 0 18px;">${downloadsEnabled ? copy.finalDelivery.linksEnabledBody : copy.finalDelivery.linksDisabledBody}</p>
      <p style="margin: 0 0 20px;">
        <a href="${escapeHtml(galleryUrl)}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">${ctaLabel}</a>
      </p>
      <p style="margin: 0; color: #777; font-size: 13px;">${copy.finalDelivery.fallback}<br>${escapeHtml(galleryUrl)}</p>
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
      subject: `${copyForLanguage(payload.language).finalDelivery.subject}: ${payload.galleryTitle}`,
      html: clientFinalDeliveryHtml(payload),
      text: [
        copyForLanguage(payload.language).finalDelivery.subject,
        "",
        `Galerie: ${payload.galleryTitle}`,
        payload.downloadsEnabled
          ? copyForLanguage(payload.language).finalDelivery.linksEnabledBody
          : copyForLanguage(payload.language).finalDelivery.linksDisabledBody,
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
  fileSizeBytes,
  language
}: GuestGalleryDownloadReadyEmail) {
  const formattedSize = formatBytes(fileSizeBytes);
  const copy = copyForLanguage(language);
  const links =
    downloadLinks && downloadLinks.length > 0
      ? downloadLinks
      : downloadUrl
        ? [{ label: copy.guestDownload.downloadLabel, url: downloadUrl, fileSizeBytes }]
        : [];

  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">${links.length > 1 ? copy.guestDownload.headingMulti : copy.guestDownload.heading}</h1>
      <p style="margin: 0 0 18px;">${links.length > 1 ? copy.guestDownload.bodyMulti : copy.guestDownload.bodySingle} <strong>${escapeHtml(galleryTitle)}</strong> ${links.length > 1 ? copy.guestDownload.bodySuffixMulti : copy.guestDownload.bodySuffixSingle}</p>
      <table style="border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">${asEmailLanguage(language) === "hu" ? "Galéria" : "Galerie"}</td><td style="padding: 4px 0;"><strong>${escapeHtml(galleryTitle)}</strong></td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">${copy.guestDownload.mediaLabel}</td><td style="padding: 4px 0;">${photoCount}</td></tr>
        ${formattedSize ? `<tr><td style="padding: 4px 16px 4px 0; color: #777;">${copy.guestDownload.sizeLabel}</td><td style="padding: 4px 0;">${escapeHtml(formattedSize)}</td></tr>` : ""}
        <tr><td style="padding: 4px 16px 4px 0; color: #777;">${copy.guestDownload.expiresAtLabel}</td><td style="padding: 4px 0;">${expiresAt.toLocaleString(dateLocale(language), { timeZone: APP_TIME_ZONE })}</td></tr>
      </table>
      <div style="margin: 0 0 18px;">
        ${links
          .map((link) => {
            const linkSize = formatBytes(link.fileSizeBytes);
            return `<p style="margin: 0 0 10px;"><a href="${escapeHtml(link.url)}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">${escapeHtml(link.label)}</a>${linkSize ? ` <span style="color: #777; font-size: 13px;">${escapeHtml(linkSize)}</span>` : ""}</p>`;
          })
          .join("")}
      </div>
      <p style="margin: 0; color: #777; font-size: 13px;">${copy.guestDownload.fallback}<br>${links.map((link) => escapeHtml(link.url)).join("<br>")}</p>
    </div>
  `;
}

export async function sendGuestGalleryDownloadReadyEmail(payload: GuestGalleryDownloadReadyEmail) {
  const copy = copyForLanguage(payload.language);
  const { apiKey, from } = emailConfig();
  const formattedSize = formatBytes(payload.fileSizeBytes);
  const links =
    payload.downloadLinks && payload.downloadLinks.length > 0
      ? payload.downloadLinks
      : payload.downloadUrl
        ? [{ label: copy.guestDownload.downloadLabel, url: payload.downloadUrl, fileSizeBytes: payload.fileSizeBytes }]
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
      subject: `${links.length > 1 ? copy.guestDownload.subjectMulti : copy.guestDownload.subjectSingle}: ${payload.galleryTitle}`,
      html: guestGalleryDownloadReadyHtml(payload),
      text: [
        links.length > 1 ? copy.guestDownload.headingMulti : copy.guestDownload.heading,
        "",
        `Galerie: ${payload.galleryTitle}`,
        `${copy.guestDownload.mediaLabel}: ${payload.photoCount}`,
        ...(formattedSize ? [`${copy.guestDownload.sizeLabel}: ${formattedSize}`] : []),
        `${copy.guestDownload.expiresAtLabel}: ${payload.expiresAt.toLocaleString(dateLocale(payload.language), { timeZone: APP_TIME_ZONE })}`,
        ...(links.length > 1 ? ["", copy.guestDownload.bodySuffixMulti] : []),
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
  contractUrl,
  language
}: ContractSignatureRequestEmail) {
  const copy = copyForLanguage(language);
  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">${copy.contract.heading}</h1>
      <p style="margin: 0 0 18px;">Hallo ${escapeHtml(coupleName)},</p>
      <p style="margin: 0 0 18px;">${copy.contract.body} <strong>${escapeHtml(contractTitle)}</strong>.</p>
      <p style="margin: 0 0 20px;">
        <a href="${escapeHtml(contractUrl)}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">${copy.contract.cta}</a>
      </p>
      <p style="margin: 0; color: #777; font-size: 13px;">${copy.contract.fallback}<br>${escapeHtml(contractUrl)}</p>
    </div>
  `;
}

export async function sendContractSignatureRequestEmail(payload: ContractSignatureRequestEmail) {
  const copy = copyForLanguage(payload.language);
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
      subject: `${copy.contract.subjectPrefix}: ${payload.contractTitle}`,
      html: contractSignatureRequestHtml(payload),
      text: [
        `Hallo ${payload.coupleName}, ${copy.contract.intro}`,
        "",
        `${copy.contract.body} ${payload.contractTitle}`,
        `${copy.contract.cta}: ${payload.contractUrl}`
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
  dueDateLabel,
  language
}: CustomerInvoiceEmail) {
  const copy = copyForLanguage(language);
  const metaLines = [
    amountLabel ? `<p style="margin: 0 0 8px;"><strong>${copy.invoice.amountLabel}:</strong> ${escapeHtml(amountLabel)}</p>` : "",
    dueDateLabel ? `<p style="margin: 0 0 18px;"><strong>${copy.invoice.dueLabel}:</strong> ${escapeHtml(dueDateLabel)}</p>` : ""
  ].join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">${copy.invoice.heading}</h1>
      <p style="margin: 0 0 18px;">Hallo ${escapeHtml(coupleName)},</p>
      <p style="margin: 0 0 18px;">${copy.invoice.body} <strong>${escapeHtml(invoiceTitle)}</strong>.</p>
      ${metaLines}
      <p style="margin: 0 0 20px;">
        <a href="${escapeHtml(invoiceUrl)}" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">${copy.invoice.cta}</a>
      </p>
      <p style="margin: 0; color: #777; font-size: 13px;">${copy.invoice.fallback}<br>${escapeHtml(invoiceUrl)}</p>
    </div>
  `;
}

export async function sendCustomerInvoiceEmail(payload: CustomerInvoiceEmail) {
  const copy = copyForLanguage(payload.language);
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
      subject: `${copy.invoice.subjectPrefix}: ${payload.invoiceTitle}`,
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
