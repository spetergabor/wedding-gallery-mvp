"use client";

import { FormEvent, MouseEvent, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, MessageSquare, Pencil, Plus, Send, Trash2, Undo2, X } from "lucide-react";
import {
  approveAlbumReviewSpreadAction,
  createAlbumReviewCommentAction,
  deleteAlbumReviewCommentAction,
  resetAlbumReviewSpreadDecisionAction,
  submitAlbumReviewAction,
  updateAlbumReviewCommentAction
} from "@/lib/album-review-actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import type { CustomerLanguage } from "@/lib/customer-language";

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

type ReviewSubmission = {
  status: string;
  submittedAt: string;
};

const ALBUM_REVIEW_COPY = {
  de: {
    saveError: "Die Notiz konnte nicht gespeichert werden.",
    emptyNote: "Bitte geben Sie eine Notiz ein.",
    updateError: "Die Notiz konnte nicht aktualisiert werden.",
    deleteConfirm: "Diese Notiz wirklich löschen?",
    deleteError: "Die Notiz konnte nicht gelöscht werden.",
    approveError: "Die Freigabe konnte nicht gespeichert werden.",
    revokeApprovalError: "Die Freigabe konnte nicht zurückgenommen werden.",
    revokeChangesConfirm: "Alle Änderungsnotizen dieser Doppelseite löschen und den Änderungswunsch zurücknehmen?",
    revokeChangesError: "Der Änderungswunsch konnte nicht zurückgenommen werden.",
    spread: (index: number) => `Doppelseite ${index}`,
    notes: "Notizen",
    approved: "Freigegeben",
    changesRequested: "Änderung angefordert",
    approving: "Speichern...",
    approve: "Diese Seite ist in Ordnung",
    revokingApproval: "Wird zurückgenommen...",
    revokeApproval: "Freigabe zurücknehmen",
    revokingChanges: "Wird zurückgenommen...",
    revokeChanges: "Änderungswunsch zurücknehmen",
    editTitle: "Notiz bearbeiten",
    updatePending: "Speichern...",
    update: "Notiz aktualisieren",
    edit: "Bearbeiten",
    deleting: "Löschen...",
    delete: "Löschen",
    newNote: "Neue Notiz",
    placeholder: "z.B. Bitte dieses Bild gegen Bild 1234 tauschen",
    savePending: "Speichern...",
    save: "Notiz speichern",
    submitEyebrow: "Prüfung abschließen",
    submitTitle: "Albumprüfung übermitteln",
    submitDescription: "Bitte entscheiden Sie bei jeder Doppelseite: freigeben oder eine Änderungsnotiz hinzufügen.",
    approvedPages: (count: number) => `${count} freigegeben`,
    changedPages: (count: number) => `${count} mit Änderungswünschen`,
    unresolvedPages: (count: number) => `${count} noch nicht geprüft`,
    submitConfirm: "Albumprüfung jetzt verbindlich abschließen und senden? Danach können keine weiteren Änderungen eingetragen werden.",
    submitPending: "Wird gesendet...",
    submit: "Prüfung abschließen und senden",
    submittedApprovedTitle: "Album vollständig freigegeben",
    submittedChangesTitle: "Änderungswünsche wurden übermittelt",
    submittedDescription: "Vielen Dank. Ihre Rückmeldung wurde vollständig und verbindlich übermittelt.",
    submittedAt: "Übermittelt"
  },
  hu: {
    saveError: "A megjegyzést nem sikerült menteni.",
    emptyNote: "Írjatok be egy megjegyzést.",
    updateError: "A megjegyzést nem sikerült frissíteni.",
    deleteConfirm: "Biztosan törlitek ezt a megjegyzést?",
    deleteError: "A megjegyzést nem sikerült törölni.",
    approveError: "Az oldalpár jóváhagyását nem sikerült menteni.",
    revokeApprovalError: "Az oldalpár jóváhagyását nem sikerült visszavonni.",
    revokeChangesConfirm: "Törlitek az oldalpár összes módosítási megjegyzését, és visszavonjátok a módosításkérést?",
    revokeChangesError: "A módosításkérést nem sikerült visszavonni.",
    spread: (index: number) => `Oldalpár ${index}`,
    notes: "megjegyzés",
    approved: "Rendben jelölve",
    changesRequested: "Módosítás kérve",
    approving: "Mentés...",
    approve: "Ez az oldal rendben van",
    revokingApproval: "Visszavonás...",
    revokeApproval: "Jóváhagyás visszavonása",
    revokingChanges: "Visszavonás...",
    revokeChanges: "Módosításkérés visszavonása",
    editTitle: "Megjegyzés szerkesztése",
    updatePending: "Mentés...",
    update: "Megjegyzés frissítése",
    edit: "Szerkesztés",
    deleting: "Törlés...",
    delete: "Törlés",
    newNote: "Új megjegyzés",
    placeholder: "pl. Ezt a képet cseréljük a 1234-es képre",
    savePending: "Mentés...",
    save: "Megjegyzés mentése",
    submitEyebrow: "Ellenőrzés lezárása",
    submitTitle: "Albumellenőrzés elküldése",
    submitDescription: "Minden oldalpárnál válasszatok: jóváhagyás vagy módosítási megjegyzés.",
    approvedPages: (count: number) => `${count} jóváhagyva`,
    changedPages: (count: number) => `${count} módosítással`,
    unresolvedPages: (count: number) => `${count} még nincs ellenőrizve`,
    submitConfirm: "Biztosan lezárjátok és elkülditek az albumellenőrzést? Utána már nem lehet további módosítást beírni.",
    submitPending: "Küldés...",
    submit: "Ellenőrzés lezárása és elküldése",
    submittedApprovedTitle: "Az album teljesen jóváhagyva",
    submittedChangesTitle: "A módosítási kéréseket elküldtétek",
    submittedDescription: "Köszönjük. A teljes visszajelzés sikeresen és véglegesen elküldve.",
    submittedAt: "Elküldve"
  }
} as const;

export function AlbumReviewBoard({
  token,
  spreads,
  language = "de",
  reviewStatus = "in_review",
  submittedAt = null
}: {
  token: string;
  spreads: AlbumSpread[];
  language?: CustomerLanguage;
  reviewStatus?: string;
  submittedAt?: string | null;
}) {
  const copy = ALBUM_REVIEW_COPY[language];
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
  const [revokingSpreadId, setRevokingSpreadId] = useState<string | null>(null);
  const [submission, setSubmission] = useState<ReviewSubmission | null>(() =>
    submittedAt ? { status: reviewStatus, submittedAt } : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isSubmitted = Boolean(submission?.submittedAt);
  const commentsBySpread = useMemo(() => {
    const grouped = new Map<string, AlbumComment[]>();

    comments.forEach((comment) => {
      grouped.set(comment.spreadId, [...(grouped.get(comment.spreadId) ?? []), comment]);
    });

    return grouped;
  }, [comments]);
  const reviewProgress = useMemo(() => {
    const approvedCount = spreads.filter(
      (spread) => Boolean(approvedSpreads[spread.id]) && (commentsBySpread.get(spread.id)?.length ?? 0) === 0
    ).length;
    const changesRequestedCount = spreads.filter(
      (spread) => (commentsBySpread.get(spread.id)?.length ?? 0) > 0
    ).length;

    return {
      total: spreads.length,
      approvedCount,
      changesRequestedCount,
      unresolvedCount: spreads.length - approvedCount - changesRequestedCount
    };
  }, [approvedSpreads, commentsBySpread, spreads]);

  function startComment(spreadId: string, event: MouseEvent<HTMLDivElement>) {
    if (isSubmitted || pending || editingCommentId) {
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

    if (isSubmitted || !draft) {
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
      setError(result.message ?? copy.saveError);
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
    if (isSubmitted || pending || updatingCommentId) {
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

    if (isSubmitted) {
      return;
    }

    if (!editingText.trim()) {
      setError(copy.emptyNote);
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
      setError(result.message ?? copy.updateError);
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
    if (isSubmitted || pending || updatingCommentId || deletingCommentId) {
      return;
    }

    if (!window.confirm(copy.deleteConfirm)) {
      return;
    }

    setDeletingCommentId(commentId);
    setError("");

    const result = await deleteAlbumReviewCommentAction({ token, commentId });

    if (!result.ok) {
      setError(result.message ?? copy.deleteError);
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
    if (isSubmitted || pending || approvingSpreadId || revokingSpreadId) {
      return;
    }

    setApprovingSpreadId(spreadId);
    setError("");

    const result = await approveAlbumReviewSpreadAction({ token, spreadId });

    if (!result.ok || !result.approvedAt) {
      setError(result.message ?? copy.approveError);
      setApprovingSpreadId(null);
      return;
    }

    setApprovedSpreads((current) => ({ ...current, [spreadId]: result.approvedAt }));
    setApprovingSpreadId(null);
  }

  async function resetSpreadDecision(spreadId: string, hasChangeRequest: boolean) {
    if (isSubmitted || pending || approvingSpreadId || revokingSpreadId) {
      return;
    }

    if (hasChangeRequest && !window.confirm(copy.revokeChangesConfirm)) {
      return;
    }

    setRevokingSpreadId(spreadId);
    setError("");

    const result = await resetAlbumReviewSpreadDecisionAction({ token, spreadId });

    if (!result.ok) {
      setError(result.message ?? (hasChangeRequest ? copy.revokeChangesError : copy.revokeApprovalError));
      setRevokingSpreadId(null);
      return;
    }

    setComments((current) => current.filter((comment) => comment.spreadId !== spreadId));
    setApprovedSpreads((current) => ({ ...current, [spreadId]: null }));
    setDraft((current) => (current?.spreadId === spreadId ? null : current));
    setSelectedCommentId(null);
    setEditingCommentId(null);
    setEditingText("");
    setRevokingSpreadId(null);
  }

  async function submitReview() {
    if (isSubmitted || submitting || reviewProgress.unresolvedCount > 0) {
      return;
    }

    if (!window.confirm(copy.submitConfirm)) {
      return;
    }

    setSubmitting(true);
    setError("");
    const result = await submitAlbumReviewAction({ token });

    if (!result.ok || !result.submittedAt || !result.status) {
      setError(result.message ?? copy.saveError);
      setSubmitting(false);
      return;
    }

    setDraft(null);
    setEditingCommentId(null);
    setSelectedCommentId(null);
    setSubmission({ status: result.status, submittedAt: result.submittedAt });
    setSubmitting(false);
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
          const hasChangeRequest = spreadComments.length > 0;

          return (
            <section key={spread.id} className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
              <div className="flex flex-col justify-between gap-3 border-b border-ink/10 px-4 py-3 sm:flex-row sm:items-center">
                <div>
                  <p className="font-semibold text-ink">{spread.title ?? copy.spread(spread.sortOrder)}</p>
                  <p className="mt-1 text-sm text-graphite/70">{spreadComments.length} {copy.notes}</p>
                </div>
                {hasChangeRequest ? (
                  <div className="flex w-fit flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                      <CircleAlert size={16} />
                      {copy.changesRequested}
                    </span>
                    {!isSubmitted ? (
                      <button
                        type="button"
                        onClick={() => resetSpreadDecision(spread.id, true)}
                        disabled={revokingSpreadId === spread.id || Boolean(approvingSpreadId)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-medium text-graphite transition hover:border-ink/30 hover:text-ink disabled:opacity-60"
                      >
                        <Undo2 size={15} />
                        {revokingSpreadId === spread.id ? copy.revokingChanges : copy.revokeChanges}
                      </button>
                    ) : null}
                  </div>
                ) : approvedAt ? (
                  <div className="flex w-fit flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-md bg-brass/10 px-3 py-2 text-sm font-medium text-brass">
                      <CheckCircle2 size={16} />
                      {copy.approved}
                    </span>
                    {!isSubmitted ? (
                      <button
                        type="button"
                        onClick={() => resetSpreadDecision(spread.id, false)}
                        disabled={revokingSpreadId === spread.id || Boolean(approvingSpreadId)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-medium text-graphite transition hover:border-ink/30 hover:text-ink disabled:opacity-60"
                      >
                        <Undo2 size={15} />
                        {revokingSpreadId === spread.id ? copy.revokingApproval : copy.revokeApproval}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => approveSpread(spread.id)}
                    disabled={isSubmitted || approvingSpreadId === spread.id || Boolean(revokingSpreadId)}
                    className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md border border-brass/30 bg-brass/10 px-3 text-sm font-medium text-brass transition hover:bg-brass/15 disabled:opacity-60"
                  >
                    <CheckCircle2 size={16} />
                    {approvingSpreadId === spread.id ? copy.approving : copy.approve}
                  </button>
                )}
              </div>

              <div
                className={`relative bg-mist ${isSubmitted ? "cursor-default" : "cursor-crosshair"}`}
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
                              {copy.editTitle}
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
                            pendingLabel={copy.updatePending}
                          >
                            {copy.update}
                          </FormSubmitButton>
                        </form>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-xs text-ink">{index + 1}</span>
                            <span className={isSelected ? "" : "line-clamp-1"}>{comment.text}</span>
                          </span>
                          {isSelected && !isSubmitted ? (
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
                                {copy.edit}
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
                                {deletingCommentId === comment.id ? copy.deleting : copy.delete}
                              </button>
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}

                {draftForSpread && !isSubmitted ? (
                  <form
                    onClick={(event) => event.stopPropagation()}
                    onSubmit={saveDraft}
                    className="absolute z-20 min-w-72 max-w-[min(340px,calc(100%-24px))] -translate-x-3 -translate-y-3 rounded-lg border border-ink/15 bg-white p-3 shadow-soft"
                    style={{ left: `${draftForSpread.x}%`, top: `${draftForSpread.y}%` }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                        <MessageSquare size={15} />
                        {copy.newNote}
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
                      placeholder={copy.placeholder}
                      className="w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/50"
                    />
                    <FormSubmitButton
                      type="submit"
                      disabled={!draftText.trim()}
                      className="mt-2 w-full"
                      busy={pending}
                      pendingLabel={copy.savePending}
                    >
                      <Plus size={16} />
                      {copy.save}
                    </FormSubmitButton>
                  </form>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <section className={`mt-8 overflow-hidden rounded-lg border shadow-soft ${isSubmitted ? "border-brass/25 bg-brass/[0.06]" : "border-ink/10 bg-white"}`}>
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full ${isSubmitted ? "bg-brass text-white" : "bg-ink text-white"}`}>
              {isSubmitted ? <CheckCircle2 size={22} /> : <Send size={20} />}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">{copy.submitEyebrow}</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                {isSubmitted
                  ? submission?.status === "approved"
                    ? copy.submittedApprovedTitle
                    : copy.submittedChangesTitle
                  : copy.submitTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 text-graphite/70">
                {isSubmitted ? copy.submittedDescription : copy.submitDescription}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-sage/10 px-4 py-3">
              <p className="text-sm font-semibold text-sage">{copy.approvedPages(reviewProgress.approvedCount)}</p>
            </div>
            <div className="rounded-md bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-700">{copy.changedPages(reviewProgress.changesRequestedCount)}</p>
            </div>
            <div className={`rounded-md px-4 py-3 ${reviewProgress.unresolvedCount > 0 ? "bg-red-50" : "bg-ink/5"}`}>
              <p className={`text-sm font-semibold ${reviewProgress.unresolvedCount > 0 ? "text-red-700" : "text-graphite"}`}>
                {copy.unresolvedPages(reviewProgress.unresolvedCount)}
              </p>
            </div>
          </div>

          {isSubmitted && submission ? (
            <p className="mt-5 text-sm font-medium text-graphite/70">
              {copy.submittedAt}: {new Date(submission.submittedAt).toLocaleString(language === "hu" ? "hu-HU" : "de-AT", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          ) : (
            <button
              type="button"
              onClick={submitReview}
              disabled={submitting || reviewProgress.unresolvedCount > 0}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 text-sm font-medium text-white transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            >
              {submitting ? <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" /> : <Send size={16} />}
              {submitting ? copy.submitPending : copy.submit}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
