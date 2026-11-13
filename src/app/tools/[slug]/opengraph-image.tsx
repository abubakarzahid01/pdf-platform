import { site } from "@/config/site";
import { getTool, tools } from "@/config/tools";
import { ogImage, ogSize } from "@/lib/og-image";

export const alt = `${site.name} PDF tool`;
export const size = ogSize;
export const contentType = "image/png";

// One image per tool, made at build time.
export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const tool = getTool((await params).slug);
  return ogImage(tool ? `${tool.name} online, free` : site.name, tool?.description ?? site.description);
}
