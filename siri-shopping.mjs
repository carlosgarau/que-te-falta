import { detectVoiceCommand, makeItem, normalizeText, parseEntry, registerRequest } from "./core.mjs";

// This module also runs in JavaScriptCore, inside the native Siri action.
// Use the app's parser and item format rather than a second Swift catalogue.
export function siriProducts() {
  return ["Patatas", "Tomates", "Leche", "Pan", "Huevos", "Hamburguesas", "Pollo", "Arroz", "Pasta", "Agua", "Manzanas", "Plátanos", "Fresas", "Yogures", "Queso", "Aceite", "Café", "Papel higiénico"];
}

function duplicateFingerprint(item, entry) {
  return JSON.stringify([item.id, item.key, item.quantity, item.unit || "", entry.quantity, entry.unit || ""]);
}

function describe(entry) {
  return `${entry.quantity} ${entry.unit ? `${entry.unit} de ` : ""}${entry.name}`;
}

export function planSiriAddition(raw, text, approved = [], requestId = "", now = Date.now()) {
  if (!requestId) throw new Error("Falta el identificador de la petición");
  if (typeof text !== "string" || text.length > 500) throw new Error("Dime una lista de productos más corta");
  const command = detectVoiceCommand(text);
  if (command.type !== "add" || !command.entries.length) throw new Error("Dime el producto que quieres añadir");
  if (command.entries.length > 20 || command.entries.some((entry) => entry.quantity <= 0 || entry.quantity > 99 || !Number.isFinite(entry.quantity))) {
    throw new Error("Puedes añadir hasta 20 productos, con cantidades entre 1 y 99");
  }
  const state = JSON.parse(JSON.stringify(raw || {}));
  state.items = Array.isArray(state.items) ? state.items : [];
  state.catalog = state.catalog || {};
  if (state.items.some((item) => item.siriRequestIds?.includes(requestId))) {
    return { state, duplicates: [], alreadyApplied: true, summary: "El producto ya se ha guardado" };
  }
  const accepted = new Set(approved);
  const duplicates = [];
  const summaries = [];
  for (const [index, entry] of command.entries.entries()) {
    const existing = state.items.find((item) => !item.checked && (item.key || parseEntry(item.name).key) === entry.key);
    if (existing) {
      const fingerprint = duplicateFingerprint(existing, entry);
      const sameUnit = normalizeText(existing.unit || "") === normalizeText(entry.unit || "");
      if (!accepted.has(fingerprint)) {
        duplicates.push({ fingerprint, prompt: `${existing.name} ya está en la lista (${describe(existing)}). ¿Quieres añadir ${describe(entry)} más${sameUnit ? "" : " como otra entrada, porque la unidad es distinta"}?` });
        continue;
      }
      if (sameUnit) {
        existing.quantity = Number(existing.quantity || 1) + entry.quantity;
        existing.updatedAt = new Date(now).toISOString();
        existing.siriRequestIds = [...(existing.siriRequestIds || []), requestId].slice(-30);
      } else {
        state.items.push({ ...makeItem(entry, now), id: `${requestId}-${index}`, siriRequestIds: [requestId] });
      }
    } else {
      state.items.push({ ...makeItem(entry, now), id: `${requestId}-${index}`, siriRequestIds: [requestId] });
    }
    registerRequest(state, entry, now);
    summaries.push(describe(entry));
  }
  // The caller must confirm ALL duplicates before committing anything.
  return { state, duplicates, alreadyApplied: false, summary: summaries.join(", ") };
}
