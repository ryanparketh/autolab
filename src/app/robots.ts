import { siteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/book/success", "/book/cancelled"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
