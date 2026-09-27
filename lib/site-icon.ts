import { isHttpUrl } from "@/lib/attribution";

/** Reject loopback / private literals. DNS rebinding still possible — ok for public storefront icons. */
export function isPublicHttpUrl(value: string): boolean {
  if (!isHttpUrl(value)) return false;
  try {
    const h = new URL(value).hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0") {
      return false;
    }
    if (h === "::1" || h === "[::1]") return false;
    if (
      /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"),
  );
  return m?.[1] ?? null;
}

function absolutize(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Prefer apple-touch-icon, then rel=icon, then og:image.
 * Fallback caller may try /favicon.ico.
 */
export function pickSiteIcon(html: string, pageUrl: string): string | null {
  // ponytail: separate vars — TS ignores closure writes to `let best: T | null`
  let bestHref: string | null = null;
  let bestScore = -1;
  const consider = (href: string | null, score: number) => {
    if (!href) return;
    const abs = absolutize(href, pageUrl);
    if (!abs || score <= bestScore) return;
    bestHref = abs;
    bestScore = score;
  };

  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    if (rel.includes("apple-touch-icon")) consider(attr(tag, "href"), 3);
    else if (rel.split(/\s+/).includes("icon") || rel.includes("shortcut")) {
      consider(attr(tag, "href"), 2);
    }
  }
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const prop = (
      attr(tag, "property") ??
      attr(tag, "name") ??
      ""
    ).toLowerCase();
    if (prop === "og:image" || prop === "og:image:secure_url") {
      consider(attr(tag, "content"), 1);
    }
  }
  return bestHref;
}
