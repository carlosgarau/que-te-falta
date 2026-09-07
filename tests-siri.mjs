import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { planSiriAddition } from "./siri-shopping.mjs";
import { buildSiriBundle } from "./scripts/siri-bundle.mjs";
import { AccountStateWriter, mergeStateEdits } from "./account-state-writer.mjs";

const initial = { items: [], catalog: {}, purchases: [{ id: "purchase", name: "Huevos" }], expirations: [{ id: "expiration" }] };
const add = (state = initial, text = "patatas", approved = [], id = "request-one") => planSiriAddition(state, text, approved, id, 1_780_000_000_000);

test("Siri uses the same product, quantity, category and history format", () => {
  const result = add(initial, "dos kilos de patatas y leche");
  assert.equal(result.state.items[0].key, "patata");
  assert.equal(result.state.items[0].quantity, 2);
  assert.equal(result.state.items[0].unit, "kilos");
  assert.equal(result.state.items[0].category, "Fruta y verdura");
  assert.equal(result.state.catalog.patata.requestDates.length, 1);
  assert.deepEqual(result.state.expirations, initial.expirations);
  assert.deepEqual(result.state.purchases, initial.purchases);
  assert.equal(initial.items.length, 0);
});

test("No product is committed until duplicates are confirmed; approval binds to current quantity", () => {
  const original = add().state;
  const pending = add(original, "patatas", [], "request-two");
  assert.equal(pending.duplicates.length, 1);
  assert.equal(original.items[0].quantity, 1);
  const approved = pending.duplicates.map((entry) => entry.fingerprint);
  assert.equal(add(original, "patatas", approved, "request-two").state.items[0].quantity, 2);
  const changed = structuredClone(original);
  changed.items[0].quantity = 3;
  assert.equal(add(changed, "patatas", approved, "request-two").duplicates.length, 1);
});

test("Repeated product inside one utterance has stable confirmation identity", () => {
  const plan = add(initial, "patatas y patatas");
  const result = add(initial, "patatas y patatas", plan.duplicates.map((entry) => entry.fingerprint));
  assert.equal(result.duplicates.length, 0);
  assert.equal(result.state.items[0].quantity, 2);
});

test("Confirmed products retain photos and receipts prevent double writes", () => {
  const existing = add().state;
  existing.items[0].photoDataUrl = "data:image/jpeg;base64,YQ==";
  const request = add(existing, "patatas", [], "next");
  const result = add(existing, "patatas", request.duplicates.map((d) => d.fingerprint), "next");
  assert.equal(result.state.items[0].photoDataUrl, existing.items[0].photoDataUrl);
  const replay = add(result.state, "patatas", [], "next");
  assert.equal(replay.alreadyApplied, true);
  assert.equal(replay.state.items[0].quantity, 2);
});

test("Different units are confirmed as a separate entry and checked products can be bought again", () => {
  const state = add().state;
  const pending = add(state, "dos kilos de patatas", [], "second");
  const result = add(state, "dos kilos de patatas", pending.duplicates.map((d) => d.fingerprint), "second");
  assert.equal(result.state.items.length, 2);
  assert.equal(result.state.items[0].quantity, 1);
  state.items[0].checked = true;
  assert.equal(add(state, "patatas", [], "third").duplicates.length, 0);
});

test("List questions and invalid requests never become ingredients", () => {
  for (const text of ["qué hay en la lista de la compra", "qué ingredientes hay", "", "100 patatas", "x".repeat(501)]) {
    assert.throws(() => add(initial, text));
  }
});

test("The exact script embedded for JavaScriptCore can run without a browser or crypto", async () => {
  const context = vm.createContext({});
  vm.runInContext(await buildSiriBundle(new URL("./", import.meta.url)), context);
  const result = vm.runInContext('SiriShopping.planSiriAddition({}, "patatas", [], "native-request", 1780000000000)', context);
  assert.equal(result.state.items[0].key, "patata");
  assert.equal(result.state.items[0].id, "native-request-0");
});

test("Stale app edits preserve Siri additions, photos and simultaneous quantity changes", () => {
  const base = add().state;
  const local = structuredClone(base);
  local.items[0].quantity = 2;
  const remote = add(base, "leche", [], "siri-milk").state;
  remote.items[0].quantity = 3;
  remote.items[0].photoDataUrl = "photo";
  const merged = mergeStateEdits(base, local, remote);
  assert.equal(merged.items.length, 2);
  assert.equal(merged.items[0].quantity, 4);
  assert.equal(merged.items[0].photoDataUrl, "photo");
  assert.equal(merged.items[1].key, "leche");
});

test("Stale device does not resurrect a removed item or discard another device's new item", () => {
  const base = add().state;
  const local = structuredClone(base);
  local.items[0].checked = true;
  const remote = add(initial, "leche", [], "remote").state;
  const merged = mergeStateEdits(base, local, remote);
  assert.deepEqual(merged.items.map((item) => item.key), ["leche"]);
});

test("Writer retries definite ETag conflicts and protects optimistic state from SSE", async () => {
  let remote = add().state;
  let version = 1;
  let writes = 0;
  const writer = new AccountStateWriter({
    read: async () => ({ state: structuredClone(remote), etag: String(version) }),
    write: async (id, state, etag) => {
      writes += 1;
      if (writes === 1) { remote = add(remote, "leche", [], "siri").state; version += 1; }
      if (etag !== String(version)) return false;
      remote = state;
      version += 1;
      return true;
    },
  });
  writer.observe("family", remote);
  const local = structuredClone(remote);
  local.items[0].checked = true;
  const result = writer.update("family", local);
  assert.equal(writer.observe("family", {}), false);
  await result;
  assert.equal(remote.items[0].checked, true);
  assert.equal(remote.items[1].key, "leche");
  assert.equal(writes, 2);
});

test("Rapid queued increments are applied once and failed writes are not replayed", async () => {
  let remote = add().state;
  const writer = new AccountStateWriter({ read: async () => ({ state: remote, etag: "1" }), write: async (id, next) => { remote = next; return true; } });
  writer.observe("list", remote);
  const two = structuredClone(remote); two.items[0].quantity = 2;
  const three = structuredClone(remote); three.items[0].quantity = 3;
  await Promise.all([writer.update("list", two), writer.update("list", three)]);
  assert.equal(remote.items[0].quantity, 3);
  let calls = 0;
  const failing = new AccountStateWriter({ read: async () => ({ state: remote, etag: "1" }), write: async () => { calls += 1; throw new Error("offline"); } });
  failing.observe("list", remote);
  const results = await Promise.allSettled([failing.update("list", two), failing.update("list", three)]);
  assert.equal(calls, 1);
  assert.deepEqual(results.map((result) => result.status), ["rejected", "rejected"]);
});
