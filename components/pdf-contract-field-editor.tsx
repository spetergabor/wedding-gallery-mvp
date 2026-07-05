"use client";

import { PointerEvent, useMemo, useState } from "react";
import { MousePointer2, Plus, Trash2 } from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { saveContractPdfFieldsAction } from "@/lib/contract-actions";
import { CONTRACT_FIELD_OPTIONS } from "@/lib/contract-fields";
import type { ContractPdfField } from "@/lib/contract-pdf-fields";

type DraftField = Pick<ContractPdfField, "x" | "y" | "width" | "height"> | null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function pdfUrlForPage(fileUrl: string, page: number) {
  return `${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&page=${page}&view=FitH`;
}

function pointerPercent(event: PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
    y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
  };
}

function fieldDefaultHeight(type: ContractPdfField["type"]) {
  return type === "textarea" ? 9 : 5;
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
  const [page, setPage] = useState(Math.max(1, initialFields[0]?.page ?? 1));
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<DraftField>(null);
  const activeField = CONTRACT_FIELD_OPTIONS.find((field) => field.key === activeKey) ?? CONTRACT_FIELD_OPTIONS[0];
  const activePageFields = fields.filter((field) => field.page === page);
  const hiddenValue = useMemo(() => JSON.stringify(fields), [fields]);

  function beginDraw(event: PointerEvent<HTMLDivElement>) {
    if (!activeField) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPercent(event);
    setStart(point);
    setDraft({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  function continueDraw(event: PointerEvent<HTMLDivElement>) {
    if (!start) {
      return;
    }

    const point = pointerPercent(event);
    const x = Math.min(start.x, point.x);
    const y = Math.min(start.y, point.y);
    const width = Math.abs(point.x - start.x);
    const height = Math.abs(point.y - start.y);

    setDraft({
      x: roundPercent(x),
      y: roundPercent(y),
      width: roundPercent(width),
      height: roundPercent(height)
    });
  }

  function finishDraw() {
    if (!activeField || !draft) {
      setStart(null);
      setDraft(null);
      return;
    }

    const width = Math.max(8, draft.width || 24);
    const height = Math.max(3.5, draft.height || fieldDefaultHeight(activeField.type));
    const nextField: ContractPdfField = {
      id: `${activeField.key}-${Date.now()}`,
      key: activeField.key,
      label: activeField.label,
      type: activeField.type,
      page,
      x: roundPercent(clamp(draft.x, 0, Math.max(0, 100 - width))),
      y: roundPercent(clamp(draft.y, 0, Math.max(0, 100 - height))),
      width: roundPercent(width),
      height: roundPercent(height)
    };

    setFields((current) => [...current.filter((field) => field.key !== activeField.key), nextField]);
    setStart(null);
    setDraft(null);
  }

  function removeField(id: string) {
    setFields((current) => current.filter((field) => field.id !== id));
  }

  return (
    <details className="mt-4 rounded-md border border-ink/10 bg-paper p-3">
      <summary className="cursor-pointer text-sm font-semibold text-ink">PDF kitöltendő mezők</summary>

      <form action={saveContractPdfFieldsAction.bind(null, customerId, contractId)} className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <input type="hidden" name="pdfFields" value={hiddenValue} />

        <div className="space-y-3">
          <div className="relative mx-auto aspect-[1/1.414] w-full max-w-3xl overflow-hidden rounded-md border border-ink/10 bg-white shadow-soft">
            <object
              title={title}
              data={pdfUrlForPage(fileUrl, page)}
              type="application/pdf"
              className="absolute inset-0 h-full w-full pointer-events-none"
            >
              <iframe title={title} src={pdfUrlForPage(fileUrl, page)} className="h-full w-full" />
            </object>

            <div
              role="button"
              tabIndex={0}
              aria-label="PDF mező elhelyezése"
              className="absolute inset-0 cursor-crosshair touch-none"
              onPointerDown={beginDraw}
              onPointerMove={continueDraw}
              onPointerUp={finishDraw}
              onPointerCancel={finishDraw}
            >
              {activePageFields.map((field) => (
                <span
                  key={field.id}
                  className="absolute rounded border-2 border-brass bg-brass/15 px-1 text-[10px] font-semibold text-ink shadow-sm"
                  style={{
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: `${field.width}%`,
                    height: `${field.height}%`
                  }}
                >
                  {field.label}
                </span>
              ))}

              {draft ? (
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
        </div>

        <aside className="space-y-4 rounded-md border border-ink/10 bg-white p-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <MousePointer2 size={16} />
              Mező rajzolása
            </p>
            <p className="mt-1 text-xs leading-5 text-graphite/65">
              Válassz mezőtípust, majd húzz egy téglalapot a PDF-en oda, ahova az ügyfél válasza kerüljön.
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/65">Oldal</span>
            <input
              type="number"
              min={1}
              value={page}
              onChange={(event) => setPage(Math.max(1, Number(event.currentTarget.value) || 1))}
              className="h-10 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
            />
          </label>

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

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/65">Elhelyezett mezők</p>
            {fields.length > 0 ? (
              fields.map((field) => (
                <div key={field.id} className="flex items-center gap-2 rounded-md bg-paper px-3 py-2 text-sm text-graphite">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{field.label}</span>
                    <span className="text-xs text-graphite/60">{field.page}. oldal</span>
                  </span>
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
