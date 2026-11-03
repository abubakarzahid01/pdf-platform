// Writes public/third-party-notices.txt: the licence of every package the site depends on
// (taken from the installed packages, so it always matches what is shipped), plus libraries
// compiled into the WebAssembly engines, whose licence texts are kept in scripts/notices/.
// Runs automatically after `npm install` and before `npm run dev` / `npm run build`.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(readFileSync(join(root, "src/config/third-party.json"), "utf8"));
const noticesDir = join(root, "scripts/notices");
const LICENCE_FILE = /^(licen[cs]e|copying|notice)/i;

function packageDir(name, from) {
  try {
    return dirname(createRequire(join(from, "package.json")).resolve(`${name}/package.json`));
  } catch {
    // Packages whose "exports" hide package.json: walk up node_modules instead.
    for (let dir = from; ; dir = dirname(dir)) {
      const candidate = join(dir, "node_modules", name);
      if (existsSync(join(candidate, "package.json"))) return candidate;
      if (dirname(dir) === dir) return null;
    }
  }
}

// Production dependencies, followed recursively (optional dependencies such as Next's
// image optimiser run only on a server, so they aren't shipped to visitors).
const found = new Map();
function visit(name, from) {
  const dir = packageDir(name, from);
  if (!dir) return;
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const key = `${pkg.name}@${pkg.version}`;
  if (found.has(key)) return;
  const files = readdirSync(dir).filter((f) => LICENCE_FILE.test(f)).sort();
  found.set(key, {
    pkg,
    licence: typeof pkg.license === "string" ? pkg.license : (pkg.license?.type ?? pkg.licenses?.map((l) => l.type).join(" OR ") ?? "UNKNOWN"),
    texts: files.map((f) => readFileSync(join(dir, f), "utf8").trim()),
  });
  for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep, dir);
}
const own = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
for (const dep of Object.keys(own.dependencies)) visit(dep, root);

const rule = "=".repeat(78);
const section = (title, body) => `${rule}\n${title}\n${rule}\n\n${body.trim()}\n\n`;
const notice = (file) => readFileSync(join(noticesDir, file), "utf8");

let out = `Third-party software notices

This website uses the open-source software listed below. Each is used under its own
licence, reproduced here. ${config.acknowledgements.join(" ")}

`;
for (const { pkg, licence, texts } of [...found.values()].sort((a, b) => a.pkg.name.localeCompare(b.pkg.name))) {
  const home = pkg.homepage ?? (typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url) ?? "";
  const body = texts.length ? texts.join("\n\n---\n\n") : `Licensed under ${licence}. The package includes no separate licence file.`;
  out += section(`${pkg.name} ${pkg.version}\nLicence: ${licence}${home ? `\n${home}` : ""}`, body);
}
for (const c of config.components.filter((c) => !c.package)) {
  out += section(`${c.name}\nLicence: ${c.licence}\n${c.url}`, c.files.map(notice).join("\n\n---\n\n"));
}
out += `${rule}\nLibraries compiled into the WebAssembly engines\n${rule}\n\n`;
for (const e of config.embedded) {
  // Entries without their own file are Apache-2.0, whose full text comes with pdfjs-dist.
  const body = e.files ? e.files.map(notice).join("\n\n---\n\n") : `Licensed under ${e.licence}; the full licence text is reproduced above under pdfjs-dist.`;
  out += section(`${e.name} (inside ${e.inside})\nLicence: ${e.licence}\n${e.url}`, body);
}

writeFileSync(join(root, "public/third-party-notices.txt"), out);
console.log(`Third-party notices written to public/third-party-notices.txt (${found.size} packages)`);
