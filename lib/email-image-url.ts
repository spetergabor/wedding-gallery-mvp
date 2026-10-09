// Email clients cannot use relative URLs or a logged-in browser session.
export function emailImageUrl(value: string, baseUrl: string) {
  if (!value.trim()) return null;
  try {
    const url = new URL(value, baseUrl);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}
