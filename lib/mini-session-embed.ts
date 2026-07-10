import { miniSessionEmbedUrl } from "@/lib/email";

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function miniSessionEmbedCode(slug: string, title: string) {
  const embedUrl = escapeHtmlAttribute(miniSessionEmbedUrl(slug));
  const safeTitle = escapeHtmlAttribute(`${title} időpontfoglaló`);

  return `<iframe src="${embedUrl}" title="${safeTitle}" style="width:100%;max-width:720px;height:860px;border:0;border-radius:12px;overflow:hidden;" loading="lazy"></iframe>`;
}
