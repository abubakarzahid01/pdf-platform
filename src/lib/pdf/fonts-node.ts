import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fontPackagePaths } from "./font-files";
import type { FontLoader } from "./operations/edits";

// Reads the same font files from node_modules, for tests and scripts run with Node.
const require = createRequire(import.meta.url);
export const nodeFontLoader: FontLoader = async (file) => new Uint8Array(readFileSync(require.resolve(fontPackagePaths[file])));
