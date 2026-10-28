import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedBundleId = "com.carlosgarau.lacompra";
const failures = [];
const skipScreenshotValidation = process.env.CI === "true"
  || process.env.SKIP_SCREENSHOT_VALIDATION === "1";

function file(relativePath) {
  const fullPath = join(root, relativePath);
  if (!existsSync(fullPath)) {
    failures.push(`Falta ${relativePath}`);
    return "";
  }
  return readFileSync(fullPath, "utf8");
}

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

function pngInfo(relativePath) {
  const fullPath = join(root, relativePath);
  if (!existsSync(fullPath)) {
    failures.push(`Falta ${relativePath}`);
    return null;
  }
  const data = readFileSync(fullPath);
  const pngSignature = "89504e470d0a1a0a";
  if (data.subarray(0, 8).toString("hex") !== pngSignature) {
    failures.push(`${relativePath} no es un PNG válido`);
    return null;
  }
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    colorType: data[25],
  };
}

const capacitor = JSON.parse(file("capacitor.config.json") || "{}");
requireCondition(capacitor.appId === expectedBundleId, "El appId de Capacitor no coincide con el Bundle ID");
requireCondition(capacitor.appName === "¿Qué te falta?", "El nombre de Capacitor debe ser ¿Qué te falta?");
requireCondition(capacitor.webDir === "www", "Capacitor debe empaquetar el directorio www");

const project = file("ios/App/App.xcodeproj/project.pbxproj");
requireCondition((project.match(/PRODUCT_BUNDLE_IDENTIFIER = com\.carlosgarau\.lacompra;/g) || []).length === 2,
  "El proyecto Xcode debe usar el Bundle ID en Debug y Release");
requireCondition((project.match(/TARGETED_DEVICE_FAMILY = 1;/g) || []).length === 2,
  "La primera versión debe estar limitada a iPhone");
requireCondition((project.match(/IPHONEOS_DEPLOYMENT_TARGET = 15\.0;/g) || []).length >= 2,
  "El destino mínimo debe ser iOS 15");

const infoPlist = file("ios/App/App/Info.plist");
requireCondition(infoPlist.includes("<string>¿Qué te falta?</string>"),
  "El nombre visible en iPhone debe ser ¿Qué te falta?");
for (const requiredText of [
  "NSMicrophoneUsageDescription",
  "NSSpeechRecognitionUsageDescription",
  "ITSAppUsesNonExemptEncryption",
  "public.app-category.shopping",
  "<string>lacompra</string>",
]) {
  requireCondition(infoPlist.includes(requiredText), `Info.plist no contiene ${requiredText}`);
}
requireCondition(!infoPlist.includes("UIInterfaceOrientationLandscape"),
  "La primera versión no debe anunciar orientaciones no probadas");

const privacyManifest = file("ios/App/App/PrivacyInfo.xcprivacy");
for (const requiredText of [
  "<key>NSPrivacyTracking</key>",
  "NSPrivacyCollectedDataTypeName",
  "NSPrivacyCollectedDataTypeEmailAddress",
  "NSPrivacyCollectedDataTypeUserID",
  "NSPrivacyCollectedDataTypeOtherUserContent",
  "NSPrivacyCollectedDataTypePurchaseHistory",
  "NSPrivacyCollectedDataTypePhotosorVideos",
  "NSPrivacyCollectedDataTypeDeviceID",
  "NSPrivacyCollectedDataTypePurposeAppFunctionality",
]) {
  requireCondition(privacyManifest.includes(requiredText), `PrivacyInfo.xcprivacy no contiene ${requiredText}`);
}

const metadata = file("APP_STORE_METADATA.md");
for (const requiredText of [
  expectedBundleId,
  "https://carlosgarau.github.io/que-te-falta/support.html",
  "https://carlosgarau.github.io/que-te-falta/privacy.html",
  "LA-COMPRA-IOS-001",
]) {
  requireCondition(metadata.includes(requiredText), `Los metadatos no contienen ${requiredText}`);
}
requireCondition(!metadata.includes(",Siri,"), "Los metadatos no deben anunciar una integración nativa de Siri inexistente");

const accountSharing = file("account-sharing.mjs");
const nativeBridge = file("native-bridge.mjs");
requireCondition(accountSharing.includes("prepareDeletion(providerId)"),
  "La eliminación de cuenta debe revalidar el proveedor antes de borrar datos");
const accountDeletionImplementation = accountSharing.split("export async function deleteAccountAndData()", 2)[1]
  ?.split("export async function saveAccountProfile()", 1)[0] || "";
requireCondition(!accountDeletionImplementation.includes(".catch(() => {})"),
  "La eliminación de cuenta no debe ocultar fallos que puedan dejar datos huérfanos");
requireCondition(nativeBridge.includes("FirebaseAuthentication.revokeAccessToken"),
  "La eliminación de una cuenta de Apple debe revocar su autorización");

const databaseRules = JSON.parse(file("database.rules.json") || "{}");
requireCondition(databaseRules.rules?.families?.$familyId?.[".write"] === "data.exists()",
  "Las reglas antiguas no deben permitir crear nuevas familias sin autenticación");
requireCondition(databaseRules.rules?.sharedLists?.$listId?.[".write"] === "data.exists()",
  "Las reglas antiguas no deben permitir crear nuevas listas sin autenticación");
requireCondition(databaseRules.rules?.lists?.$listId?.[".read"]?.includes("auth != null"),
  "Las listas nuevas deben exigir autenticación para leer");
const invitedMemberRule = databaseRules.rules?.lists?.$listId?.members?.$uid?.[".write"] || "";
requireCondition(invitedMemberRule.includes("newData.child('role').val() === 'editor'"),
  "Una invitación no debe permitir que el invitado se atribuya el rol de propietario");
requireCondition(invitedMemberRule.includes("child('role').val() === 'editor'"),
  "El rol aceptado debe coincidir con el rol de editor de la invitación");

const reviewResponse = file("APP_REVIEW_RESPONSE_2026-08-14.md");
requireCondition(!reviewResponse.includes("[SCREEN_RECORDING_FILENAME]"),
  "La respuesta a App Review todavía contiene el nombre de vídeo pendiente");
requireCondition(!reviewResponse.includes("No AI, ads, analytics, payments, or social login are used"),
  "La respuesta a App Review contradice el acceso con Apple y Google");

const supportPage = file("support.html");
requireCondition(supportPage.includes("mailto:"),
  "La página de soporte debe incluir un correo de contacto directo");

if (!skipScreenshotValidation) {
  const screenshotNames = [
    "01-lista-habitual.png",
    "02-voy-a-comprar.png",
    "03-caducidades.png",
    "04-comprados.png",
    "05-historial.png",
  ];
  for (const screenshotName of screenshotNames) {
    const screenshot = pngInfo(`PARA-SUBIR-A-APPLE/${screenshotName}`);
    if (!screenshot) continue;
    requireCondition(screenshot.width === 1242 && screenshot.height === 2688,
      `${screenshotName} debe medir 1242 x 2688 píxeles`);
    requireCondition(![4, 6].includes(screenshot.colorType),
      `${screenshotName} no puede contener transparencia`);

    const largeScreenshot = pngInfo(`PARA-SUBIR-A-APPLE-6.9/${screenshotName}`);
    if (!largeScreenshot) continue;
    requireCondition(largeScreenshot.width === 1290 && largeScreenshot.height === 2796,
      `${screenshotName} de 6,9 pulgadas debe medir 1290 x 2796 píxeles`);
    requireCondition(![4, 6].includes(largeScreenshot.colorType),
      `${screenshotName} de 6,9 pulgadas no puede contener transparencia`);
  }
}

for (const requiredPath of [
  "privacy.html",
  "support.html",
  "firebase.json",
  ".firebaserc",
  ".github/workflows/ios-xcode26.yml",
  ".github/workflows/ios-testflight.yml",
]) {
  file(requiredPath);
}

const appIcon = pngInfo("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");
if (appIcon) {
  requireCondition(appIcon.width === 1024 && appIcon.height === 1024,
    "El icono de App Store debe medir 1024 x 1024 píxeles");
  requireCondition(![4, 6].includes(appIcon.colorType),
    "El icono de App Store no puede contener canal alfa");
}

if (failures.length) {
  console.error("Validación de App Store fallida:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Validación de App Store correcta");
console.log(`Bundle ID: ${expectedBundleId}`);
console.log("Destino: iPhone, iOS 15 o posterior, orientación vertical");
console.log("Icono: 1024 x 1024, sin transparencia");
