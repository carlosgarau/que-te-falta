import { readFile } from "node:fs/promises";

export async function buildSiriBundle(root) {
  const core = await readFile(new URL("core.mjs", root), "utf8");
  const siri = await readFile(new URL("siri-shopping.mjs", root), "utf8");
  const source = `${core}\n${siri.replace(/^import[^\n]+\n/gm, "")}`.replace(/^export /gm, "");
  return `"use strict";\n${source}\nglobalThis.SiriShopping = { planSiriAddition, siriProducts };\n`;
}
