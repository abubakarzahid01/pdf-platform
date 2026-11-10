// The font files used when saving text, and which one each writing system needs.
// Inter covers Latin, Greek and Cyrillic; Noto fonts cover Chinese, Japanese, Korean,
// Hebrew, Thai and Hindi, and Vazirmatn covers Arabic, Persian and Urdu (all OFL-1.1).
// Vazirmatn is used for Arabic because its letters come with their joined forms ready
// made: Noto Sans Arabic builds letters from separate dots, which pdf-lib can't position
// and which copy out of the PDF as the wrong letters. All are bundled with the site and
// fetched only when needed.

export type InterStyle = "regular" | "bold" | "italic" | "boldItalic";
export type Script = "sc" | "jp" | "kr" | "arabic" | "hebrew" | "thai" | "devanagari";
export type FontFile = InterStyle | `${Script}-${"regular" | "bold"}`;

export const scriptNames: Record<Script, string> = {
  sc: "Chinese",
  jp: "Japanese",
  kr: "Korean",
  arabic: "Arabic",
  hebrew: "Hebrew",
  thai: "Thai",
  devanagari: "Hindi",
};

// Paths inside node_modules; the browser's copy (fonts-browser.ts) lists the same files.
export const fontPackagePaths: Record<FontFile, string> = {
  regular: "@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf",
  bold: "@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf",
  italic: "@expo-google-fonts/inter/400Regular_Italic/Inter_400Regular_Italic.ttf",
  boldItalic: "@expo-google-fonts/inter/700Bold_Italic/Inter_700Bold_Italic.ttf",
  "sc-regular": "@expo-google-fonts/noto-sans-sc/400Regular/NotoSansSC_400Regular.ttf",
  "sc-bold": "@expo-google-fonts/noto-sans-sc/700Bold/NotoSansSC_700Bold.ttf",
  "jp-regular": "@expo-google-fonts/noto-sans-jp/400Regular/NotoSansJP_400Regular.ttf",
  "jp-bold": "@expo-google-fonts/noto-sans-jp/700Bold/NotoSansJP_700Bold.ttf",
  "kr-regular": "@expo-google-fonts/noto-sans-kr/400Regular/NotoSansKR_400Regular.ttf",
  "kr-bold": "@expo-google-fonts/noto-sans-kr/700Bold/NotoSansKR_700Bold.ttf",
  "arabic-regular": "@expo-google-fonts/vazirmatn/400Regular/Vazirmatn_400Regular.ttf",
  "arabic-bold": "@expo-google-fonts/vazirmatn/700Bold/Vazirmatn_700Bold.ttf",
  "hebrew-regular": "@expo-google-fonts/noto-sans-hebrew/400Regular/NotoSansHebrew_400Regular.ttf",
  "hebrew-bold": "@expo-google-fonts/noto-sans-hebrew/700Bold/NotoSansHebrew_700Bold.ttf",
  "thai-regular": "@expo-google-fonts/noto-sans-thai/400Regular/NotoSansThai_400Regular.ttf",
  "thai-bold": "@expo-google-fonts/noto-sans-thai/700Bold/NotoSansThai_700Bold.ttf",
  "devanagari-regular": "@expo-google-fonts/noto-sans-devanagari/400Regular/NotoSansDevanagari_400Regular.ttf",
  "devanagari-bold": "@expo-google-fonts/noto-sans-devanagari/700Bold/NotoSansDevanagari_700Bold.ttf",
};

// Unicode blocks per writing system. Han (Chinese characters) is handled separately.
const blocks: [Script, number, number][] = [
  ["kr", 0x1100, 0x11ff], // Hangul Jamo
  ["kr", 0x3130, 0x318f], // Hangul Compatibility Jamo
  ["kr", 0xa960, 0xa97f],
  ["kr", 0xac00, 0xd7ff], // Hangul syllables
  ["jp", 0x3040, 0x30ff], // Hiragana, Katakana
  ["jp", 0x31f0, 0x31ff],
  ["jp", 0xff66, 0xff9f], // half-width Katakana
  ["arabic", 0x0600, 0x06ff],
  ["arabic", 0x0750, 0x077f],
  ["arabic", 0x0870, 0x08ff],
  ["arabic", 0xfb50, 0xfdff],
  ["arabic", 0xfe70, 0xfeff],
  ["hebrew", 0x0590, 0x05ff],
  ["hebrew", 0xfb1d, 0xfb4f],
  ["thai", 0x0e00, 0x0e7f],
  ["devanagari", 0x0900, 0x097f],
  ["devanagari", 0xa8e0, 0xa8ff],
];

const isHan = (cp: number) =>
  (cp >= 0x2e80 && cp <= 0x2fdf) || // radicals
  (cp >= 0x3000 && cp <= 0x303f) || // CJK punctuation
  (cp >= 0x3190 && cp <= 0x31ef) ||
  (cp >= 0x3200 && cp <= 0x33ff) || // enclosed letters, compatibility
  (cp >= 0x3400 && cp <= 0x4dbf) ||
  (cp >= 0x4e00 && cp <= 0x9fff) ||
  (cp >= 0xf900 && cp <= 0xfaff) ||
  (cp >= 0xfe30 && cp <= 0xfe4f) ||
  (cp >= 0xff00 && cp <= 0xffef) || // full-width forms
  (cp >= 0x20000 && cp <= 0x3134f);

/**
 * The writing system whose font draws a character, or null for characters with no
 * dedicated font here. Han and full-width characters use the Japanese font when the
 * text also has kana, the Korean font when it has Hangul, and Chinese otherwise.
 */
export function scriptOf(cp: number, text: string): Script | null {
  for (const [script, from, to] of blocks) if (cp >= from && cp <= to) return script;
  if (!isHan(cp)) return null;
  if (/[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/.test(text)) return "jp";
  if (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7ff]/.test(text)) return "kr";
  return "sc";
}

export const rightToLeft = (script: Script | null) => script === "arabic" || script === "hebrew";
