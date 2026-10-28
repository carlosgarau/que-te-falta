import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 8765);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relative = normalize(pathname).replace(/^[/\\]+/u, "");
  let target = join(root, relative || "index.html");
  if (!target.startsWith(root) || !existsSync(target)) {
    response.writeHead(404).end("No encontrado");
    return;
  }
  if (statSync(target).isDirectory()) target = join(target, "index.html");
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": types[extname(target).toLowerCase()] || "application/octet-stream",
  });
  createReadStream(target).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`¿Qué te falta? disponible en http://127.0.0.1:${port}/`);
});
