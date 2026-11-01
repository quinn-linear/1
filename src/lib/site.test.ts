import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeOrigin, resolveSiteOrigin } from "./site.ts";

test("normalizeOrigin keeps only safe origins", () => {
  assert.equal(normalizeOrigin("https://wrapped.example.com/some/path?x=1#h"), "https://wrapped.example.com");
  assert.equal(normalizeOrigin("my-app.vercel.app"), "https://my-app.vercel.app");
  assert.equal(normalizeOrigin("http://localhost:4000/x"), "http://localhost:4000");
  for (const bad of ["http://example.com", "javascript:alert(1)", "https://user:pw@example.com", "ftp://x.com", "", "  ", undefined, "https://"]) {
    assert.equal(normalizeOrigin(bad), null, String(bad));
  }
});

test("SITE_URL wins, then Vercel production, then deployment URL, then localhost", () => {
  assert.equal(resolveSiteOrigin({ SITE_URL: "https://a.example", VERCEL_URL: "b.vercel.app" }), "https://a.example");
  assert.equal(resolveSiteOrigin({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "prod.example", VERCEL_URL: "dep.vercel.app" }), "https://prod.example");
  assert.equal(resolveSiteOrigin({ VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "prod.example", VERCEL_URL: "dep.vercel.app" }), "https://dep.vercel.app");
  assert.equal(resolveSiteOrigin({}), "http://localhost:3000");
  assert.equal(resolveSiteOrigin({ PORT: "4321" }), "http://localhost:4321");
  assert.equal(resolveSiteOrigin({ PORT: "abc" }), "http://localhost:3000");
});

test("an unsafe SITE_URL is ignored rather than published", () => {
  assert.equal(resolveSiteOrigin({ SITE_URL: "http://evil.example", VERCEL_URL: "ok.vercel.app" }), "https://ok.vercel.app");
  assert.equal(resolveSiteOrigin({ SITE_URL: "https://u:p@evil.example" }), "http://localhost:3000");
});
