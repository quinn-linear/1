"use client";

import { useEffect, useRef, useState } from "react";
import type { CardId } from "@/lib/recap";
import type { ShareLink } from "@/lib/share/link";

type Link = ShareLink & { url: string; storyImageUrl: string; wideImageUrl: string };
type Load = { status: "loading" } | { status: "ready"; link: Link } | { status: "error"; message: string };
type Notice = { ok: boolean; text: string };

const ERRORS: Record<number, string> = {
  401: "Your session expired. Sign in again to share.",
  429: "Linear is rate limiting us. Try again in a minute.",
};

const button = "term-btn";

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
      className="m-auto max-h-[92dvh] w-[min(94vw,32rem)] select-text overflow-y-auto border-4 border-ph bg-screen p-5 text-ph phosphor backdrop:bg-black/80 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="share-title" className="text-2xl uppercase tracking-wide text-amber">
          Save “{title}”
        </h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close share panel" className={button}>
          ✕
        </button>
      </div>

      {load.status === "error" && (
        <div role="alert" className="panel mt-4 !border-amber p-4 text-lg text-amber">
          <p>{load.message}</p>
          <button type="button" onClick={() => { setLoad({ status: "loading" }); setAttempt((n) => n + 1); }} className={`${button} mt-3`}>
            Try again
          </button>
        </div>
      )}

      <div className="mt-4 flex gap-4">
        <div className="aspect-[9/16] w-24 shrink-0 overflow-hidden border-2 border-ph/60 bg-ph/10 sm:w-28">
          {link && (
            // Same-origin generated preview of exactly what gets shared.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={link.storyImageUrl} alt={link.alt} width={108} height={192} className="h-full w-full object-cover" />
          )}
        </div>
        <section aria-labelledby="share-reveals" className="min-w-0 text-lg">
          <h3 id="share-reveals" className="uppercase text-amber">
            Anyone with the link will see
          </h3>
          {link ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ph [overflow-wrap:anywhere]">
              {link.reveals.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-ph/80">{load.status === "loading" ? "Preparing…" : "Unavailable."}</p>
          )}
        </section>
      </div>

      <p className="mt-3 text-base text-ph/80">
        Only this card, and no sign-in is needed to view it. Your other cards stay private. We store nothing: the card&apos;s data lives inside the link, so we can&apos;t take it back once it&apos;s shared.
      </p>

      {link?.sensitive && (
        <label className="panel mt-3 flex items-start gap-2 !border-amber p-3 text-lg text-amber">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-amber" />
          <span>This includes names from your workspace (listed above). I&apos;m okay making them public.</span>
        </label>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={postToX} disabled={!canShare} className={`${button}`}>
          Share link on X
        </button>
        <button type="button" onClick={() => void saveAndPostToX()} disabled={!canShare} className={`${button}`}>
          Save image + open X
        </button>
        {file && (
          <button type="button" onClick={() => void nativeShare()} disabled={!canShare} className={`${button} col-span-2`}>
            Share image…
          </button>
        )}
        <button type="button" onClick={copy} disabled={!canShare} className={`${button}`}>
          Copy link
        </button>
        <button type="button" onClick={() => download("story")} disabled={!canShare} className={`${button}`}>
          Download image
        </button>
        <button type="button" onClick={() => download("og")} disabled={!canShare} className={`${button}`}>
          Download wide image
        </button>
      </div>
      <p className="mt-2 text-base text-ph/80">
        X&apos;s composer can&apos;t attach an image for us. “Share link on X” previews this card&apos;s image from the link; “Save image + open X” saves the PNG so you can attach it yourself.
      </p>
      {link?.sensitive && !ack && <p className="mt-2 text-base text-amber">Tick the box above to enable sharing.</p>}

      {link && (
        <input
          ref={field}
          readOnly
          value={link.url}
          aria-label="Share link"
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 w-full border-2 border-ph/50 bg-black/40 px-3 py-2 text-base text-ph"
        />
      )}

      <p role="status" aria-live="polite" className={`mt-3 min-h-6 text-lg ${notice?.ok === false ? "text-amber" : "text-ph"}`}>
        {notice?.text}
      </p>
    </dialog>
  );
}
