import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "www");
const assets = [
  "styles.css",
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "app.mjs",
  "account-sharing.mjs",
  "core.mjs",
  "family-sync.mjs",
  "secure-sharing.mjs",
  "privacy.html",
  "support.html",
  "native-bridge.mjs",
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

await Promise.all(assets.map((asset) => cp(resolve(root, asset), resolve(output, asset))));

let html = await readFile(resolve(root, "index.html"), "utf8");
html = html
  .replace(/<link rel="manifest"[^>]*>\s*/u, "")
  .replace(/<script type="module" src="(?:\.\/)?app\.mjs\?v=\d+"><\/script>/u, '<script type="module" src="./native-bridge.mjs"></script>');
if (!html.includes('src="./native-bridge.mjs"')) {
  throw new Error("No se ha podido preparar la entrada nativa de index.html");
}
await writeFile(resolve(output, "index.html"), html, "utf8");

console.log(`Aplicación móvil preparada en ${output}`);
