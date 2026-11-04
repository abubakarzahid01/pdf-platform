import { NextResponse, type NextRequest } from "next/server";
import { toolSlugs } from "@/config/tool-slugs";

const known = new Set(toolSlugs);

// Tool pages stream, so by the time the page could call notFound() the response has already
// been sent as 200. Unknown and hidden tools are rejected here, before rendering, so they get a
// real 404 (and random URLs aren't rendered and cached one by one).
export function proxy(request: NextRequest) {
  const slug = request.nextUrl.pathname.split("/")[2];
  if (known.has(slug)) return NextResponse.next();
  // No page exists at this path, so Next.js serves the not-found page with a 404 status.
  return NextResponse.rewrite(new URL("/404", request.url));
}

export const config = {
  matcher: "/tools/:slug*",
};
