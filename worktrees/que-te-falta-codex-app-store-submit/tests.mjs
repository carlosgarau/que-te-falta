import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  addExpiration,
  categoryFor,
  createInitialState,
  detectVoiceCommand,
  getActiveExpirations,
  getPendingExpirationAlerts,
  getPreviouslyPurchased,
  getSuggestions,
  groupItems,
  hydrateState,
  isFreezable,
  isPerishable,
  markExpirationAlerted,
  parseEntry,
  parseExtraPurchaseCommand,
  parseSpokenList,
  parseSpokenExpiryDate,
  productKey,
  registerPurchase,
  registerRequest,
  updateExpiration,
} from "./core.mjs";
import {
  createFamilyId,
  createFamilySync,
  createSharedListSync,
  expireFamilyCookie,
  familyCookiePathFromUrl,
  familyIdFromCookie,
  familyIdFromUrl,
  FAMILY_COOKIE_MAX_AGE,
  FAMILY_COOKIE_NAME,
  makeFamilyCookie,
  makeFamilyShareUrl,
  makeSharedListUrl,
  mergeFamilyStates,
  mergeSharedState,
  sharedListIdFromUrl,
  sharedStateFrom,
} from "./family-sync.mjs";
import {
  createSharedPasswordCodec,
  isEncryptedSharedRecord,
  validateSharedPassword,
} from "./secure-sharing.mjs";
import {
  accountProviderForDeletion,
  accountInviteFromUrl,
  accountStateFrom,
  clearAccountInviteFromUrl,
  makeAccountInviteUrl,
  mergeAccountState,
  normalizeAccountUser,
} from "./account-sharing.mjs";

test("separa una frase con varios productos", () => {
  const entries = parseSpokenList("Añade leche, pan y dos kilos de patatas a la lista de la compra");
  assert.deepEqual(entries.map(({ key, quantity, unit }) => ({ key, quantity, unit })), [
    { key: "leche", quantity: 1, unit: "" },
    { key: "pan", quantity: 1, unit: "" },
    { key: "patata", quantity: 2, unit: "kilos" },
  ]);
});

test("normaliza plurales habituales para detectar repetidos", () => {
  assert.equal(productKey("Fresas"), "fresa");
  assert.equal(productKey("los huevos"), "huevo");
  assert.equal(parseEntry("3 yogures").key, "yogur");
});

test("clasifica productos en familias", () => {
  assert.equal(categoryFor("leche entera"), "Lácteos y huevos");
  assert.equal(categoryFor("pañales talla 5"), "Bebés y niños");
  assert.equal(categoryFor("tomates cherry"), "Fruta y verdura");
  assert.equal(categoryFor("aguacate"), "Fruta y verdura");
  assert.equal(categoryFor("turrón"), "Despensa");
  assert.equal(groupItems([{ category: "Bebidas" }, { category: "Despensa" }]).length, 2);
});

test("reconoce comandos de compra", () => {
  assert.equal(detectVoiceCommand("Voy a hacer la compra").type, "shopping");
  assert.equal(detectVoiceCommand("leer la lista").type, "read");
  assert.equal(detectVoiceCommand("¿Qué hay en la lista de la compra?").type, "read");
  assert.equal(detectVoiceCommand("Hay en la lista de la compra").type, "read");
  assert.equal(detectVoiceCommand("Hay").type, "read");
  assert.equal(detectVoiceCommand("Qué ingredientes hay en la lista de la compra").type, "read");
  assert.equal(detectVoiceCommand("Qué productos tengo en mi lista").type, "read");
  assert.equal(detectVoiceCommand("Cuáles son los ingredientes de la lista de la compra").type, "read");
  assert.equal(detectVoiceCommand("Dime qué hay en mi lista de la compra").type, "read");
  assert.equal(detectVoiceCommand("Qué tengo en la lista de la compra").type, "read");
  assert.equal(detectVoiceCommand("Léeme la lista").type, "read");
  assert.equal(detectVoiceCommand("He terminado la compra").type, "finish");
  assert.equal(detectVoiceCommand("Hazme la lista final que voy a comprar").type, "shopping");
  assert.equal(detectVoiceCommand("Muéstrame la lista de la compra").type, "show-list");
});

test("entiende fechas de caducidad dichas en voz alta", () => {
  const now = new Date(2026, 6, 16, 10).getTime();
  assert.equal(parseSpokenExpiryDate("caducan en tres días", now), "2026-07-19");
  assert.equal(parseSpokenExpiryDate("caduca el 25 de julio", now), "2026-07-25");
  assert.equal(parseSpokenExpiryDate("caduca mañana", now), "2026-07-17");
});

test("registra una compra extra con producto y fecha dictados", () => {
  const now = new Date(2026, 6, 16, 10).getTime();
  const command = parseExtraPurchaseCommand("He comprado hamburguesas extra que caducan en tres días", now);
  assert.equal(command.type, "extra-expiration");
  assert.equal(command.entry.key, "hamburguesa");
  assert.equal(command.expiresOn, "2026-07-19");
  const incomplete = detectVoiceCommand("He comprado algo extra que caduque");
  assert.equal(incomplete.type, "extra-expiration");
  assert.equal(incomplete.entry, null);
});

test("sugiere un producto olvidado según el historial", () => {
  const state = createInitialState();
  const entry = parseEntry("leche");
  const fiftyDays = 50 * 86_400_000;
  registerRequest(state, entry, 0);
  registerPurchase(state, { ...entry, id: "1" }, 0);
  const ideas = getSuggestions(state, fiftyDays);
  assert.equal(ideas.remembered[0].key, "leche");
});

test("no sugiere algo que ya está en la lista", () => {
  const state = createInitialState();
  const entry = parseEntry("leche");
  registerRequest(state, entry, 0);
  registerPurchase(state, { ...entry, id: "1" }, 0);
  state.items.push({ ...entry, id: "2", checked: false });
  assert.equal(getSuggestions(state, 50 * 86_400_000).remembered.length, 0);
});

test("detecta productos delicados y cuáles se pueden congelar", () => {
  assert.equal(isPerishable(parseEntry("hamburguesas")), true);
  assert.equal(isFreezable(parseEntry("hamburguesas")), true);
  assert.equal(isPerishable(parseEntry("detergente")), false);
  assert.equal(isFreezable(parseEntry("yogures")), false);
});

test("avisa a tres días y vuelve a avisar a un día", () => {
  const state = createInitialState();
  const item = parseEntry("hamburguesas");
  const firstCheck = new Date(2026, 6, 16, 10).getTime();
  const expiration = addExpiration(state, item, "2026-07-19", firstCheck);
  assert.equal(getActiveExpirations(state, firstCheck)[0].daysLeft, 3);
  assert.equal(getPendingExpirationAlerts(state, firstCheck)[0].threshold, 3);

  markExpirationAlerted(state, expiration.id, 3);
  assert.equal(getPendingExpirationAlerts(state, firstCheck).length, 0);
  const secondCheck = new Date(2026, 6, 18, 10).getTime();
  assert.equal(getPendingExpirationAlerts(state, secondCheck)[0].threshold, 1);
});

test("permite cambiar una caducidad y reinicia sus avisos", () => {
  const state = createInitialState();
  const item = parseEntry("patatas");
  const now = new Date(2026, 7, 14, 10).getTime();
  const expiration = addExpiration(state, item, "2026-08-17", now);
  markExpirationAlerted(state, expiration.id, 3);

  const updated = updateExpiration(state, expiration.id, "2026-08-19", now + 1000);
  assert.equal(updated.id, expiration.id);
  assert.equal(updated.expiresOn, "2026-08-19");
  assert.deepEqual(updated.alertsSent, []);
  assert.equal(getActiveExpirations(state, now)[0].daysLeft, 5);
});

test("ofrece productos comprados anteriormente sin duplicados ni activos", () => {
  const state = createInitialState();
  const milk = parseEntry("leche");
  const bread = parseEntry("pan");
  registerPurchase(state, milk, new Date(2026, 7, 12, 10).getTime());
  registerPurchase(state, bread, new Date(2026, 7, 13, 10).getTime());
  registerPurchase(state, milk, new Date(2026, 7, 14, 10).getTime());

  const previous = getPreviouslyPurchased(state, [bread]);
  assert.deepEqual(previous.map((entry) => entry.key), [milk.key]);
  assert.equal(previous[0].name, "Leche");
});

test("crea y reconoce enlaces familiares privados", () => {
  const fakeCrypto = {
    getRandomValues(bytes) {
      bytes.forEach((_, index) => { bytes[index] = index + 1; });
      return bytes;
    },
  };
  const familyId = createFamilyId(fakeCrypto);
  assert.equal(familyId.length, 43);
  const url = makeFamilyShareUrl("https://example.com/que-te-falta/?command=pan#lista", familyId);
  assert.equal(familyIdFromUrl(url), familyId);
  assert.equal(new URL(url).searchParams.has("command"), false);
});

test("traspasa la familia de Safari a la app instalada mediante cookie", () => {
  const familyId = "f".repeat(43);
  const sharedUrl = makeFamilyShareUrl("https://example.com/que-te-falta/", familyId);
  const cookiePath = familyCookiePathFromUrl(sharedUrl);
  const setCookie = makeFamilyCookie(familyId, cookiePath);
  const cookieHeader = setCookie.split(";")[0];

  assert.equal(cookiePath, "/que-te-falta/");
  assert.equal(familyIdFromUrl(sharedUrl), familyId);
  assert.equal(familyIdFromCookie(cookieHeader), familyId);
  assert.match(setCookie, new RegExp(`^${FAMILY_COOKIE_NAME}=${familyId};`));
  assert.match(setCookie, new RegExp(`Max-Age=${FAMILY_COOKIE_MAX_AGE}`));
  assert.match(setCookie, /Path=\/que-te-falta\/; SameSite=Strict; Secure$/);
  assert.match(expireFamilyCookie(cookiePath), /Max-Age=0; Path=\/que-te-falta\//);
});

test("ignora cookies familiares manipuladas o incompletas", () => {
  assert.equal(familyIdFromCookie(`${FAMILY_COOKIE_NAME}=demasiado-corta`), "");
  assert.equal(familyIdFromCookie(`otra=1; ${FAMILY_COOKIE_NAME}=${"%".repeat(43)}`), "");
  assert.equal(familyIdFromCookie("otra=1"), "");
});

test("crea un enlace aislado para una sola lista especial", () => {
  const listId = "N".repeat(43);
  const url = makeSharedListUrl("https://example.com/que-te-falta/?familia=secreto&command=pan", listId);
  assert.equal(sharedListIdFromUrl(url), listId);
  assert.equal(new URL(url).searchParams.has("familia"), false);
  assert.equal(new URL(url).searchParams.has("command"), false);
});

test("conserva listas especiales, nombre, artículos y enlace al hidratar", () => {
  const shareId = "s".repeat(43);
  const hydrated = hydrateState({
    specialLists: [{
      id: "navidad",
      name: "navidad",
      shareId,
      items: [{ id: "1", key: "turron", name: "Turrón", quantity: 1, checked: false }],
    }],
  });
  assert.equal(hydrated.specialLists[0].name, "Navidad");
  assert.equal(hydrated.specialLists[0].shareId, shareId);
  assert.equal(hydrated.specialLists[0].items[0].key, "turron");
});

test("mantiene las preferencias de voz fuera de la lista compartida", () => {
  const local = createInitialState();
  local.settings.speak = false;
  const shared = sharedStateFrom(local);
  assert.equal("settings" in shared, false);
  assert.equal(mergeSharedState(shared, local.settings).settings.speak, false);
});

test("recupera una lista local antigua cuando la lista familiar está vacía", () => {
  const local = createInitialState();
  local.items.push({ id: "tomate", key: "tomate", name: "Tomate", quantity: 1, checked: false });
  local.expirations.push({ id: "carne", key: "carne", name: "Carne", expiresOn: "2026-07-21" });
  const merged = mergeFamilyStates(local, { version: 1 });
  assert.equal(merged.items[0].name, "Tomate");
  assert.equal(merged.expirations[0].name, "Carne");
  assert.equal("settings" in merged, false);
});

test("une dos listas existentes sin borrar productos ni listas especiales", () => {
  const local = createInitialState();
  local.items.push({ id: "pan", key: "pan", name: "Pan", quantity: 1, checked: false });
  local.specialLists.push({
    id: "navidad",
    name: "Navidad",
    items: [{ id: "uvas", key: "uva", name: "Uvas", quantity: 1, checked: false }],
  });
  const remote = createInitialState();
  remote.items.push({ id: "leche", key: "leche", name: "Leche", quantity: 1, checked: false });
  remote.specialLists.push({
    id: "navidad",
    name: "Cena de Navidad",
    items: [{ id: "turron", key: "turron", name: "Turrón", quantity: 1, checked: false }],
  });
  const merged = mergeFamilyStates(local, remote);
  assert.deepEqual(merged.items.map((item) => item.name).sort(), ["Leche", "Pan"]);
  assert.equal(merged.specialLists[0].name, "Cena de Navidad");
  assert.deepEqual(merged.specialLists[0].items.map((item) => item.name).sort(), ["Turrón", "Uvas"]);
});

test("sube la primera lista y descarga la misma lista en otro móvil", async () => {
  let remote = null;
  const fetchImpl = async (_url, options = {}) => {
    if ((options.method || "GET") === "GET") {
      return { ok: true, status: 200, json: async () => remote };
    }
    const body = JSON.parse(options.body);
    remote = { ...body, updatedAt: 1234 };
    return { ok: true, status: 200, json: async () => remote };
  };
  const familyId = "a".repeat(43);
  const local = createInitialState();
  local.items.push({ id: "1", key: "tomate", name: "Tomate", quantity: 1, checked: false });

  const first = createFamilySync({
    databaseUrl: "https://example.test",
    familyId,
    deviceId: "movil-1",
    fetchImpl,
    EventSourceImpl: null,
  });
  await first.start(local);
  assert.equal(remote.state.items[0].key, "tomate");
  assert.equal("settings" in remote.state, false);

  let downloaded = null;
  const second = createFamilySync({
    databaseUrl: "https://example.test",
    familyId,
    deviceId: "movil-2",
    fetchImpl,
    EventSourceImpl: null,
    onRemoteState: (next) => { downloaded = next; },
  });
  await second.start(createInitialState());
  assert.equal(downloaded.items[0].name, "Tomate");
});

test("usa una colección independiente para una lista especial compartida", () => {
  const sync = createSharedListSync({
    databaseUrl: "https://example.test/",
    listId: "x".repeat(43),
    deviceId: "movil-1",
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => null }),
    EventSourceImpl: null,
  });
  assert.equal(sync.endpoint, `https://example.test/sharedLists/${"x".repeat(43)}.json`);
  sync.stop();
});

test("cifra una lista compartida y la abre únicamente con su contraseña", async () => {
  const owner = createSharedPasswordCodec("Nevera casa 2026");
  const protectedState = await owner.encrypt({ items: [{ name: "Tomates" }] });
  assert.equal(isEncryptedSharedRecord({ encryptedState: protectedState }), true);

  const invited = createSharedPasswordCodec("Nevera casa 2026");
  assert.deepEqual(await invited.decrypt(protectedState), { items: [{ name: "Tomates" }] });

  const intruder = createSharedPasswordCodec("Otra clave distinta");
  await assert.rejects(
    intruder.decrypt(protectedState),
    (error) => error.code === "WRONG_SHARED_PASSWORD",
  );
});

test("no permite contraseñas demasiado cortas", () => {
  assert.throws(() => validateSharedPassword("1234567"), /al menos 8 caracteres/);
  assert.equal(validateSharedPassword("una clave segura"), "una clave segura");
});

test("sincroniza una familia cifrada sin guardar el contenido en claro", async () => {
  let remote = null;
  const fetchImpl = async (_url, options = {}) => {
    if ((options.method || "GET") === "GET") {
      return { ok: true, status: 200, json: async () => remote };
    }
    const body = JSON.parse(options.body);
    remote = { ...body, updatedAt: 1234 };
    return { ok: true, status: 200, json: async () => remote };
  };
  const familyId = "z".repeat(43);
  const local = createInitialState();
  local.items.push({ id: "1", key: "tomate", name: "Tomate", quantity: 1, checked: false });

  const owner = createFamilySync({
    databaseUrl: "https://example.test",
    familyId,
    deviceId: "movil-1",
    fetchImpl,
    EventSourceImpl: null,
    codec: createSharedPasswordCodec("Nevera casa 2026"),
  });
  await owner.start(local);
  assert.equal("state" in remote, false);
  assert.equal(isEncryptedSharedRecord(remote), true);
  assert.doesNotMatch(remote.encryptedState.ciphertext, /Tomate/);

  let downloaded = null;
  const invited = createFamilySync({
    databaseUrl: "https://example.test",
    familyId,
    deviceId: "movil-2",
    fetchImpl,
    EventSourceImpl: null,
    codec: createSharedPasswordCodec("Nevera casa 2026"),
    onRemoteState: (next) => { downloaded = next; },
  });
  await invited.start(createInitialState());
  assert.equal(downloaded.items[0].name, "Tomate");
});

test("crea invitaciones de cuenta sin exponer otra lista", () => {
  const url = makeAccountInviteUrl("https://carlosgarau.github.io/que-te-falta/", "abc_123");
  assert.equal(accountInviteFromUrl(url), "abc_123");
  assert.equal(clearAccountInviteFromUrl(url), "/que-te-falta/");
  assert.equal(new URL(url).searchParams.has("familia"), false);
  assert.equal(new URL(url).searchParams.has("lista"), false);
});

test("identifica el proveedor que debe revalidarse al eliminar una cuenta", () => {
  assert.equal(accountProviderForDeletion({ providerId: "apple.com" }), "apple.com");
  assert.equal(accountProviderForDeletion({ providerData: [{ providerId: "google.com" }] }), "google.com");
  assert.equal(accountProviderForDeletion({
    providerId: "firebase",
    providerData: [{ providerId: "password" }, { providerId: "apple.com" }],
  }), "apple.com");
  assert.equal(accountProviderForDeletion({ providerId: "password" }), "");
});

test("sincroniza la lista familiar sin mezclar listas especiales", () => {
  const local = createInitialState();
  local.items.push({ id: "1", name: "Tomate" });
  local.specialLists.push({ id: "navidad", name: "Navidad", items: [{ id: "2", name: "Turrón" }] });
  const cloud = accountStateFrom(local);
  assert.equal("specialLists" in cloud, false);
  assert.equal(cloud.items[0].name, "Tomate");

  const merged = mergeAccountState({ ...cloud, items: [{ id: "3", name: "Leche" }] }, local);
  assert.equal(merged.items[0].name, "Leche");
  assert.equal(merged.specialLists[0].name, "Navidad");
});

test("conserva la identidad mínima de Google o Apple", () => {
  assert.deepEqual(normalizeAccountUser({
    uid: "u1",
    displayName: "Carlos Garau",
    email: "carlos@example.com",
    photoUrl: "https://example.com/carlos.jpg",
    providerId: "google.com",
  }), {
    uid: "u1",
    displayName: "Carlos Garau",
    email: "carlos@example.com",
    photoURL: "https://example.com/carlos.jpg",
    providerId: "google.com",
  });
});

test("la actualización no recarga la app mientras se usa", async () => {
  const worker = await readFile(new URL("./service-worker.js", import.meta.url), "utf8");
  assert.equal(worker.includes("client.navigate("), false);
  assert.match(worker, /self\.clients\.claim\(\)/u);
});

test("el acceso web conserva la sesión en iPhone sin redirección completa", async () => {
  const accountSharing = await readFile(new URL("./account-sharing.mjs", import.meta.url), "utf8");
  assert.match(accountSharing, /signInWithPopup\(webAuth, authProvider\)/u);
  assert.equal(accountSharing.includes("signInWithRedirect(webAuth, authProvider)"), false);
});

test("la bienvenida ofrece sincronización entre dispositivos sin bloquear el uso local", async () => {
  const app = await readFile(new URL("./app.mjs", import.meta.url), "utf8");
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  assert.match(app, /Llévate tu lista a cualquier dispositivo/u);
  assert.match(app, /maybeOpenAccountWelcome\(\)/u);
  assert.match(html, /Seguir sin cuenta/u);
});

test("la actualización reinicia una sola vez la sesión de prueba y vuelve a pedir acceso", async () => {
  const app = await readFile(new URL("./app.mjs", import.meta.url), "utf8");
  assert.match(app, /ACCOUNT_SESSION_RESET_KEY = "que-te-falta-account-session-reset-v29"/u);
  assert.match(app, /if \(user\) await signOutAccount\(\)/u);
  assert.match(app, /state = createInitialState\(\)/u);
  assert.match(app, /openAccountDialog\("welcome"\)/u);
});

test("cerrar sesión olvida la bienvenida pero conserva el flujo de acceso", async () => {
  const app = await readFile(new URL("./app.mjs", import.meta.url), "utf8");
  const start = app.indexOf("async function handleAccountSignOut()");
  const end = app.indexOf("async function handleDeleteAccount()", start);
  const handler = app.slice(start, end);
  assert.match(handler, /forgetAccountWelcomeSeen\(\)/u);
  assert.match(handler, /openAccountDialog\("welcome"\)/u);
  assert.equal(handler.includes("localStorage.clear()"), false);
});

test("la interfaz móvil bloquea el desplazamiento lateral involuntario", async () => {
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(styles, /overflow-x: clip/u);
  assert.match(styles, /overscroll-behavior-x: none/u);
  assert.match(styles, /\.list-selector-row \{ align-items: center; flex-wrap: nowrap;/u);
  assert.match(styles, /\.list-switcher \{ flex: 1 1 auto; flex-wrap: wrap; overflow-x: visible;/u);
});

test("la cabecera de voz móvil deja espacio a la lista", async () => {
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.voice-card \{ grid-template-columns: minmax\(0, 1fr\) 58px; min-height: 128px;/u);
  assert.match(styles, /\.voice-card h1 \{ margin: 4px 0; font-size: 24px;/u);
  assert.match(styles, /\.mic-button \{ width: 52px; height: 52px;/u);
});

test("ajustes respeta la zona visible del navegador móvil", async () => {
  const app = await readFile(new URL("./app.mjs", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(app, /window\.visualViewport\?\.height/u);
  assert.match(styles, /--visible-viewport-height/u);
  assert.match(styles, /\.sheet-heading \{ position: sticky;/u);
});

