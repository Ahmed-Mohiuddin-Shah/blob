import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = publicSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/profile",
          "/profile/",
          "/admin",
          "/admin/",
          "/api",
          "/api/",
          "/auth",
          "/auth/",
          "/upload",
          "/logout",
          "/*/compose",
          "/*/edit",
          "/*/remix",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
