import assert from "node:assert/strict";
import test from "node:test";
import { CALLBACK_PATH, LINEAR_AUTHORIZE_URL, LINEAR_SCOPE, RECONNECT_COOKIE, SESSION_COOKIE, START_PATH, STATE_COOKIE, buildAuthorizeUrl, logoutCookies, wantsWorkspaceChoice } from "./auth.ts";
import { forgetWrappedStats, getWrappedStats } from "./stats/index.ts";

const base = { clientId: "cid", origin: "https://wrapped.example", state: "st4te" };

test("the normal authorize URL is read-only, has state and the fixed callback, and no prompt", () => {
  const url = buildAuthorizeUrl({ ...base, chooseWorkspace: false });
  assert.equal(`${url.origin}${url.pathname}`, LINEAR_AUTHORIZE_URL);
  assert.equal(url.searchParams.get("scope"), "read");
  assert.equal(LINEAR_SCOPE, "read");
  assert.equal(url.searchParams.get("state"), "st4te");
  assert.equal(url.searchParams.get("redirect_uri"), `https://wrapped.example${CALLBACK_PATH}`);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("prompt"), null);
});

test("after sign out the authorize URL asks Linear for its consent screen (documented prompt=consent) and nothing else changes", () => {
  const plain = buildAuthorizeUrl({ ...base, chooseWorkspace: false });
  const url = buildAuthorizeUrl({ ...base, chooseWorkspace: true });
  assert.equal(url.searchParams.get("prompt"), "consent");
  for (const k of ["client_id", "redirect_uri", "response_type", "scope", "state"]) assert.equal(url.searchParams.get(k), plain.searchParams.get(k), k);
  // Only documented parameters: no invented workspace/account selectors, no write scope or actor.
  assert.deepEqual([...url.searchParams.keys()].sort(), ["client_id", "prompt", "redirect_uri", "response_type", "scope", "state"]);
});

test("the consent screen is forced by the post-logout marker or an explicit ?switch=1, never otherwise", () => {
  assert.equal(wantsWorkspaceChoice("1", null), true);
  assert.equal(wantsWorkspaceChoice(undefined, "1"), true);
  assert.equal(wantsWorkspaceChoice(undefined, null), false);
  assert.equal(wantsWorkspaceChoice("0", "yes"), false);
});

test("sign out expires the session and OAuth state cookies and sets a data-free reconnect marker", () => {
  const byName = Object.fromEntries(logoutCookies().map((c) => [c.name, c]));
  assert.equal(byName[SESSION_COOKIE].value, "");
  assert.equal(byName[SESSION_COOKIE].options.maxAge, 0);
  assert.equal(byName[SESSION_COOKIE].options.httpOnly, true);
  assert.equal(byName[SESSION_COOKIE].options.path, "/", "same path as the cookie it replaces, or it would not be cleared");
  assert.equal(byName[STATE_COOKIE].value, "");
  assert.equal(byName[STATE_COOKIE].options.maxAge, 0);
  assert.equal(byName[STATE_COOKIE].options.path, CALLBACK_PATH);
  assert.equal(byName[RECONNECT_COOKIE].value, "1");
  assert.ok(byName[RECONNECT_COOKIE].options.maxAge > 0);
  assert.equal(byName[RECONNECT_COOKIE].options.httpOnly, true);
  assert.equal(byName[RECONNECT_COOKIE].options.path, START_PATH, "only sent to the connect route");
});

test("forgetting one token's stats leaves other visitors' memo alone", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  // Never resolves: the memo keeps the pending entries, and we only count how often Linear would be asked.
  globalThis.fetch = (() => {
    calls++;
    return new Promise<Response>(() => {});
  }) as typeof fetch;
  try {
    void getWrappedStats("token-a");
    void getWrappedStats("token-b");
    const afterFirst = calls;
    void getWrappedStats("token-a");
    void getWrappedStats("token-b");
    assert.equal(calls, afterFirst, "both are memoized");
    forgetWrappedStats("token-a");
    void getWrappedStats("token-b");
    assert.equal(calls, afterFirst, "b is still memoized");
    void getWrappedStats("token-a");
    assert.ok(calls > afterFirst, "a is fetched again after sign out");
  } finally {
    globalThis.fetch = realFetch;
  }
});
