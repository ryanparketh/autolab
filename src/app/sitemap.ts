import { siteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";
import { categoryMeta } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const paths = ["", "/services", "/book", "/quote", "/contact", "/policies"].concat(
    Object.values(categoryMeta).map((c) => `/services/${c.slug}`),
  );
  return paths.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));
}
