import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { tools } from "@/config/tools";

// Pages for search engines to index. The editor and extraction screens are app screens
// (marked noindex), so they aren't listed.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url, changeFrequency: "weekly", priority: 1 },
    ...tools.map((t) => ({
      url: `${site.url}/tools/${t.slug}`,
      changeFrequency: "monthly" as const,
      priority: t.popular ? 0.9 : 0.7,
    })),
    { url: `${site.url}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site.url}/licences`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
