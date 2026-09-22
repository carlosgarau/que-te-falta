const MAX_ACTIVITY = 100;

export function makeActivity({ action, product, actor, list = "Lista habitual", now = Date.now(), id = globalThis.crypto?.randomUUID?.() }) {
  const allowed = new Set(["added", "edited", "checked", "unchecked", "removed", "purchased", "undone"]);
  if (!allowed.has(action)) throw new Error("Actividad no válida");
  return {
    id: id || `${now}-${Math.random().toString(16).slice(2)}`,
    action,
    product: String(product || "").trim().slice(0, 100),
    actor: String(actor || "Alguien").trim().slice(0, 40),
    list: String(list || "Lista habitual").trim().slice(0, 50),
    at: new Date(now).toISOString(),
  };
}

export function mergeActivity(...collections) {
  const byId = new Map();
  for (const collection of collections) {
    for (const entry of Array.isArray(collection) ? collection : []) {
      if (!entry?.id || !entry?.action || !entry?.at) continue;
      byId.set(String(entry.id), entry);
    }
  }
  return [...byId.values()]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)) || String(a.id).localeCompare(String(b.id)))
    .slice(0, MAX_ACTIVITY);
}

export function describeActivity(entry) {
  const product = String(entry?.product || "un producto");
  if (entry?.actor === "Tú") {
    const secondPerson = {
      added: `añadiste ${product}`,
      edited: `editaste ${product}`,
      checked: `marcaste ${product}`,
      unchecked: `desmarcaste ${product}`,
      removed: `quitaste ${product}`,
      purchased: `compraste ${product}`,
      undone: `deshiciste un cambio en ${product}`,
    };
    return `Tú ${secondPerson[entry?.action] || `cambiaste ${product}`}`;
  }
  const verbs = {
    added: `añadió ${product}`,
    edited: `editó ${product}`,
    checked: `marcó ${product}`,
    unchecked: `desmarcó ${product}`,
    removed: `quitó ${product}`,
    purchased: `compró ${product}`,
    undone: `deshizo un cambio en ${product}`,
  };
  return `${entry?.actor || "Alguien"} ${verbs[entry?.action] || `cambió ${product}`}`;
}
