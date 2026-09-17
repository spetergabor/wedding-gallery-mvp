const AUTOMATED_USER_AGENT_PATTERNS = [
  /\b(bot|crawler|spider|slurp)\b/i,
  /facebookexternalhit|facebookcatalog|facebot|meta-externalagent|meta-externalfetcher/i,
  /whatsapp|telegrambot|discordbot|slackbot|twitterbot|linkedinbot|pinterestbot/i,
  /googlebot|googleimageproxy|google-inspectiontool|bingpreview|yandexbot|baiduspider/i,
  /skypeuripreview|microsoft office existence discovery|safelinks|urlpreview|linkpreview/i,
  /proofpoint|mimecast|barracuda|symantec|zscaler/i,
  /headlesschrome|phantomjs|lighthouse|pagespeed|uptimerobot|pingdom/i,
  /curl\/|wget\/|python-requests|node-fetch|axios\//i
];

function isAutomatedPurpose(value: string | null) {
  return Boolean(value && /\b(prefetch|preview)\b/i.test(value));
}

export function isAutomatedGalleryView(headers: Headers) {
  if (
    isAutomatedPurpose(headers.get("purpose")) ||
    isAutomatedPurpose(headers.get("sec-purpose")) ||
    isAutomatedPurpose(headers.get("x-purpose"))
  ) {
    return true;
  }

  const userAgent = headers.get("user-agent")?.trim();

  if (!userAgent) {
    return true;
  }

  return AUTOMATED_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent));
}
