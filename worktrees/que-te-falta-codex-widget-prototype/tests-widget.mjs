import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const backend = read("./ios/App/WidgetPrototype/WidgetListStore.swift");
const view = read("./ios/App/WidgetPrototype/ShoppingListWidget.swift");
const bundle = read("./ios/App/WidgetPrototype/WidgetBundle.swift");
const sessionPlugin = read("./ios/App/WidgetPrototype/WidgetSessionPlugin.swift");
const project = read("./ios/App/App.xcodeproj/project.pbxproj");
const entitlements = read("./ios/App/App/App.entitlements");
const widgetEntitlements = read("./ios/App/WidgetPrototype/Widget.entitlements");
const hostPlugin = read("./ios/App/App/SiriShoppingPlugin.swift");

test("el widget tiene target propio pero permanece fuera de la app", () => {
  assert.match(project, /productType = "com\.apple\.product-type\.app-extension"/);
  assert.doesNotMatch(project, /QueTeFaltaWidget\.appex in Embed App Extensions/);
  assert.doesNotMatch(project, /B70000010000000000000005.*GoogleService-Info\.plist in Widget Resources/);
  assert.match(project, /PROVISIONING_PROFILE_SPECIFIER = "Que Te Falta Widget App Store"/);
  assert.match(entitlements, /com\.apple\.security\.application-groups/);
  assert.match(entitlements, /group\.com\.carlosgarau\.lacompra/);
  assert.match(widgetEntitlements, /group\.com\.carlosgarau\.lacompra/);
  assert.match(bundle, /@main\s+struct QueTeFaltaWidgetBundle/);
  assert.doesNotMatch(hostPlugin, /registerPlugin\(WidgetSessionPlugin\.self\)/);
});

test("la migración de sesión está preparada pero no activada", () => {
  assert.match(sessionPlugin, /getStoredUser\(forAccessGroup: keychainGroup\)/);
  assert.match(sessionPlugin, /updateCurrentUser\(privateUser\)/);
  assert.doesNotMatch(project, /WidgetSessionPlugin\.swift in Sources/);
});

test("el widget no abre la app ni exhibe controles cuando no hay datos confirmados", () => {
  assert.match(view, /openAppWhenRun\s*=\s*false/);
  assert.match(view, /authenticationPolicy.*requiresAuthentication/);
  assert.match(view, /case \.signIn.*case \.noAccess.*case \.offline.*case \.setup/s);
  assert.match(view, /case \.ready\(let snapshot, let unconfirmed\):[\s\S]*Button\(intent:/);
  assert.match(view, /let checked = products\.filter\(\\\.checked\)\.reversed\(\)/);
  assert.match(view, /WidgetCenter\.shared\.reloadTimelines\(ofKind:/);
  assert.match(view, /Cambio no confirmado/);
});

test("la mutación exige identidad, permiso y confirmación CAS del servidor", () => {
  assert.match(backend, /keychainAccessGroup = "N44AYP9B99\.\\\(appGroupID\)"/);
  assert.match(backend, /useUserAccessGroup\(keychainAccessGroup\)/);
  assert.match(backend, /containerURL\(forSecurityApplicationGroupIdentifier: appGroupID\)/);
  assert.match(backend, /guard account\.uid == expectedUserID/);
  assert.match(backend, /record\["type"\].*"family"/);
  assert.match(backend, /\["owner", "editor"\]/);
  assert.match(backend, /"if-match"/);
  assert.match(backend, /response\.statusCode == 412 \{ continue \}/);
  assert.match(backend, /Never retry an ambiguous write/);
  assert.doesNotMatch(backend, /UserDefaults\.standard|setValue\(.*[Tt]oken|setObject\(.*[Tt]oken/);
});

test("la maqueta limita filas en el tamaño mediano y con letra accesible", () => {
  assert.match(view, /dynamicTypeSize\.isAccessibilitySize \{ return family == \.systemLarge \? 3 : 1 \}/);
  assert.match(view, /return family == \.systemLarge \? 5 : 2/);
  assert.match(view, /let shownPending = Array\(pending\.prefix\(rowLimit\)\)/);
  assert.match(view, /guard shownPending\.count < rowLimit/);
  assert.doesNotMatch(view, /systemLarge \? 7 : 4/);
});
