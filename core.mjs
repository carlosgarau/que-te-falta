export const CATEGORY_ORDER = [
  "Fruta y verdura",
  "Carne y pescado",
  "Lácteos y huevos",
  "Panadería y desayuno",
  "Despensa",
  "Bebidas",
  "Congelados",
  "Limpieza",
  "Higiene",
  "Bebés y niños",
  "Mascotas",
  "Otros",
];

export const CATEGORY_META = {
  "Fruta y verdura": { icon: "leaf", color: "#3f7d58" },
  "Carne y pescado": { icon: "fish", color: "#c95f54" },
  "Lácteos y huevos": { icon: "milk", color: "#5681a6" },
  "Panadería y desayuno": { icon: "bread", color: "#b7793f" },
  Despensa: { icon: "jar", color: "#8b6f47" },
  Bebidas: { icon: "bottle", color: "#4b87a3" },
  Congelados: { icon: "snow", color: "#6d87b5" },
  Limpieza: { icon: "sparkle", color: "#667a89" },
  Higiene: { icon: "drop", color: "#97749a" },
  "Bebés y niños": { icon: "baby", color: "#cc7f94" },
  Mascotas: { icon: "paw", color: "#9a755c" },
  Otros: { icon: "basket", color: "#706c65" },
};

export const PERISHABLE_CATEGORIES = new Set([
  "Fruta y verdura",
  "Carne y pescado",
  "Lácteos y huevos",
]);

const FREEZABLE_KEYWORDS = [
  "hamburguesa", "pan", "fresa", "frambuesa", "arandano", "platano", "banana",
  "mango", "espinaca", "brocoli", "coliflor", "guisante", "judia verde", "pimiento",
  "calabacin", "mantequilla", "queso rallado",
];

const CATEGORY_KEYWORDS = {
  "Bebés y niños": [
    "panal", "pañal", "toallita", "potito", "papilla", "leche infantil",
    "formula infantil", "chupete", "biberon",
  ],
  Mascotas: ["pienso", "arena de gato", "comida de perro", "comida de gato", "mascota"],
  Limpieza: [
    "detergente", "lavavajillas", "lejia", "suavizante", "limpiador", "bayeta",
    "estropajo", "bolsa de basura", "papel de cocina", "limpieza", "lavadora",
  ],
  Higiene: [
    "champu", "gel de ducha", "jabon", "desodorante", "dentifrico", "pasta de dientes",
    "cepillo de dientes", "papel higienico", "compresa", "tampon", "afeitar",
  ],
  Congelados: ["congelado", "helado", "hielo", "pizza congelada"],
  Bebidas: [
    "agua", "cerveza", "vino", "refresco", "zumo", "coca cola", "tonica", "sidra",
    "ginebra", "ron", "whisky", "batido",
  ],
  "Lácteos y huevos": [
    "leche", "yogur", "queso", "huevo", "mantequilla", "nata", "kefir", "requeson",
    "cuajada", "mozzarella",
  ],
  "Carne y pescado": [
    "pollo", "pavo", "ternera", "cerdo", "cordero", "hamburguesa", "carne", "jamon",
    "salchicha", "bacon", "pescado", "salmon", "atun", "merluza", "bacalao", "gamba",
    "langostino", "calamar", "sepia", "mejillon", "sardina", "embutido",
  ],
  "Panadería y desayuno": [
    "pan", "barra", "baguette", "croissant", "ensaimada", "galleta", "cereal", "tostada",
    "magdalena", "bizcocho", "bolleria", "mermelada",
  ],
  "Fruta y verdura": [
    "fresa", "frambuesa", "arandano", "mora", "manzana", "platano", "banana", "pera",
    "naranja", "mandarina", "limon", "lima", "sandia", "melon", "melocoton", "nectarina",
    "albaricoque", "ciruela", "cereza", "uva", "kiwi", "mango", "aguacate", "higo",
    "tomate", "lechuga", "cebolla", "ajo", "patata", "zanahoria", "calabacin", "berenjena",
    "pimiento", "pepino", "brocoli", "coliflor", "espinaca", "acelga", "alcachofa",
    "esparrago", "puerro", "judia verde", "champiñon", "seta", "verdura", "fruta",
  ],
  Despensa: [
    "arroz", "pasta", "macarron", "espagueti", "harina", "azucar", "sal", "pimienta",
    "aceite", "vinagre", "cafe", "te", "infusion", "legumbre", "lenteja", "garbanzo",
    "alubia", "conserva", "tomate frito", "salsa", "mayonesa", "ketchup", "mostaza",
    "chocolate", "cacao", "fruto seco", "almendra", "nuez", "avena", "quinoa", "caldo",
    "turron",
  ],
};

const ALIASES = {
  "aguacates": "aguacate", "ajos": "ajo", "albaricoques": "albaricoque",
  "alcachofas": "alcachofa", "arandanos": "arandano", "berenjenas": "berenjena",
  "calabacines": "calabacin", "cebollas": "cebolla", "cerezas": "cereza",
  "cervezas": "cerveza", "ciruelas": "ciruela", "fresas": "fresa", "galletas": "galleta",
  "garbanzos": "garbanzo", "hamburguesas": "hamburguesa", "higos": "higo", "huevos": "huevo", "judias verdes": "judia verde",
  "lechugas": "lechuga", "leches": "leche", "limones": "limon", "latas de atun": "atun",
  "macarrones": "macarron", "mandarinas": "mandarina", "manzanas": "manzana",
  "melocotones": "melocoton", "naranjas": "naranja", "nectarinas": "nectarina",
  "panales": "panal", "pañales": "panal", "patatas": "patata", "pepinos": "pepino",
  "peras": "pera", "pimientos": "pimiento", "platanos": "platano", "plátanos": "platano",
  "refrescos": "refresco", "tomates": "tomate", "toallitas": "toallita", "yogures": "yogur",
  "zanahorias": "zanahoria", "zumos": "zumo",
};

const NUMBER_WORDS = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};

const UNITS = [
  "kilogramos", "kilogramo", "kilos", "kilo", "kg", "gramos", "gramo", "g",
  "litros", "litro", "l", "mililitros", "mililitro", "ml", "botellas", "botella",
  "paquetes", "paquete", "bandejas", "bandeja", "latas", "lata", "botes", "bote",
  "docenas", "docena", "cajas", "caja", "bolsas", "bolsa",
];

export const SEASONAL_PRODUCE = [
  { name: "Fresas", key: "fresa", months: [1, 2, 3, 4, 5] },
  { name: "Alcachofas", key: "alcachofa", months: [1, 2, 3, 4, 11, 12] },
  { name: "Naranjas", key: "naranja", months: [1, 2, 3, 4, 11, 12] },
  { name: "Mandarinas", key: "mandarina", months: [1, 2, 3, 10, 11, 12] },
  { name: "Espárragos", key: "esparrago", months: [3, 4, 5] },
  { name: "Guisantes", key: "guisante", months: [2, 3, 4, 5] },
  { name: "Cerezas", key: "cereza", months: [5, 6, 7] },
  { name: "Albaricoques", key: "albaricoque", months: [5, 6, 7] },
  { name: "Melocotones", key: "melocoton", months: [6, 7, 8, 9] },
  { name: "Nectarinas", key: "nectarina", months: [6, 7, 8, 9] },
  { name: "Sandía", key: "sandia", months: [6, 7, 8, 9] },
  { name: "Melón", key: "melon", months: [6, 7, 8, 9] },
  { name: "Tomates", key: "tomate", months: [6, 7, 8, 9] },
  { name: "Pimientos", key: "pimiento", months: [6, 7, 8, 9, 10] },
  { name: "Calabacín", key: "calabacin", months: [5, 6, 7, 8, 9] },
  { name: "Higos", key: "higo", months: [7, 8, 9] },
  { name: "Uvas", key: "uva", months: [8, 9, 10, 11] },
  { name: "Granadas", key: "granada", months: [9, 10, 11] },
  { name: "Caquis", key: "caqui", months: [10, 11, 12] },
  { name: "Calabaza", key: "calabaza", months: [9, 10, 11, 12, 1, 2] },
  { name: "Brócoli", key: "brocoli", months: [1, 2, 3, 10, 11, 12] },
  { name: "Coliflor", key: "coliflor", months: [1, 2, 3, 11, 12] },
];

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function productKey(name) {
  let key = normalizeText(name)
    .replace(/^(el|la|los|las|un|una|unos|unas)\s+/, "")
    .trim();
  return ALIASES[key] || key;
}

export function titleCase(value) {
  const cleaned = String(value).trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  return cleaned.charAt(0).toLocaleUpperCase("es") + cleaned.slice(1);
}

export function categoryFor(name) {
  const normalized = normalizeText(name);
  for (const category of Object.keys(CATEGORY_KEYWORDS)) {
    if (CATEGORY_KEYWORDS[category].some((keyword) => {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      return new RegExp(`(?:^|\\s)${escaped}(?:s|es)?(?:$|\\s)`).test(normalized);
    })) {
      return category;
    }
  }
  return "Otros";
}

export function splitListText(value) {
  return String(value)
    .replace(/\s+(?:además|también)\s+/gi, ",")
    .split(/\s*(?:,|;|\n|\s+y\s+)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseEntry(raw) {
  let text = String(raw).trim().replace(/[.!?]+$/g, "");
  let quantity = 1;
  let unit = "";

  const quantityMatch = text.match(/^(\d+(?:[.,]\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+(.+)$/i);
  if (quantityMatch) {
    const quantityToken = normalizeText(quantityMatch[1]);
    quantity = NUMBER_WORDS[quantityToken] || Number(quantityToken.replace(",", ".")) || 1;
    text = quantityMatch[2].trim();
  }

  const unitPattern = new RegExp(`^(${UNITS.join("|")})\\s+(?:de\\s+)?(.+)$`, "i");
  const unitMatch = text.match(unitPattern);
  if (unitMatch) {
    unit = normalizeText(unitMatch[1]);
    text = unitMatch[2].trim();
  }

  text = text.replace(/^(de\s+)/i, "").trim();
  const key = productKey(text);
  const canonicalName = ALIASES[normalizeText(text)] || normalizeText(text);

  return {
    key,
    name: titleCase(canonicalName || text),
    quantity,
    unit,
    category: categoryFor(key || text),
  };
}

export function parseSpokenList(value) {
  let text = String(value).trim();
  text = text
    .replace(/^(oye\s+siri[,:]?\s*)/i, "")
    .replace(/^(añade|agrega|apunta|anota|pon|mete|necesitamos|necesito|hace falta|hay que comprar|comprar)\s+/i, "")
    .replace(/\s+(?:a|en)\s+(?:mi\s+|la\s+)?lista\s+de\s+(?:la\s+)?compra\s*$/i, "")
    .trim();
  return splitListText(text).map(parseEntry).filter((entry) => entry.key);
}

function dateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseSpokenExpiryDate(value, now = Date.now()) {
  const normalized = normalizeText(value);
  const base = new Date(now);

  const iso = normalized.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;

  const numeric = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numeric) {
    let year = numeric[3] ? Number(numeric[3]) : base.getFullYear();
    if (year < 100) year += 2000;
    return dateValue(new Date(year, Number(numeric[2]) - 1, Number(numeric[1])));
  }

  let offset = null;
  if (/\bpasado manana\b/.test(normalized)) offset = 2;
  else if (/\bmanana\b/.test(normalized)) offset = 1;
  else if (/\bhoy\b/.test(normalized)) offset = 0;
  const relative = normalized.match(/\ben\s+(\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+dias?\b/);
  if (relative) offset = NUMBER_WORDS[relative[1]] ?? Number(relative[1]);
  if (offset !== null) {
    base.setDate(base.getDate() + offset);
    return dateValue(base);
  }

  const months = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  };
  const namedDate = normalized.match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de\s+(20\d{2}))?\b/);
  if (namedDate) {
    let year = namedDate[3] ? Number(namedDate[3]) : base.getFullYear();
    const candidate = new Date(year, months[namedDate[2]], Number(namedDate[1]));
    if (!namedDate[3] && candidate < new Date(base.getFullYear(), base.getMonth(), base.getDate())) candidate.setFullYear(year + 1);
    return dateValue(candidate);
  }

  const weekdays = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  const weekday = normalized.match(/\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/);
  if (weekday) {
    const difference = (weekdays[weekday[1]] - base.getDay() + 7) % 7;
    base.setDate(base.getDate() + difference);
    return dateValue(base);
  }

  return "";
}

export function parseExtraPurchaseCommand(value, now = Date.now()) {
  const normalized = normalizeText(value);
  if (!/(he comprado|hemos comprado|compre)\b/.test(normalized) || !/(extra|caduc|caduq)/.test(normalized)) return null;

  const spoken = String(value);
  const detailMatch = spoken.match(/(?:he|hemos)\s+comprado\s+(.+)/i) || spoken.match(/compr[eé]\s+(.+)/i);
  let productText = detailMatch?.[1] || "";
  productText = productText
    .replace(/\b(?:que|y)\s+cadu(?:c|q)\w*.*$/i, "")
    .replace(/\b(?:algo|un producto|una cosa|producto)\b/gi, "")
    .replace(/\bextra\b/gi, "")
    .replace(/^[\s,:;-]+|[\s,:;-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const entry = productText ? parseEntry(productText) : null;
  return {
    type: "extra-expiration",
    entry: entry?.key ? entry : null,
    expiresOn: parseSpokenExpiryDate(value, now),
  };
}

export function detectVoiceCommand(value) {
  const normalized = normalizeText(value);
  const extraPurchase = parseExtraPurchaseCommand(value);
  if (extraPurchase) return extraPurchase;
  if (
    /^(voy|vamos) a (hacer )?la compra$/.test(normalized)
    || /^(voy|vamos) a comprar$/.test(normalized)
    || /^(hazme|prepara|preparame) la lista final( que voy a comprar)?$/.test(normalized)
    || ["modo compra", "lista final", "preparar la compra"].includes(normalized)
  ) {
    return { type: "shopping" };
  }
  if (/^(he |hemos )?(terminado|acabado)( la compra)?$/.test(normalized) || /^(terminar|finalizar|fin de) compra$/.test(normalized)) {
    return { type: "finish" };
  }
  const mentionsList = /\b(?:la|mi) lista(?: de (?:la )?compra)?\b/.test(normalized);
  const asksForListContents = /^(?:dime )?(?:que |cuales? )?(?:(?:ingredientes|productos|cosas) )?(?:hay|tengo|tenemos)\b/.test(normalized)
    || /^(?:que|cuales?) (?:son )?(?:los |las )?(?:ingredientes|productos|cosas) (?:de|en)\b/.test(normalized);
  if (
    (mentionsList && asksForListContents)
    || /^(?:lee|leer|leeme) (?:la|mi) lista(?: de (?:la )?compra)?$/.test(normalized)
    || ["hay", "que hay", "que ingredientes hay", "ingredientes hay", "que productos hay", "productos hay"].includes(normalized)
  ) {
    return { type: "read" };
  }
  if (/^(abre|muestra|muestrame|ensena|ensename) (la|mi) lista( de la compra)?$/.test(normalized)) {
    return { type: "show-list" };
  }
  return { type: "add", entries: parseSpokenList(value) };
}

export function createInitialState() {
  return {
    version: 1,
    items: [],
    catalog: {},
    purchases: [],
    expirations: [],
    specialLists: [],
    dismissedSuggestions: {},
    settings: { speak: true },
  };
}

export function hydrateState(raw) {
  const initial = createInitialState();
  if (!raw || typeof raw !== "object") return initial;
  return {
    ...initial,
    ...raw,
    items: Array.isArray(raw.items) ? raw.items : [],
    catalog: raw.catalog && typeof raw.catalog === "object" ? raw.catalog : {},
    purchases: Array.isArray(raw.purchases) ? raw.purchases : [],
    expirations: Array.isArray(raw.expirations) ? raw.expirations : [],
    specialLists: Array.isArray(raw.specialLists)
      ? raw.specialLists.map((list) => ({
        id: String(list.id || ""),
        name: titleCase(list.name || "Lista especial"),
        shareId: String(list.shareId || ""),
        accountListId: String(list.accountListId || ""),
        accountRole: list.accountRole === "owner" ? "owner" : list.accountRole ? "editor" : "",
        createdAt: list.createdAt || new Date().toISOString(),
        items: Array.isArray(list.items) ? list.items : [],
      })).filter((list) => list.id)
      : [],
    dismissedSuggestions: raw.dismissedSuggestions && typeof raw.dismissedSuggestions === "object"
      ? raw.dismissedSuggestions
      : {},
    settings: { ...initial.settings, ...(raw.settings || {}) },
  };
}

export function makeItem(entry, now = Date.now()) {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${now}-${Math.random().toString(16).slice(2)}`,
    ...entry,
    addedAt: new Date(now).toISOString(),
    checked: false,
  };
}

export function registerRequest(state, entry, now = Date.now()) {
  const current = state.catalog[entry.key] || {
    key: entry.key,
    name: entry.name,
    category: entry.category,
    requestDates: [],
    purchaseDates: [],
  };
  current.name = entry.name;
  current.category = entry.category;
  current.requestDates = [...(current.requestDates || []), new Date(now).toISOString()].slice(-20);
  state.catalog[entry.key] = current;
}

export function registerPurchase(state, item, now = Date.now()) {
  const entry = state.catalog[item.key] || {
    key: item.key,
    name: item.name,
    category: item.category,
    requestDates: [],
    purchaseDates: [],
  };
  entry.purchaseDates = [...(entry.purchaseDates || []), new Date(now).toISOString()].slice(-20);
  entry.name = item.name;
  entry.category = item.category;
  state.catalog[item.key] = entry;
  state.purchases.unshift({
    id: globalThis.crypto?.randomUUID?.() || `${now}-${Math.random().toString(16).slice(2)}`,
    key: item.key,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    purchasedAt: new Date(now).toISOString(),
  });
  state.purchases = state.purchases.slice(0, 500);
}

export function getPreviouslyPurchased(state, activeItems = [], limit = 24) {
  const activeKeys = new Set((activeItems || []).map((item) => item?.key).filter(Boolean));
  const seen = new Set();
  return (state.purchases || [])
    .filter((purchase) => {
      if (!purchase?.key || activeKeys.has(purchase.key) || seen.has(purchase.key)) return false;
      seen.add(purchase.key);
      return true;
    })
    .slice(0, limit)
    .map((purchase) => ({ ...purchase }));
}

export function isPerishable(item) {
  return PERISHABLE_CATEGORIES.has(item?.category);
}

export function isFreezable(item) {
  if (item?.category === "Carne y pescado") return true;
  const normalized = normalizeText(item?.key || item?.name || "");
  return FREEZABLE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function localDayStamp(value) {
  if (typeof value === "number") {
    const date = new Date(value);
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  }
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function expirationDaysLeft(expiresOn, now = Date.now()) {
  return Math.round((localDayStamp(expiresOn) - localDayStamp(now)) / DAY);
}

export function addExpiration(state, item, expiresOn, now = Date.now()) {
  if (!Number.isFinite(localDayStamp(expiresOn))) throw new Error("Fecha de caducidad no válida");
  const changedAt = new Date(now).toISOString();
  const expiration = {
    id: globalThis.crypto?.randomUUID?.() || `${now}-${Math.random().toString(16).slice(2)}`,
    key: item.key,
    name: item.name,
    category: item.category,
    expiresOn: String(expiresOn).slice(0, 10),
    createdAt: changedAt,
    updatedAt: changedAt,
    consumedAt: null,
    alertsSent: [],
  };
  state.expirations.unshift(expiration);
  state.expirations = state.expirations.slice(0, 300);
  return expiration;
}

export function updateExpiration(state, expirationId, expiresOn, now = Date.now()) {
  if (!Number.isFinite(localDayStamp(expiresOn))) throw new Error("Fecha de caducidad no válida");
  const expiration = (state.expirations || []).find((entry) => entry.id === expirationId);
  if (!expiration) return null;
  expiration.expiresOn = String(expiresOn).slice(0, 10);
  expiration.updatedAt = new Date(now).toISOString();
  expiration.alertsSent = [];
  return expiration;
}

export function getActiveExpirations(state, now = Date.now()) {
  return (state.expirations || [])
    .filter((entry) => !entry.consumedAt)
    .map((entry) => ({ ...entry, daysLeft: expirationDaysLeft(entry.expiresOn, now) }))
    .sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name, "es"));
}

export function getPendingExpirationAlerts(state, now = Date.now()) {
  return getActiveExpirations(state, now).flatMap((entry) => {
    const threshold = entry.daysLeft <= 1 ? 1 : entry.daysLeft <= 3 ? 3 : null;
    if (!threshold || (entry.alertsSent || []).includes(threshold)) return [];
    return [{ ...entry, threshold }];
  });
}

export function markExpirationAlerted(state, expirationId, threshold) {
  const entry = (state.expirations || []).find((candidate) => candidate.id === expirationId);
  if (!entry) return;
  entry.alertsSent = [...new Set([...(entry.alertsSent || []), threshold])];
}

export function groupItems(items) {
  const groups = new Map(CATEGORY_ORDER.map((category) => [category, []]));
  for (const item of items) {
    const category = groups.has(item.category) ? item.category : "Otros";
    groups.get(category).push(item);
  }
  return [...groups.entries()]
    .filter(([, entries]) => entries.length)
    .map(([category, entries]) => ({ category, items: entries }));
}

export function formatAmount(item) {
  if (item.quantity === 1 && !item.unit) return "";
  const quantity = Number.isInteger(item.quantity) ? item.quantity : String(item.quantity).replace(".", ",");
  return `${quantity}${item.unit ? ` ${item.unit}` : ""}`;
}

const DAY = 86_400_000;

function daysSince(isoDate, now) {
  return Math.max(0, Math.floor((now - new Date(isoDate).getTime()) / DAY));
}

function averageIntervals(dates) {
  const ordered = dates.map((date) => new Date(date).getTime()).sort((a, b) => a - b);
  if (ordered.length < 2) return null;
  const intervals = ordered.slice(1).map((time, index) => (time - ordered[index]) / DAY);
  return intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
}

export function getSuggestions(state, now = Date.now()) {
  const activeKeys = new Set(state.items.map((item) => item.key));
  const month = new Date(now).getMonth() + 1;
  const dismissalKey = `${new Date(now).getFullYear()}-${String(month).padStart(2, "0")}`;
  const dismissed = new Set(state.dismissedSuggestions[dismissalKey] || []);

  const remembered = Object.values(state.catalog)
    .filter((entry) => !activeKeys.has(entry.key) && !dismissed.has(entry.key))
    .map((entry) => {
      const purchaseDates = entry.purchaseDates || [];
      const requestDates = entry.requestDates || [];
      if (purchaseDates.length) {
        const elapsed = daysSince(purchaseDates.at(-1), now);
        const average = averageIntervals(purchaseDates);
        const dueAfter = average === null ? 45 : Math.min(90, Math.max(12, Math.round(average * 1.25)));
        if (elapsed >= dueAfter) {
          return {
            key: entry.key,
            name: entry.name,
            category: entry.category,
            reason: `Hace ${elapsed} días que no lo compras`,
            score: elapsed / dueAfter,
            kind: "remembered",
          };
        }
      } else if (requestDates.length) {
        const elapsed = daysSince(requestDates.at(-1), now);
        if (elapsed >= 21) {
          return {
            key: entry.key,
            name: entry.name,
            category: entry.category,
            reason: `Lo pediste hace ${elapsed} días`,
            score: elapsed / 21,
            kind: "remembered",
          };
        }
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const seasonal = SEASONAL_PRODUCE
    .filter((produce) => produce.months.includes(month))
    .filter((produce) => !activeKeys.has(produce.key) && !dismissed.has(produce.key))
    .map((produce) => ({
      ...produce,
      category: "Fruta y verdura",
      reason: "Suele estar de temporada este mes",
      kind: "seasonal",
    }))
    .slice(0, 8);

  return { remembered, seasonal, dismissalKey };
}

export function shoppingSummary(items) {
  const pending = items.filter((item) => !item.checked);
  const families = groupItems(pending).length;
  if (!pending.length) return "La lista está vacía";
  return `${pending.length} ${pending.length === 1 ? "producto" : "productos"} en ${families} ${families === 1 ? "familia" : "familias"}`;
}
