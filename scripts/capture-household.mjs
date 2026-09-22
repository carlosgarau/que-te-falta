import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const output = resolve(process.env.CAPTURE_DIR || resolve(root, ".tmp-household-captures"));
const playwrightPath = process.env.PLAYWRIGHT_MODULE;
if (!playwrightPath) throw new Error("Indica PLAYWRIGHT_MODULE para la captura local");
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const mime = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer(async (request, response) => {
  const relative = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname).replace(/^\/+/, "") || "index.html";
  const path = resolve(root, relative);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(path);
    response.writeHead(200, { "Content-Type": mime[extname(path)] || "application/octet-stream" }).end(data);
  } catch {
    response.writeHead(404).end();
  }
});

await mkdir(output, { recursive: true });
await new Promise((accept) => server.listen(0, "127.0.0.1", accept));
const port = server.address().port;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXE || undefined });
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: width === 1440 ? 900 : 844 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/?captura=lista`, { waitUntil: "networkidle" });
    await page.waitForTimeout(450);
    await page.screenshot({ path: resolve(output, `lista-${width}.png`), fullPage: true });
    if (width <= 390) {
      const mobile = await page.evaluate(() => ({
        voice: parseFloat(getComputedStyle(document.querySelector(".voice-card p")).fontSize),
        navigation: parseFloat(getComputedStyle(document.querySelector(".bottom-nav button")).fontSize),
        targets: [".item-check", ".item-remove", ".quantity-control button"].map((selector) => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return Math.min(rect.width, rect.height);
        }),
      }));
      if (mobile.voice < 12 || mobile.navigation < 11 || mobile.targets.some((size) => size < 44)) {
        throw new Error(`Legibilidad o toque insuficiente en ${width}px: ${JSON.stringify(mobile)}`);
      }
    }
    await page.locator("#itemInput").focus();
    if (await page.locator("#itemInput").evaluate((input) => getComputedStyle(input).outlineStyle) === "none") {
      throw new Error(`El campo de producto no tiene foco visible en ${width}px`);
    }
    await page.screenshot({ path: resolve(output, `foco-${width}.png`), fullPage: true });
    await page.locator("#itemInput").blur();
    await page.locator('[data-nav="history"]').first().click();
    await page.waitForTimeout(450);
    await page.screenshot({ path: resolve(output, `historial-${width}.png`), fullPage: true });
    await page.locator('[data-nav="list"]').first().click();
    await page.waitForTimeout(450);
    const productsBeforeUndo = await page.locator('[data-action="remove"]').count();
    await page.locator('[data-action="remove"]').first().click();
    await page.waitForTimeout(450);
    await page.screenshot({ path: resolve(output, `deshacer-${width}.png`), fullPage: true });
    await page.locator("#toast button").click();
    if (await page.locator('[data-action="remove"]').count() !== productsBeforeUndo) {
      throw new Error(`Deshacer no ha restaurado el producto en ${width}px`);
    }
    await page.locator('[data-nav="history"]').first().click();
    await page.waitForTimeout(450);
    await page.screenshot({ path: resolve(output, `actividad-${width}.png`), fullPage: true });
    if (width === 320) {
      await page.locator('[data-nav="list"]').first().click();
      await page.waitForTimeout(450);
      await page.locator('[data-action="remove"]').first().click();
      await page.locator("#toast button").focus();
      await page.waitForTimeout(7_150);
      if (await page.locator("#toast button").count() || await page.locator("#toast").getAttribute("aria-hidden") !== "true") {
        throw new Error("Deshacer continúa enfocable después de caducar");
      }
      if (await page.evaluate(() => document.querySelector("#toast").contains(document.activeElement))) {
        throw new Error("El foco se ha quedado dentro del aviso oculto");
      }
      await page.screenshot({ path: resolve(output, "deshacer-caducado-320.png"), fullPage: true });
    }
    if (errors.length) throw new Error(`Errores en ${width}px: ${errors.join(" | ")}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) throw new Error(`Desbordamiento horizontal en ${width}px`);
    for (const mode of ["pendiente", "guardado"]) {
      await page.goto(`http://127.0.0.1:${port}/?captura=${mode}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(450);
      await page.screenshot({ path: resolve(output, `${mode}-${width}.png`), fullPage: true });
      if (width === 390) {
        await page.locator("#settingsButton").click();
        await page.waitForTimeout(250);
        await page.screenshot({ path: resolve(output, `${mode}-ajustes-390.png`), fullPage: true });
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`Capturas guardadas en ${output}`);
