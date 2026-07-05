"use client";

import { useMemo, useState } from "react";
import { contractFieldInputName } from "@/lib/contract-fields";
import type { ContractPdfField } from "@/lib/contract-pdf-fields";

function pdfUrlForPage(fileUrl: string, page: number) {
  return `${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&page=${page}&view=FitH`;
}

export function PdfContractFieldViewer({
  fileUrl,
  title,
  fields,
  values,
  formId,
  disabled = false
}: {
  fileUrl: string;
  title: string;
  fields: ContractPdfField[];
  values: Record<string, string>;
  formId: string;
  disabled?: boolean;
}) {
  const pages = useMemo(() => [...new Set(fields.map((field) => field.page))].sort((left, right) => left - right), [fields]);
  const [activePage, setActivePage] = useState(pages[0] ?? 1);
  const activeFields = fields.filter((field) => field.page === activePage);

  return (
    <div className="space-y-3">
      {pages.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {pages.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setActivePage(page)}
              className={`h-9 rounded-md border px-3 text-sm font-medium transition ${
                activePage === page
                  ? "border-ink bg-ink text-white"
                  : "border-ink/10 bg-white text-graphite hover:bg-ink/5"
              }`}
            >
              {page}. oldal
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative mx-auto aspect-[1/1.414] w-full max-w-3xl overflow-hidden rounded-md border border-ink/10 bg-white shadow-soft">
        <object
          title={title}
          data={pdfUrlForPage(fileUrl, activePage)}
          type="application/pdf"
          className="absolute inset-0 h-full w-full pointer-events-none"
        >
          <iframe title={title} src={pdfUrlForPage(fileUrl, activePage)} className="h-full w-full" />
        </object>

        <div className="absolute inset-0">
          {activeFields.map((field) => {
            const commonClass =
              "h-full w-full rounded border border-brass/60 bg-white/92 px-2 text-[11px] font-medium text-ink shadow-sm outline-none transition focus:border-ink focus:bg-white";

            return (
              <label
                key={field.id}
                className="absolute block"
                style={{
                  left: `${field.x}%`,
                  top: `${field.y}%`,
                  width: `${field.width}%`,
                  height: `${field.height}%`
                }}
                title={field.label}
              >
                <span className="sr-only">{field.label}</span>
                {field.type === "textarea" ? (
                  <textarea
                    form={formId}
                    name={contractFieldInputName(field.key)}
                    defaultValue={values[field.key] ?? ""}
                    required
                    disabled={disabled}
                    placeholder={field.label}
                    className={`${commonClass} resize-none py-1 leading-4`}
                  />
                ) : (
                  <input
                    form={formId}
                    name={contractFieldInputName(field.key)}
                    type={field.type}
                    defaultValue={values[field.key] ?? ""}
                    required
                    disabled={disabled}
                    placeholder={field.label}
                    className={commonClass}
                  />
                )}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
