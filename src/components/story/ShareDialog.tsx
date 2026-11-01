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

const button =
  "rounded-full px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Modal share panel for one card. Nothing is created until it opens, nothing
 * is posted anywhere (X opens its own composer for the user to review), and
 * the link and image shown are exactly what recipients will get.
 */
export function ShareDialog({ card, title, onClose }: { card: CardId; title: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [ack, setAck] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

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

  const postToX = () => {
    if (!link) return;
    const intent = new URL("https://x.com/intent/tweet");
    intent.searchParams.set("text", link.text);
    intent.searchParams.set("url", link.url);
    window.open(intent.toString(), "_blank", "noopener,noreferrer");
    setNotice({ ok: true, text: "Opened X in a new tab. Nothing is posted until you press Post there." });
  };

  const download = async (format: "story" | "og") => {
    if (!link) return;
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
    } catch {
      setNotice({ ok: false, text: "Couldn't download the image. Try again." });
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
      className="m-auto max-h-[92dvh] w-[min(94vw,30rem)] select-text overflow-y-auto rounded-3xl bg-[#0d0e14] p-5 text-white shadow-[0_0_80px_-20px_rgba(139,92,246,0.6)] ring-1 ring-white/15 backdrop:bg-black/75 backdrop:backdrop-blur-sm sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="share-title" className="text-xl font-semibold tracking-tight">
          Share “{title}”
        </h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close share panel" className={`${button} bg-white/10 px-3 py-1.5 hover:bg-white/20`}>
          ✕
        </button>
      </div>

      {load.status === "error" && (
        <div role="alert" className="mt-4 rounded-2xl bg-red-500/15 p-4 text-sm font-medium text-red-100 ring-1 ring-red-400/40">
          <p>{load.message}</p>
          <button type="button" onClick={() => { setLoad({ status: "loading" }); setAttempt((n) => n + 1); }} className={`${button} mt-3 bg-white text-black`}>
            Try again
          </button>
        </div>
      )}

      <div className="mt-4 flex gap-4">
        <div className="aspect-[9/16] w-24 shrink-0 overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/20 sm:w-28">
          {link && (
            // Same-origin generated preview of exactly what gets shared.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={link.storyImageUrl} alt={link.alt} width={108} height={192} className="h-full w-full object-cover" />
          )}
        </div>
        <section aria-labelledby="share-reveals" className="min-w-0 text-sm">
          <h3 id="share-reveals" className="font-extrabold">
            Anyone with the link will see
          </h3>
          {link ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-white/85 [overflow-wrap:anywhere]">
              {link.reveals.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-white/70">{load.status === "loading" ? "Preparing…" : "Unavailable."}</p>
          )}
        </section>
      </div>

      <p className="mt-3 text-xs font-medium text-white/65">
        Only this card, and no sign-in is needed to view it. Your other cards stay private. We store nothing: the card&apos;s data lives inside the link, so we can&apos;t take it back once it&apos;s shared.
      </p>

      {link?.sensitive && (
        <label className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-400/15 p-3 text-sm font-semibold text-amber-100 ring-1 ring-amber-300/40">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-300" />
          <span>This includes names from your workspace (listed above). I&apos;m okay making them public.</span>
        </label>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={postToX} disabled={!canShare} className={`${button} bg-white text-black hover:bg-white/90`}>
          Share on X
        </button>
        <button type="button" onClick={copy} disabled={!canShare} className={`${button} glass hover:bg-white/10`}>
          Copy link
        </button>
        <button type="button" onClick={() => download("story")} disabled={!canShare} className={`${button} glass hover:bg-white/10`}>
          Download image
        </button>
        <button type="button" onClick={() => download("og")} disabled={!canShare} className={`${button} glass hover:bg-white/10`}>
          Download wide image
        </button>
      </div>
      {link?.sensitive && !ack && <p className="mt-2 text-xs font-medium text-amber-100/90">Tick the box above to enable sharing.</p>}

      {link && (
        <input
          ref={field}
          readOnly
          value={link.url}
          aria-label="Share link"
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 w-full rounded-xl bg-black/30 px-3 py-2 text-xs text-white/80 ring-1 ring-white/20"
        />
      )}

      <p role="status" aria-live="polite" className={`mt-3 min-h-5 text-sm font-semibold ${notice?.ok === false ? "text-red-200" : "text-emerald-200"}`}>
        {notice?.text}
      </p>
    </dialog>
  );
}
