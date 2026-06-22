"use client";

import { FormEvent, MouseEvent, useMemo, useState } from "react";
import { MessageSquare, Plus, X } from "lucide-react";
import { Button } from "@/components/button";
import { createAlbumReviewCommentAction } from "@/lib/album-review-actions";

type AlbumComment = {
  id: string;
  spreadId: string;
  x: number;
  y: number;
  text: string;
  createdAt: string;
};

type AlbumSpread = {
  id: string;
  title: string | null;
  filename: string;
  imageUrl: string;
  sortOrder: number;
  comments: AlbumComment[];
};

type DraftComment = {
  spreadId: string;
  x: number;
  y: number;
};

export function AlbumReviewBoard({
  token,
  spreads
}: {
  token: string;
  spreads: AlbumSpread[];
}) {
  const [comments, setComments] = useState<AlbumComment[]>(() => spreads.flatMap((spread) => spread.comments));
  const [draft, setDraft] = useState<DraftComment | null>(null);
  const [draftText, setDraftText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const commentsBySpread = useMemo(() => {
    const grouped = new Map<string, AlbumComment[]>();

    comments.forEach((comment) => {
      grouped.set(comment.spreadId, [...(grouped.get(comment.spreadId) ?? []), comment]);
    });

    return grouped;
  }, [comments]);

  function startComment(spreadId: string, event: MouseEvent<HTMLDivElement>) {
    if (pending) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setDraft({
      spreadId,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    });
    setDraftText("");
    setError("");
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft) {
      return;
    }

    setPending(true);
    setError("");

    const result = await createAlbumReviewCommentAction({
      token,
      spreadId: draft.spreadId,
      x: draft.x,
      y: draft.y,
      text: draftText
    });

    if (!result.ok || !result.comment) {
      setError(result.message ?? "Die Notiz konnte nicht gespeichert werden.");
      setPending(false);
      return;
    }

    setComments((current) => [...current, result.comment]);
    setDraft(null);
    setDraftText("");
    setPending(false);
  }

  return (
    <div>
      {error ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="space-y-8">
        {spreads.map((spread) => {
          const spreadComments = commentsBySpread.get(spread.id) ?? [];
          const draftForSpread = draft?.spreadId === spread.id ? draft : null;

          return (
            <section key={spread.id} className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
              <div className="border-b border-ink/10 px-4 py-3">
                <p className="font-semibold text-ink">{spread.title ?? `Doppelseite ${spread.sortOrder}`}</p>
                <p className="mt-1 text-sm text-graphite/70">{spreadComments.length} Notizen</p>
              </div>

              <div
                className="relative cursor-crosshair bg-mist"
                onClick={(event) => startComment(spread.id, event)}
              >
                <img src={spread.imageUrl} alt={spread.title ?? spread.filename} className="block h-auto w-full" />

                {spreadComments.map((comment, index) => (
                  <div
                    key={comment.id}
                    className="absolute z-10 max-w-[260px] -translate-x-3 -translate-y-3 rounded-md bg-ink px-3 py-2 text-sm font-medium text-white shadow-soft"
                    style={{ left: `${comment.x}%`, top: `${comment.y}%` }}
                  >
                    <span className="mr-1 inline-flex size-5 items-center justify-center rounded-full bg-white text-xs text-ink">{index + 1}</span>
                    {comment.text}
                  </div>
                ))}

                {draftForSpread ? (
                  <form
                    onClick={(event) => event.stopPropagation()}
                    onSubmit={saveDraft}
                    className="absolute z-20 min-w-72 max-w-[min(340px,calc(100%-24px))] -translate-x-3 -translate-y-3 rounded-lg border border-ink/15 bg-white p-3 shadow-soft"
                    style={{ left: `${draftForSpread.x}%`, top: `${draftForSpread.y}%` }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                        <MessageSquare size={15} />
                        Neue Notiz
                      </span>
                      <button type="button" onClick={() => setDraft(null)} className="rounded-md p-1 text-graphite hover:bg-ink/5">
                        <X size={15} />
                      </button>
                    </div>
                    <textarea
                      value={draftText}
                      onChange={(event) => setDraftText(event.target.value)}
                      rows={3}
                      autoFocus
                      placeholder="z.B. Bitte dieses Bild gegen Bild 1234 tauschen"
                      className="w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/50"
                    />
                    <Button type="submit" disabled={pending || !draftText.trim()} className="mt-2 w-full">
                      <Plus size={16} />
                      {pending ? "Speichern..." : "Notiz speichern"}
                    </Button>
                  </form>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
