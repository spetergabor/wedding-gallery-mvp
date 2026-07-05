"use client";

import { PointerEvent, useMemo, useState } from "react";
import { MousePointer2, Move, Plus, Trash2 } from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PdfPreviewCanvas, usePdfPreviewPages } from "@/components/pdf-preview";
import { saveContractPdfFieldsAction } from "@/lib/contract-actions";
import { CONTRACT_FIELD_OPTIONS } from "@/lib/contract-fields";
import type { ContractPdfField } from "@/lib/contract-pdf-fields";

type DraftField = Pick<ContractPdfField, "page" | "x" | "y" | "width" | "height"> | null;

type EditorInteraction =
  | { kind: "draw"; page: number; start: { x: number; y: number } }
  | { kind: "move"; id: string; offsetX: number; offsetY: number }
  | { kind: "resize"; id: string; start: { x: number; y: number }; original: ContractPdfField }
  | null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function pointerPercent(event: PointerEvent<HTMLElement>, element: HTMLElement) {
  const rect = element.getBoundingClientRect();

  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
    y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
  };
}

function fieldDefaultHeight() {
  return 4.2;
}

function minFieldWidth(type: ContractPdfField["type"]) {
  return type === "textarea" ? 14 : 9;
}

function minFieldHeight() {
  return 3;
}

function findPageOverlay(event: PointerEvent<HTMLElement>) {
  return (event.currentTarget as HTMLElement).closest("[data-pdf-page-overlay]") as HTMLElement | null;
}

export function PdfContractFieldEditor({
  customerId,
  contractId,
  fileUrl,
  title,
  initialFields
}: {
  customerId: string;
  contractId: string;
  fileUrl: string;
  title: string;
  initialFields: ContractPdfField[];
}) {
  const [fields, setFields] = useState<ContractPdfField[]>(initialFields);
  const [activeKey, setActiveKey] = useState(CONTRACT_FIELD_OPTIONS[0]?.key ?? "");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(initialFields[0]?.id ?? null);
  const [interaction, setInteraction] = useState<EditorInteraction>(null);
  const [draft, setDraft] = useState<DraftField>(null);
  const { pages, isLoading, error } = usePdfPreviewPages(fileUrl);
  const activeField = CONTRACT_FIELD_OPTIONS.find((field) => field.key === activeKey) ?? CONTRACT_FIELD_OPTIONS[0];
  const hiddenValue = useMemo(() => JSON.stringify(fields), [fields]);

  function beginDraw(event: PointerEvent<HTMLDivElement>, page: number) {
    if (!activeField) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPercent(event, event.currentTarget);
    setSelectedFieldId(null);
    setInteraction({ kind: "draw", page, start: point });
    setDraft({ page, x: point.x, y: point.y, width: 0, height: 0 });
  }

  function continueDraw(event: PointerEvent<HTMLDivElement>) {
    if (!interaction || interaction.kind !== "draw") {
      return;
    }

    const point = pointerPercent(event, event.currentTarget);
    const x = Math.min(interaction.start.x, point.x);
    const y = Math.min(interaction.start.y, point.y);
    const width = Math.abs(point.x - interaction.start.x);
    const height = Math.abs(point.y - interaction.start.y);

    setDraft({
      page: interaction.page,
      x: roundPercent(x),
      y: roundPercent(y),
      width: roundPercent(width),
      height: roundPercent(height)
    });
  }

  function finishInteraction() {
    if (!interaction || interaction.kind !== "draw" || !activeField || !draft) {
      setInteraction(null);
      setDraft(null);
      return;
    }

    const width = Math.max(minFieldWidth(activeField.type), draft.width || 24);
    const height = Math.max(minFieldHeight(), draft.height || fieldDefaultHeight());
    const nextField: ContractPdfField = {
      id: `${activeField.key}-${Date.now()}`,
      key: activeField.key,
      label: activeField.label,
      type: activeField.type,
      page: draft.page,
      x: roundPercent(clamp(draft.x, 0, Math.max(0, 100 - width))),
      y: roundPercent(clamp(draft.y, 0, Math.max(0, 100 - height))),
      width: roundPercent(width),
      height: roundPercent(height)
    };

    setFields((current) => [...current.filter((field) => field.key !== activeField.key), nextField]);
    setSelectedFieldId(nextField.id);
    setInteraction(null);
    setDraft(null);
  }

  function beginMove(event: PointerEvent<HTMLSpanElement>, field: ContractPdfField) {
    const overlay = findPageOverlay(event);

    if (!overlay) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPercent(event, overlay);

    setSelectedFieldId(field.id);
    setInteraction({
      kind: "move",
      id: field.id,
      offsetX: point.x - field.x,
      offsetY: point.y - field.y
    });
  }

  function continueMove(event: PointerEvent<HTMLSpanElement>) {
    if (!interaction || interaction.kind !== "move") {
      return;
    }

    const overlay = findPageOverlay(event);

    if (!overlay) {
      return;
    }

    const point = pointerPercent(event, overlay);

    setFields((current) =>
      current.map((field) =>
        field.id === interaction.id
          ? {
              ...field,
              x: roundPercent(clamp(point.x - interaction.offsetX, 0, Math.max(0, 100 - field.width))),
              y: roundPercent(clamp(point.y - interaction.offsetY, 0, Math.max(0, 100 - field.height)))
            }
          : field
      )
    );
  }

  function beginResize(event: PointerEvent<HTMLButtonElement>, field: ContractPdfField) {
    const overlay = findPageOverlay(event);

    if (!overlay) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPercent(event, overlay);

    setSelectedFieldId(field.id);
    setInteraction({
      kind: "resize",
      id: field.id,
      start: point,
      original: field
    });
  }

  function continueResize(event: PointerEvent<HTMLButtonElement>) {
    if (!interaction || interaction.kind !== "resize") {
      return;
    }

    const overlay = findPageOverlay(event);

    if (!overlay) {
      return;
    }

    const point = pointerPercent(event, overlay);
    const deltaX = point.x - interaction.start.x;
    const deltaY = point.y - interaction.start.y;

    setFields((current) =>
      current.map((field) => {
        if (field.id !== interaction.id) {
          return field;
        }

        const maxWidth = 100 - interaction.original.x;
        const maxHeight = 100 - interaction.original.y;

        return {
          ...field,
          width: roundPercent(clamp(interaction.original.width + deltaX, minFieldWidth(field.type), maxWidth)),
          height: roundPercent(clamp(interaction.original.height + deltaY, minFieldHeight(), maxHeight))
        };
      })
    );
  }

  function removeField(id: string) {
    setFields((current) => current.filter((field) => field.id !== id));
    setSelectedFieldId((current) => (current === id ? null : current));
  }

  return (
    <details className="mt-4 rounded-md border border-ink/10 bg-paper p-3">
      <summary className="cursor-pointer text-sm font-semibold text-ink">PDF kitöltendő mezők</summary>

      <form action={saveContractPdfFieldsAction.bind(null, customerId, contractId)} className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <input type="hidden" name="pdfFields" value={hiddenValue} />

        <div className="max-h-[76vh] overflow-y-auto rounded-md border border-ink/10 bg-paper p-3">
          {isLoading ? (
            <div className="grid min-h-[420px] place-items-center rounded-md bg-white text-sm text-graphite/65">
              PDF előnézet betöltése...
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
              Nem sikerült betölteni a többoldalas PDF előnézetet. Nyisd meg a PDF-et külön ablakban, vagy próbáld újra az oldalt.
            </div>
          ) : null}

          {!isLoading && !error ? (
            <div className="space-y-5">
              {pages.map((pdfPage) => {
                const pageFields = fields.filter((field) => field.page === pdfPage.pageNumber);

                return (
                  <section key={pdfPage.pageNumber} className="mx-auto w-full max-w-3xl">
                    <div className="mb-2 flex items-center justify-between text-xs font-medium text-graphite/65">
                      <span>{pdfPage.pageNumber}. oldal</span>
                      <span>{pageFields.length} mező</span>
                    </div>
                    <div
                      className="relative overflow-hidden rounded-md border border-ink/10 bg-white shadow-soft"
                      style={{ aspectRatio: `${pdfPage.width} / ${pdfPage.height}` }}
                    >
                      <PdfPreviewCanvas page={pdfPage} className="absolute inset-0 h-full w-full select-none" />

                      <div
                        data-pdf-page-overlay
                        role="button"
                        tabIndex={0}
                        aria-label={`${pdfPage.pageNumber}. oldal PDF mező elhelyezése`}
                        className="absolute inset-0 cursor-crosshair touch-none"
                        onPointerDown={(event) => beginDraw(event, pdfPage.pageNumber)}
                        onPointerMove={continueDraw}
                        onPointerUp={finishInteraction}
                        onPointerCancel={finishInteraction}
                      >
                        {pageFields.map((field) => {
                          const isSelected = selectedFieldId === field.id;

                          return (
                            <span
                              key={field.id}
                              data-field-box
                              className={`absolute cursor-move overflow-hidden rounded border-2 px-1 text-[10px] font-semibold text-ink shadow-sm transition ${
                                isSelected ? "border-ink bg-brass/25" : "border-brass bg-brass/15"
                              }`}
                              style={{
                                left: `${field.x}%`,
                                top: `${field.y}%`,
                                width: `${field.width}%`,
                                height: `${field.height}%`
                              }}
                              onPointerDown={(event) => beginMove(event, field)}
                              onPointerMove={continueMove}
                              onPointerUp={finishInteraction}
                              onPointerCancel={finishInteraction}
                            >
                              <span className="block truncate leading-5">{field.label}</span>
                              {isSelected ? (
                                <button
                                  type="button"
                                  aria-label="Mező méretezése"
                                  className="absolute -bottom-1 -right-1 size-4 rounded-sm border border-ink bg-white shadow-sm cursor-nwse-resize"
                                  onPointerDown={(event) => beginResize(event, field)}
                                  onPointerMove={continueResize}
                                  onPointerUp={finishInteraction}
                                  onPointerCancel={finishInteraction}
                                />
                              ) : null}
                            </span>
                          );
                        })}

                        {draft && draft.page === pdfPage.pageNumber ? (
                          <span
                            className="absolute rounded border-2 border-ink bg-ink/10"
                            style={{
                              left: `${draft.x}%`,
                              top: `${draft.y}%`,
                              width: `${draft.width}%`,
                              height: `${draft.height}%`
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}
        </div>

        <aside className="space-y-4 rounded-md border border-ink/10 bg-white p-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <MousePointer2 size={16} />
              Mező rajzolása
            </p>
            <p className="mt-1 text-xs leading-5 text-graphite/65">
              Válassz mezőtípust, majd húzz egy téglalapot bármelyik PDF oldalon oda, ahova az ügyfél válasza kerüljön.
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/65">Mező típusa</span>
            <select
              value={activeKey}
              onChange={(event) => setActiveKey(event.currentTarget.value)}
              className="h-10 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
            >
              {CONTRACT_FIELD_OPTIONS.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-md bg-paper px-3 py-2 text-xs leading-5 text-graphite/65">
            <p className="flex items-center gap-2 font-medium text-ink">
              <Move size={14} />
              Szerkesztés
            </p>
            <p className="mt-1">A lerakott mezőt húzással mozgathatod. Kattintás után a jobb alsó fogantyúval méretezhető.</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/65">Elhelyezett mezők</p>
            {fields.length > 0 ? (
              fields.map((field) => (
                <div
                  key={field.id}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm text-graphite ${
                    selectedFieldId === field.id ? "bg-brass/15 ring-1 ring-brass/40" : "bg-paper"
                  }`}
                >
                  <button type="button" onClick={() => setSelectedFieldId(field.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-medium text-ink">{field.label}</span>
                    <span className="text-xs text-graphite/60">{field.page}. oldal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeField(field.id)}
                    className="inline-flex size-8 items-center justify-center rounded-md text-red-700 transition hover:bg-red-50"
                    title="Mező törlése"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            ) : (
              <p className="rounded-md bg-paper px-3 py-2 text-sm text-graphite/65">Még nincs mező a PDF-en.</p>
            )}
          </div>

          <FormSubmitButton className="w-full" pendingLabel="Mentés...">
            <Plus size={16} />
            Mezők mentése
          </FormSubmitButton>
        </aside>
      </form>
    </details>
  );
}
