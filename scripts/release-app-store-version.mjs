import { sign } from "node:crypto";

const APP_ID = process.env.APPLE_APP_ID || "6800699896";
const VERSION = process.env.APPLE_APP_VERSION || "1.0";

function required(name) {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Falta el secreto ${name}`);
  return value.trim();
}

function base64url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({
    alg: "ES256",
    kid: required("APPLE_API_KEY_ID"),
    typ: "JWT",
  }));
  const payload = base64url(JSON.stringify({
    iss: required("APPLE_API_ISSUER_ID"),
    iat: now,
    exp: now + 10 * 60,
    aud: "appstoreconnect-v1",
  }));
  const unsignedToken = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(unsignedToken), {
    key: required("APPLE_API_PRIVATE_KEY").replace(/\\n/g, "\n"),
    dsaEncoding: "ieee-p1363",
  });
  return `${unsignedToken}.${base64url(signature)}`;
}

async function appleRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${createToken()}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const details = body.errors
      ?.map((error) => `${error.status || response.status}: ${error.detail || error.title}`)
      .join("; ");
    throw new Error(`Apple rechazó la operación: ${details || response.statusText}`);
  }
  return { response, body };
}

async function getVersion() {
  const url = new URL(
    `https://api.appstoreconnect.apple.com/v1/apps/${APP_ID}/appStoreVersions`,
  );
  url.searchParams.set("filter[platform]", "IOS");
  url.searchParams.set(
    "fields[appStoreVersions]",
    "versionString,appStoreState,createdDate,platform",
  );
  url.searchParams.set("limit", "50");
  const { body } = await appleRequest(url);
  return body.data
    ?.filter((item) => item.attributes?.versionString === VERSION)
    .sort(
      (a, b) =>
        new Date(b.attributes?.createdDate || 0) -
        new Date(a.attributes?.createdDate || 0),
    )[0];
}

const version = await getVersion();
if (!version) {
  throw new Error(`Apple no devolvió la versión iOS ${VERSION} de la app ${APP_ID}`);
}
if (version.attributes.appStoreState !== "PENDING_DEVELOPER_RELEASE") {
  throw new Error(
    `Publicación detenida: la versión ${VERSION} está en ${version.attributes.appStoreState}, no en PENDING_DEVELOPER_RELEASE`,
  );
}

console.log(`Versión verificada: ${VERSION}`);
console.log("Estado previo: PENDING_DEVELOPER_RELEASE");

const { response, body } = await appleRequest(
  "https://api.appstoreconnect.apple.com/v1/appStoreVersionReleaseRequests",
  {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "appStoreVersionReleaseRequests",
        relationships: {
          appStoreVersion: {
            data: {
              type: "appStoreVersions",
              id: version.id,
            },
          },
        },
      },
    }),
  },
);

if (response.status !== 201 || body.data?.type !== "appStoreVersionReleaseRequests") {
  throw new Error(`Respuesta inesperada de Apple: HTTP ${response.status}`);
}

console.log("APP_STORE_RELEASE_REQUEST=CREATED");
console.log(`Publicación solicitada para la versión ${VERSION}`);
