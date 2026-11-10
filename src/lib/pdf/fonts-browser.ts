import type { FontFile } from "@/lib/pdf/font-files";
import type { FontLoader } from "@/lib/pdf/operations/edits";

// Font files (OFL-1.1), bundled with the site and fetched only when text needs them. The
// same files as fontPackagePaths in font-files.ts; each URL is written out so the bundler
// copies the file. The Chinese, Japanese and Korean files are large (6-10 MB) and are only
// downloaded when such text is saved; the browser keeps them for next time.
const urls: Record<FontFile, URL> = {
  regular: new URL("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf", import.meta.url),
  bold: new URL("@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf", import.meta.url),
  italic: new URL("@expo-google-fonts/inter/400Regular_Italic/Inter_400Regular_Italic.ttf", import.meta.url),
  boldItalic: new URL("@expo-google-fonts/inter/700Bold_Italic/Inter_700Bold_Italic.ttf", import.meta.url),
  "sc-regular": new URL("@expo-google-fonts/noto-sans-sc/400Regular/NotoSansSC_400Regular.ttf", import.meta.url),
  "sc-bold": new URL("@expo-google-fonts/noto-sans-sc/700Bold/NotoSansSC_700Bold.ttf", import.meta.url),
  "jp-regular": new URL("@expo-google-fonts/noto-sans-jp/400Regular/NotoSansJP_400Regular.ttf", import.meta.url),
  "jp-bold": new URL("@expo-google-fonts/noto-sans-jp/700Bold/NotoSansJP_700Bold.ttf", import.meta.url),
  "kr-regular": new URL("@expo-google-fonts/noto-sans-kr/400Regular/NotoSansKR_400Regular.ttf", import.meta.url),
  "kr-bold": new URL("@expo-google-fonts/noto-sans-kr/700Bold/NotoSansKR_700Bold.ttf", import.meta.url),
  "arabic-regular": new URL("@expo-google-fonts/vazirmatn/400Regular/Vazirmatn_400Regular.ttf", import.meta.url),
  "arabic-bold": new URL("@expo-google-fonts/vazirmatn/700Bold/Vazirmatn_700Bold.ttf", import.meta.url),
  "hebrew-regular": new URL("@expo-google-fonts/noto-sans-hebrew/400Regular/NotoSansHebrew_400Regular.ttf", import.meta.url),
  "hebrew-bold": new URL("@expo-google-fonts/noto-sans-hebrew/700Bold/NotoSansHebrew_700Bold.ttf", import.meta.url),
  "thai-regular": new URL("@expo-google-fonts/noto-sans-thai/400Regular/NotoSansThai_400Regular.ttf", import.meta.url),
  "thai-bold": new URL("@expo-google-fonts/noto-sans-thai/700Bold/NotoSansThai_700Bold.ttf", import.meta.url),
  "devanagari-regular": new URL("@expo-google-fonts/noto-sans-devanagari/400Regular/NotoSansDevanagari_400Regular.ttf", import.meta.url),
  "devanagari-bold": new URL("@expo-google-fonts/noto-sans-devanagari/700Bold/NotoSansDevanagari_700Bold.ttf", import.meta.url),
};

export const browserFontLoader: FontLoader = async (file) => {
  const response = await fetch(urls[file]);
  if (!response.ok) throw new Error(`Font ${file} couldn't be loaded`);
  return new Uint8Array(await response.arrayBuffer());
};
