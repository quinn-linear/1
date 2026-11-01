#!/usr/bin/env node
/**
 * Real-browser checks against a running server (see README, "Browser checks").
 *   PREVIEW_FIXTURES=1 npm run dev   (or `npm start` after a build)
 *   CHROME=/path/to/chrome BASE=http://localhost:3000 OUT=./shots node scripts/browser-check.mjs [landing|drag|story|disk|all]
 * Drives headless Chrome over the DevTools protocol (no extra dependencies) and
 * fails (exit 1) if the landing scrolls, the dragged floppy is ever covered, a
 * story card is clipped or needs scrolling, or the floppy label's text overlaps.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "./shots";
const CHROME = process.env.CHROME ?? "chromium";
const PORT = 9300 + Math.floor(Math.random() * 500);
const which = process.argv[2] ?? "all";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  desktop: [1440, 900, 1],
  laptop: [1280, 720, 1],
  phone: [390, 844, 2],
  "phone-small": [360, 640, 2],
  "phone-landscape": [844, 390, 2],
  "phone-landscape-short": [667, 375, 2],
  zoom200: [720, 450, 1], // 1440x900 at 200% browser zoom
};
const ALL_CARDS = ["intro", "total", "archetype", "peak", "streak", "comeback", "project", "constellation", "scope", "collaborator", "integrations", "got-away", "label", "signature", "photo-finish", "summary"];

const CARDS = process.env.CARDS ? process.env.CARDS.split(",") : ALL_CARDS;
const VPS = process.env.VPS ? process.env.VPS.split(",") : Object.keys(VIEWPORTS);
const failures = [];
const check = (ok, msg) => {
  if (!ok) failures.push(msg);
  console.log(`${ok ? "ok  " : "FAIL"} ${msg}`);
};

const dir = mkdtempSync(join(tmpdir(), "chrome-"));
const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  for (let i = 0; i < 80; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = targets.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await connect());
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++id;
  pending.set(n, { resolve, reject });
  ws.send(JSON.stringify({ id: n, method, params }));
});
await send("Page.enable");
await send("Runtime.enable");

const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
  return r.result.value;
};
const viewport = (name, extra = {}) => {
  const [width, height, deviceScaleFactor] = VIEWPORTS[name];
  const mobile = name.startsWith("phone");
  return send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor, mobile, ...extra });
};
const go = async (path, { reduced = false } = {}) => {
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }] });
  await send("Page.navigate", { url: BASE + path });
  for (let i = 0; i < 100; i++) {
    if (await evaluate(`document.readyState === "complete"`)) break;
    await sleep(100);
  }
  await sleep(Number(process.env.SETTLE ?? 500));
  for (let i = 0; i < 40 && path.startsWith("/preview"); i++) {
    if (await evaluate(`!!document.querySelector("[data-cols]")`)) break;
    await sleep(150);
  }
};
const shot = async (name) => {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
};
const mouse = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, ...extra });

async function landing() {
  for (const name of Object.keys(VIEWPORTS)) {
    await viewport(name);
    await go("/");
    const r = await evaluate(`(() => {
      const de = document.documentElement, main = document.querySelector("main");
      const vis = (el) => { if (!el) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1; };
      const keys = [...document.querySelectorAll(".dock-keys button")];
      return {
        pageScroll: de.scrollHeight - innerHeight, mainScroll: main.scrollHeight - main.clientHeight,
        h1: vis(document.querySelector("h1")), pet: vis(document.querySelector(".pet-view")), drive: vis(document.querySelector(".dock-art")),
        floppy: vis(document.querySelector("[data-floppy]")), keys: keys.length === 4 && keys.every(vis),
        signin: vis([...document.querySelectorAll("a")].find((a) => /sign in with linear/i.test(a.textContent))),
      };
    })()`);
    const fits = r.pageScroll <= 0 && r.mainScroll <= 0;
    check(fits, `landing ${name}: no scrolling (page ${r.pageScroll}, main ${r.mainScroll})`);
    check(r.h1 && r.pet && r.drive && r.floppy && r.keys && r.signin, `landing ${name}: title, computer, drive, floppy, keys and sign-in all inside the viewport ${JSON.stringify(r)}`);
    await shot(`landing-${name}`);
  }
}

async function boot() {
  await viewport("desktop");
  await go("/");
  await sleep(1200);
  const r = await evaluate(`(() => {
    const g = document.querySelector('[role=group][aria-label="Linear wrapped"]');
    const pre = g?.querySelector("pre");
    return { label: !!g, art: pre?.getAttribute("aria-hidden"), title: [...g.querySelectorAll("p")].some((p) => p.textContent === "Linear wrapped"), rows: pre?.querySelectorAll("span").length };
  })()`);
  check(r.label && r.art === "true" && r.title && r.rows === 6, `boot: named group, aria-hidden art, exact "Linear wrapped" title ${JSON.stringify(r)}`);
  await shot("boot-desktop");
  await go("/", { reduced: true });
  const op = await evaluate(`getComputedStyle(document.querySelector(".boot-line")).animationName`);
  check(op === "none", `boot: reduced motion shows every line immediately (animation: ${op})`);
}

async function drag() {
  for (const name of ["desktop", "phone", "phone-landscape"]) {
    await viewport(name);
    await go("/");
    const pos = await evaluate(`(() => { const f = document.querySelector("[data-floppy]").getBoundingClientRect(), s = document.querySelector(".dock-art").getBoundingClientRect(); return { fx: f.left + f.width / 2, fy: f.top + f.height / 2, sx: s.left + s.width / 2, sy: s.top + s.height * 0.3 }; })()`);
    check(await evaluate(`document.querySelector("[data-floppy]").parentElement === document.body`), `drag ${name}: floppy is rendered on document.body, outside every clipping/stacking context`);
    await mouse("mousePressed", pos.fx, pos.fy);
    let allTop = true;
    for (let i = 1; i <= 14; i++) {
      const x = pos.fx + ((pos.sx - pos.fx) * i) / 14, y = pos.fy + ((pos.sy - pos.fy) * i) / 14;
      await mouse("mouseMoved", x, y);
      await sleep(30);
      const top = await evaluate(`(() => { const b = document.querySelector("[data-floppy]"), r = b.getBoundingClientRect(); const pts = [[.5,.5],[.5,.15],[.2,.8],[.8,.8]]; return pts.every(([a, c]) => document.elementFromPoint(r.left + r.width * a, r.top + r.height * c)?.closest("[data-floppy]") === b) && b.dataset.state === "dragging" && getComputedStyle(b).zIndex === "2147483647"; })()`);
      allTop &&= top;
    }
    await shot(`drag-mid-${name}`);
    check(allTop, `drag ${name}: floppy stays the topmost element at every point of the drag (over the drive and the computer)`);
    await mouse("mouseReleased", pos.sx, pos.sy);
    for (const t of [100, 300, 600, 1000]) {
      await sleep(t === 100 ? 100 : 250);
      const top = await evaluate(`(() => { const b = document.querySelector("[data-floppy]"), r = b.getBoundingClientRect(); return r.width > 0 && document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.6) === b.querySelector("svg") || document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.6)?.closest("[data-floppy]") === b; })()`);
      check(top, `drag ${name}: floppy still on top ${t}ms into insertion`);
    }
    await sleep(800);
    const fin = await evaluate(`(() => { const b = document.querySelector("[data-floppy]"), r = b.getBoundingClientRect(), s = document.querySelector(".dock-art").getBoundingClientRect(); return { state: b.dataset.state, visible: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight, insideDrive: r.left >= s.left - 2 && r.right <= s.right + 2 && r.top >= s.top - 2 }; })()`);
    check(fin.state === "seated" && fin.visible && fin.insideDrive, `drag ${name}: seated in the drive and fully visible ${JSON.stringify(fin)}`);
    await shot(`drag-seated-${name}`);
    await sleep(2800);
    const ready = await evaluate(`!!document.querySelector('[role=log] input')`);
    check(ready, `drag ${name}: boot leads on to the RUN prompt`);
    await shot(`ready-${name}`);
    // A short drag that doesn't reach the slot springs back.
    await go("/");
    await mouse("mousePressed", pos.fx, pos.fy);
    await mouse("mouseMoved", pos.fx + 40, pos.fy + 5);
    await mouse("mouseReleased", pos.fx + 40, pos.fy + 5);
    await sleep(900);
    check((await evaluate(`document.querySelector("[data-floppy]").dataset.state`)) === "resting", `drag ${name}: a drag that misses the slot returns the disk`);
  }
}

async function story(fixture = "full") {
  for (const name of VPS) {
    await viewport(name);
    for (const card of CARDS) {
      await go(`/preview/${fixture}?card=${card}`, { reduced: true });
      const r = await evaluate(`(() => {
        const f = document.querySelector("[data-fit-scale]"), inner = f.firstElementChild.firstElementChild;
        const o = f.getBoundingClientRect(), b = inner.getBoundingClientRect();
        const kids = [...inner.querySelectorAll("*")].filter((e) => e.getBoundingClientRect().height > 0 && !e.closest("details:not([open])") && !e.classList.contains("sr-only") && !e.closest("[data-disk] .crt") || e.tagName === "SUMMARY");
        const clipped = kids.filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > o.bottom + 1.5 || r.top < o.top - 1.5 || r.right > o.right + 1.5 || r.left < o.left - 1.5; }).length;
        const bad = kids.filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > o.bottom + 1.5 || r.top < o.top - 1.5 || r.right > o.right + 1.5 || r.left < o.left - 1.5; }).slice(0, 2).map((e) => e.tagName + "." + String(e.className?.baseVal ?? e.className).slice(0, 40) + JSON.stringify([e.getBoundingClientRect().left | 0, e.getBoundingClientRect().top | 0, e.getBoundingClientRect().right | 0, e.getBoundingClientRect().bottom | 0, o.top | 0, o.bottom | 0]));
        const innerBox = inner.getBoundingClientRect(); return { dbg: [inner.offsetHeight, inner.offsetWidth, o.height | 0, o.width | 0, innerBox.height | 0], bad, cols: inner.dataset.cols, scale: +f.dataset.fitScale, overflow: f.hasAttribute("data-fit-overflow"), clipped, cs: getComputedStyle(document.querySelector(".story-crt")).borderTopWidth, page: document.documentElement.scrollHeight - innerHeight };
      })()`);
      check(!r.overflow && r.clipped === 0 && r.page <= 0, `story ${fixture} ${name} ${card}: fits (scale ${r.scale}, cols ${r.cols}, clipped ${r.clipped}, overflow ${r.overflow}${r.clipped || r.overflow ? " " + JSON.stringify(r.bad) + JSON.stringify(r.dbg) : ""})`);
      if (["desktop", "phone", "phone-landscape"].includes(name) && ["intro", "peak", "summary"].includes(card)) await shot(`story-${fixture}-${name}-${card}`);
    }
  }
}

async function disk() {
  for (const fixture of ["full", "sparse", "zero", "long"]) {
    for (const name of ["desktop", "phone", "phone-small", "phone-landscape"]) {
      await viewport(name);
      await go(`/preview/${fixture}?card=summary`, { reduced: true });
      await sleep(600);
      const r = await evaluate(`(() => {
        const d = document.querySelector("[data-disk]"), label = d.querySelector("header").parentElement;
        const bands = [...label.children].map((e) => e.getBoundingClientRect());
        const overlap = bands.some((a, i) => bands.some((b, j) => j > i && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5));
        const inLabel = bands.every((b) => b.bottom <= label.getBoundingClientRect().bottom + 1 && b.top >= label.getBoundingClientRect().top - 1);
        const texts = [...label.querySelectorAll("p, dt, dd, span")].filter((e) => e.children.length === 0);
        const cut = texts.filter((e) => /line-clamp/.test(e.className) && e.scrollHeight > e.clientHeight + 2).length;
        const min = Math.min(...texts.map((e) => parseFloat(getComputedStyle(e).fontSize)));
        return { overlap, inLabel, cut, min: +min.toFixed(1), name: d.querySelector("p.uppercase.line-clamp-2")?.textContent };
      })()`);
      check(!r.overlap && r.inLabel && r.cut === 0, `disk label ${fixture} ${name}: bands separate, inside the label, nothing cut (min text ${r.min}px) ${JSON.stringify(r)}`);
      await shot(`disk-${fixture}-${name}`);
    }
  }
}

try {
  const all = which === "all";
  if (all || which === "landing") await landing();
  if (all || which === "boot") await boot();
  if (all || which === "drag") await drag();
  if (all || which === "story") for (const f of (process.env.FIXTURES ?? "full,sparse,zero,long").split(",")) await story(f);
  if (all || which === "disk") await disk();
} finally {
  ws.close();
  chrome.kill();
}
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
