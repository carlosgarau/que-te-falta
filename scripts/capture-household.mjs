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
    const assertHeaderVisible = async (state) => {
      const header = await page.evaluate(() => {
        const topbar = document.querySelector(".topbar").getBoundingClientRect();
        const brand = document.querySelector(".brand").getBoundingClientRect();
        return { top: topbar.top, bottom: topbar.bottom, brandTop: brand.top, brandBottom: brand.bottom, scrollY };
      });
      if (header.brandTop < header.top - 1 || header.brandBottom > header.bottom + 1 || header.top < -1 || header.scrollY > 1) {
        throw new Error(`La cabecera queda recortada en ${state} a ${width}px: ${JSON.stringify(header)}`);
      }
    };
    const waitForFonts = async () => page.evaluate(() => document.fonts.ready);
    const assertTouchTargets = async (state) => {
      if (width > 390) return;
      const tooSmall = await page.evaluate(() => Array.from(document.querySelectorAll(
        "button, .item-photo-picker, .import-button, label.setting-row",
      )).flatMap((element, index) => {
        if (element.closest("[hidden], [aria-hidden='true'], dialog:not([open])")) return [];
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) return [];
        const size = Math.min(rect.width, rect.height);
        return size < 43.5 ? [{
          target: element.getAttribute("aria-label") || element.textContent.trim().replace(/\s+/g, " ").slice(0, 45) || `${element.tagName}-${index}`,
          width: rect.width,
          height: rect.height,
        }] : [];
      }));
      if (tooSmall.length) throw new Error(`Objetivos táctiles insuficientes en ${state} a ${width}px: ${JSON.stringify(tooSmall)}`);
    };
    await page.goto(`http://127.0.0.1:${port}/?captura=lista`, { waitUntil: "networkidle" });
    await waitForFonts();
    await page.waitForTimeout(450);
    await assertHeaderVisible("lista");
    await page.screenshot({ path: resolve(output, `lista-${width}.png`) });
    const layout = await page.evaluate(() => {
      const main = document.querySelector("main").getBoundingClientRect();
      const navigation = document.querySelector(".bottom-nav").getBoundingClientRect();
      return { mainBottom: main.bottom, navigationTop: navigation.top, navigationBottom: navigation.bottom, viewport: innerHeight };
    });
    if (layout.mainBottom > layout.navigationTop + 1 || layout.navigationBottom > layout.viewport + 1) {
      throw new Error(`La navegación invade el contenido en ${width}px: ${JSON.stringify(layout)}`);
    }
    await assertTouchTargets("lista");
    await page.locator("main").evaluate((main) => { main.scrollTop = main.scrollHeight; });
    await page.waitForTimeout(150);
    await assertHeaderVisible("lista al final");
    const finalListLayout = await page.evaluate(() => {
      const main = document.querySelector("main").getBoundingClientRect();
      const finalCard = document.querySelector("#listContent .category-group:last-child")?.getBoundingClientRect();
      return finalCard ? { mainTop: main.top, mainBottom: main.bottom, cardTop: finalCard.top, cardBottom: finalCard.bottom } : null;
    });
    if (!finalListLayout || finalListLayout.cardBottom > finalListLayout.mainBottom + 1 || finalListLayout.cardTop < finalListLayout.mainTop - 1) {
      throw new Error(`El último grupo no puede quedar por encima de la navegación en ${width}px: ${JSON.stringify(finalListLayout)}`);
    }
    await page.screenshot({ path: resolve(output, `lista-final-${width}.png`) });
    await page.locator("main").evaluate((main) => { main.scrollTop = 0; });
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
    await page.screenshot({ path: resolve(output, `foco-${width}.png`) });
    if (width === 390) {
      await page.setViewportSize({ width, height: 560 });
      await page.waitForTimeout(250);
      const keyboardLayout = await page.evaluate(() => {
        const field = document.querySelector("#itemInput").getBoundingClientRect();
        const navigation = document.querySelector(".bottom-nav").getBoundingClientRect();
        return {
          fieldTop: field.top,
          fieldBottom: field.bottom,
          navigationTop: navigation.top,
          navigationBottom: navigation.bottom,
          viewport: innerHeight,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      if (
        keyboardLayout.fieldTop < 0
        || keyboardLayout.fieldBottom > keyboardLayout.navigationTop
        || keyboardLayout.navigationBottom > keyboardLayout.viewport + 1
        || keyboardLayout.horizontalOverflow
      ) {
        throw new Error(`La vista con teclado queda recortada a ${width}px: ${JSON.stringify(keyboardLayout)}`);
      }
      await page.screenshot({ path: resolve(output, "teclado-390.png") });
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(250);
    }
    await page.locator("#itemInput").blur();
    if (width <= 390) {
      await page.locator(".item-edit-trigger").first().click();
      await page.waitForTimeout(250);
      await assertTouchTargets("editar producto");
      await page.screenshot({ path: resolve(output, `editar-${width}.png`) });
      await page.locator("#itemEditCancel").click();
      await page.waitForTimeout(150);
    }
    await page.locator('[data-nav="history"]').first().click();
    await page.waitForTimeout(450);
    await assertHeaderVisible("historial");
    await assertTouchTargets("historial");
    await page.screenshot({ path: resolve(output, `historial-${width}.png`) });
    await page.locator("main").evaluate((main) => { main.scrollTop = main.scrollHeight; });
    await page.waitForTimeout(150);
    await assertHeaderVisible("historial al final");
    const finalHistoryLayout = await page.evaluate(() => {
      const main = document.querySelector("main").getBoundingClientRect();
      const finalCard = document.querySelector("#historyContent > :last-child")?.getBoundingClientRect();
      return finalCard ? { mainTop: main.top, mainBottom: main.bottom, cardTop: finalCard.top, cardBottom: finalCard.bottom } : null;
    });
    if (!finalHistoryLayout || finalHistoryLayout.cardBottom > finalHistoryLayout.mainBottom + 1 || finalHistoryLayout.cardTop < finalHistoryLayout.mainTop - 1) {
      throw new Error(`La última entrada del historial no puede quedar por encima de la navegación en ${width}px: ${JSON.stringify(finalHistoryLayout)}`);
    }
    await page.screenshot({ path: resolve(output, `historial-final-${width}.png`) });
    await page.locator("main").evaluate((main) => { main.scrollTop = 0; });
    await page.locator('[data-nav="list"]').first().click();
    await page.waitForTimeout(450);
    const productsBeforeUndo = await page.locator('[data-action="remove"]').count();
    await page.locator('[data-action="remove"]').first().click();
    await page.waitForTimeout(450);
    await page.screenshot({ path: resolve(output, `deshacer-${width}.png`) });
    await page.locator("#toast button").click();
    if (await page.locator('[data-action="remove"]').count() !== productsBeforeUndo) {
      throw new Error(`Deshacer no ha restaurado el producto en ${width}px`);
    }
    await page.waitForTimeout(2_800);
    await page.locator('[data-nav="history"]').first().click();
    await page.waitForTimeout(450);
    await page.screenshot({ path: resolve(output, `actividad-${width}.png`) });
    await page.locator('[data-nav="expiration"]').first().click();
    await page.waitForTimeout(350);
    await assertHeaderVisible("caducidad");
    await assertTouchTargets("caducidad");
    await page.screenshot({ path: resolve(output, `caducidad-${width}.png`) });
    await page.locator('[data-nav="ideas"]').first().click();
    await page.waitForTimeout(350);
    await assertHeaderVisible("comprados");
    await assertTouchTargets("comprados");
    await page.screenshot({ path: resolve(output, `comprados-${width}.png`) });
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
      await page.screenshot({ path: resolve(output, "deshacer-caducado-320.png" ) });
      await page.locator("#itemInput").fill("Yogures naturales sin lactosa");
      await page.locator('#addForm button[type="submit"]').click();
      await page.locator(".shopping-item", { hasText: "Yogures naturales sin lactosa" }).locator('[data-action="remove"]').click();
      await page.waitForTimeout(450);
      if (await page.locator("#toast button").evaluate((button) => button.getBoundingClientRect().height) < 44) {
        throw new Error("El botón Deshacer no tiene altura táctil suficiente");
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: resolve(output, "deshacer-largo-320.png") });
    }
    if (errors.length) throw new Error(`Errores en ${width}px: ${errors.join(" | ")}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) throw new Error(`Desbordamiento horizontal en ${width}px`);
    for (const mode of ["pendiente", "guardado"]) {
      await page.goto(`http://127.0.0.1:${port}/?captura=${mode}`, { waitUntil: "networkidle" });
      await waitForFonts();
      await page.waitForTimeout(450);
      if (width === 320) {
        const headerCollision = await page.evaluate(() => {
          const title = document.querySelector(".brand strong").getBoundingClientRect();
          const actions = document.querySelector(".topbar-actions").getBoundingClientRect();
          return { titleRight: title.right, actionsLeft: actions.left, collides: title.right > actions.left + 1 };
        });
        if (headerCollision.collides) throw new Error(`La marca invade los estados de cabecera: ${JSON.stringify(headerCollision)}`);
      }
      await page.screenshot({ path: resolve(output, `${mode}-${width}.png`) });
      if (width <= 390) {
        await page.locator("#settingsButton").click();
        await page.locator(".settings-body").evaluate((body) => { body.scrollTop = 0; });
        await page.waitForTimeout(250);
        const initialSettingsLayout = await page.locator("#settingsDialog").evaluate((dialog) => {
          const compact = (element) => {
            const rect = element.getBoundingClientRect();
            return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
          };
          return {
            viewport: { width: innerWidth, height: innerHeight, scrollY },
            dialog: compact(dialog),
            handle: compact(dialog.querySelector(".sheet-handle")),
            title: compact(dialog.querySelector(".sheet-heading h2")),
            close: compact(dialog.querySelector("#settingsClose")),
            bodyScrollTop: dialog.querySelector(".settings-body").scrollTop,
          };
        });
        if (
          initialSettingsLayout.dialog.top < 0
          || initialSettingsLayout.handle.top < 0
          || initialSettingsLayout.title.top < 0
          || initialSettingsLayout.close.top < 0
          || initialSettingsLayout.close.right > initialSettingsLayout.viewport.width
          || initialSettingsLayout.bodyScrollTop > 1
        ) {
          throw new Error(`Ajustes no abre completamente encuadrado en ${width}px: ${JSON.stringify(initialSettingsLayout)}`);
        }
        await assertTouchTargets(`${mode} ajustes`);
        await page.screenshot({ path: resolve(output, `${mode}-ajustes-${width}.png`) });
        await page.locator(".settings-body").evaluate((body) => {
          const firstCompleteGroup = body.querySelector(".account-settings");
          const maximum = Math.max(0, body.scrollHeight - body.clientHeight);
          const desired = firstCompleteGroup
            ? body.scrollTop + firstCompleteGroup.getBoundingClientRect().top - body.getBoundingClientRect().top
            : maximum;
          body.scrollTop = Math.min(maximum, Math.max(0, desired));
        });
        await page.waitForTimeout(150);
        const settingsHeaderVisible = await page.locator("#settingsDialog").evaluate((dialog) => {
          const selectors = [".sheet-handle", ".sheet-heading h2", "#settingsClose"];
          return selectors.every((selector) => {
            const rect = dialog.querySelector(selector)?.getBoundingClientRect();
            return rect && rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth;
          });
        });
        if (!settingsHeaderVisible) throw new Error(`La cabecera de Ajustes queda recortada al desplazar en ${width}px`);
        const settingsBodyStartsCleanly = await page.locator("#settingsDialog").evaluate((dialog) => {
          const bodyRect = dialog.querySelector(".settings-body").getBoundingClientRect();
          const accountRect = dialog.querySelector(".account-settings").getBoundingClientRect();
          return accountRect.top >= bodyRect.top - 1;
        });
        if (!settingsBodyStartsCleanly) throw new Error(`Ajustes deja una sección parcialmente recortada al desplazar en ${width}px`);
        const finalActionVisible = await page.locator("#deleteAccountButton").evaluate((button) => {
          const rect = button.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= innerHeight;
        });
        if (!finalActionVisible) throw new Error(`La acción final de Ajustes no queda visible al desplazar en ${width}px`);
        const stickyHeaderSurface = await page.locator(".sheet-heading").evaluate((heading) => ({
          backgroundColor: getComputedStyle(heading).backgroundColor,
          backgroundImage: getComputedStyle(heading).backgroundImage,
        }));
        if (stickyHeaderSurface.backgroundColor === "rgba(0, 0, 0, 0)" || stickyHeaderSurface.backgroundImage !== "none") {
          throw new Error(`La cabecera de Ajustes deja ver contenido por detrás: ${JSON.stringify(stickyHeaderSurface)}`);
        }
        await assertTouchTargets(`${mode} ajustes al final`);
        await page.screenshot({ path: resolve(output, `${mode}-ajustes-final-${width}.png`) });
        if (mode === "pendiente") {
          await page.locator("#importInput").focus();
          if (await page.locator(".import-button").evaluate((label) => getComputedStyle(label).outlineStyle) === "none") {
            throw new Error("Importar copia no tiene foco visible");
          }
          await page.screenshot({ path: resolve(output, `importar-foco-${width}.png`) });
        }
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`Capturas guardadas en ${output}`);
