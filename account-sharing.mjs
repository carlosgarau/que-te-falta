const FIREBASE_WEB_VERSION = "11.10.0";
const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyA29DqSnfWX9ueuLC13B0sP8ln5j-5kVD4",
  authDomain: "la-compra-familiar.firebaseapp.com",
  databaseURL: "https://la-compra-familiar-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "la-compra-familiar",
  storageBucket: "la-compra-familiar.firebasestorage.app",
  messagingSenderId: "927654282506",
  appId: "1:927654282506:web:e0edbad72f29bfcda066f3",
});

export const ACCOUNT_INVITE_PARAMETER = "invitacion";
export const ACCOUNT_ACTIVE_LIST_PREFIX = "que-te-falta-active-list:";
export const ACCOUNT_INVITE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export const ACCOUNT_PRIMARY_LIST_FIELD = "activeFamilyListId";

const NATIVE = globalThis.LaCompraNative || {};
let firebaseModulesPromise = null;
let webAuth = null;
let accountUser = null;
let unsubscribeAuth = null;

function cleanText(value, max = 100) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function encodePathPart(value) {
  return encodeURIComponent(String(value || ""));
}

function randomId(byteLength = 24, cryptoImpl = globalThis.crypto) {
  const bytes = new Uint8Array(byteLength);
  cryptoImpl.getRandomValues(bytes);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function normalizeAccountUser(user) {
  if (!user?.uid) return null;
  return {
    uid: String(user.uid),
    displayName: cleanText(user.displayName || user.name || user.email?.split("@")[0] || "Usuario", 80),
    email: cleanText(user.email, 160),
    photoURL: cleanText(user.photoURL || user.photoUrl, 500),
    providerId: cleanText(user.providerId || user.providerData?.[0]?.providerId, 50),
  };
}

export function accountProviderForDeletion(user) {
  const providerIds = [
    user?.providerId,
    ...(Array.isArray(user?.providerData) ? user.providerData.map((entry) => entry?.providerId) : []),
  ].filter(Boolean).join(" ").toLowerCase();
  if (providerIds.includes("apple")) return "apple.com";
  if (providerIds.includes("google")) return "google.com";
  return "";
}

async function loadFirebaseWeb() {
  if (!firebaseModulesPromise) {
    firebaseModulesPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_WEB_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_WEB_VERSION}/firebase-auth.js`),
    ]).then(([appApi, authApi]) => ({ appApi, authApi }));
  }
  return firebaseModulesPromise;
}

async function initializeWebAuth(onChange) {
  const { appApi, authApi } = await loadFirebaseWeb();
  const app = appApi.getApps().length ? appApi.getApp() : appApi.initializeApp(FIREBASE_CONFIG);
  webAuth = authApi.getAuth(app);
  webAuth.languageCode = "es";
  await authApi.setPersistence(webAuth, authApi.browserLocalPersistence);
  unsubscribeAuth?.();
  unsubscribeAuth = authApi.onAuthStateChanged(webAuth, (user) => {
    accountUser = normalizeAccountUser(user);
    onChange(accountUser);
  });
  const redirectResult = await authApi.getRedirectResult(webAuth).catch((error) => {
    if (!String(error?.code || "").includes("no-auth-event")) throw error;
    return null;
  });
  if (redirectResult?.user) {
    accountUser = normalizeAccountUser(redirectResult.user);
    onChange(accountUser);
  }
}

async function initializeNativeAuth(onChange) {
  const current = await NATIVE.accountAuth.getCurrentUser();
  accountUser = normalizeAccountUser(current);
  onChange(accountUser);
  await NATIVE.accountAuth.onChange((user) => {
    accountUser = normalizeAccountUser(user);
    onChange(accountUser);
  });
}

export async function initializeAccountAuth({ onChange = () => {} } = {}) {
  if (NATIVE.accountAuth?.available) await initializeNativeAuth(onChange);
  else await initializeWebAuth(onChange);
  return accountUser;
}

export function getAccountUser() {
  return accountUser;
}

export async function signInWithAccount(provider) {
  if (!['google', 'apple'].includes(provider)) throw new Error("Proveedor de acceso no válido");
  if (NATIVE.accountAuth?.available) {
    const user = await NATIVE.accountAuth.signIn(provider);
    accountUser = normalizeAccountUser(user);
    return accountUser;
  }

  const { authApi } = await loadFirebaseWeb();
  if (!webAuth) await initializeWebAuth(() => {});
  const authProvider = provider === "google"
    ? new authApi.GoogleAuthProvider()
    : new authApi.OAuthProvider("apple.com");
  if (provider === "apple") {
    authProvider.addScope("email");
    authProvider.addScope("name");
    authProvider.setCustomParameters({ locale: "es" });
  }
  const result = await authApi.signInWithPopup(webAuth, authProvider);
  accountUser = normalizeAccountUser(result.user);
  return accountUser;
}

export async function signOutAccount() {
  if (NATIVE.accountAuth?.available) await NATIVE.accountAuth.signOut();
  else {
    const { authApi } = await loadFirebaseWeb();
    if (webAuth) await authApi.signOut(webAuth);
  }
  accountUser = null;
}

async function getIdToken(forceRefresh = false) {
  if (NATIVE.accountAuth?.available) return NATIVE.accountAuth.getIdToken(forceRefresh);
  if (!webAuth?.currentUser) throw new Error("Inicia sesión para continuar");
  return webAuth.currentUser.getIdToken(forceRefresh);
}

export function makeAuthenticatedDatabaseUrl(path, token, databaseUrl = FIREBASE_CONFIG.databaseURL) {
  const url = new URL(`${String(databaseUrl).replace(/\/+$/g, "")}/${path}.json`);
  url.searchParams.set("auth", String(token || ""));
  return url.toString();
}

async function authenticatedDatabaseResponse(path, { method = "GET", body, headers = {} } = {}, forceRefresh = false) {
  const token = await getIdToken(forceRefresh);
  return fetch(makeAuthenticatedDatabaseUrl(path, token), {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    cache: "no-store",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function databaseError(response) {
  const error = new Error(response.status === 401 || response.status === 403
    ? "No tienes permiso para abrir esta lista"
    : `No se puede sincronizar la lista (${response.status})`);
  error.status = response.status;
  return error;
}

async function databaseRequest(path, options = {}) {
  let response = await authenticatedDatabaseResponse(path, options);
  if (response.status === 401) response = await authenticatedDatabaseResponse(path, options, true);
  if (!response.ok) {
    throw databaseError(response);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function accountInviteFromUrl(value) {
  try {
    return cleanText(new URL(value).searchParams.get(ACCOUNT_INVITE_PARAMETER), 80);
  } catch {
    return "";
  }
}

export function clearAccountInviteFromUrl(value) {
  const url = new URL(value);
  url.searchParams.delete(ACCOUNT_INVITE_PARAMETER);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function makeAccountInviteUrl(baseUrl, inviteId) {
  const url = new URL(baseUrl);
  url.searchParams.set(ACCOUNT_INVITE_PARAMETER, cleanText(inviteId, 80));
  return url.toString();
}

export function accountStateFrom(state) {
  return {
    version: 2,
    items: Array.isArray(state?.items) ? state.items : [],
    catalog: state?.catalog && typeof state.catalog === "object" ? state.catalog : {},
    purchases: Array.isArray(state?.purchases) ? state.purchases : [],
    expirations: Array.isArray(state?.expirations) ? state.expirations : [],
    dismissedSuggestions: state?.dismissedSuggestions && typeof state.dismissedSuggestions === "object"
      ? state.dismissedSuggestions
      : {},
  };
}

export function mergeAccountState(remote, local) {
  const target = local && typeof local === "object" ? local : {};
  return {
    ...target,
    ...accountStateFrom(remote),
    specialLists: Array.isArray(target.specialLists) ? target.specialLists : [],
    settings: target.settings || {},
  };
}

function memberRecord(user, role = "editor", inviteId = "") {
  return {
    role,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    joinedAt: Date.now(),
    ...(inviteId ? { inviteId } : {}),
  };
}

function listIndexRecord({ id, name, type, role }) {
  return { id, name: cleanText(name, 50), type, role, updatedAt: Date.now() };
}

export async function listAccountMemberships() {
  if (!accountUser) return [];
  const records = await databaseRequest(`userLists/${encodePathPart(accountUser.uid)}`);
  return Object.entries(records || {}).map(([id, record]) => ({ id, ...record }));
}

export function selectPrimaryFamilyAccountList(familyLists, {
  preferredId = "",
  profileId = "",
  storedId = "",
} = {}) {
  const candidates = (Array.isArray(familyLists) ? familyLists : [])
    .filter((entry) => entry?.id && entry.type === "family");
  if (!candidates.length) return null;

  const explicit = candidates.find((entry) => entry.id === preferredId);
  if (explicit) return explicit;

  const shared = candidates.filter((entry) => Number(entry.memberCount) > 1);
  const pool = shared.length ? shared : candidates;
  for (const id of [profileId, storedId]) {
    const remembered = pool.find((entry) => entry.id === id);
    if (remembered) return remembered;
  }

  return [...pool].sort((left, right) => (
    (Number(right.memberCount) || 0) - (Number(left.memberCount) || 0)
    || (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0)
    || String(left.id).localeCompare(String(right.id))
  ))[0];
}

export async function listFamilyAccountLists(memberships = null) {
  const records = Array.isArray(memberships) ? memberships : await listAccountMemberships();
  const familyMemberships = records.filter((entry) => entry.type === "family" && entry.id);
  const lists = await Promise.all(familyMemberships.map(async (membership) => {
    const list = await getAccountList(membership.id);
    if (!list) return null;
    return {
      ...membership,
      name: list.meta?.name || membership.name || "Mi lista familiar",
      role: list.members?.[accountUser?.uid]?.role || membership.role || "editor",
      memberCount: Object.keys(list.members || {}).length,
      createdAt: Number(list.meta?.createdAt) || 0,
      updatedAt: Number(list.meta?.updatedAt) || Number(membership.updatedAt) || 0,
      state: list.state || {},
      list,
    };
  }));
  return lists.filter(Boolean);
}

export async function createAccountList({ name, type = "family", state = {} }) {
  if (!accountUser) throw new Error("Inicia sesión para compartir");
  const id = randomId();
  const now = Date.now();
  const list = {
    meta: {
      id,
      name: cleanText(name, 50) || (type === "special" ? "Lista compartida" : "Mi lista familiar"),
      type,
      ownerId: accountUser.uid,
      createdAt: now,
      updatedAt: now,
    },
    members: { [accountUser.uid]: memberRecord(accountUser, "owner") },
    state,
  };
  await databaseRequest(`lists/${id}`, { method: "PUT", body: list });
  await databaseRequest(`userLists/${encodePathPart(accountUser.uid)}/${id}`, {
    method: "PUT",
    body: listIndexRecord({ id, name: list.meta.name, type, role: "owner" }),
  });
  return { id, ...list };
}

export async function ensureFamilyAccountList(localState, selection = {}) {
  const options = typeof selection === "string" ? { storedId: selection } : (selection || {});
  let memberships = await listAccountMemberships();
  let familyLists = await listFamilyAccountLists(memberships);
  let selected = selectPrimaryFamilyAccountList(familyLists, options);
  if (!selected) {
    const created = await createAccountList({
      name: "Mi lista familiar",
      type: "family",
      state: accountStateFrom(localState),
    });
    memberships = await listAccountMemberships();
    familyLists = await listFamilyAccountLists(memberships);
    selected = familyLists.find((entry) => entry.id === created.id)
      || {
        id: created.id,
        ...created.meta,
        role: "owner",
        memberCount: 1,
        state: created.state || {},
        list: created,
      };
  }
  return { selected, memberships, familyLists };
}

export async function getAccountList(listId) {
  return databaseRequest(`lists/${encodePathPart(listId)}`);
}

export async function updateAccountListState(listId, state) {
  await databaseRequest(`lists/${encodePathPart(listId)}/state`, { method: "PUT", body: state });
  if (state?.name) {
    await databaseRequest(`lists/${encodePathPart(listId)}/meta/name`, {
      method: "PUT",
      body: cleanText(state.name, 50),
    });
  }
  await databaseRequest(`lists/${encodePathPart(listId)}/meta/updatedAt`, { method: "PUT", body: Date.now() });
}

export async function mergeIntoAccountListState(listId, incomingState, mergeStates, maxAttempts = 5) {
  if (typeof mergeStates !== "function") throw new Error("No se puede reunir la lista");
  const path = `lists/${encodePathPart(listId)}/state`;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let response = await authenticatedDatabaseResponse(path, {
      headers: { "X-Firebase-ETag": "true" },
    });
    if (response.status === 401) {
      response = await authenticatedDatabaseResponse(path, {
        headers: { "X-Firebase-ETag": "true" },
      }, true);
    }
    if (!response.ok) throw databaseError(response);
    const etag = response.headers.get("etag");
    const remoteState = response.status === 204 ? {} : (await response.json() || {});
    const mergedState = mergeStates(incomingState || {}, remoteState);
    if (!etag) {
      await updateAccountListState(listId, mergedState);
      return mergedState;
    }

    let write = await authenticatedDatabaseResponse(path, {
      method: "PUT",
      headers: { "if-match": etag },
      body: mergedState,
    });
    if (write.status === 401) {
      write = await authenticatedDatabaseResponse(path, {
        method: "PUT",
        headers: { "if-match": etag },
        body: mergedState,
      }, true);
    }
    if (write.status === 412) continue;
    if (!write.ok) throw databaseError(write);
    await databaseRequest(`lists/${encodePathPart(listId)}/meta/updatedAt`, { method: "PUT", body: Date.now() });
    return mergedState;
  }
  throw new Error("La lista ha cambiado varias veces. Vuelve a intentarlo en unos segundos");
}

export function subscribeAccountList(listId, { onState = () => {}, onStatus = () => {} } = {}) {
  let source = null;
  let stopped = false;
  let refreshTimer = null;
  let streamHealthCheck = null;

  const refresh = async () => {
    try {
      const list = await getAccountList(listId);
      if (list?.state) onState(list.state, list);
      onStatus("synced");
      return list;
    } catch (error) {
      onStatus("offline");
      throw error;
    }
  };

  const connect = async () => {
    if (stopped || !globalThis.EventSource) return;
    source?.close();
    const token = await getIdToken();
    const url = `${FIREBASE_CONFIG.databaseURL}/lists/${encodePathPart(listId)}.json?auth=${encodeURIComponent(token)}`;
    source = new EventSource(url);
    source.addEventListener("put", (event) => {
      try {
        const message = JSON.parse(event.data);
        const list = message.path === "/" ? message.data : null;
        if (list?.state) onState(list.state, list);
        else refresh().catch(() => {});
      } catch {
        refresh().catch(() => {});
      }
    });
    source.addEventListener("patch", () => refresh().catch(() => {}));
    source.addEventListener("open", () => onStatus("synced"));
    source.onerror = () => {
      if (streamHealthCheck) return;
      streamHealthCheck = refresh()
        .catch(() => {})
        .finally(() => { streamHealthCheck = null; });
    };
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => connect().catch(() => {}), 50 * 60 * 1000);
  };

  const ready = refresh().then(async (list) => {
    await connect();
    return list;
  });
  ready.catch(() => {});
  return {
    ready,
    refresh,
    stop() {
      stopped = true;
      clearTimeout(refreshTimer);
      source?.close();
      source = null;
    },
  };
}

export async function createListInvite(listId) {
  if (!accountUser) throw new Error("Inicia sesión para compartir");
  const list = await getAccountList(listId);
  if (list?.members?.[accountUser.uid]?.role !== "owner") throw new Error("Solo el propietario puede invitar");
  const id = randomId(30);
  const invite = {
    id,
    listId,
    listName: cleanText(list.meta?.name, 50),
    listType: list.meta?.type === "special" ? "special" : "family",
    role: "editor",
    createdBy: accountUser.uid,
    createdByName: accountUser.displayName,
    createdAt: Date.now(),
    expiresAt: Date.now() + ACCOUNT_INVITE_MAX_AGE,
  };
  await databaseRequest(`invites/${id}`, { method: "PUT", body: invite });
  return invite;
}

export async function getListInvite(inviteId) {
  const invite = await databaseRequest(`invites/${encodePathPart(inviteId)}`);
  if (!invite || Number(invite.expiresAt) < Date.now()) throw new Error("Esta invitación ha caducado");
  return invite;
}

export async function acceptListInvite(inviteId) {
  if (!accountUser) throw new Error("Inicia sesión para aceptar la invitación");
  const invite = await getListInvite(inviteId);
  const member = memberRecord(accountUser, "editor", inviteId);
  await databaseRequest(`lists/${encodePathPart(invite.listId)}/members/${encodePathPart(accountUser.uid)}`, {
    method: "PUT",
    body: member,
  });
  await databaseRequest(`userLists/${encodePathPart(accountUser.uid)}/${encodePathPart(invite.listId)}`, {
    method: "PUT",
    body: listIndexRecord({
      id: invite.listId,
      name: invite.listName,
      type: invite.listType,
      role: "editor",
    }),
  });
  return invite;
}

export async function getListMembers(listId) {
  const members = await databaseRequest(`lists/${encodePathPart(listId)}/members`);
  return Object.entries(members || {}).map(([uid, member]) => ({ uid, ...member }));
}

export async function removeListMember(listId, uid) {
  const list = await getAccountList(listId);
  if (list?.members?.[accountUser?.uid]?.role !== "owner") throw new Error("Solo el propietario puede quitar personas");
  if (uid === accountUser.uid) throw new Error("El propietario no puede eliminarse");
  await databaseRequest(`lists/${encodePathPart(listId)}/members/${encodePathPart(uid)}`, { method: "DELETE" });
  await databaseRequest(`userLists/${encodePathPart(uid)}/${encodePathPart(listId)}`, { method: "DELETE" });
}

export async function deleteAccountList(listId) {
  const list = await getAccountList(listId);
  if (list?.members?.[accountUser?.uid]?.role !== "owner") throw new Error("Solo el propietario puede eliminar esta lista");
  await Promise.all(Object.keys(list.members || {}).map((uid) => databaseRequest(
    `userLists/${encodePathPart(uid)}/${encodePathPart(listId)}`,
    { method: "DELETE" },
  ).catch(() => {})));
  await databaseRequest(`lists/${encodePathPart(listId)}`, { method: "DELETE" });
}

export async function leaveAccountList(listId) {
  if (!accountUser) return;
  const list = await getAccountList(listId);
  if (list?.members?.[accountUser.uid]?.role === "owner") throw new Error("El propietario debe eliminar la lista o transferirla");
  await databaseRequest(`lists/${encodePathPart(listId)}/members/${encodePathPart(accountUser.uid)}`, { method: "DELETE" });
  await databaseRequest(`userLists/${encodePathPart(accountUser.uid)}/${encodePathPart(listId)}`, { method: "DELETE" });
}

export async function deleteAccountAndData() {
  if (!accountUser) return;
  const uid = accountUser.uid;
  const providerId = accountProviderForDeletion(accountUser);
  if (NATIVE.accountAuth?.available) {
    await NATIVE.accountAuth.prepareDeletion(providerId);
  } else if (webAuth?.currentUser && providerId) {
    const { authApi } = await loadFirebaseWeb();
    const provider = providerId === "apple.com"
      ? new authApi.OAuthProvider("apple.com")
      : new authApi.GoogleAuthProvider();
    await authApi.reauthenticateWithPopup(webAuth.currentUser, provider);
  }
  const memberships = await listAccountMemberships();
  for (const membership of memberships) {
    const list = await getAccountList(membership.id);
    if (!list) {
      await databaseRequest(`userLists/${encodePathPart(uid)}/${encodePathPart(membership.id)}`, { method: "DELETE" });
      continue;
    }
    if (list.meta?.ownerId === uid) {
      const memberIds = Object.keys(list.members || {});
      await Promise.all(memberIds.map((memberId) => databaseRequest(
        `userLists/${encodePathPart(memberId)}/${encodePathPart(membership.id)}`,
        { method: "DELETE" },
      )));
      await databaseRequest(`lists/${encodePathPart(membership.id)}`, { method: "DELETE" });
    } else {
      await leaveAccountList(membership.id);
    }
  }
  await databaseRequest(`userProfiles/${encodePathPart(uid)}`, { method: "DELETE" });
  if (NATIVE.accountAuth?.available) await NATIVE.accountAuth.deleteUser();
  else {
    const { authApi } = await loadFirebaseWeb();
    if (webAuth?.currentUser) await authApi.deleteUser(webAuth.currentUser);
  }
  accountUser = null;
}

export async function getAccountProfile() {
  if (!accountUser) return null;
  return databaseRequest(`userProfiles/${encodePathPart(accountUser.uid)}`);
}

export async function saveAccountProfile(fields = {}) {
  if (!accountUser) return;
  await databaseRequest(`userProfiles/${encodePathPart(accountUser.uid)}`, {
    method: "PATCH",
    body: { ...accountUser, ...fields, updatedAt: Date.now() },
  });
}

export async function savePrimaryFamilyListId(listId) {
  if (!accountUser) return;
  await saveAccountProfile({ [ACCOUNT_PRIMARY_LIST_FIELD]: cleanText(listId, 80) });
}

