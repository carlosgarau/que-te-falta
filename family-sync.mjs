export const FAMILY_STORAGE_KEY = "la-compra-family-v1";
export const DEVICE_STORAGE_KEY = "la-compra-device-v1";
export const FAMILY_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const FAMILY_COOKIE_NAME = FAMILY_STORAGE_KEY;
export const FAMILY_COOKIE_MAX_AGE = 31_536_000;

export function normalizeFamilyId(value) {
  const candidate = String(value || "").trim();
  return FAMILY_ID_PATTERN.test(candidate) ? candidate : "";
}

export function createFamilyId(cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.getRandomValues) throw new Error("No se puede crear un enlace seguro");
  const bytes = cryptoImpl.getRandomValues(new Uint8Array(32));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

export function familyIdFromUrl(value) {
  const url = value instanceof URL ? value : new URL(String(value), "https://example.invalid/");
  return normalizeFamilyId(url.searchParams.get("familia") || url.searchParams.get("family"));
}

export function familyIdFromCookie(value) {
  const cookies = String(value || "").split(";");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== FAMILY_COOKIE_NAME) continue;
    try {
      return normalizeFamilyId(decodeURIComponent(cookie.slice(separator + 1).trim()));
    } catch {
      return "";
    }
  }
  return "";
}

export function familyCookiePathFromUrl(value) {
  const url = value instanceof URL ? value : new URL(String(value), "https://example.invalid/");
  return new URL(".", url).pathname;
}

export function makeFamilyCookie(familyId, path = "/") {
  const id = normalizeFamilyId(familyId);
  if (!id) throw new Error("El enlace familiar no es válido");
  return `${FAMILY_COOKIE_NAME}=${encodeURIComponent(id)}; Max-Age=${FAMILY_COOKIE_MAX_AGE}; Path=${path}; SameSite=Strict; Secure`;
}

export function expireFamilyCookie(path = "/") {
  return `${FAMILY_COOKIE_NAME}=; Max-Age=0; Path=${path}; SameSite=Strict; Secure`;
}

export function sharedListIdFromUrl(value) {
  const url = value instanceof URL ? value : new URL(String(value), "https://example.invalid/");
  return normalizeFamilyId(url.searchParams.get("lista"));
}

export function makeFamilyShareUrl(value, familyId) {
  const id = normalizeFamilyId(familyId);
  if (!id) throw new Error("El enlace familiar no es válido");
  const url = value instanceof URL ? new URL(value) : new URL(String(value));
  url.search = "";
  url.hash = "";
  url.searchParams.set("familia", id);
  return url.toString();
}

export function makeSharedListUrl(value, listId) {
  const id = normalizeFamilyId(listId);
  if (!id) throw new Error("El enlace de la lista no es válido");
  const url = value instanceof URL ? new URL(value) : new URL(String(value));
  url.search = "";
  url.hash = "";
  url.searchParams.set("lista", id);
  return url.toString();
}

export function sharedStateFrom(state) {
  const { settings: _settings, ...shared } = state || {};
  return shared;
}

export function mergeSharedState(shared, localSettings = {}) {
  return {
    ...(shared || {}),
    settings: { ...localSettings },
  };
}

function mergeUniqueEntries(localEntries, remoteEntries, identity) {
  const merged = new Map();
  [...(Array.isArray(localEntries) ? localEntries : []), ...(Array.isArray(remoteEntries) ? remoteEntries : [])]
    .forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const id = identity(entry, index);
      merged.set(id, { ...(merged.get(id) || {}), ...entry });
    });
  return [...merged.values()];
}

function mergeCatalog(localCatalog, remoteCatalog) {
  const local = localCatalog && typeof localCatalog === "object" ? localCatalog : {};
  const remote = remoteCatalog && typeof remoteCatalog === "object" ? remoteCatalog : {};
  const merged = {};
  new Set([...Object.keys(local), ...Object.keys(remote)]).forEach((key) => {
    const localEntry = local[key] || {};
    const remoteEntry = remote[key] || {};
    merged[key] = {
      ...localEntry,
      ...remoteEntry,
      requestDates: [...new Set([...(localEntry.requestDates || []), ...(remoteEntry.requestDates || [])])].sort().slice(-20),
      purchaseDates: [...new Set([...(localEntry.purchaseDates || []), ...(remoteEntry.purchaseDates || [])])].sort().slice(-20),
    };
  });
  return merged;
}

function mergeDismissals(localDismissals, remoteDismissals) {
  const local = localDismissals && typeof localDismissals === "object" ? localDismissals : {};
  const remote = remoteDismissals && typeof remoteDismissals === "object" ? remoteDismissals : {};
  const merged = {};
  new Set([...Object.keys(local), ...Object.keys(remote)]).forEach((month) => {
    merged[month] = [...new Set([...(local[month] || []), ...(remote[month] || [])])];
  });
  return merged;
}

function mergeSpecialLists(localLists, remoteLists) {
  const merged = new Map();
  [...(Array.isArray(localLists) ? localLists : []), ...(Array.isArray(remoteLists) ? remoteLists : [])]
    .forEach((list, index) => {
      if (!list || typeof list !== "object") return;
      const id = String(list.id || `lista-${index}`);
      const previous = merged.get(id) || {};
      merged.set(id, {
        ...previous,
        ...list,
        id,
        items: mergeUniqueEntries(previous.items, list.items, (item, itemIndex) => (
          String(item.id || `${item.key || item.name || "producto"}-${itemIndex}`)
        )),
      });
    });
  return [...merged.values()];
}

export function mergeFamilyStates(localState, remoteState) {
  const localSource = localState && typeof localState === "object" ? localState : {};
  const remoteSource = remoteState && typeof remoteState === "object" ? remoteState : {};
  const { settings: _localSettings, ...local } = localSource;
  const { settings: _remoteSettings, ...remote } = remoteSource;
  return {
    ...local,
    ...remote,
    version: Math.max(Number(local.version) || 1, Number(remote.version) || 1),
    items: mergeUniqueEntries(local.items, remote.items, (item, index) => (
      String(item.id || `${item.key || item.name || "producto"}-${index}`)
    )),
    catalog: mergeCatalog(local.catalog, remote.catalog),
    purchases: mergeUniqueEntries(local.purchases, remote.purchases, (entry, index) => (
      String(entry.id || `${entry.key || entry.name || "compra"}-${entry.purchasedAt || index}`)
    )).sort((a, b) => String(b.purchasedAt || "").localeCompare(String(a.purchasedAt || ""))).slice(0, 500),
    expirations: mergeUniqueEntries(local.expirations, remote.expirations, (entry, index) => (
      String(entry.id || `${entry.key || entry.name || "caducidad"}-${entry.expiresOn || index}`)
    )).slice(0, 300),
    specialLists: mergeSpecialLists(local.specialLists, remote.specialLists),
    dismissedSuggestions: mergeDismissals(local.dismissedSuggestions, remote.dismissedSuggestions),
  };
}

export function createFamilySync({
  databaseUrl,
  familyId,
  collection = "families",
  deviceId,
  fetchImpl = globalThis.fetch,
  EventSourceImpl = globalThis.EventSource,
  onRemoteState = () => {},
  onStatus = () => {},
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  codec = null,
  onAccessRequired = () => {},
}) {
  const id = normalizeFamilyId(familyId);
  if (!id) throw new Error("El enlace familiar no es válido");
  if (!databaseUrl || !fetchImpl) throw new Error("La sincronización no está disponible");
  if (!["families", "sharedLists"].includes(collection)) throw new Error("La colección compartida no es válida");

  const endpoint = `${String(databaseUrl).replace(/\/+$/g, "")}/${collection}/${id}.json`;
  let stopped = false;
  let source = null;
  let writeTimer = null;
  let pendingState = null;
  let writing = false;
  let latestUpdatedAt = 0;

  function setStatus(status) {
    if (!stopped) onStatus(status);
  }

  function handleSyncError(error) {
    if (["SHARED_PASSWORD_REQUIRED", "WRONG_SHARED_PASSWORD", "UNSUPPORTED_SHARED_ENCRYPTION"].includes(error?.code)) {
      setStatus("locked");
      onAccessRequired(error);
      return;
    }
    setStatus("offline");
  }

  async function decodedState(remote) {
    if (remote?.encryptedState) {
      if (!codec) {
        const error = new Error("Esta lista está protegida con contraseña");
        error.code = "SHARED_PASSWORD_REQUIRED";
        throw error;
      }
      return codec.decrypt(remote.encryptedState);
    }
    return remote?.state || null;
  }

  async function readRemote({ initial = false } = {}) {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`No se puede leer la lista (${response.status})`);
    const remote = await response.json();
    const remoteState = await decodedState(remote);
    if (remoteState) {
      latestUpdatedAt = Math.max(latestUpdatedAt, Number(remote.updatedAt) || 0);
      onRemoteState(remoteState, { initial, updatedBy: remote.updatedBy || "" });
    }
    return { ...remote, state: remoteState };
  }

  async function writeNow(sharedState) {
    pendingState = sharedStateFrom(sharedState);
    if (writing || stopped) return;
    writing = true;
    const nextState = pendingState;
    pendingState = null;
    setStatus("connecting");
    try {
      const storedState = codec
        ? { encryptedState: await codec.encrypt(nextState) }
        : { state: nextState };
      const response = await fetchImpl(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...storedState,
          updatedAt: { ".sv": "timestamp" },
          updatedBy: deviceId,
        }),
      });
      if (!response.ok) throw new Error(`No se puede guardar la lista (${response.status})`);
      const saved = await response.json();
      latestUpdatedAt = Math.max(latestUpdatedAt, Number(saved?.updatedAt) || 0);
      setStatus("synced");
    } catch (error) {
      pendingState = nextState;
      handleSyncError(error);
      throw error;
    } finally {
      writing = false;
    }
    if (pendingState && !stopped) schedule(pendingState, 0);
  }

  function schedule(sharedState, delay = 300) {
    pendingState = sharedStateFrom(sharedState);
    if (stopped) return;
    clearTimeoutImpl(writeTimer);
    writeTimer = setTimeoutImpl(() => {
      writeTimer = null;
      writeNow(pendingState).catch(() => {});
    }, delay);
  }

  async function receiveEvent(event) {
    try {
      const message = JSON.parse(event.data);
      if (message.path !== "/" || (!message.data?.state && !message.data?.encryptedState)) {
        readRemote().catch(handleSyncError);
        return;
      }
      const remote = message.data;
      const updatedAt = Number(remote.updatedAt) || 0;
      if (remote.updatedBy === deviceId || (updatedAt && updatedAt <= latestUpdatedAt)) return;
      latestUpdatedAt = Math.max(latestUpdatedAt, updatedAt);
      const remoteState = await decodedState(remote);
      onRemoteState(remoteState, { initial: false, updatedBy: remote.updatedBy || "" });
      setStatus("synced");
    } catch (error) {
      handleSyncError(error);
    }
  }

  function subscribe() {
    if (!EventSourceImpl || stopped || source) return;
    source = new EventSourceImpl(endpoint);
    source.addEventListener("put", (event) => receiveEvent(event));
    source.addEventListener("patch", () => readRemote().catch(handleSyncError));
    source.addEventListener("open", () => setStatus("synced"));
    source.addEventListener("cancel", () => setStatus("offline"));
    source.addEventListener("auth_revoked", () => setStatus("offline"));
    source.onerror = () => setStatus("offline");
  }

  async function start(localState) {
    setStatus("connecting");
    try {
      const remote = await readRemote({ initial: true });
      if (!remote?.state) await writeNow(localState);
      else setStatus("synced");
    } catch (error) {
      handleSyncError(error);
    }
    subscribe();
  }

  async function refresh() {
    try {
      await readRemote();
      setStatus("synced");
      if (pendingState) await writeNow(pendingState);
    } catch (error) {
      handleSyncError(error);
    }
  }

  function stop() {
    stopped = true;
    clearTimeoutImpl(writeTimer);
    source?.close();
    source = null;
  }

  return {
    endpoint,
    refresh,
    schedule,
    start,
    stop,
    writeNow,
  };
}

export function createSharedListSync({ listId, ...options }) {
  return createFamilySync({
    ...options,
    familyId: listId,
    collection: "sharedLists",
  });
}
