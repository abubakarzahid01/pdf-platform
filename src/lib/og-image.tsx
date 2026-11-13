import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/config/site";

// The picture shown when a page is shared (WhatsApp, Facebook, X, LinkedIn, Slack):
// the bee logo, the page's headline and a short line under it, on the brand colours.
export const ogSize = { width: 1200, height: 630 };

export async function ogImage(headline: string, line: string) {
  const bee = `data:image/svg+xml;base64,${(await readFile(join(process.cwd(), "src/app/icon.svg"))).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#efecfd", color: "#15132b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not a page */}
          <img src={bee} width={84} height={84} alt="" style={{ borderRadius: 20 }} />
          <span style={{ fontSize: 46, fontWeight: 800 }}>{site.name}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{headline}</span>
          <span style={{ fontSize: 34, color: "#4a4766" }}>{line}</span>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#4a38d1", fontWeight: 700 }}>editbee.online · Free · No sign-up</div>
      </div>
    ),
    ogSize,
  );
}
