"use client";

import { FormEvent, MouseEvent, useMemo, useState } from "react";
import { CheckCircle2, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  approveAlbumReviewSpreadAction,
  createAlbumReviewCommentAction,
  deleteAlbumReviewCommentAction,
  updateAlbumReviewCommentAction
} from "@/lib/album-review-actions";
import { FormSubmitButton } from "@/components/form-submit-button";

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
  approvedAt: string | null;
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
  const [approvedSpreads, setApprovedSpreads] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(spreads.map((spread) => [spread.id, spread.approvedAt]))
  );
  const [draft, setDraft] = useState<DraftComment | null>(null);
  const [draftText, setDraftText] = useState("");
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [pending, setPending] = useState(false);
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [approvingSpreadId, setApprovingSpreadId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const commentsBySpread = useMemo(() => {
    const grouped = new Map<string, AlbumComment[]>();

    comments.forEach((comment) => {
      grouped.set(comment.spreadId, [...(grouped.get(comment.spreadId) ?? []), comment]);
    });

    return grouped;
  }, [comments]);

  function startComment(spreadId: string, event: MouseEvent<HTMLDivElement>) {
    if (pending || editingCommentId) {
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
    setApprovedSpreads((current) => ({ ...current, [draft.spreadId]: null }));
    setDraft(null);
    setDraftText("");
    setPending(false);
  }

  function startEditComment(comment: AlbumComment) {
    if (pending || updatingCommentId) {
      return;
    }

    setDraft(null);
    setSelectedCommentId(comment.id);
    setEditingCommentId(comment.id);
    setEditingText(comment.text);
    setError("");
  }

  async function saveCommentEdit(event: FormEvent<HTMLFormElement>, commentId: string) {
    event.preventDefault();

    if (!editingText.trim()) {
      setError("Bitte geben Sie eine Notiz ein.");
      return;
    }

    setUpdatingCommentId(commentId);
    setError("");

    const result = await updateAlbumReviewCommentAction({
      token,
      commentId,
      text: editingText
    });

    if (!result.ok || !result.comment) {
      setError(result.message ?? "Die Notiz konnte nicht aktualisiert werden.");
      setUpdatingCommentId(null);
      return;
    }

    setComments((current) => current.map((comment) => (comment.id === commentId ? result.comment : comment)));
    setSelectedCommentId(commentId);
    setEditingCommentId(null);
    setEditingText("");
    setUpdatingCommentId(null);
  }

  async function deleteComment(commentId: string) {
    if (pending || updatingCommentId || deletingCommentId) {
      return;
    }

    if (!window.confirm("Diese Notiz wirklich löschen?")) {
      return;
    }

    setDeletingCommentId(commentId);
    setError("");

    const result = await deleteAlbumReviewCommentAction({ token, commentId });

    if (!result.ok) {
      setError(result.message ?? "Die Notiz konnte nicht gelöscht werden.");
      setDeletingCommentId(null);
      return;
    }

    setComments((current) => current.filter((comment) => comment.id !== commentId));
    if (selectedCommentId === commentId) {
      setSelectedCommentId(null);
    }
    if (editingCommentId === commentId) {
      setEditingCommentId(null);
      setEditingText("");
    }
    setDeletingCommentId(null);
  }

  async function approveSpread(spreadId: string) {
    if (pending || approvingSpreadId) {
      return;
    }

    setApprovingSpreadId(spreadId);
    setError("");

    const result = await approveAlbumReviewSpreadAction({ token, spreadId });

    if (!result.ok || !result.approvedAt) {
      setError(result.message ?? "Die Freigabe konnte nicht gespeichert werden.");
      setApprovingSpreadId(null);
      return;
    }

    setApprovedSpreads((current) => ({ ...current, [spreadId]: result.approvedAt }));
    setApprovingSpreadId(null);
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
          const approvedAt = approvedSpreads[spread.id];

          return (
            <section key={spread.id} className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
              <div className="flex flex-col justify-between gap-3 border-b border-ink/10 px-4 py-3 sm:flex-row sm:items-center">
                <div>
                  <p className="font-semibold text-ink">{spread.title ?? `Doppelseite ${spread.sortOrder}`}</p>
                  <p className="mt-1 text-sm text-graphite/70">{spreadComments.length} Notizen</p>
                </div>
                {approvedAt ? (
                  <span className="inline-flex w-fit items-center gap-2 rounded-md bg-brass/10 px-3 py-2 text-sm font-medium text-brass">
                    <CheckCircle2 size={16} />
                    Freigegeben
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => approveSpread(spread.id)}
                    disabled={approvingSpreadId === spread.id}
                    className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md border border-brass/30 bg-brass/10 px-3 text-sm font-medium text-brass transition hover:bg-brass/15 disabled:opacity-60"
                  >
                    <CheckCircle2 size={16} />
                    {approvingSpreadId === spread.id ? "Speichern..." : "Diese Seite ist in Ordnung"}
                  </button>
                )}
              </div>

              <div
                className="relative cursor-crosshair bg-mist"
                onClick={(event) => startComment(spread.id, event)}
              >
                <img src={spread.imageUrl} alt={spread.title ?? spread.filename} className="block h-auto w-full" />

                {spreadComments.map((comment, index) => {
                  const isEditing = editingCommentId === comment.id;
                  const isSelected = selectedCommentId === comment.id;

                  return (
                    <div
                      key={comment.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!isEditing) {
                          setSelectedCommentId(isSelected ? null : comment.id);
                        }
                      }}
                      className={`absolute z-10 max-w-[min(360px,calc(100%-24px))] -translate-x-3 -translate-y-3 rounded-md shadow-soft ${
                        isEditing
                          ? "min-w-72 border border-ink/15 bg-white p-3 text-ink"
                          : isSelected
                            ? "bg-ink px-3 py-2 text-sm font-medium text-white"
                            : "max-w-[240px] cursor-pointer bg-ink/90 px-2.5 py-1.5 text-xs font-medium text-white"
                      }`}
                      style={{ left: `${comment.x}%`, top: `${comment.y}%` }}
                    >
                      {isEditing ? (
                        <form onSubmit={(event) => saveCommentEdit(event, comment.id)}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                              <span className="inline-flex size-5 items-center justify-center rounded-full bg-ink text-xs text-white">{index + 1}</span>
                              Notiz bearbeiten
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCommentId(comment.id);
                                setEditingCommentId(null);
                                setEditingText("");
                              }}
                              className="rounded-md p-1 text-graphite hover:bg-ink/5"
                            >
                              <X size={15} />
                            </button>
                          </div>
                          <textarea
                            value={editingText}
                            onChange={(event) => setEditingText(event.target.value)}
                            rows={3}
                            autoFocus
                            className="w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/50"
                          />
                          <FormSubmitButton
                            type="submit"
                            disabled={!editingText.trim()}
                            className="mt-2 w-full"
                            busy={updatingCommentId === comment.id}
                            pendingLabel="Speichern..."
                          >
                            Notiz aktualisieren
                          </FormSubmitButton>
                        </form>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-xs text-ink">{index + 1}</span>
                            <span className={isSelected ? "" : "line-clamp-1"}>{comment.text}</span>
                          </span>
                          {isSelected ? (
                            <span className="mt-2 flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startEditComment(comment);
                                }}
                                className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/85 transition hover:bg-white/20 hover:text-white"
                              >
                                <Pencil size={12} />
                                Bearbeiten
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteComment(comment.id);
                                }}
                                disabled={deletingCommentId === comment.id}
                                className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/85 transition hover:bg-red-500/40 hover:text-white disabled:opacity-60"
                              >
                                <Trash2 size={12} />
                                {deletingCommentId === comment.id ? "Löschen..." : "Löschen"}
                              </button>
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}

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
                    <FormSubmitButton
                      type="submit"
                      disabled={!draftText.trim()}
                      className="mt-2 w-full"
                      busy={pending}
                      pendingLabel="Speichern..."
                    >
                      <Plus size={16} />
                      Notiz speichern
                    </FormSubmitButton>
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
