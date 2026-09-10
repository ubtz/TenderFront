import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";

const source = readFileSync(new URL("../src/api/session.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .replace(/export /g, "")
  .replace("import.meta.env.VITE_API_URL", JSON.stringify("/api"));

const sessionHarness = (post) => {
  const stored = new Map([["token", "original"], ["data", "{}"]]);
  let interval;
  let failures = 0;
  const context = vm.createContext({
    axios: { post },
    jwtDecode: () => ({}),
    localStorage: {
      getItem: (key) => stored.get(key),
      setItem: (key, value) => stored.set(key, value),
      removeItem: (key) => stored.delete(key),
    },
    document: { visibilityState: "visible", addEventListener() {}, removeEventListener() {} },
    window: { setInterval(callback) { interval = callback; return 1; }, clearInterval() {} },
    onFailure: () => { failures++; },
  });
  vm.runInContext(source, context);
  return {
    stored,
    start: () => vm.runInContext("startSessionHeartbeat(onFailure)", context),
    send: () => vm.runInContext("sendHeartbeat()", context),
    tick: () => interval(),
    get failures() { return failures; },
  };
};

for (const status of [undefined, 500, 503, 429]) {
  test(`heartbeat retries after ${status ?? "network"} failure without logout`, async () => {
    let calls = 0;
    const harness = sessionHarness(async () => {
      if (++calls === 1) throw Object.assign(new Error("temporary"), { response: { status } });
      return { data: { token: "refreshed" } };
    });
    harness.start();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(harness.stored.get("token"), "original");
    assert.equal(harness.failures, 0);
    await harness.tick();
    assert.equal(calls, 2);
    assert.equal(harness.stored.get("token"), "refreshed");
  });
}

for (const status of [401, 403]) {
  test(`heartbeat clears rejected sessions on HTTP ${status}`, async () => {
    const harness = sessionHarness(async () => { throw { response: { status } }; });
    harness.start();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(harness.stored.has("token"), false);
    assert.equal(harness.stored.has("data"), false);
    assert.equal(harness.failures, 1);
    await harness.tick();
    assert.equal(harness.failures, 1);
  });
}

test("a late heartbeat response cannot restore a logged-out session", async () => {
  let resolve;
  const harness = sessionHarness(() => new Promise((done) => { resolve = done; }));
  const sending = harness.send();
  harness.stored.delete("token");
  resolve({ data: { token: "stale refresh" } });
  await sending;
  assert.equal(harness.stored.has("token"), false);
});

test("a late authentication rejection cannot clear a newer login", async () => {
  let reject;
  const harness = sessionHarness(() => new Promise((_, fail) => { reject = fail; }));
  harness.start();
  harness.stored.set("token", "new login");
  reject({ response: { status: 401 } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.stored.get("token"), "new login");
  assert.equal(harness.failures, 0);
});
