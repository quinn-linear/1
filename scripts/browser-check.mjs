#!/usr/bin/env node
/**
 * Real-browser checks against a running server (see README, "Browser checks").
 *   PREVIEW_FIXTURES=1 npm run dev   (or `npm start` after a build)
 *   CHROME=/path/to/chrome BASE=http://localhost:3000 OUT=./shots node scripts/browser-check.mjs [landing|boot|dust|moth|drag|drop|integrations|summary|story|print|dock|fullscreen|art|recapui|all]
 * Drives headless Chrome over the DevTools protocol (no extra dependencies) and
 * fails (exit 1) if the landing scrolls or has button clutter, the dragged
 * cassette is ever covered or a drop does the wrong thing (grant, miss, keyboard,
 * tap, duplicate redirects), a story card is clipped, the dock misbehaves, the
 * fullscreen cases (supported, rejected, unsupported, change, exit) misbehave,
 * an archetype's art is wrong or missing, or the disk label's text overlaps.
 * Start the server with fake LINEAR_CLIENT_ID/LINEAR_CLIENT_SECRET so the
 * sign-in route redirects to Linear's authorize URL (which is only recorded).
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
const chrome = spawn(CHROME, [...(CHROME.includes("headless-shell") ? [] : ["--headless=new"]), "--no-sandbox", "--disable-gpu", "--no-proxy-server", `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
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
const requests = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.method === "Network.requestWillBeSent") requests.push(msg.params.request.url);
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
await send("Network.enable");

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
  const nav = await send("Page.navigate", { url: BASE + path });
  if (nav.errorText) console.log("navigate error:", nav.errorText, BASE + path);
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

const authRequests = () => requests.filter((u) => u.includes("/api/auth/linear") && !u.includes("callback")).length;

const innerWidthOf = (n) => VIEWPORTS[n][0];
const innerHeightOf = (n) => VIEWPORTS[n][1];

async function landing() {
  for (const name of Object.keys(VIEWPORTS)) {
    await viewport(name);
    await go("/");
    if (!(await evaluate(`!!document.querySelector("main")`))) {
      console.log("page did not render <main>:", await evaluate(`location.href + " | " + document.title + " | " + document.body.innerText.slice(0, 300)`));
      await shot(`landing-broken-${name}`);
    }
    const r = await evaluate(`(() => {
      const de = document.documentElement, main = document.querySelector("main");
      const inView = (b) => b.width > 0 && b.height > 0 && b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
      const pv = document.querySelector(".pet-view").getBoundingClientRect(), img = document.querySelector(".pet-img").getBoundingClientRect();
      const c = document.querySelector("[data-cassette]").getBoundingClientRect(), crt = document.querySelector(".pet-screen-zone.crt").getBoundingClientRect();
      const logo = document.querySelector(".boot-logo").getBoundingClientRect(), cur = document.querySelector(".cursor-block").getBoundingClientRect();
      const pad = { l: pv.left + pv.width * 1280 / 1672, t: pv.top + pv.height * 655 / 941, w: pv.width * 320 / 1672, h: pv.height * 220 / 941 };
      // Text anybody can see: not the 1px screen-reader-only copy, not hidden skip links.
      const seen = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode()); ) {
        const t = n.textContent.trim(), el = n.parentElement;
        if (!t || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
        const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (b.width <= 1 || b.height <= 1 || cs.visibility === "hidden" || b.bottom < 0 || b.right < 0 || b.top > innerHeight || b.left > innerWidth) continue;
        seen.push(t);
      }
      return {
        pageScroll: de.scrollHeight - innerHeight, mainScroll: (main.scrollTop = 50, main.scrollLeft = 50, main.scrollTop + main.scrollLeft), bodyX: de.scrollWidth - innerWidth,
        covers: pv.left <= 1 && pv.top <= 1 && pv.right >= innerWidth - 1 && pv.bottom >= innerHeight - 1, ratio: +(img.width / img.height).toFixed(3),
        cassetteInView: inView(c), crtInView: inView(crt), contentInView: inView(logo) && inView(cur), seen,
        logoDx: Math.round(logo.left + logo.width / 2 - (crt.left + crt.width / 2)), logoDy: Math.round(logo.top + logo.height / 2 - (crt.top + crt.height / 2)),
        cursorBR: cur.left > crt.left + crt.width * 0.7 && cur.top > crt.top + crt.height * 0.7 && cur.right <= crt.right && cur.bottom <= crt.bottom,
        onNotepad: c.left + c.width / 2 >= pad.l && c.left + c.width / 2 <= pad.l + pad.w && c.top + c.height / 2 >= pad.t && c.top + c.height / 2 <= pad.t + pad.h,
        tape: [Math.round(c.left), Math.round(c.top), Math.round(c.width), Math.round(c.height)], buttons: [...document.querySelectorAll("button")].filter((b) => !b.hasAttribute("data-cassette") && b.getBoundingClientRect().width > 0).length,
        skipLink: !!document.querySelector("a.landing-skip"), terminalText: document.querySelector(".pet-terminal").innerText.trim(),
      };
    })()`);
    const portrait = innerWidthOf(name) < innerHeightOf(name);
    check(r.pageScroll <= 0 && r.mainScroll <= 0 && r.bodyX <= 0, `landing ${name}: no scrolling, and the cropped picture can't be scrolled to (page ${r.pageScroll}, main ${r.mainScroll}, x ${r.bodyX})`);
    check(r.covers && Math.abs(r.ratio - 1672 / 941) < 0.01, `landing ${name}: the picture fills the whole viewport at its own aspect ratio (${r.ratio})`);
    // Upright phones are narrower than the glass itself at cover scale: its rim is cropped, the mark and cursor are not.
    check((portrait ? r.contentInView : r.crtInView) && r.cassetteInView, `landing ${name}: the ${portrait ? "mark, cursor" : "screen"} and the cassette are fully on screen (tape ${r.tape})`);
    check(r.seen.length === 0 && r.terminalText === "", `landing ${name}: no visible text at all: no title, tips, or boot lines (${JSON.stringify(r.seen)})`);
    check(Math.abs(r.logoDx) <= 2 && Math.abs(r.logoDy) <= 2 && r.cursorBR, `landing ${name}: the mark is centred on the glass (${r.logoDx},${r.logoDy}) and the cursor sits at its bottom right`);
    check(r.buttons === 0 && r.skipLink, `landing ${name}: no other buttons, and the sign-in fallback link exists`);
    if (!portrait) check(r.onNotepad, `landing ${name}: the cassette rests on the notepad`);
    else console.log(`note: landing ${name}: upright phone, the notepad is cropped out; the tape is pulled inside the screen at ${r.tape}`);
    await shot(`landing-${name}`);
  }
}

async function dust() {
  for (const name of ["desktop", "laptop", "phone", "phone-landscape"]) {
    await viewport(name);
    await go("/");
    await sleep(800);
    const r = await evaluate(`(() => {
      const c = document.querySelector("[data-dust]"), p = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }, b = c.getBoundingClientRect();
      const z = document.querySelector(".pet-screen-zone.crt").getBoundingClientRect();
      const cs = getComputedStyle(c);
      const hits = [[.2,.2],[.5,.5],[.8,.8]].map(([a, d]) => document.elementFromPoint(b.left + b.width * a, b.top + b.height * d)).filter(Boolean);
      const px = (() => { const x = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < x.length; i += 4) if (x[i] > 8) n++; return n; })();
      const inView = b.right > p.left + 4 && b.left < p.right - 4 && b.bottom > p.top + 4 && b.top < p.bottom - 4;
      const clipW = Math.max(0, Math.min(b.right, p.right) - Math.max(b.left, p.left)), clipH = Math.max(0, Math.min(b.bottom, p.bottom) - Math.max(b.top, p.top));
      return { aria: c.getAttribute("aria-hidden"), events: cs.pointerEvents, inView, w: b.width | 0, h: b.height | 0, clipped: Math.round(100 * clipW * clipH / (b.width * b.height)), litPixels: px, awayFromScreen: b.right <= z.left + 1 || b.left >= z.right - 1 || b.bottom <= z.top || b.top >= z.bottom, hitsDust: hits.some((h) => h === c), cassetteTop: !!document.querySelector("[data-cassette]") };
    })()`);
    check(r.aria === "true" && r.events === "none" && !r.hitsDust && r.awayFromScreen, `dust ${name}: aria-hidden, pointer-events none, never the hit target, clear of the CRT ${JSON.stringify(r)}`);
    if (r.inView && r.clipped > 30) check(r.litPixels > 0 && r.litPixels < r.w * r.h * 0.05 * 4, `dust ${name}: some motes are drawn but sparse (${r.litPixels} lit px in ${r.w}x${r.h})`);
    else console.log(`note: dust ${name}: the lamp beam is cropped out of this view (${r.clipped}% visible); nothing to see`);
    await shot(`dust-${name}`);
  }
  // Drifts: two frames a few seconds apart differ; reduced motion is still.
  await viewport("desktop");
  await go("/");
  const grab = () => evaluate(`document.querySelector("[data-dust]").toDataURL()`);
  const a = await grab();
  await sleep(2500);
  const b = await grab();
  check(a !== b, "dust: the motes drift over time");
  await go("/", { reduced: true });
  const c = await grab();
  await sleep(1500);
  const d = await grab();
  check(c === d && c.length > 200, "dust: reduced motion draws a still frame (no animation)");
  // Hidden tab pauses the loop.
  await go("/");
  await evaluate(`Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange"))`);
  const e = await grab();
  await sleep(1500);
  check(e === (await grab()), "dust: nothing is drawn while the tab is hidden");
  // The cassette still drags with the dust in place.
  await go("/");
  const pos = await evaluate(centers);
  await mouse("mousePressed", pos.fx, pos.fy);
  await mouse("mouseMoved", pos.fx - 200, pos.fy - 120);
  await mouse("mouseMoved", pos.fx - 260, pos.fy - 200);
  check((await evaluate(`document.querySelector("[data-cassette]").dataset.state`)) === "dragging", "dust: a drag across the lamp area still moves the cassette");
  await mouse("mouseReleased", pos.fx - 260, pos.fy - 200);
}

/** The moth: arrives after a quiet start, flutters inside the beam's box, leaves; never with reduced motion or a cropped-out beam. */
async function moth() {
  const flag = () => evaluate(`document.querySelector("[data-dust]")?.dataset.moth ?? ""`);
  await viewport("desktop");
  await go("/");
  check((await flag()) !== "1", "moth: not there at the start (quiet gaps)");
  let seen = 0;
  let shots = 0;
  let gone = false;
  for (let i = 0; i < 400 && !gone; i++) {
    await sleep(250);
    const f = await flag();
    if (f === "1") {
      seen++;
      if (seen === 8 || seen === 24) await shot(`moth-desktop-${++shots}`);
    } else if (seen > 0) gone = true;
  }
  check(seen > 8 && gone, `moth: arrives, flutters (${seen} samples) and departs`);
  check(await evaluate(`(() => { const c = document.querySelector("[data-dust]"); return c.getAttribute("aria-hidden") === "true" && getComputedStyle(c).pointerEvents === "none"; })()`), "moth: canvas stays aria-hidden and pointer-events none");
  await go("/", { reduced: true });
  await sleep(25000);
  check((await flag()) === "", "moth: omitted under reduced motion");
  await viewport("phone");
  await go("/");
  await sleep(25000);
  check((await flag()) === "", "moth: never starts while the beam is cropped out (phone)");
}

async function boot() {
  await viewport("desktop");
  await go("/");
  await sleep(1500);
  const r = await evaluate(`(() => {
    const g = document.querySelector('[role=group][aria-label="Linear wrapped"]');
    const svg = g?.querySelector("svg");
    const box = svg?.getBoundingClientRect();
    return { label: !!g, art: svg?.getAttribute("aria-hidden"), title: g.innerText.trim() === "", bands: svg?.querySelectorAll("g.boot-line").length, square: box && Math.abs(box.width - box.height) < 1, fill: getComputedStyle(svg.querySelector("polygon")).fill, shown: [...svg.querySelectorAll("g.boot-line")].every((e) => getComputedStyle(e).opacity === "1") };
  })()`);
  check(r.label && r.art === "true" && r.title && r.bands === 17 && r.square && r.shown, `boot: named group, aria-hidden square 17-band mark, no visible text, all bands revealed ${JSON.stringify(r)}`);
  await shot("boot-desktop");
    // The mark mid-reveal: some bands visible, some not (line by line).
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await send("Page.navigate", { url: BASE + "/" });
  for (let i = 0; i < 100 && !(await evaluate(`!!document.querySelector("svg g.boot-line")`).catch(() => false)); i++) await sleep(15);
  await sleep(380);
  const mid = await evaluate(`(() => { const o = [...document.querySelectorAll("svg g.boot-line")].map((e) => getComputedStyle(e).opacity); return { on: o.filter((v) => v === "1").length, off: o.filter((v) => v === "0").length }; })()`);
  check(mid.on > 0 && mid.off > 0, `boot: the mark reveals band by band (mid-reveal ${JSON.stringify(mid)})`);
  await shot("boot-mid-reveal");
  await go("/", { reduced: true });
  const op = await evaluate(`[...document.querySelectorAll(".boot-line")].every((e) => getComputedStyle(e).animationName === "none")`);
  check(op, "boot: reduced motion shows every band and line immediately");
  await viewport("phone");
  await go("/");
  await sleep(1500);
  const fit = await evaluate(`(() => { const z = document.querySelector(".pet-screen-zone.crt").getBoundingClientRect(), b = document.querySelector(".boot-logo").getBoundingClientRect(); return b.left >= z.left - 1 && b.right <= z.right + 1 && b.top >= z.top - 1 && b.bottom <= z.bottom + 1; })()`);
  check(fit, "boot: the logo fits inside the PET screen on a phone");
  await shot("boot-phone");
}

const cassetteState = `(() => { const c = document.querySelector("[data-cassette]"), p = document.querySelector("[data-pet]"); return { cassette: c.dataset.state, pet: p.dataset.state, screen: document.querySelector(".pet-terminal").innerText.trim() }; })()`;
const cassetteTop = `(() => { const b = document.querySelector("[data-cassette]"), r = b.getBoundingClientRect(); const pts = [[.5,.5],[.5,.15],[.2,.8],[.8,.8]]; return pts.every(([a, c]) => document.elementFromPoint(r.left + r.width * a, r.top + r.height * c)?.closest("[data-cassette]") === b) && getComputedStyle(b).zIndex === "2147483647"; })()`;
const centers = `(() => {
  const f = document.querySelector("[data-cassette]").getBoundingClientRect(), p = document.querySelector(".pet-screen-zone.crt").getBoundingClientRect(), t = document.querySelector("[data-pet]").getBoundingClientRect();
  // A point inside the viewport but outside the (expanded) drop target, to pull the tape out to before dropping it in.
  const cx = f.left + f.width / 2;
  const away = t.top > 24 ? [cx, t.top / 2] : t.bottom < innerHeight - 24 ? [cx, (t.bottom + innerHeight) / 2] : t.left > 24 ? [t.left / 2, f.top + f.height / 2] : [(t.right + innerWidth) / 2, f.top + f.height / 2];
  return { fx: f.left + f.width / 2, fy: f.top + f.height / 2, px: p.left + p.width / 2, py: p.top + p.height / 2, ax: away[0], ay: away[1], t: { l: t.left, t: t.top, w: t.width, h: t.height } };
})()`;

async function drag() {
  for (const name of ["desktop", "phone", "phone-landscape"]) {
    await viewport(name);
    await go("/");
    const pos = await evaluate(centers);
    check(await evaluate(`document.querySelector("[data-cassette]").parentElement === document.body`), `drag ${name}: cassette is on document.body, outside every clipping/stacking context`);
    const before = authRequests();
    await mouse("mousePressed", pos.fx, pos.fy);
    // Out to a point clear of the computer first (on a phone the resting tape already lies over its case), then in.
    for (let i = 1; i <= 4; i++) await mouse("mouseMoved", pos.fx + ((pos.ax - pos.fx) * i) / 4, pos.fy + ((pos.ay - pos.fy) * i) / 4);
    let allTop = true, glowedOver = false, dimWhileFar = true;
    for (let i = 1; i <= 14; i++) {
      const x = pos.ax + ((pos.px - pos.ax) * i) / 14, y = pos.ay + ((pos.py - pos.ay) * i) / 14;
      await mouse("mouseMoved", x, y);
      await sleep(40);
      allTop &&= await evaluate(cassetteTop);
      const st = await evaluate(cassetteState);
      if (i === 1 && st.pet !== "idle") dimWhileFar = false;
      if (i === 14) glowedOver = st.pet === "hover" && st.cassette === "dragging";
    }
    await sleep(900);
    await shot(`drag-over-${name}`);
    check(allTop, `drag ${name}: cassette stays the topmost element all the way over the computer`);
    check(glowedOver && dimWhileFar, `drag ${name}: the computer glows only while the cassette is over it (hover state ${glowedOver})`);
    await mouse("mouseReleased", pos.px, pos.py);
    await sleep(150);
    const granted = await evaluate(cassetteState);
    check(granted.pet === "granted" && /ACCESS GRANTED/.test(granted.screen), `drag ${name}: release over the computer flashes exactly ACCESS GRANTED ${JSON.stringify(granted)}`);
    await sleep(100);
    const screen = await evaluate(`(() => { const z = document.querySelector(".pet-screen-zone.crt").getBoundingClientRect(), t = document.querySelector(".access-granted").getBoundingClientRect(); return t.left >= z.left && t.right <= z.right && t.top >= z.top && t.bottom <= z.bottom; })()`);
    check(screen, `drag ${name}: the message fits inside the CRT`);
    // Double activation while granted must not start a second redirect.
    await evaluate(`document.querySelector("[data-cassette]").click()`);
    await mouse("mousePressed", pos.px, pos.py);
    await mouse("mouseReleased", pos.px, pos.py);
    // (A screenshot here is slow enough in software rendering for the redirect to start, so the granted state is not captured.)
    await sleep(2200);
    check(authRequests() - before === 1, `drag ${name}: exactly one sign-in redirect started (${authRequests() - before})`);
  }
  // Redirect target: the real Linear authorize URL, read-only, with state.
  const lin = requests.find((u) => u.startsWith("https://linear.app/oauth/authorize"));
  if (lin) {
    const q = new URL(lin).searchParams;
    check(q.get("scope") === "read" && !!q.get("state") && q.get("response_type") === "code", `authorize URL is read-only with state (${lin.slice(0, 90)}...)`);
  } else console.log("note: no linear.app authorize request seen (start the server with fake LINEAR_CLIENT_ID/SECRET to check it)");

  for (const name of ["desktop", "phone"]) {
    await viewport(name);
    await go("/");
    const pos = await evaluate(centers);
    const before = authRequests();
    // A drop beside the computer resets and signs nobody in.
    await mouse("mousePressed", pos.fx, pos.fy);
    await mouse("mouseMoved", pos.fx + 30, pos.fy + 4);
    await mouse("mouseMoved", pos.fx + 60, pos.fy + 8);
    await mouse("mouseReleased", pos.fx + 60, pos.fy + 8);
    await sleep(1000);
    const st = await evaluate(cassetteState);
    const back = await evaluate(`(() => { const c = document.querySelector("[data-cassette]").getBoundingClientRect(); return Math.abs(c.left + c.width / 2 - ${pos.fx}) < 2 && Math.abs(c.top + c.height / 2 - ${pos.fy}) < 2; })()`);
    check(st.cassette === "resting" && st.pet === "idle" && back && authRequests() === before, `drag ${name}: a drop outside the computer springs back, no glow, no sign-in ${JSON.stringify(st)}`);
  }

  // Keyboard: Tab to the cassette, Enter and Space each grant once.
  for (const key of ["Enter", " "]) {
    await viewport("desktop");
    await go("/");
    const before = authRequests();
    const label = await evaluate(`(() => { for (let i = 0; i < 12 && !document.activeElement?.hasAttribute("data-cassette"); i++) { document.activeElement?.blur?.(); } return document.querySelector("[data-cassette]").getAttribute("aria-label"); })()`);
    check(/drag it onto the computer/i.test(label) && /enter or space/i.test(label), `keyboard: the cassette's accessible name explains drag, Enter and Space (${label.slice(0, 60)}...)`);
    for (let i = 0; i < 12; i++) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      if (await evaluate(`document.activeElement?.hasAttribute("data-cassette")`)) break;
    }
    check(await evaluate(`document.activeElement?.hasAttribute("data-cassette")`), "keyboard: Tab reaches the cassette");
    await shot("cassette-focus");
    const ring = await evaluate(`(() => { const s = getComputedStyle(document.activeElement); return { style: s.outlineStyle, color: s.outlineColor }; })()`);
    check(ring.style !== "none" && !/255, 180, 58/.test(ring.color), `keyboard: a visible lavender focus ring, not the old yellow rectangle (${JSON.stringify(ring)})`);
    const code = key === " " ? "Space" : "Enter";
    await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, text: key === "Enter" ? "\r" : " ", windowsVirtualKeyCode: key === "Enter" ? 13 : 32 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: key === "Enter" ? 13 : 32 });
    await sleep(200);
    const st = await evaluate(cassetteState);
    check(st.pet === "granted" && /ACCESS GRANTED/.test(st.screen), `keyboard: ${code} grants access ${JSON.stringify(st)}`);
    await sleep(2200);
    check(authRequests() - before === 1, `keyboard: ${code} starts exactly one sign-in redirect`);
  }

  // Touch tap (phone): the same grant.
  await viewport("phone");
  await go("/");
  {
    const before = authRequests();
    const pos = await evaluate(centers);
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pos.fx, y: pos.fy }] });
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(250);
    const st = await evaluate(cassetteState);
    check(st.pet === "granted" && /ACCESS GRANTED/.test(st.screen), `touch: a tap grants access ${JSON.stringify(st)}`);
    await sleep(2200);
    check(authRequests() - before === 1, "touch: a tap starts exactly one sign-in redirect");
  }

  // Reduced motion: no animated flash, still grants.
  await viewport("desktop");
  await go("/", { reduced: true });
  await evaluate(`document.querySelector("[data-cassette]").click()`);
  await sleep(200);
  const rm = await evaluate(`({ anim: getComputedStyle(document.querySelector(".access-granted")).animationName, float: getComputedStyle(document.querySelector(".cassette-float")).animationName })`);
  check(rm.anim === "none" && rm.float === "none", `reduced motion: no glow animation and no floating (${JSON.stringify(rm)})`);
  await sleep(1500);
}

/** Where in the drop target (fractions of its box) a few parts of the computer sit: the screen, the keyboard and the built-in cassette deck. */
const PARTS = { screen: [0.5, 0.3], keyboard: [0.664, 0.769], deck: [0.2415, 0.7174] };

/** Press the tape, walk it through `waypoints`, release, and say whether sign-in started. */
async function dropVia(waypoints, wait = 1900) {
  const pos = await evaluate(centers);
  const before = authRequests();
  await mouse("mousePressed", pos.fx, pos.fy);
  let at = [pos.fx, pos.fy];
  for (const [x, y] of waypoints(pos)) {
    for (let i = 1; i <= 5; i++) await mouse("mouseMoved", at[0] + ((x - at[0]) * i) / 5, at[1] + ((y - at[1]) * i) / 5);
    at = [x, y];
    await sleep(60);
  }
  const glow = (await evaluate(cassetteState)).pet;
  await mouse("mouseReleased", at[0], at[1]);
  await sleep(wait);
  return { auth: authRequests() - before, glow, state: await evaluate(cassetteState).catch(() => null) };
}

/** The drop target covers the whole computer with a little forgiveness, and only a deliberate drag into it signs in. */
async function drop() {
  const inTarget = (f) => (p) => [p.t.l + p.t.w * f[0], p.t.t + p.t.h * f[1]];
  for (const name of ["desktop", "phone-landscape"]) {
    await viewport(name);
    for (const [part, f] of Object.entries(PARTS)) {
      await go("/");
      const r = await dropVia((p) => [[p.ax, p.ay], inTarget(f)(p)]);
      check(r.auth === 1 && r.glow === "hover", `drop ${name}: letting go on the ${part} signs in once (auth ${r.auth}, glow ${r.glow})`);
    }
    // Just outside the case's edge but inside the margin: forgiven.
    await go("/");
    const near = await dropVia((p) => [[p.ax, p.ay], [p.t.l + 6, p.t.t + p.t.h * 0.5]]);
    check(near.auth === 1, `drop ${name}: a little beside the case still counts (auth ${near.auth})`);
    // Clearly outside: nothing, and the tape returns.
    await go("/");
    const out = await dropVia((p) => [[p.ax, p.ay]], 1200);
    check(out.auth === 0 && out.state?.pet === "idle" && out.state?.cassette === "resting", `drop ${name}: released away from the computer does nothing ${JSON.stringify(out.state)}`);
    // Released where it lay, or nudged a little: nothing.
    await go("/");
    const nudge = await dropVia((p) => [[p.fx + 14, p.fy + 10]], 1200);
    check(nudge.auth === 0 && nudge.state?.pet === "idle", `drop ${name}: a nudge where the tape lies does not sign in (auth ${nudge.auth})`);
    // Pressed and released without moving: that is a tap, handled elsewhere (once).
  }
  // A phone's crop leaves the tape lying over the case: dragging around inside the target, never leaving it, is not a sign-in.
  await viewport("phone");
  await go("/");
  const p0 = await evaluate(centers);
  const restOver = p0.fx >= p0.t.l && p0.fx <= p0.t.l + p0.t.w && p0.fy >= p0.t.t && p0.fy <= p0.t.t + p0.t.h;
  console.log(`note: phone: the resting tape ${restOver ? "lies over" : "is clear of"} the drop target`);
  const stay = await dropVia((p) => [[p.px, p.py], [p.fx, p.fy + 5]], 1200);
  check(stay.auth === 0 && stay.state?.pet === "idle", `drop phone: dragging within the target without entering it, then letting go, does not sign in (auth ${stay.auth})`);
  await go("/");
  const around = await dropVia((p) => [[p.ax, p.ay], [p.px, p.py]]);
  check(around.auth === 1, `drop phone: out and back in signs in once (auth ${around.auth})`);
  // Keyboard and tap stay separate and intentional: one redirect each.
  await go("/");
  const t0 = authRequests();
  await evaluate(`document.querySelector("[data-cassette]").click()`);
  await sleep(1900);
  check(authRequests() - t0 === 1, "drop: a click or tap on the cassette still signs in once");
}

/** Integrations: the workspace's name, and no overlap at any count. */
async function integrations() {
  const probe = `(() => {
    const sec = document.querySelector("section[aria-label=Integrations]"), hub = sec.querySelector("[data-workspace]"), chips = [...sec.querySelectorAll("ul[aria-label='Connected services'] li")];
    const fit = document.querySelector("[data-fit-scale]").getBoundingClientRect();
    const rs = [hub, ...chips].filter(Boolean).map((e) => e.getBoundingClientRect());
    let overlaps = 0;
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) overlaps++; }
    const out = rs.filter((r) => r.left < fit.left - 1 || r.right > fit.right + 1 || r.top < fit.top - 1 || r.bottom > fit.bottom + 1).length;
    const clipped = [hub, ...chips].filter(Boolean).filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible" && !getComputedStyle(e).textOverflow.includes("ellipsis")).length;
    return { chips: chips.length, hub: hub?.innerText.replace(/\\s+/g, " ").trim() ?? null, overlaps, out, clipped, text: sec.innerText, overflow: document.querySelector("[data-fit-scale]").hasAttribute("data-fit-overflow") };
  })()`;
  for (const name of ["desktop", "phone", "phone-small", "phone-landscape", "phone-landscape-short"]) {
    await viewport(name);
    for (const n of [1, 2, 3, 5, 8, 12]) {
      await go(`/preview/full?card=integrations&services=${n}`, { reduced: true });
      const r = await evaluate(probe);
      const want = Math.min(n, 8);
      check(r.chips === want && r.overlaps === 0 && r.out === 0 && !r.overflow && /WORKSPACE\s+ACME|Workspace\s+Acme/i.test(r.hub ?? ""), `integrations ${name} x${n}: ${r.chips} chips, no overlaps, inside the card, workspace named ${JSON.stringify(r.hub)} (overlaps ${r.overlaps}, outside ${r.out})`);
      check(r.text.includes("Acme") && !/your workspace/i.test(r.text.replace(/not necessarily yours personally/i, "")), `integrations ${name} x${n}: the actual workspace name replaces "your workspace"`);
      if (n === 8 && ["desktop", "phone", "phone-landscape"].includes(name)) await shot(`integrations-${name}-8`);
    }
  }
  await viewport("phone");
  await go("/preview/long?card=integrations&services=9", { reduced: true });
  const long = await evaluate(probe);
  check(long.overlaps === 0 && long.out === 0 && !long.overflow && /Konstantinopoulou/i.test(long.hub ?? ""), `integrations: a very long workspace name wraps without overlap (${JSON.stringify({ o: long.overlaps, out: long.out })})`);
  await shot("integrations-phone-long");
  await go("/preview/full?card=integrations&services=3&workspace=none", { reduced: true });
  const none = await evaluate(probe);
  check(/your/i.test(none.hub ?? "") && /your workspace/i.test(none.text) && none.overlaps === 0, `integrations: without a name it falls back to "your workspace" ${JSON.stringify(none.hub)}`);
  // Private only: the share dialog, its preview and its link never carry the workspace name.
  await viewport("desktop");
  await go("/preview/full?card=integrations&services=3", { reduced: true });
  await evaluate(`document.querySelector('[aria-label^="Share this card"]').click()`);
  await sleep(1500);
  const shared = await evaluate(`(() => { const d = document.querySelector("dialog[open]"); if (!d) return null; return [d.innerText, ...[...d.querySelectorAll("input,textarea")].map((e) => e.value), ...[...d.querySelectorAll("a[href],img[src]")].map((e) => e.href ?? e.src)].join("\\n"); })()`);
  check(shared !== null && !/acme/i.test(shared), `integrations: the share dialog, link and preview do not name the workspace (${shared === null ? "dialog did not open" : "checked " + shared.length + " chars"})`);
}

/** The final card shows the print-out and every number side by side when wide, stacked when narrow. */
async function summary() {
  for (const name of ["desktop", "laptop", "phone", "phone-small", "phone-landscape", "zoom200"]) {
    await viewport(name);
    await go("/preview/full?card=summary", { reduced: true });
    const r = await evaluate(`(() => {
      const lay = document.querySelector("[data-summary-layout]"), pr = document.querySelector("[data-print]").getBoundingClientRect(), fit = document.querySelector("[data-fit-scale]").getBoundingClientRect();
      const nums = [...document.querySelectorAll("dl")].find((d) => /issues closed/i.test(d.innerText)), nr = nums?.getBoundingClientRect(), det = document.querySelector("details");
      const shown = !!nums && nr.width > 0 && nr.height > 0 && getComputedStyle(nums).visibility !== "hidden" && (!det || det.open);
      return { mode: lay?.dataset.summaryLayout, details: !!det, open: det?.open ?? null, shown, side: !!nr && pr.right <= nr.left + 1 && Math.min(pr.bottom, nr.bottom) > Math.max(pr.top, nr.top), overlap: !!nr && pr.left < nr.right && nr.left < pr.right && pr.top < nr.bottom && nr.top < pr.bottom, inFit: [pr, nr].filter(Boolean).every((b) => b.left >= fit.left - 1 && b.right <= fit.right + 1 && b.top >= fit.top - 1 && b.bottom <= fit.bottom + 1), overflow: document.querySelector("[data-fit-scale]").hasAttribute("data-fit-overflow"), heading: !!document.querySelector("#all-numbers") };
    })()`);
    if (VIEWPORTS[name][0] >= 900) check(r.mode === "side" && !r.details && r.shown && r.side && !r.overlap && r.inFit && !r.overflow && r.heading, `summary ${name}: print-out and All your numbers are side by side by default, no disclosure ${JSON.stringify(r)}`);
    else check(r.mode === "stack" && r.details && !r.overlap && r.inFit && !r.overflow, `summary ${name}: narrow screens stack them, numbers behind a disclosure, nothing overlapping or clipped ${JSON.stringify(r)}`);
    if (["desktop", "phone", "phone-landscape"].includes(name)) await shot(`summary-${name}`);
  }
}

const dockInfo = `(() => {
  const dock = document.querySelector(".dock-pill"), fit = document.querySelector("[data-fit-scale]");
  const d = dock.getBoundingClientRect(), f = fit.getBoundingClientRect();
  const btns = [...dock.querySelectorAll("button")].map((b) => { const r = b.getBoundingClientRect(); return { label: b.getAttribute("aria-label"), w: r.width, h: r.height, disabled: b.disabled }; });
  return { inView: d.left >= 0 && d.right <= innerWidth && d.bottom <= innerHeight, clear: d.top >= f.bottom - 1, h: d.height, btns, safe: getComputedStyle(dock.parentElement).paddingBottom };
})()`;

async function dock() {
  for (const name of Object.keys(VIEWPORTS)) {
    await viewport(name);
    await go("/preview/full?card=intro", { reduced: true });
    let d = await evaluate(dockInfo);
    const min = VIEWPORTS[name][1] <= 520 ? 36 : 44;
    check(d.inView && d.clear, `dock ${name}: compact, fully on screen and below the card, not covering it (height ${d.h | 0}px)`);
    check(d.btns.every((b) => b.w >= min - 0.5 && b.h >= min - 0.5), `dock ${name}: every control is at least ${min}px (${d.btns.map((b) => `${b.label}:${b.w | 0}`).join(", ")})`);
    check(d.btns.find((b) => /previous/i.test(b.label))?.disabled && !d.btns.find((b) => /next/i.test(b.label))?.disabled, `dock ${name}: Prev disabled on the first card, Next enabled`);
    if (["desktop", "phone", "phone-landscape"].includes(name)) await shot(`dock-${name}`);
    await go("/preview/full?card=summary", { reduced: true });
    d = await evaluate(dockInfo);
    check(!d.btns.find((b) => /previous/i.test(b.label))?.disabled && d.btns.find((b) => /next/i.test(b.label))?.disabled, `dock ${name}: Next disabled on the last card, Prev enabled`);
    check(d.inView && d.clear, `dock ${name}: summary card clear of the dock`);
  }
  // Keyboard focus + tooltip.
  await viewport("desktop");
  await go("/preview/full?card=peak", { reduced: true });
  for (let i = 0; i < 40; i++) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    if (await evaluate(`document.activeElement?.getAttribute("aria-label") === "Next card"`)) break;
  }
  const f = await evaluate(`(() => { const e = document.activeElement, s = getComputedStyle(e), t = getComputedStyle(e, "::after"); return { label: e.getAttribute("aria-label"), outline: s.outlineStyle + " " + s.outlineColor, tip: t.content, tipOpacity: t.opacity }; })()`);
  check(f.label === "Next card" && /solid/.test(f.outline) && !/255, 180, 58/.test(f.outline), `dock: keyboard focus ring is lavender and visible (${f.outline})`);
  check(/Next/.test(f.tip) && f.tipOpacity === "1", `dock: the tooltip shows on keyboard focus (${f.tip})`);
  await shot("dock-focus-tooltip");
}

const FS_STUB = (mode) => `(() => {
  window.__fs = { requests: 0, exits: 0 };
  const mode = ${JSON.stringify(mode)};
  let current = null;
  const set = (v) => { current = v; document.dispatchEvent(new Event("fullscreenchange")); };
  Object.defineProperty(document, "fullscreenElement", { get: () => current, configurable: true });
  window.__esc = () => set(null);
  if (mode === "unsupported") {
    Object.defineProperty(document, "fullscreenEnabled", { value: false, configurable: true });
    Element.prototype.requestFullscreen = undefined;
    return;
  }
  Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
  Element.prototype.requestFullscreen = function () {
    window.__fs.requests++;
    if (mode === "rejected") return Promise.reject(new TypeError("Permissions check failed"));
    set(this);
    return Promise.resolve();
  };
  document.exitFullscreen = () => { window.__fs.exits++; set(null); return Promise.resolve(); };
})()`;

async function fullscreen() {
  const run = async (mode, path, fn) => {
    const { identifier } = await send("Page.addScriptToEvaluateOnNewDocument", { source: FS_STUB(mode) });
    await viewport("desktop");
    await go(path, { reduced: true });
    await fn();
    await send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  };
  const fsBtn = `document.querySelector('.dock-pill button[aria-label="Full screen"]')`;
  const exitBtn = `document.querySelector('button[aria-label="Exit full screen"]')`;

  await run("supported", "/preview/full?card=intro", async () => {
    check(await evaluate(`!!${fsBtn}`), "fullscreen supported: the dock offers a Full screen control");
    check(await evaluate(`${fsBtn}.getAttribute("aria-pressed") === "false" && !${exitBtn}`), "fullscreen supported: starts out of full screen, no X");
    await evaluate(`${fsBtn}.click()`);
    await sleep(200);
    check(await evaluate(`window.__fs.requests === 1 && ${fsBtn}.getAttribute("aria-pressed") === "true" && !!${exitBtn}`), "fullscreen supported: the click enters full screen and a visible X appears");
    const vis = await evaluate(`(() => { const r = ${exitBtn}.getBoundingClientRect(); return r.width >= 36 && r.right <= innerWidth && r.top >= 0 && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === ${exitBtn} || ${exitBtn}.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); })()`);
    check(vis, "fullscreen supported: the X is on screen, big enough, and not covered");
    await shot("fullscreen-active");
    await evaluate(`${exitBtn}.click()`);
    await sleep(200);
    check(await evaluate(`window.__fs.exits === 1 && !${exitBtn} && ${fsBtn}.getAttribute("aria-pressed") === "false"`), "fullscreen: the X exits and the controls update");
    await evaluate(`${fsBtn}.click()`);
    await sleep(150);
    await evaluate(`window.__esc()`);
    await sleep(300);
    check(await evaluate(`window.__fs.requests === 2 && !${exitBtn} && ${fsBtn}.getAttribute("aria-pressed") === "false"`), "fullscreen: Esc (the browser's own exit, simulated with fullscreenchange) leaves it out and nothing re-enters");
    // Not trapped: navigation still works while/after.
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
    await sleep(150);
    check(await evaluate(`document.querySelector("section[aria-label]").getAttribute("aria-label") === "Issues closed"`), "fullscreen: the story keeps working (not trapped)");
  });

  await run("rejected", "/preview/full?card=intro", async () => {
    await evaluate(`${fsBtn}.click()`);
    await sleep(300);
    const r = await evaluate(`({ req: window.__fs.requests, pressed: ${fsBtn}.getAttribute("aria-pressed"), note: document.querySelector("[role=status].dock-note")?.textContent, x: !!${exitBtn}, alert: typeof window.__alerts })`);
    check(r.req === 1 && r.pressed === "false" && !r.x && /blocked full screen/i.test(r.note ?? ""), `fullscreen rejected: honest inline notice, no fake fullscreen, no X ${JSON.stringify(r)}`);
    await shot("fullscreen-rejected");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
    await sleep(150);
    check(await evaluate(`document.querySelector("section[aria-label]").getAttribute("aria-label") === "Issues closed"`), "fullscreen rejected: the recap still works in the window");
  });

  await run("unsupported", "/preview/full?card=intro", async () => {
    check(await evaluate(`!${fsBtn} && !!document.querySelector(".dock-pill")`), "fullscreen unsupported (e.g. iPhone Safari): no Full screen control is shown, the dock still works");
  });

  await run("supported", "/preview/full?gate=1", async () => {
    const g = await evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return { open: !!d, focus: document.activeElement?.textContent, title: d?.querySelector("h2")?.textContent }; })()`);
    check(g.open && /Enter recap in full screen/.test(g.focus ?? "") && g.title === "Your recap is ready", `enter screen: dialog with the primary action focused ${JSON.stringify(g)}`);
    await shot("enter-recap");
    const gate = await evaluate(`(() => { const t = document.body.innerText, g = document.querySelector("[data-enter-gate]"), c = getComputedStyle(g).backgroundColor, h = document.documentElement.innerHTML; return { t, bg: c, covers: g.getBoundingClientRect().width >= innerWidth && g.getBoundingClientRect().height >= innerHeight, story: !!document.querySelector("[data-fit-scale], .story-crt, section[aria-label], dl, [data-print], .dock-pill, nav[aria-label='Story progress']"), leak: /Alan|Acme|Apollo|issues closed|closed/i.test(t), leakHtml: /Acme|Apollo/.test(h.replace(/<script[\s\S]*?<\/script>/g, "")) }; })()`);
    check(gate.bg === "rgb(10, 9, 18)" && gate.covers && !gate.story && !gate.leak && !gate.leakHtml, `enter screen: an opaque neutral backdrop, and no recap content in the DOM or on screen behind it ${JSON.stringify({ bg: gate.bg, covers: gate.covers, story: gate.story, leak: gate.leak, leakHtml: gate.leakHtml })}`);
    await evaluate(`[...document.querySelectorAll("[role=dialog] button")].find((b) => /enter recap/i.test(b.textContent)).click()`);
    await sleep(300);
    check(await evaluate(`window.__fs.requests === 1 && !document.querySelector("[role=dialog]") && !!${exitBtn}`), "enter screen: 'Enter recap' requests full screen from that click and starts the story");
  });
  await run("supported", "/preview/full?gate=1", async () => {
    await evaluate(`[...document.querySelectorAll("[role=dialog] button")].find((b) => /continue in this window/i.test(b.textContent)).click()`);
    await sleep(200);
    check(await evaluate(`window.__fs.requests === 0 && !document.querySelector("[role=dialog]")`), "enter screen: 'Continue in this window' never asks the browser");
  });
  await run("supported", "/preview/full?gate=1", async () => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(200);
    check(await evaluate(`window.__fs.requests === 0 && !document.querySelector("[role=dialog]")`), "enter screen: Esc continues in the window without requesting full screen");
  });
  await run("unsupported", "/preview/full?gate=1", async () => {
    const t = await evaluate(`[...document.querySelectorAll("[role=dialog] button")].map((b) => b.textContent)`);
    check(t.length === 1 && t[0] === "Enter recap", `enter screen unsupported: a single honest 'Enter recap' (${JSON.stringify(t)})`);
  });
}

const ARCHETYPES = { "early-bird": "Early Bird", "friday-shipper": "Friday Shipper", "weekend-warrior": "Weekend Warrior", "steady-builder": "Steady Builder", "night-owl": "Night Owl" };

async function art() {
  for (const name of ["desktop", "phone", "phone-landscape"]) {
    await viewport(name);
    for (const [id, title] of Object.entries(ARCHETYPES)) {
      for (const card of ["archetype", "summary"]) {
        await go(`/preview/full?card=${card}&archetype=${id}`, { reduced: true });
        await sleep(500);
        const r = await evaluate(`(() => {
          const root = document.querySelector("section[aria-label]");
          const img = root.querySelector('img[src*="/archetypes/"]');
          if (!img) return { found: false };
          const b = img.getBoundingClientRect(), o = document.querySelector("[data-fit-scale]").getBoundingClientRect();
          const text = [...root.querySelectorAll("h2, p, dd, dt")].filter((e) => e.getBoundingClientRect().height > 0 && !e.classList.contains("sr-only"));
          const overlap = text.filter((e) => { const r = e.getBoundingClientRect(); return !e.contains(img) && r.left < b.right - 1 && b.left < r.right - 1 && r.top < b.bottom - 1 && b.top < r.bottom - 1; }).map((e) => e.textContent.slice(0, 20));
          return { found: true, src: img.getAttribute("src"), loaded: img.complete && img.naturalWidth === 720 && img.naturalHeight === 720, alt: img.alt, w: b.width | 0, h: b.height | 0, square: Math.abs(b.width - b.height) < 1, fit: getComputedStyle(img).objectFit, inside: b.left >= o.left - 1 && b.right <= o.right + 1 && b.top >= o.top - 1 && b.bottom <= o.bottom + 1, overlap };
        })()`);
        check(r.found && r.src === `/archetypes/${id}.webp` && r.loaded && r.alt.includes(title) && r.square && r.fit === "contain" && r.inside && r.overlap.length === 0, `art ${name} ${card} ${id}: right file, loaded at 720px, whole (contain), square, alt names it, inside the card, no text overlap ${JSON.stringify(r)}`);
        if (name !== "phone-landscape" && id === "night-owl") await shot(`art-${card}-${id}-${name}`);
        if (name === "desktop") await shot(`art-${card}-${id}`);
      }
    }
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

const rectOf = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, op: getComputedStyle(e).opacity }; })()`;
const inside = (r) => r && r.l >= 0 && r.t >= 0 && r.r <= VIEW.w && r.b <= VIEW.h;
let VIEW = { w: 0, h: 0 };

/** Sign out in the top bar, the full-screen X, the halftone and the print-out's share button, on the final card. */
async function recapui() {
  const { identifier } = await send("Page.addScriptToEvaluateOnNewDocument", { source: FS_STUB("ok") });
  for (const name of ["desktop", "phone", "phone-landscape", "phone-landscape-short"]) {
    await viewport(name);
    VIEW = { w: VIEWPORTS[name][0], h: VIEWPORTS[name][1] };
    const min = VIEW.h <= 520 ? 36 : 44;
    await go("/preview/full?card=peak", { reduced: true });
    check(await evaluate(`!document.querySelector(".story-signout") && !/sign out/i.test(document.querySelector("[role=group]").innerText)`), `recap ${name}: no Sign out on other cards`);
    await go("/preview/full?card=summary", { reduced: true });
    const gone = await evaluate(`[...document.querySelectorAll("button")].filter((b) => /sign out/i.test(b.textContent) && !b.classList.contains("story-signout")).length`);
    check(gone === 0, `recap ${name}: the big Sign out button is gone from the final card`);
    const halftone = await evaluate(`(() => { const h = document.querySelector(".story-halftone"), s = getComputedStyle(h); return { events: s.pointerEvents, bg: s.backgroundImage.includes("radial-gradient"), mask: (s.maskImage || s.webkitMaskImage || "").includes("radial"), anim: s.animationName, hidden: h.getAttribute("aria-hidden") }; })()`);
    check(halftone.events === "none" && halftone.bg && halftone.mask && halftone.anim === "none" && halftone.hidden === "true", `recap ${name}: halftone texture is a static, masked, click-through layer ${JSON.stringify(halftone)}`);
    // Not full screen: sign out sits at the top right, fully visible and big enough.
    let so = await evaluate(rectOf(".story-signout"));
    check(inside(so) && so.h >= min - 0.5 && so.w >= 44 && so.r > VIEW.w * 0.6 && so.t < 60, `recap ${name}: Sign out is a discreet top-right control (${JSON.stringify(so)})`);
    // Full screen: the X joins it, with no overlap, both whole and at least the minimum size.
    await evaluate(`document.querySelector('.dock-pill button[aria-label="Full screen"]').click()`);
    await sleep(300);
    so = await evaluate(rectOf(".story-signout"));
    const x = await evaluate(rectOf(".story-exit"));
    const apart = x && so && (x.l >= so.r || so.l >= x.r || x.t >= so.b || so.t >= x.b);
    check(inside(x) && inside(so) && apart, `recap ${name}: full-screen X and Sign out are both fully visible and do not touch (X ${JSON.stringify(x)}, Sign out ${JSON.stringify(so)})`);
    check(x && x.w >= min - 0.5 && x.h >= min - 0.5 && so.h >= min - 0.5, `recap ${name}: both targets are at least ${min}px`);
    await shot(`recapui-${name}`);
    await evaluate(`window.__esc()`);
    await sleep(200);

    // The print-out's share button: hidden at rest on a hover screen, shown on hover and on focus; shown always on touch.
    const hoverNone = await evaluate(`matchMedia("(hover: none)").matches`);
    const pr = await evaluate(rectOf("[data-print]"));
    const btn = await evaluate(rectOf(".print-share"));
    const fitScale = Number(await evaluate(`document.querySelector("[data-fit-scale]").getAttribute("data-fit-scale")`)) || 1;
    check(btn && btn.w >= 44 * fitScale - 0.5 && btn.h >= min * fitScale - 0.5 && btn.l >= pr.l && btn.r <= pr.r + 1 && inside(btn) && btn.t < pr.t + btn.h, `recap ${name}: the print-out's share button is a whole, on-screen, big enough target straddling the sheet top (card scale ${fitScale}) (${JSON.stringify(btn)} sheet ${JSON.stringify(pr)})`);
    if (hoverNone) {
      check(btn.op === "1", `recap ${name}: on a touch screen the share button is always visible`);
    } else {
      await mouse("mouseMoved", 5, VIEW.h - 5);
      await sleep(250);
      check((await evaluate(rectOf(".print-share"))).op === "0", `recap ${name}: share button is hidden until hover or focus`);
      await mouse("mouseMoved", pr.l + pr.w / 2, pr.t + pr.h / 2);
      await sleep(300);
      check((await evaluate(rectOf(".print-share"))).op === "1", `recap ${name}: hovering the print-out reveals the share button`);
      await shot(`recapui-hover-${name}`);
      await mouse("mouseMoved", 5, VIEW.h - 5);
      await sleep(250);
      await evaluate(`document.querySelector(".print-share").focus()`);
      await sleep(250);
      const f = await evaluate(`(() => { const b = document.querySelector(".print-share"), s = getComputedStyle(b); return { op: s.opacity, outline: s.outlineStyle + " " + s.outlineWidth }; })()`);
      check(f.op === "1" && /solid 2px/.test(f.outline), `recap ${name}: keyboard focus reveals it with a visible focus ring (${JSON.stringify(f)})`);
    }
    // It opens the same share dialog and does not turn the page.
    await evaluate(`window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; };
      window.__dl = []; const click = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dl.push(this.download); else click.call(this); };
      const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
      const orig = window.fetch.bind(window);
      window.fetch = async (u, o) => { const s = String(u);
        if (s.includes("/api/wrapped/share")) return new Response(JSON.stringify({ path: "/s/tok", storyImagePath: "/s/tok/image?f=story&r=ht1", wideImagePath: "/s/tok/image?f=og&r=ht1", text: "My Linear Wrapped", alt: "alt", reveals: ["a number"], sensitive: false, filename: "lw-test" }), { status: 200, headers: { "content-type": "application/json" } });
        if (s.includes("/image?")) return new Response(new Blob([png], { type: "image/png" }), { status: 200, headers: { "content-type": "image/png" } });
        return orig(u, o); };
      navigator.canShare = () => true; navigator.share = async (d) => { window.__shared = { files: d.files.length, type: d.files[0]?.type, url: d.url, text: d.text }; };`);
    const before = await evaluate(`document.querySelector("[aria-live=polite]").textContent`);
    await evaluate(`document.querySelector(".print-share").focus(); document.querySelector(".print-share").click()`);
    await sleep(900);
    const dlg = await evaluate(`(() => { const d = document.querySelector("dialog[open]"); return { open: !!d, labels: d ? [...d.querySelectorAll("button")].map((b) => b.textContent.trim()) : [], note: d?.innerText.includes("can't attach an image") }; })()`);
    check(dlg.open && dlg.labels.includes("Share link on X") && dlg.labels.includes("Save image + open X") && dlg.labels.includes("Share image…") && dlg.note, `recap ${name}: the print-out's button opens the share dialog with honest X wording and a native share button ${JSON.stringify(dlg.labels)}`);
    check((await evaluate(`document.querySelector("[aria-live=polite]").textContent`)) === before, `recap ${name}: opening it does not turn the card`);
    const click = (label) => evaluate(`[...document.querySelectorAll("dialog button")].find((b) => b.textContent.trim() === ${JSON.stringify(label)}).click()`);
    await click("Share link on X");
    await click("Save image + open X");
    await sleep(600);
    await click("Share image…");
    await sleep(300);
    const out = await evaluate(`({ opened: window.__opened, dl: window.__dl, shared: window.__shared })`);
    const intent = new URL(out.opened[0] ?? "http://none/");
    check(out.opened.length === 2 && intent.origin === "https://x.com" && intent.pathname === "/intent/tweet" && intent.searchParams.get("url")?.endsWith("/s/tok") && ![...intent.searchParams.keys()].some((k) => /media|image|token|key/i.test(k)), `recap ${name}: X intent carries only the text and the public card link (${out.opened[0]})`);
    check(out.dl.length === 1 && /og\.png$/.test(out.dl[0]), `recap ${name}: "Save image + open X" saves the wide PNG (${out.dl})`);
    check(out.shared?.files === 1 && out.shared.type === "image/png" && out.shared.url?.endsWith("/s/tok"), `recap ${name}: native share gets the PNG file plus the link (${JSON.stringify(out.shared)})`);
    await evaluate(`document.querySelector("dialog").close()`);
    await sleep(200);
    check(await evaluate(`document.activeElement?.classList.contains("print-share")`), `recap ${name}: closing the dialog returns focus to the print-out's share button`);
  }
  await send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
}

async function print() {
  for (const fixture of ["full", "sparse", "zero", "long"]) {
    for (const name of ["desktop", "phone", "phone-small", "phone-landscape", "phone-landscape-short"]) {
      await viewport(name);
      await go(`/preview/${fixture}?card=summary`, { reduced: true });
      await sleep(500);
      const r = await evaluate(`(() => {
        const sheet = document.querySelector("[data-print]"), box = sheet.getBoundingClientRect();
        const fit = document.querySelector("[data-fit-scale]").getBoundingClientRect();
        const inner = sheet.firstElementChild;
        const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const items = [...inner.querySelectorAll("p:not(.sr-only), img, div[aria-hidden]")].filter((e) => vis(e) && !(e.tagName === "DIV" && !e.querySelector("svg path")) || e.tagName === "IMG" || e.tagName === "P" && vis(e)).filter((e) => !e.matches(".sr-only") && !(e.tagName === "DIV" && e.style.top === "37%"));
        const dots = items.filter((e) => e.tagName === "DIV" && e.querySelector("svg path") && e.getBoundingClientRect().width > 0);
        const named = items.filter((e) => e.tagName !== "DIV" || dots.includes(e));
        const rects = named.map((e) => ({ e, r: e.getBoundingClientRect() }));
        const sep = rects.filter((a) => !(a.e.tagName === "DIV" && a.r.height < 8 || a.e.tagName === "DIV" && a.r.width < 8));
        const overlap = [];
        sep.forEach((a, i) => sep.forEach((b, j) => { if (j > i && a.r.left < b.r.right - 1.5 && b.r.left < a.r.right - 1.5 && a.r.top < b.r.bottom - 1.5 && b.r.top < a.r.bottom - 1.5) overlap.push((a.e.textContent || a.e.tagName).slice(0, 18) + " x " + (b.e.textContent || b.e.tagName).slice(0, 18)); }));
        const outside = sep.filter((a) => a.r.left < box.left - 1 || a.r.right > box.right + 1 || a.r.top < box.top - 1 || a.r.bottom > box.bottom + 1).length;
        const cut = [...inner.querySelectorAll("p:not(.sr-only)")].filter((e) => !e.classList.contains("truncate") && (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2)).map((e) => e.textContent.slice(0, 20));
        const text = sheet.innerText;
        return { overlap, outside, cut, inFit: box.left >= fit.left - 1 && box.right <= fit.right + 1 && box.top >= fit.top - 1 && box.bottom <= fit.bottom + 1, w: box.width | 0, h: box.height | 0, name: /NAME:\s*(.*)/.exec(text)?.[1], hasSample: /AARON|QUINN/i.test(text), floppy: /floppy|foil/i.test(document.body.innerText), stats: [...sheet.querySelectorAll("p.sr-only")].map((p) => p.textContent) };
      })()`);
      check(r.overlap.length === 0 && r.outside === 0 && r.cut.length === 0 && r.inFit && !r.hasSample && !r.floppy, `print-out ${fixture} ${name}: no collisions, nothing outside the sheet or cut, sheet whole inside the card area, no sample or floppy text ${JSON.stringify(r)}`);
      await shot(`print-${fixture}-${name}`);
    }
  }
}

try {
  const all = which === "all";
  if (all || which === "landing") await landing();
  if (all || which === "boot") await boot();
  if (all || which === "dust") await dust();
  if (all || which === "moth") await moth();
  if (all || which === "drag") await drag();
  if (all || which === "drop") await drop();
  if (all || which === "integrations") await integrations();
  if (all || which === "summary") await summary();
  if (all || which === "story") for (const f of (process.env.FIXTURES ?? "full,sparse,zero,long").split(",")) await story(f);
  if (all || which === "print" || which === "disk") await print();
  if (all || which === "dock") await dock();
  if (all || which === "fullscreen") await fullscreen();
  if (all || which === "art") await art();
  if (all || which === "recapui") await recapui();
} finally {
  ws.close();
  chrome.kill();
}
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
