import test from "node:test";
import assert from "node:assert/strict";
import { makeActivity, mergeActivity, describeActivity } from "./activity.mjs";
import { createInitialState, displayProductName, hydrateState, parseEntry } from "./core.mjs";
import { accountStateFrom, mergeAccountState } from "./account-sharing.mjs";
import { mergeStateEdits } from "./account-state-writer.mjs";

test("la actividad se conserva entre dispositivos y no duplica eventos", () => {
  const first = makeActivity({ id: "a", action: "added", product: "Patatas", actor: "Ana", now: 1000 });
  const second = makeActivity({ id: "b", action: "checked", product: "Leche", actor: "Carlos", now: 2000 });
  const local = hydrateState({ ...createInitialState(), activity: [first] });
  const remote = accountStateFrom({ activity: [second] });
  const merged = mergeStateEdits(accountStateFrom(createInitialState()), accountStateFrom(local), remote);
  assert.deepEqual(mergeActivity(merged.activity, [first]), [second, first]);
  assert.deepEqual(mergeAccountState(merged, local).activity, [second, first]);
  assert.equal(describeActivity(first), "Ana añadió Patatas");
  assert.equal(describeActivity(makeActivity({ action: "removed", product: "Tomate", actor: "Tú" })), "Tú quitaste Tomate");
});

test("la actividad compartida nunca guarda la foto ni el correo del usuario", () => {
  const entry = makeActivity({ id: "a", action: "edited", product: "Yogur", actor: "Ana" });
  assert.deepEqual(Object.keys(entry).sort(), ["action", "actor", "at", "id", "list", "product"]);
  assert.equal(accountStateFrom({ activity: [entry] }).activity[0].product, "Yogur");
});

test("los nombres visibles conservan tildes nuevas y corrigen compras antiguas", () => {
  assert.equal(parseEntry("dos plátanos").name, "Plátano");
  assert.equal(parseEntry("salmón").name, "Salmón");
  assert.equal(parseEntry("café").name, "Café");
  assert.equal(displayProductName("Salmon"), "Salmón");
  assert.equal(displayProductName("Cafe"), "Café");
  assert.equal(displayProductName("Platano"), "Plátano");
});

test("un cambio pendiente conserva una adición ajena y una cantidad propia", () => {
  const base = accountStateFrom({ items: [{ id: "a", name: "Patatas", quantity: 1 }] });
  const local = accountStateFrom({ items: [{ id: "a", name: "Patatas", quantity: 2 }] });
  const remote = accountStateFrom({ items: [
    { id: "a", name: "Patatas", quantity: 1 },
    { id: "b", name: "Leche", quantity: 1 },
  ] });
  assert.deepEqual(mergeStateEdits(base, local, remote).items, [
    { id: "a", name: "Patatas", quantity: 2 },
    { id: "b", name: "Leche", quantity: 1 },
  ]);
});

test("un cambio pendiente no recupera un producto eliminado en otro móvil", () => {
  const base = accountStateFrom({ items: [
    { id: "a", name: "Patatas", quantity: 1 },
    { id: "b", name: "Leche", quantity: 1 },
  ] });
  const local = accountStateFrom({ items: [
    { id: "a", name: "Patatas", quantity: 2 },
    { id: "b", name: "Leche", quantity: 1 },
  ] });
  const remote = accountStateFrom({ items: [{ id: "a", name: "Patatas", quantity: 1 }] });
  assert.deepEqual(mergeStateEdits(base, local, remote).items, [{ id: "a", name: "Patatas", quantity: 2 }]);
});

test("una segunda pulsación conserva cambios ajenos mientras termina la primera", () => {
  const firstWrite = accountStateFrom({ items: [{ id: "a", name: "Patatas", quantity: 2 }] });
  const currentScreen = accountStateFrom({ items: [{ id: "a", name: "Patatas", quantity: 3 }] });
  const confirmed = accountStateFrom({ items: [
    { id: "a", name: "Patatas", quantity: 2 },
    { id: "b", name: "Leche", quantity: 1 },
  ] });
  const rebased = mergeStateEdits(firstWrite, currentScreen, confirmed);
  assert.deepEqual(rebased.items, [
    { id: "a", name: "Patatas", quantity: 3 },
    { id: "b", name: "Leche", quantity: 1 },
  ]);
});
