"use client";

import dynamic from "next/dynamic";
import type { ContractPdfField } from "@/lib/contract-pdf-fields";

type PdfContractFieldViewerProps = {
  fileUrl: string;
  title: string;
  fields: ContractPdfField[];
  values: Record<string, string>;
  formId: string;
  disabled?: boolean;
};

const PdfContractFieldViewer = dynamic<PdfContractFieldViewerProps>(
  () => import("@/components/pdf-contract-field-viewer").then((module) => module.PdfContractFieldViewer),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-[420px] place-items-center rounded-md border border-ink/10 bg-white text-sm text-graphite/65">
        PDF betöltése...
      </div>
    )
  }
);

export function PdfContractFieldViewerClient(props: PdfContractFieldViewerProps) {
  return <PdfContractFieldViewer {...props} />;
}
