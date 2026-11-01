import assert from "node:assert/strict";
import { test } from "node:test";
import { FS_INITIAL, enterFullscreen, exitFullscreen, fsReducer, fullscreenSupported, isFullscreen, type FsDocument } from "./fullscreen.ts";

function doc(over: Partial<FsDocument> & { request?: () => Promise<void> } = {}): FsDocument & { calls: string[] } {
  const calls: string[] = [];
  const { request, ...rest } = over;
  const d = {
    calls,
    fullscreenEnabled: true,
    fullscreenElement: null as unknown,
    exitFullscreen: async () => {
      calls.push("exit");
      d.fullscreenElement = null;
    },
    documentElement: {
      requestFullscreen: async () => {
        calls.push("request");
        await (request ?? (async () => {}))();
        d.fullscreenElement = d.documentElement;
      },
    },
    ...rest,
  } as FsDocument & { calls: string[] };
  return d;
}

test("supported: the API exists and the browser allows it", async () => {
  const d = doc();
  assert.equal(fullscreenSupported(d), true);
  assert.equal(await enterFullscreen(d), "entered");
  assert.deepEqual(d.calls, ["request"]);
  assert.equal(isFullscreen(d), true);
});

test("unsupported: no API (iPhone Safari), a disabled document (sandboxed iframe), or both, never throws", async () => {
  const none = doc({ documentElement: {} });
  assert.equal(fullscreenSupported(none), false);
  assert.equal(await enterFullscreen(none), "unsupported");
  const disabled = doc({ fullscreenEnabled: false });
  assert.equal(await enterFullscreen(disabled), "unsupported");
  assert.deepEqual(disabled.calls, [], "a disabled document is not even asked");
});

test("webkit-prefixed browsers are supported through the prefixed API", async () => {
  let requested = 0;
  const d = doc({ fullscreenEnabled: undefined, webkitFullscreenEnabled: true, documentElement: { webkitRequestFullscreen: () => void requested++ } });
  assert.equal(fullscreenSupported(d), true);
  assert.equal(await enterFullscreen(d), "entered");
  assert.equal(requested, 1);
  assert.equal(isFullscreen({ ...d, webkitFullscreenElement: {} }), true);
});

test("rejected: the browser refuses (no user activation, policy) and we report it instead of throwing", async () => {
  const d = doc({
    request: async () => {
      throw new TypeError("Permissions check failed");
    },
  });
  assert.equal(await enterFullscreen(d), "rejected");
  assert.equal(isFullscreen(d), false);
});

test("the request is issued synchronously, while the click's activation is still live", () => {
  const d = doc();
  void enterFullscreen(d); // no await
  assert.deepEqual(d.calls, ["request"]);
});

test("exit works, is a no-op when not fullscreen, and never throws", async () => {
  const d = doc();
  await enterFullscreen(d);
  await exitFullscreen(d);
  assert.deepEqual(d.calls, ["request", "exit"]);
  await exitFullscreen(d);
  assert.deepEqual(d.calls, ["request", "exit"], "nothing to exit");
  const failing = doc({
    fullscreenElement: {},
    exitFullscreen: async () => {
      throw new Error("not in fullscreen");
    },
  });
  await exitFullscreen(failing);
});

test("state follows the browser's change events; Esc exits and nothing re-enters", () => {
  let s = fsReducer(FS_INITIAL, { type: "init", supported: true, active: false });
  assert.deepEqual(s, { supported: true, active: false, blocked: false });
  s = fsReducer(s, { type: "change", active: true });
  assert.equal(s.active, true);
  // Esc: the browser exits and fires a change. We only record it.
  s = fsReducer(s, { type: "change", active: false });
  assert.deepEqual(s, { supported: true, active: false, blocked: false });
  // A rejected request shows a notice, which clears on its own or when fullscreen is later entered.
  s = fsReducer(s, { type: "blocked" });
  assert.equal(s.blocked, true);
  assert.equal(fsReducer(s, { type: "dismiss" }).blocked, false);
  assert.equal(fsReducer(s, { type: "change", active: true }).blocked, false);
  assert.equal(fsReducer(FS_INITIAL, { type: "init", supported: false, active: false }).supported, false);
});
