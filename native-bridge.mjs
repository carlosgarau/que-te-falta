const capacitor = globalThis.Capacitor;
const plugins = capacitor?.Plugins || {};
const isNative = Boolean(capacitor?.isNativePlatform?.());
const App = plugins.App;
const Haptics = plugins.Haptics;
const LocalNotifications = plugins.LocalNotifications;
const Share = plugins.Share;
const SplashScreen = plugins.SplashScreen;
const SpeechRecognition = plugins.SpeechRecognition;
const FirebaseAuthentication = plugins.FirebaseAuthentication;
let speechListenerHandles = [];
let accountAuthListenerHandle = null;

function notificationId(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash | 0) || 1;
}

async function requestNotificationPermission() {
  if (!LocalNotifications) return false;
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return true;
  const requested = await LocalNotifications.requestPermissions();
  return requested.display === "granted";
}

async function replaceExpirationNotifications(notifications) {
  if (!LocalNotifications) return false;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return false;

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map(({ id }) => ({ id })) });
  }

  const future = notifications
    .filter(({ at }) => new Date(at).getTime() > Date.now())
    .map((entry) => ({
      id: notificationId(entry.id),
      title: entry.title,
      body: entry.body,
      schedule: { at: new Date(entry.at) },
      extra: { expirationId: entry.expirationId, threshold: entry.threshold },
    }));
  if (future.length) await LocalNotifications.schedule({ notifications: future });
  return true;
}

async function removeSpeechListeners() {
  const handles = speechListenerHandles;
  speechListenerHandles = [];
  await Promise.all(handles.map(async (handle) => {
    try {
      await handle?.remove?.();
    } catch {}
  }));
}

async function startSpeechRecognition({ onPartial, onStopped, onError }) {
  if (!SpeechRecognition) throw new Error("El reconocimiento de voz no está disponible");
  const availability = await SpeechRecognition.available();
  if (!availability.available) throw new Error("Este dispositivo no permite reconocimiento de voz");
  let permission = await SpeechRecognition.checkPermissions();
  if (permission.speechRecognition !== "granted") {
    permission = await SpeechRecognition.requestPermissions();
  }
  if (permission.speechRecognition !== "granted") {
    const error = new Error("Necesito permiso para usar el micrófono y reconocer la voz");
    error.code = "not-allowed";
    throw error;
  }

  await removeSpeechListeners();
  let latestText = "";
  const partial = await SpeechRecognition.addListener("partialResults", (event) => {
    latestText = event.accumulatedText || event.accumulated || event.matches?.[0] || latestText;
    onPartial?.(latestText);
  });
  const listening = await SpeechRecognition.addListener("listeningState", async (event) => {
    if (event.state !== "stopped" && event.status !== "stopped") return;
    try {
      const last = await SpeechRecognition.getLastPartialResult();
      latestText = last.text || latestText;
    } catch {}
    await removeSpeechListeners();
    onStopped?.(latestText);
  });
  const errors = await SpeechRecognition.addListener("error", async (event) => {
    await removeSpeechListeners();
    onError?.(event);
  });
  speechListenerHandles = [partial, listening, errors];
  await SpeechRecognition.start({
    language: "es-ES",
    maxResults: 3,
    partialResults: true,
    addPunctuation: true,
    contextualStrings: ["lista de la compra", "caducidad", "hamburguesas", "tomates"],
  });
}

async function stopSpeechRecognition() {
  if (!SpeechRecognition) return;
  await SpeechRecognition.forceStop();
}

function accountProvider(value) {
  const providerId = String(value || "").toLowerCase();
  if (providerId.includes("apple")) return "apple";
  if (providerId.includes("google")) return "google";
  return "";
}

async function nativeAccountSignIn(provider) {
  if (!FirebaseAuthentication) throw new Error("El acceso seguro no está disponible");
  return provider === "apple"
    ? FirebaseAuthentication.signInWithApple()
    : FirebaseAuthentication.signInWithGoogle();
}

globalThis.LaCompraNative = {
  isNative,
  async share(data) {
    if (!Share) throw new Error("Compartir no está disponible");
    await Share.share({ ...data, dialogTitle: data.title });
  },
  async impact(style = "light") {
    if (!Haptics) return;
    const styles = { light: "LIGHT", medium: "MEDIUM", heavy: "HEAVY" };
    await Haptics.impact({ style: styles[style] || "LIGHT" });
  },
  requestNotificationPermission,
  replaceExpirationNotifications,
  startSpeechRecognition,
  stopSpeechRecognition,
  accountAuth: {
    available: Boolean(isNative && FirebaseAuthentication),
    async getCurrentUser() {
      if (!FirebaseAuthentication) return null;
      return (await FirebaseAuthentication.getCurrentUser()).user || null;
    },
    async getIdToken() {
      if (!FirebaseAuthentication) throw new Error("El acceso seguro no está disponible");
      return (await FirebaseAuthentication.getIdToken()).token;
    },
    async signIn(provider) {
      if (!FirebaseAuthentication) throw new Error("El acceso seguro no está disponible");
      const result = await nativeAccountSignIn(provider);
      return result.user || null;
    },
    async signOut() {
      if (FirebaseAuthentication) await FirebaseAuthentication.signOut();
    },
    async prepareDeletion(providerId) {
      const provider = accountProvider(providerId);
      if (!provider) return;
      const result = await nativeAccountSignIn(provider);
      if (provider !== "apple") return;
      const authorizationCode = result?.credential?.authorizationCode;
      if (!authorizationCode) {
        const error = new Error("Apple no ha devuelto el código necesario para revocar el acceso");
        error.code = "APPLE_REVOCATION_CODE_MISSING";
        throw error;
      }
      await FirebaseAuthentication.revokeAccessToken({ token: authorizationCode });
    },
    async deleteUser() {
      if (!FirebaseAuthentication) return;
      await FirebaseAuthentication.deleteUser();
    },
    async onChange(callback) {
      await accountAuthListenerHandle?.remove?.().catch(() => {});
      if (!FirebaseAuthentication) return;
      accountAuthListenerHandle = await FirebaseAuthentication.addListener("authStateChange", ({ user }) => callback(user || null));
    },
  },
};

const initialLaunchUrl = isNative && App?.getLaunchUrl ? App.getLaunchUrl().catch(() => null) : Promise.resolve(null);

if (isNative) {
  App?.addListener("appStateChange", ({ isActive }) => {
    if (isActive) document.dispatchEvent(new CustomEvent("la-compra:native-active"));
  });
  App?.addListener("appUrlOpen", ({ url }) => {
    document.dispatchEvent(new CustomEvent("la-compra:app-url-open", { detail: { url } }));
  });
  LocalNotifications?.addListener("localNotificationActionPerformed", ({ notification }) => {
    document.dispatchEvent(new CustomEvent("la-compra:notification-opened", {
      detail: notification.extra || {},
    }));
  });
}

await import("./app.mjs");

const launch = await initialLaunchUrl;
if (launch?.url) {
  document.dispatchEvent(new CustomEvent("la-compra:app-url-open", { detail: { url: launch.url } }));
}

if (isNative) SplashScreen?.hide().catch(() => {});
