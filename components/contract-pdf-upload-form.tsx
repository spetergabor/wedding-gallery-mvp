"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { uploadContractAction } from "@/lib/contract-actions";

function contractTitleFromFilename(filename: string) {
  return filename.replace(/\.[^/.]+$/, "").trim();
}

export function ContractPdfUploadForm({ customerId }: { customerId: string }) {
  const [title, setTitle] = useState("");

  return (
    <form action={uploadContractAction.bind(null, customerId)} className="mt-6 space-y-4 rounded-md border border-ink/10 bg-paper p-5">
      <div>
        <div className="flex items-center gap-2 text-base font-semibold text-ink">
          <UploadCloud size={18} />
          Kész PDF sablon feltöltése
        </div>
        <p className="mt-1 text-sm text-graphite/70">
          Válaszd ki a PDF-et; a szerződés címe automatikusan a fájlnév lesz, és szükség esetén átírható.
        </p>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-graphite">Szerződés címe</span>
        <input
          name="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="pl. Fotózás szerződés"
          className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-graphite">PDF fájl</span>
        <input
          name="contractPdf"
          type="file"
          accept="application/pdf,.pdf"
          required
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              setTitle(contractTitleFromFilename(file.name));
            }
          }}
          className="block w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        />
      </label>
      <FormSubmitButton className="w-full sm:w-auto" pendingLabel="Feltöltés...">
        <UploadCloud size={16} />
        PDF feltöltése és tovább
      </FormSubmitButton>
    </form>
  );
}
