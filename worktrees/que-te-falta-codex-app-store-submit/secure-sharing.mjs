export const SHARED_PASSWORD_MIN_LENGTH = 8;
export const SHARED_ENCRYPTION_VERSION = 1;
const PBKDF2_ITERATIONS = 210_000;
const ADDITIONAL_DATA = new TextEncoder().encode("la-compra-shared-v1");

function encodeBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value) {
  const base64 = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function normalizeSharedPassword(value) {
  return String(value || "").normalize("NFC");
}

export function validateSharedPassword(value) {
  const password = normalizeSharedPassword(value);
  if (password.length < SHARED_PASSWORD_MIN_LENGTH) {
    throw new Error(`La contraseña debe tener al menos ${SHARED_PASSWORD_MIN_LENGTH} caracteres`);
  }
  return password;
}

export function isEncryptedSharedRecord(record) {
  return Boolean(record?.encryptedState?.version === SHARED_ENCRYPTION_VERSION);
}

export function createSharedPasswordCodec(value, cryptoImpl = globalThis.crypto) {
  const password = validateSharedPassword(value);
  if (!cryptoImpl?.subtle || !cryptoImpl?.getRandomValues) {
    throw new Error("Este dispositivo no permite proteger la lista");
  }
  let activeSalt = null;
  const keyCache = new Map();

  async function keyFor(salt) {
    const saltKey = encodeBase64Url(salt);
    if (keyCache.has(saltKey)) return keyCache.get(saltKey);
    const material = await cryptoImpl.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    const key = await cryptoImpl.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    keyCache.set(saltKey, key);
    return key;
  }

  async function encrypt(state) {
    if (!activeSalt) activeSalt = cryptoImpl.getRandomValues(new Uint8Array(16));
    const iv = cryptoImpl.getRandomValues(new Uint8Array(12));
    const key = await keyFor(activeSalt);
    const clearText = new TextEncoder().encode(JSON.stringify(state));
    const cipherText = await cryptoImpl.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: ADDITIONAL_DATA },
      key,
      clearText,
    );
    return {
      version: SHARED_ENCRYPTION_VERSION,
      algorithm: "AES-256-GCM",
      kdf: "PBKDF2-SHA256",
      iterations: PBKDF2_ITERATIONS,
      salt: encodeBase64Url(activeSalt),
      iv: encodeBase64Url(iv),
      ciphertext: encodeBase64Url(new Uint8Array(cipherText)),
    };
  }

  async function decrypt(envelope) {
    if (envelope?.version !== SHARED_ENCRYPTION_VERSION
      || envelope?.algorithm !== "AES-256-GCM"
      || envelope?.kdf !== "PBKDF2-SHA256"
      || Number(envelope?.iterations) !== PBKDF2_ITERATIONS) {
      const error = new Error("La protección de esta lista no es compatible");
      error.code = "UNSUPPORTED_SHARED_ENCRYPTION";
      throw error;
    }
    try {
      const salt = decodeBase64Url(envelope.salt);
      const iv = decodeBase64Url(envelope.iv);
      const cipherText = decodeBase64Url(envelope.ciphertext);
      const key = await keyFor(salt);
      const clearText = await cryptoImpl.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: ADDITIONAL_DATA },
        key,
        cipherText,
      );
      activeSalt = salt;
      return JSON.parse(new TextDecoder().decode(clearText));
    } catch (cause) {
      if (cause?.code === "UNSUPPORTED_SHARED_ENCRYPTION") throw cause;
      const error = new Error("La contraseña no es correcta");
      error.code = "WRONG_SHARED_PASSWORD";
      throw error;
    }
  }

  return { decrypt, encrypt };
}
