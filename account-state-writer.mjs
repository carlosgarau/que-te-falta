const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (value) => value && typeof value === "object" && !Array.isArray(value);

// Apply only this device's edits to the latest server version. In particular a
// stale screen must not delete products that Siri (or another device) just added.
export function mergeStateEdits(base, local, remote, field = "") {
  if (equal(base, local)) return clone(remote);
  if (local === undefined) return undefined;
  if (field === "quantity" && [base, local, remote].every(Number.isFinite)) {
    return Math.max(1, remote + local - base);
  }
  if (Array.isArray(local) && (base === undefined || Array.isArray(base)) && (remote == null || Array.isArray(remote))) {
    const previous = base || [];
    const latest = remote || [];
    if ([...previous, ...local, ...latest].every((value) => value && typeof value.id === "string")) {
      const before = new Map(previous.map((value) => [value.id, value]));
      const after = new Map(local.map((value) => [value.id, value]));
      const merged = latest.filter((value) => !before.has(value.id) || after.has(value.id)).map((value) =>
        after.has(value.id) ? mergeStateEdits(before.get(value.id), after.get(value.id), value) : clone(value));
      for (const value of local) {
        if (!before.has(value.id) && !latest.some((entry) => entry.id === value.id)) merged.push(clone(value));
      }
      return merged;
    }
    if ([...previous, ...local, ...latest].every((value) => typeof value !== "object")) {
      return [...new Set([...latest.filter((value) => !previous.includes(value) || local.includes(value)), ...local.filter((value) => !previous.includes(value))])];
    }
  }
  if (object(local) && (base == null || object(base)) && (remote == null || object(remote))) {
    const result = clone(remote || {});
    for (const key of new Set([...Object.keys(base || {}), ...Object.keys(local)])) {
      const value = mergeStateEdits(base?.[key], local[key], remote?.[key], key);
      if (value === undefined) delete result[key];
      else result[key] = value;
    }
    return result;
  }
  return clone(local);
}

export class AccountStateWriter {
  constructor({ read, write }) {
    this.read = read;
    this.write = write;
    this.records = new Map();
  }
  record(id) {
    if (!this.records.has(id)) this.records.set(id, { base: undefined, optimistic: undefined, tail: Promise.resolve(), pending: 0 });
    return this.records.get(id);
  }
  observe(id, state) {
    const record = this.record(id);
    if (record.pending) return false;
    record.base = clone(state);
    return true;
  }
  update(id, next) {
    const record = this.record(id);
    const base = clone(record.pending ? record.optimistic : record.base);
    const local = clone(next);
    record.optimistic = local;
    record.pending += 1;
    const operation = record.tail.then(async () => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const latest = await this.read(id);
        if (!latest.etag) throw new Error("No se ha podido comprobar la versión de la lista");
        const merged = mergeStateEdits(base ?? latest.state, local, latest.state);
        const result = await this.write(id, merged, latest.etag);
        if (result === false) continue;
        // The screen still shows 'local' until the next subscription delivery.
        // A second tap before that delivery must not treat unseen Siri items as
        // user deletions. Only observe() advances the displayed server base.
        record.base = clone(local);
        return merged;
      }
      throw new Error("La lista está cambiando en otro dispositivo. Vuelve a intentarlo");
    });
    // Later queued edits cannot run on an unconfirmed write. Otherwise a
    // disconnected client could replay a quantity increment twice.
    record.tail = operation;
    const completed = operation.finally(() => {
      record.pending -= 1;
      if (!record.pending) { record.tail = Promise.resolve(); record.optimistic = undefined; }
    });
    return completed;
  }
}
