import { Download, ExternalLink, FileText, UploadCloud } from "lucide-react";
import { Button } from "@/components/button";
import { uploadContractAction } from "@/lib/contract-actions";

type Contract = {
  id: string;
  title: string;
  status: string;
  originalFilename: string;
  fileUrl: string;
  fileSize: number;
  sentAt: Date | null;
  openedAt: Date | null;
  signedAt: Date | null;
  createdAt: Date;
};

const statusLabels: Record<string, string> = {
  draft: "Vázlat",
  sent: "Elküldve",
  opened: "Megnyitva",
  signed: "Aláírva"
};

function formatFileSize(bytes: number) {
  if (bytes <= 0) {
    return "0 MB";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function formatDate(date: Date | null) {
  if (!date) {
    return null;
  }

  return date.toLocaleString("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function ContractManager({
  customerId,
  contracts
}: {
  customerId: string;
  contracts: Contract[];
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex size-11 items-center justify-center rounded-md bg-paper text-graphite">
        <FileText size={20} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink">Szerződések</h2>
      <p className="mt-2 text-sm text-graphite/70">
        Tölts fel PDF szerződést. A következő lépésben innen tudjuk majd emailben kiküldeni és aláíratni.
      </p>

      <form action={uploadContractAction.bind(null, customerId)} className="mt-5 space-y-3 rounded-md border border-ink/10 bg-paper p-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-graphite">Szerződés címe</span>
          <input
            name="title"
            required
            placeholder="pl. Esküvői fotózás szerződés"
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
            className="block w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
          />
        </label>
        <Button type="submit" className="w-full">
          <UploadCloud size={16} />
          PDF feltöltése
        </Button>
      </form>

      {contracts.length > 0 ? (
        <div className="mt-5 space-y-3">
          {contracts.map((contract) => (
            <article key={contract.id} className="rounded-md border border-ink/10 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{contract.title}</p>
                    <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                      {statusLabels[contract.status] ?? contract.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-graphite/70">{contract.originalFilename}</p>
                  <p className="mt-1 text-xs text-graphite/60">
                    {formatFileSize(contract.fileSize)} · feltöltve: {formatDate(contract.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <a
                    href={contract.fileUrl}
                    target="_blank"
                    className="inline-flex size-10 items-center justify-center rounded-md border border-ink/10 text-graphite transition hover:bg-ink/5"
                    title="PDF megnyitása"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <a
                    href={contract.fileUrl}
                    download={contract.originalFilename}
                    className="inline-flex size-10 items-center justify-center rounded-md border border-ink/10 text-graphite transition hover:bg-ink/5"
                    title="PDF letöltése"
                  >
                    <Download size={16} />
                  </a>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-graphite/60">
                <p>Elküldve: {formatDate(contract.sentAt) ?? "még nincs"}</p>
                <p>Megnyitva: {formatDate(contract.openedAt) ?? "még nincs"}</p>
                <p>Aláírva: {formatDate(contract.signedAt) ?? "még nincs"}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-md bg-paper px-4 py-3 text-sm text-graphite/70">
          Még nincs feltöltött szerződés.
        </div>
      )}
    </section>
  );
}
