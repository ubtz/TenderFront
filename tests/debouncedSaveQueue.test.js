import assert from "node:assert/strict";
import { test } from "node:test";
import { createDebouncedSaveQueue } from "../src/utils/debouncedSaveQueue.js";

test("closing an editor flushes its latest pending delivery edit", async () => {
  const writes = [];
  const queue = createDebouncedSaveQueue({ save: async (value) => writes.push(value) });
  queue.schedule(1, { qty: 1 });
  queue.schedule(1, { qty: 3 });
  await queue.flush();
  assert.deepEqual(writes, [{ qty: 3 }]);
  await queue.flush();
  assert.equal(writes.length, 1);
});

test("edits save automatically after the debounce", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const writes = [];
  const queue = createDebouncedSaveQueue({ save: async (value) => writes.push(value) });
  queue.schedule(1, "saved");
  t.mock.timers.tick(499);
  await Promise.resolve();
  assert.deepEqual(writes, []);
  t.mock.timers.tick(1);
  await queue.flush();
  assert.deepEqual(writes, ["saved"]);
});

test("a slow write cannot overtake a newer delivery edit", async () => {
  const writes = [];
  let finishFirst;
  const first = new Promise((resolve) => { finishFirst = resolve; });
  const queue = createDebouncedSaveQueue({ save: async (value) => {
    writes.push(value);
    if (value === 1) await first;
  } });
  queue.schedule("item", 1);
  const initialFlush = queue.flush();
  await Promise.resolve();
  queue.schedule("item", 2);
  const closingFlush = queue.flush();
  await Promise.resolve();
  assert.deepEqual(writes, [1]);
  finishFirst();
  await Promise.all([initialFlush, closingFlush]);
  assert.deepEqual(writes, [1, 2]);
});

test("failed writes are reported and do not block later edits", async () => {
  const writes = [];
  const errors = [];
  const queue = createDebouncedSaveQueue({
    save: async (value) => {
      writes.push(value);
      if (value === 1) throw new Error("offline");
    },
    onError: (error) => errors.push(error.message),
  });
  queue.schedule("item", 1);
  await queue.flush();
  queue.schedule("item", 2);
  await queue.flush();
  assert.deepEqual(writes, [1, 2]);
  assert.deepEqual(errors, ["offline"]);
});
