"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical, Trash2, Undo2 } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  deleteGallerySectionAction,
  saveGallerySectionOrderAction
} from "@/lib/gallery-actions";

type GallerySectionItem = {
  id: string;
  title: string;
  count: number;
};

function sectionsChanged(left: GallerySectionItem[], right: GallerySectionItem[]) {
  if (left.length !== right.length) {
    return true;
  }

  return left.some((section, index) => section.id !== right[index]?.id);
}

export function GallerySectionSortableList({
  galleryId,
  sections
}: {
  galleryId: string;
  sections: GallerySectionItem[];
}) {
  const [orderedSections, setOrderedSections] = useState(() => sections);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dropTargetSectionId, setDropTargetSectionId] = useState<string | null>(null);
  const lastLiveMoveRef = useRef<{ draggedId: string; targetId: string } | null>(null);
  const hasUnsavedOrder = sectionsChanged(orderedSections, sections);

  useEffect(() => {
    setOrderedSections(sections);
  }, [sections]);

  function resetDragState() {
    setDraggedSectionId(null);
    setDropTargetSectionId(null);
    lastLiveMoveRef.current = null;
  }

  function moveSection(draggedId: string, targetId: string) {
    if (draggedId === targetId) {
      return;
    }

    setOrderedSections((currentSections) => {
      const originalDraggedIndex = currentSections.findIndex((section) => section.id === draggedId);
      const originalTargetIndex = currentSections.findIndex((section) => section.id === targetId);

      if (originalDraggedIndex < 0 || originalTargetIndex < 0) {
        return currentSections;
      }

      const withoutDragged = currentSections.filter((section) => section.id !== draggedId);
      const targetIndex = withoutDragged.findIndex((section) => section.id === targetId);
      const insertIndex = originalDraggedIndex < originalTargetIndex ? targetIndex + 1 : targetIndex;
      const draggedSection = currentSections[originalDraggedIndex];
      const nextSections = [...withoutDragged];
      nextSections.splice(insertIndex, 0, draggedSection);

      return nextSections;
    });
  }

  return (
    <>
      <div className="mt-5 flex flex-wrap gap-2">
        {orderedSections.map((section, index) => {
          const isDragging = draggedSectionId === section.id;
          const isDropTarget = dropTargetSectionId === section.id && !isDragging;

          return (
            <div
              key={section.id}
              draggable
              aria-grabbed={isDragging}
              onDragStart={(event) => {
                setDraggedSectionId(section.id);
                setDropTargetSectionId(null);
                lastLiveMoveRef.current = null;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", section.id);
                event.dataTransfer.setDragImage(
                  event.currentTarget,
                  event.currentTarget.offsetWidth / 2,
                  event.currentTarget.offsetHeight / 2
                );
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                const draggedId = event.dataTransfer.getData("text/plain") || draggedSectionId;

                if (!draggedId || draggedId === section.id) {
                  return;
                }

                setDropTargetSectionId(section.id);

                const lastLiveMove = lastLiveMoveRef.current;
                if (lastLiveMove?.draggedId === draggedId && lastLiveMove.targetId === section.id) {
                  return;
                }

                lastLiveMoveRef.current = { draggedId, targetId: section.id };
                moveSection(draggedId, section.id);
              }}
              onDragEnd={resetDragState}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (dropTargetSectionId !== section.id) {
                  setDropTargetSectionId(section.id);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                resetDragState();
              }}
              className={`group relative inline-flex min-h-11 cursor-grab items-center gap-2 rounded-md border bg-paper px-3 py-2 text-sm text-ink transition-[border-color,box-shadow,opacity,transform] active:cursor-grabbing ${
                isDragging
                  ? "scale-[1.02] border-brass/70 opacity-85 shadow-soft ring-2 ring-brass/25"
                  : isDropTarget
                    ? "-translate-y-0.5 border-brass/45 shadow-soft"
                    : "border-ink/10 hover:border-brass/30 hover:shadow-sm"
              }`}
            >
              {isDropTarget ? (
                <span className="pointer-events-none absolute inset-1 rounded border border-dashed border-brass/45" />
              ) : null}
              <span className="inline-flex items-center gap-1.5 text-graphite">
                <GripVertical size={14} />
                <span className="sr-only">Sorrend: {index + 1}</span>
              </span>
              <span className="font-medium">{section.title}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-graphite/70">
                {section.count}
              </span>
              <form action={deleteGallerySectionAction.bind(null, galleryId, section.id)}>
                <ConfirmSubmitButton
                  message="Biztosan törlöd ezt a szekciót? A képek nem törlődnek, csak visszakerülnek az általános galériába."
                  variant="ghost"
                  className="h-8 px-2 text-graphite hover:text-red-700"
                >
                  <Trash2 size={14} />
                </ConfirmSubmitButton>
              </form>
            </div>
          );
        })}
      </div>

      {hasUnsavedOrder ? (
        <form
          action={saveGallerySectionOrderAction.bind(null, galleryId)}
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-3xl flex-col gap-3 rounded-lg border border-brass/25 bg-white/95 p-3 shadow-[0_18px_60px_rgba(17,17,17,0.18)] backdrop-blur md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p className="text-sm font-semibold text-ink">A címkék sorrendje módosult</p>
            <p className="mt-0.5 text-xs text-graphite/70">Ez lesz a publikus galéria blokk-sorrendje is.</p>
          </div>
          {orderedSections.map((section) => (
            <input key={section.id} type="hidden" name="sectionIds" value={section.id} />
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOrderedSections(sections)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/12 bg-white px-3 text-sm font-medium text-graphite transition hover:bg-ink/5"
            >
              <Undo2 size={15} />
              Visszaállítás
            </button>
            <FormSubmitButton className="h-10 px-4" pendingLabel="Mentés...">
              Sorrend mentése
            </FormSubmitButton>
          </div>
        </form>
      ) : null}
    </>
  );
}
