import type { FontLoader, InterStyle } from "@/lib/pdf/operations/edits";

// Inter font files (OFL-1.1), bundled with the site and fetched only when text needs them.
const urls: Record<InterStyle, URL> = {
  regular: new URL("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf", import.meta.url),
  bold: new URL("@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf", import.meta.url),
  italic: new URL("@expo-google-fonts/inter/400Regular_Italic/Inter_400Regular_Italic.ttf", import.meta.url),
  boldItalic: new URL("@expo-google-fonts/inter/700Bold_Italic/Inter_700Bold_Italic.ttf", import.meta.url),
};

export const browserFontLoader: FontLoader = async (style) => {
  const response = await fetch(urls[style]);
  if (!response.ok) throw new Error(`Font ${style} couldn't be loaded`);
  return new Uint8Array(await response.arrayBuffer());
};
