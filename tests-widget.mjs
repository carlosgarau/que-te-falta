import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const backend = read("./ios/App/WidgetPrototype/WidgetListStore.swift");
const view = read("./ios/App/WidgetPrototype/ShoppingListWidget.swift");
const project = read("./ios/App/App.xcodeproj/project.pbxproj");
const entitlements = read("./ios/App/App/App.entitlements");
const workflow = read("./.github/workflows/ios-testflight.yml");

test("el prototipo permanece invisible mientras falta App Groups y firma de extensión", () => {
  assert.doesNotMatch(project, /WidgetPrototype|QueTeFaltaFamilyList|com\.apple\.product-type\.app-extension/);
  assert.doesNotMatch(entitlements, /com\.apple\.security\.application-groups/);
  assert.doesNotMatch(view, /@main\s+(?:struct|class)/);
  assert.match(workflow, /PROVISIONING_PROFILE_SPECIFIER|La compra App Store/);
  assert.doesNotMatch(workflow, /com\.carlosgarau\.lacompra\.widget/);
});

test("el widget no abre la app ni exhibe controles cuando no hay datos confirmados", () => {
  assert.match(view, /openAppWhenRun\s*=\s*false/);
  assert.match(view, /authenticationPolicy.*requiresAuthentication/);
  assert.match(view, /case \.signIn.*case \.noAccess.*case \.offline.*case \.setup/s);
  assert.match(view, /case \.ready\(let snapshot\):[\s\S]*Button\(intent:/);
  assert.match(view, /let checked = products\.filter\(\\\.checked\)\.reversed\(\)/);
});

test("la mutación exige identidad, permiso y confirmación CAS del servidor", () => {
  assert.match(backend, /useUserAccessGroup\(appGroupID\)/);
  assert.match(backend, /containerURL\(forSecurityApplicationGroupIdentifier: appGroupID\)/);
  assert.match(backend, /guard account\.uid == expectedUserID/);
  assert.match(backend, /record\["type"\].*"family"/);
  assert.match(backend, /\["owner", "editor"\]/);
  assert.match(backend, /"if-match"/);
  assert.match(backend, /response\.statusCode == 412 \{ continue \}/);
  assert.match(backend, /Never retry an ambiguous write/);
  assert.doesNotMatch(backend, /UserDefaults\.standard|setValue\(.*[Tt]oken|setObject\(.*[Tt]oken/);
});
