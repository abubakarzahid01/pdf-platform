import type { MetadataRoute } from "next";
import { site } from "@/config/site";

// Cloudflare adds its own AI-crawler rules above these when serving robots.txt.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
