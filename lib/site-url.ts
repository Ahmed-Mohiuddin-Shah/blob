/** Public site origin for metadata, sitemap, robots (AUTH_URL in prod). */
export function publicSiteUrl(): string {
  return (process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}
