"use client";

import { PdfPreviewCanvas, usePdfPreviewPages } from "@/components/pdf-preview";
import { contractFieldInputName } from "@/lib/contract-fields";
import type { ContractPdfField } from "@/lib/contract-pdf-fields";

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
  const { pages, isLoading, error } = usePdfPreviewPages(fileUrl);

  return (
    <div className="max-h-[72vh] overflow-y-auto rounded-md border border-ink/10 bg-paper p-3">
      {isLoading ? (
        <div className="grid min-h-[420px] place-items-center rounded-md bg-white text-sm text-graphite/65">
          PDF betöltése...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
          A PDF előnézet nem tölthető be. Nyissátok meg a PDF-et külön ablakban, majd töltsétek ki az adatokat.
        </div>
      ) : null}

      {!isLoading && !error ? (
        <div className="space-y-5">
          {pages.map((pdfPage) => {
            const pageFields = fields.filter((field) => field.page === pdfPage.pageNumber);

            return (
              <section key={pdfPage.pageNumber} className="mx-auto w-full max-w-3xl">
                <div className="mb-2 text-xs font-medium text-graphite/65">{pdfPage.pageNumber}. oldal</div>
                <div
                  className="relative overflow-hidden rounded-md border border-ink/10 bg-white shadow-soft"
                  style={{ aspectRatio: `${pdfPage.width} / ${pdfPage.height}` }}
                >
                  <PdfPreviewCanvas page={pdfPage} className="absolute inset-0 h-full w-full select-none" />

                  <div className="absolute inset-0">
                    {pageFields.map((field) => {
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
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
