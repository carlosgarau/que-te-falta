import { sign } from "node:crypto";

const APP_ID = process.env.APPLE_APP_ID || "6800699896";
const VERSION = process.env.APPLE_APP_VERSION || "1.0";

function required(name) {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`Falta el secreto ${name}`);
  }
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
  const keyId = required("APPLE_API_KEY_ID");
  const issuerId = required("APPLE_API_ISSUER_ID");
  const privateKey = required("APPLE_API_PRIVATE_KEY").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(
    JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }),
  );
  const payload = base64url(
    JSON.stringify({
      iss: issuerId,
      iat: now,
      exp: now + 10 * 60,
      aud: "appstoreconnect-v1",
    }),
  );
  const unsignedToken = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(unsignedToken), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });

  return `${unsignedToken}.${base64url(signature)}`;
}

const statusNames = {
  ACCEPTED: "Aceptada",
  IN_REVIEW: "En revisión",
  INVALID_BINARY: "Binario no válido",
  METADATA_REJECTED: "Metadatos rechazados",
  PENDING_APPLE_RELEASE: "Pendiente de publicación por Apple",
  PENDING_DEVELOPER_RELEASE: "Pendiente de publicación manual",
  PREPARE_FOR_SUBMISSION: "En preparación",
  PROCESSING_FOR_DISTRIBUTION: "Procesando para distribución",
  READY_FOR_DISTRIBUTION: "Lista para distribución",
  READY_FOR_SALE: "Disponible en el App Store",
  READY_FOR_REVIEW: "Lista para enviar a revisión",
  REJECTED: "Rechazada",
  WAITING_FOR_EXPORT_COMPLIANCE: "Pendiente de cumplimiento de exportación",
  WAITING_FOR_REVIEW: "Pendiente de revisión",
};

const url = new URL(
  `https://api.appstoreconnect.apple.com/v1/apps/${APP_ID}/appStoreVersions`,
);
url.searchParams.set("filter[platform]", "IOS");
url.searchParams.set(
  "fields[appStoreVersions]",
  "versionString,appStoreState,createdDate,platform",
);
url.searchParams.set("limit", "50");

const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${createToken()}`,
    Accept: "application/json",
  },
});

const body = await response.json();
if (!response.ok) {
  const details = body.errors
    ?.map((error) => `${error.status || response.status}: ${error.detail || error.title}`)
    .join("; ");
  throw new Error(`Apple rechazó la consulta: ${details || response.statusText}`);
}

const version = body.data
  ?.filter((item) => item.attributes?.versionString === VERSION)
  .sort(
    (a, b) =>
      new Date(b.attributes?.createdDate || 0) -
      new Date(a.attributes?.createdDate || 0),
  )[0];

if (!version) {
  throw new Error(`Apple no devolvió la versión iOS ${VERSION} de la app ${APP_ID}`);
}

const state = version.attributes.appStoreState;
const checkedAt = new Date().toISOString();
const result = {
  appId: APP_ID,
  version: version.attributes.versionString,
  state,
  stateSpanish: statusNames[state] || state,
  createdDate: version.attributes.createdDate,
  checkedAt,
};

console.log(`APP_STORE_STATUS=${state}`);
console.log(`Estado: ${result.stateSpanish}`);
console.log(`Versión: ${result.version}`);
console.log(`Comprobado: ${checkedAt}`);
console.log(JSON.stringify(result));
