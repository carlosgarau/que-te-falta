import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const expected = Object.freeze({
  androidPackage: "app.quetefalta.mobile",
  iosBundle: "com.carlosgarau.lacompra",
  firebaseProject: "la-compra-familiar",
  firebaseNumber: "927654282506",
  webHost: "carlosgarau.github.io",
  webPath: "/que-te-falta/",
  targetSdk: 36,
});

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [googleServicesText, iosFirebase, accountSharing, manifest, variables, gradle, rules, launcher, splash, androidResources] = await Promise.all([
  read("android/app/google-services.json"),
  read("ios/App/App/GoogleService-Info.plist"),
  read("account-sharing.mjs"),
  read("android/app/src/main/AndroidManifest.xml"),
  read("android/variables.gradle"),
  read("android/app/build.gradle"),
  read("database.rules.json"),
  read("android/app/src/main/res/drawable/ic_launcher_foreground.xml"),
  read("android/app/src/main/res/drawable/splash.xml"),
  readdir(new URL("../android/app/src/main/res", import.meta.url), { recursive: true }),
]);

const googleServices = JSON.parse(googleServicesText);
const androidClient = googleServices.client?.find((client) => (
  client.client_info?.android_client_info?.package_name === expected.androidPackage
));
assert.ok(androidClient, `google-services.json no contiene ${expected.androidPackage}`);
assert.equal(googleServices.project_info?.project_id, expected.firebaseProject);
assert.equal(String(googleServices.project_info?.project_number), expected.firebaseNumber);

const androidOAuthClients = (androidClient.oauth_client || []).filter((client) => (
  client.client_type === 1
  && client.android_info?.package_name === expected.androidPackage
  && client.android_info?.certificate_hash
));
assert.ok(
  androidOAuthClients.length >= 2,
  "Firebase debe incluir las firmas de subida y de Google Play para que el acceso funcione en ambas instalaciones",
);
assert.ok(
  (androidClient.oauth_client || []).some((client) => client.client_type === 3),
  "Falta el cliente web que usa Firebase Authentication",
);

assert.match(iosFirebase, new RegExp(`<string>${expected.iosBundle.replaceAll(".", "\\.")}</string>`));
assert.match(iosFirebase, new RegExp(`<string>${expected.firebaseProject.replaceAll("-", "\\-")}</string>`));
assert.match(accountSharing, new RegExp(`projectId: "${expected.firebaseProject}"`));
assert.match(accountSharing, new RegExp(`messagingSenderId: "${expected.firebaseNumber}"`));

assert.match(manifest, new RegExp(`android:host="${expected.webHost.replaceAll(".", "\\.")}"`));
assert.match(manifest, new RegExp(`android:pathPrefix="${expected.webPath.replaceAll("/", "\\/")}"`));
assert.match(manifest, /android:scheme="lacompra"/u);
assert.match(manifest, /android:name="android\.permission\.INTERNET"/u);
assert.match(variables, new RegExp(`targetSdkVersion = ${expected.targetSdk}`));
assert.match(gradle, new RegExp(`applicationId "${expected.androidPackage.replaceAll(".", "\\.")}"`));
assert.match(gradle, /bundleRelease/u);
assert.match(launcher, /#F7F4EC/u);
assert.match(launcher, /#D9EB9E/u);
assert.match(launcher, /M142,86 L292,86 L374,168/u);
assert.doesNotMatch(launcher, /M136,207|M373,87/u);
assert.match(splash, /@drawable\/splash_mark/u);
assert.equal(androidResources.some((path) => /ic_launcher_foreground\.png$/u.test(path)), false);
assert.equal(androidResources.some((path) => /(?:^|[\\/])splash\.png$/u.test(path)), false);

const parsedRules = JSON.parse(rules);
const stateWriteRule = parsedRules.rules?.lists?.$listId?.state?.[".write"] || "";
assert.match(stateWriteRule, /role'\)\.val\(\) === 'editor'/u);
assert.match(stateWriteRule, /role'\)\.val\(\) === 'owner'/u);

console.log("GOOGLE_PLAY_READY");
console.log(`Firebase compartido: ${expected.firebaseProject}`);
console.log(`Android: ${expected.androidPackage} · iOS: ${expected.iosBundle}`);
console.log(`OAuth Android registrado para ${androidOAuthClients.length} certificados`);
