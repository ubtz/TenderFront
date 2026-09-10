import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import { useContractDraft } from "../src/pages/Бүртгэл/useContractDraft.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const mountDraft = (t, record, onSave) => {
  let current;
  function Harness(props) {
    current = useContractDraft(props.record, props.visible, onSave);
    return null;
  }
  let renderer;
  act(() => { renderer = create(React.createElement(Harness, { record, visible: true })); });
  t.after(() => act(() => renderer.unmount()));
  return {
    get current() { return current; },
    update(nextRecord, visible = true) {
      act(() => renderer.update(React.createElement(Harness, { record: nextRecord, visible })));
    },
  };
};

test("saving a contract field preserves drafts in other fields", async (t) => {
  const request = deferred();
  const record = { GereeId: 1, name: "old", terms: "old terms", ААН_регистер: "old register" };
  const hook = mountDraft(t, record, () => request.promise);
  let saving;
  act(() => { saving = hook.current.saveField("name", "new"); });
  act(() => {
    hook.current.setDraft("terms", "unfinished terms");
    hook.current.setDraft("ААН_регистер", "unfinished register");
  });
  hook.update({ ...record, name: "new" });
  await act(async () => { request.resolve(true); await saving; });
  assert.equal(hook.current.draft.name, "new");
  assert.equal(hook.current.draft.terms, "unfinished terms");
  assert.equal(hook.current.draft.ААН_регистер, "unfinished register");
});

test("a rejected save rolls back only its own field", async (t) => {
  const request = deferred();
  const hook = mountDraft(t, { GereeId: 1, name: "old", terms: "old terms" }, () => request.promise);
  let saving;
  act(() => { saving = hook.current.saveField("name", "new"); });
  act(() => hook.current.setDraft("terms", "keep me"));
  await act(async () => { request.resolve(false); await saving; });
  assert.equal(hook.current.draft.name, "old");
  assert.equal(hook.current.draft.terms, "keep me");
});

test("an earlier save failure preserves a newer edit of the same field", async (t) => {
  const request = deferred();
  const hook = mountDraft(t, { GereeId: 1, name: "old" }, () => request.promise);
  let saving;
  act(() => { saving = hook.current.saveField("name", "first"); });
  act(() => hook.current.setDraft("name", "newer draft"));
  await act(async () => { request.resolve(false); await saving; });
  assert.equal(hook.current.draft.name, "newer draft");
});

test("late save responses do not modify a different contract", async (t) => {
  const request = deferred();
  const hook = mountDraft(t, { GereeId: 1, name: "first contract" }, () => request.promise);
  let saving;
  act(() => { saving = hook.current.saveField("name", "edit"); });
  hook.update({ GereeId: 2, name: "second contract" });
  await act(async () => { request.resolve(false); await saving; });
  assert.deepEqual(hook.current.draft, { GereeId: 2, name: "second contract" });
});

test("reopening a contract starts with its saved record", (t) => {
  const record = { GereeId: 1, name: "saved" };
  const hook = mountDraft(t, record, async () => true);
  act(() => hook.current.setDraft("name", "unsaved"));
  hook.update(record, false);
  hook.update(record, true);
  assert.equal(hook.current.draft.name, "saved");
});

test("successive saves of one field reach the backend in order", async (t) => {
  const first = deferred();
  const calls = [];
  const hook = mountDraft(t, { GereeId: 1, name: "old" }, async (id, field, value) => {
    calls.push({ id, field, value });
    if (value === "first") await first.promise;
    return true;
  });
  let savingFirst;
  let savingSecond;
  await act(async () => {
    savingFirst = hook.current.saveField("name", "first");
    savingSecond = hook.current.saveField("name", "second");
  });
  assert.equal(calls.length, 1);
  await act(async () => {
    first.resolve();
    await Promise.all([savingFirst, savingSecond]);
  });
  assert.deepEqual(calls.map((call) => call.value), ["first", "second"]);
  assert.equal(hook.current.draft.name, "second");
});
