"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import type { CardId } from "@/lib/recap";
import type { ShareLink } from "@/lib/share/link";
import { previewReducer, previewSrc, type PreviewState } from "@/lib/share/preview";

type Link = ShareLink & { url: string; storyImageUrl: string; wideImageUrl: string };
type Load = { status: "loading" } | { status: "ready"; link: Link } | { status: "error"; message: string };
type Notice = { ok: boolean; text: string };

const ERRORS: Record<number, string> = {
  401: "Your session expired. Sign in again to share.",
  429: "Linear is rate limiting us. Try again in a minute.",
};

// Compact controls, deliberately plain: no glow, one thin border.
const primary = "inline-flex min-h-10 flex-1 items-center justify-center bg-ph px-3 text-base uppercase tracking-wide text-screen hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";
const secondary = "inline-flex min-h-9 items-center justify-center border border-ph/50 px-3 text-base uppercase tracking-wide text-ph hover:border-ph hover:bg-ph/10 disabled:cursor-not-allowed disabled:opacity-40";
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber";

/**
 * Modal share panel for one card. Nothing is created until it opens, nothing
 * is posted anywhere (X opens its own composer for the user to review; it can't be given an image file), and
 * the link and image shown are exactly what recipients will get.
 */
export function ShareDialog({ card, title, onClose }: { card: CardId; title: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [ack, setAck] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [preview, dispatchPreview] = useReducer(previewReducer, "loading" as PreviewState);
  // Bumped by "Retry" to mount a fresh <img> for the same URL.
  const [previewTry, setPreviewTry] = useState(0);
  // The wide PNG as a file, fetched ahead so the system share sheet can open straight from the click (browsers drop the click's permission while a download is awaited). Only kept when this browser can share files.
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/wrapped/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card }),
          signal: abort.signal,
        });
        if (!res.ok) return setLoad({ status: "error", message: ERRORS[res.status] ?? "Couldn't create a share link. Try again." });
        const link = (await res.json()) as ShareLink;
        const origin = window.location.origin;
        setLoad({ status: "ready", link: { ...link, url: origin + link.path, storyImageUrl: link.storyImagePath, wideImageUrl: link.wideImagePath } });
      } catch {
        if (!abort.signal.aborted) setLoad({ status: "error", message: "Couldn't reach the server. Check your connection and try again." });
      }
    })();
    return () => abort.abort();
  }, [card, attempt]);

  const link = load.status === "ready" ? load.link : null;

  useEffect(() => {
    if (!link || typeof navigator === "undefined" || typeof navigator.canShare !== "function") return;
    const abort = new AbortController();
    (async () => {
      try {
        const res = await fetch(link.wideImagePath, { signal: abort.signal });
        if (!res.ok || !res.headers.get("content-type")?.startsWith("image/png")) return;
        const png = new File([await res.blob()], `${link.filename}.png`, { type: "image/png" });
        if (navigator.canShare({ files: [png] })) setFile(png);
      } catch {
        // No file sharing: the other buttons still work.
      }
    })();
    return () => abort.abort();
  }, [link]);

  const canShare = !!link && (!link.sensitive || ack);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setNotice({ ok: true, text: "Link copied." });
    } catch {
      field.current?.select();
      setNotice({ ok: false, text: "Couldn't copy automatically. The link is selected: press Ctrl/⌘+C." });
    }
  };

  const openX = () => {
    if (!link) return;
    const intent = new URL("https://x.com/intent/tweet");
    intent.searchParams.set("text", link.text);
    intent.searchParams.set("url", link.url);
    window.open(intent.toString(), "_blank", "noopener,noreferrer");
  };

  // X's web composer takes text and a link, never an image file: the link's card shows the picture as its preview.
  const postToX = () => {
    openX();
    setNotice({ ok: true, text: "Opened X in a new tab with your text and link. X shows the card's image as the link preview. Nothing is posted until you press Post there." });
  };

  // For people who want the PNG itself in the post: open the composer now (while the click still counts), and save the image to attach there.
  const saveAndPostToX = async () => {
    openX();
    if (await download("og")) setNotice({ ok: true, text: "Image saved and X opened. To attach it, use the image button in X's composer: X can't attach files for us. Nothing is posted until you press Post." });
  };

  const nativeShare = async () => {
    if (!link || !file) return;
    try {
      await navigator.share({ files: [file], text: link.text, url: link.url });
      setNotice({ ok: true, text: "Shared. Which apps accept the image depends on your device." });
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setNotice({ ok: false, text: "Couldn't open the share sheet. Use Copy link or Download image." });
    }
  };

  const download = async (format: "story" | "og"): Promise<boolean> => {
    if (!link) return false;
    try {
      const res = await fetch(`${format === "story" ? link.storyImagePath : link.wideImagePath}&download=1`);
      if (!res.ok || !res.headers.get("content-type")?.startsWith("image/png")) throw new Error("bad response");
      const href = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = href;
      a.download = `${link.filename}-${format}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      setNotice({ ok: true, text: "Download started." });
      return true;
    } catch {
      setNotice({ ok: false, text: "Couldn't download the image. Try again." });
      return false;
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="share-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      // Keep taps and swipes inside the panel from navigating the story underneath.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      // Native modal <dialog>: focus is trapped, Esc closes it and focus returns to the opener. The height cap leaves room for the notch and home bar; only the body scrolls.
      style={{ maxHeight: "calc(100dvh - 1rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))" }}
      className="m-auto flex w-[min(94vw,28rem)] select-text flex-col overflow-hidden border border-ph/40 bg-screen p-0 text-ph backdrop:bg-black/80"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ph/20 px-4 py-2">
        <h2 id="share-title" className="min-w-0 truncate text-lg uppercase tracking-wide text-amber">
          Share “{title}”
        </h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close share panel" className={`${secondary} !min-h-8 !px-2.5 ${focusRing}`}>
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        {load.status === "error" && (
          <div role="alert" className="mb-3 border border-amber p-3 text-base text-amber">
            <p>{load.message}</p>
            <button type="button" onClick={() => { setLoad({ status: "loading" }); setAttempt((n) => n + 1); }} className={`${secondary} mt-2 ${focusRing}`}>
              Try again
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <div className="relative aspect-[9/16] h-[min(34dvh,16rem)] shrink-0 overflow-hidden border border-ph/30 bg-ph/5">
            {link && preview !== "error" && (
              // Same-origin PNG, the exact versioned image recipients get.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={previewTry}
                src={previewSrc(link)}
                alt={link.alt}
                onLoad={() => dispatchPreview("load")}
                onError={() => dispatchPreview("error")}
                className={`h-full w-full object-contain transition-opacity duration-200 ${preview === "loaded" ? "opacity-100" : "opacity-0"}`}
              />
            )}
            {preview === "error" && link && (
              <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center text-sm text-amber">
                <p>Preview didn&apos;t load.</p>
                <button type="button" onClick={() => { dispatchPreview("retry"); setPreviewTry((n) => n + 1); }} className={`${secondary} !min-h-8 !px-2 !text-sm ${focusRing}`}>
                  Retry
                </button>
              </div>
            )}
            {preview === "loading" && (
              <p role="status" className="absolute inset-0 flex items-center justify-center p-2 text-center text-sm text-ph/70">
                {load.status === "error" ? "" : load.status === "loading" ? "Preparing…" : "Rendering preview…"}
              </p>
            )}
          </div>

          <div className="min-w-0 flex-1 text-base">
            <p className="text-ph/90">Anyone with the link can see this one card. No sign-in needed; your other cards stay private.</p>
            <details className="mt-2 text-sm text-ph/80">
              <summary className={`cursor-pointer select-none text-ph ${focusRing}`}>What gets shared</summary>
              <section aria-labelledby="share-reveals" className="mt-1">
                <h3 id="share-reveals" className="sr-only">
                  Anyone with the link will see
                </h3>
                {link ? (
                  <ul className="list-disc space-y-0.5 pl-4 [overflow-wrap:anywhere]">
                    {link.reveals.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{load.status === "loading" ? "Preparing…" : "Unavailable."}</p>
                )}
                <p className="mt-2">We store nothing: the card&apos;s data lives inside the link, so we can&apos;t take it back once it&apos;s shared.</p>
              </section>
            </details>
          </div>
        </div>

        {/* Names are listed and need a tick before any share action works or the link is shown. */}
        {link?.sensitive && (
          <>
            <div className="mt-3 border border-amber p-2.5 text-sm text-amber">
              <p className="uppercase tracking-wide">Names in this card</p>
              <ul className="mt-1 list-disc pl-4 text-ph [overflow-wrap:anywhere]">
                {link.reveals.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <label className="mt-2 flex items-start gap-2 text-base text-amber">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-amber" />
              <span>This includes names from your workspace (listed above). I&apos;m okay making them public.</span>
            </label>
          </>
        )}

        <div className="mt-3 flex gap-2">
          <button type="button" onClick={copy} disabled={!canShare} className={`${primary} ${focusRing}`}>
            Copy link
          </button>
          <button type="button" onClick={() => download("story")} disabled={!canShare} className={`${primary} ${focusRing}`}>
            Download
          </button>
        </div>
        {link?.sensitive && !ack && <p className="mt-1.5 text-sm text-amber">Tick the box above to enable sharing.</p>}

        <details className="mt-2 text-sm">
          <summary className={`cursor-pointer select-none text-ph/80 hover:text-ph ${focusRing}`}>More ways to share</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={postToX} disabled={!canShare} className={`${secondary} ${focusRing}`}>
              Share link on X
            </button>
            <button type="button" onClick={() => void saveAndPostToX()} disabled={!canShare} className={`${secondary} ${focusRing}`}>
              Save image + open X
            </button>
            {file && (
              <button type="button" onClick={() => void nativeShare()} disabled={!canShare} className={`${secondary} ${focusRing}`}>
                Share image…
              </button>
            )}
            <button type="button" onClick={() => download("og")} disabled={!canShare} className={`${secondary} ${focusRing}`}>
              Download wide image
            </button>
          </div>
          <p className="mt-2 text-ph/70">
            X&apos;s composer can&apos;t attach an image for us. “Share link on X” previews this card&apos;s image from the link; “Save image + open X” saves the PNG so you can attach it yourself.
          </p>
        </details>

        {link && canShare && (
          <input
            ref={field}
            readOnly
            value={link.url}
            aria-label="Share link"
            onFocus={(e) => e.currentTarget.select()}
            className="mt-3 w-full border border-ph/40 bg-black/40 px-2 py-1.5 text-sm text-ph"
          />
        )}

        <p role="status" aria-live="polite" className={`mt-2 min-h-5 text-base ${notice?.ok === false ? "text-amber" : "text-ph"}`}>
          {notice?.text}
        </p>
      </div>
    </dialog>
  );
}
