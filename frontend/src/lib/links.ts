// A website shows as a link only when it's an http or https address. Anything
// else, such as a javascript: address, stays plain text, so it can't run.

/** The address to link to, or null when the text shouldn't be a link. */
export function websiteHref(text: string | null | undefined): string | null {
  const value = (text ?? "").trim();
  if (!value) return null;
  // "acme.example.com" is a web address without its scheme.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;
  return url.href;
}

/** "www.acme.example.com", without the scheme or a trailing slash. */
export function websiteLabel(text: string): string {
  return text.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
