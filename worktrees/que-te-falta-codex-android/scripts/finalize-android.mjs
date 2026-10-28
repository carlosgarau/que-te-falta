import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ANDROID_APP_ID = "app.quetefalta.mobile";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeConfigPath = resolve(root, "android/app/src/main/assets/capacitor.config.json");
const nativeConfig = JSON.parse(await readFile(nativeConfigPath, "utf8"));

nativeConfig.appId = ANDROID_APP_ID;
await writeFile(nativeConfigPath, `${JSON.stringify(nativeConfig, null, 2)}\n`, "utf8");

console.log(`Identificador Android preparado: ${ANDROID_APP_ID}`);
