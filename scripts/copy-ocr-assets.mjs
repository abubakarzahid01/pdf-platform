// Copies the OCR engine and English language data into public/ocr/ so the site serves
// them itself instead of loading code from a third-party CDN at runtime.
// Runs automatically after `npm install` and before `npm run dev` / `npm run build`.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const out = fileURLToPath(new URL("../public/ocr/", import.meta.url));
mkdirSync(join(out, "lang"), { recursive: true });

const tesseractDist = join(dirname(require.resolve("tesseract.js/package.json")), "dist");
const core = dirname(require.resolve("tesseract.js-core/package.json"));
const lang = join(dirname(require.resolve("@tesseract.js-data/eng/package.json")), "4.0.0_best_int");

const copies = [[join(tesseractDist, "worker.min.js"), join(out, "worker.min.js")]];
// Only the LSTM engine builds are used (the accurate neural-network recogniser);
// the .wasm.js files have the WebAssembly built in, so the separate .wasm files aren't needed.
for (const file of readdirSync(core).filter((f) => /^tesseract-core.*lstm\.wasm\.js$/.test(f))) {
  copies.push([join(core, file), join(out, file)]);
}
copies.push([join(lang, "eng.traineddata.gz"), join(out, "lang", "eng.traineddata.gz")]);

for (const [from, to] of copies) {
  if (!existsSync(from)) throw new Error(`OCR asset missing: ${from}`);
  copyFileSync(from, to);
}
console.log(`OCR assets copied to public/ocr (${copies.length} files)`);
