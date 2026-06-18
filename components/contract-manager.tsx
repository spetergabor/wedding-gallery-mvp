import { Download, ExternalLink, FileText, Mail, PenLine, UploadCloud } from "lucide-react";
import { Button } from "@/components/button";
import { CONTRACT_FIELD_OPTIONS } from "@/lib/contract-fields";
import { createWrittenContractAction, sendContractAction, uploadContractAction } from "@/lib/contract-actions";

type Contract = {
  id: string;
  title: string;
  status: string;
  sourceType: string;
  originalFilename: string;
  fileUrl: string;
  fileSize: number;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
  sentAt: Date | null;
  openedAt: Date | null;
  signedAt: Date | null;
  signedFileUrl: string | null;
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
    <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
      <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-5 md:flex-row md:items-start">
        <div>
          <div className="flex size-11 items-center justify-center rounded-md bg-paper text-graphite">
            <FileText size={20} />
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-ink">Szerződések</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">
            Tölts fel kész PDF-et, vagy írj saját szerződést kitöltendő ügyfél mezőkkel. Innen tudod kiküldeni,
            követni és letölteni az aláírt példányt.
          </p>
        </div>
        <div className="rounded-md bg-paper px-4 py-3 text-sm text-graphite">
          {contracts.length} szerződés
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <form action={createWrittenContractAction.bind(null, customerId)} className="space-y-3 rounded-md border border-ink/10 bg-paper p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <PenLine size={16} />
            Saját szerződés írása
          </div>
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
            <span className="text-sm font-medium text-graphite">Szerződés szövege</span>
            <textarea
              name="bodyText"
              required
              rows={8}
              placeholder="Írd ide a szerződés szövegét. A pár a kiválasztott mezőket lent fogja kitölteni, majd aláírja."
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-3 text-sm leading-6 text-ink outline-none transition focus:border-ink/50"
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-graphite">A pár által kitöltendő mezők</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONTRACT_FIELD_OPTIONS.map((field) => (
                <label key={field.key} className="flex items-center gap-2 rounded-md border border-ink/10 bg-white px-3 py-2 text-sm text-graphite">
                  <input
                    type="checkbox"
                    name="clientFields"
                    value={field.key}
                    defaultChecked={["coupleName", "primaryEmail", "phone", "weddingDate", "venue"].includes(field.key)}
                    className="size-4 accent-ink"
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" className="w-full">
            <PenLine size={16} />
            Szerződés létrehozása
          </Button>
        </form>

        <form action={uploadContractAction.bind(null, customerId)} className="space-y-3 rounded-md border border-ink/10 bg-paper p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <UploadCloud size={16} />
            Kész PDF feltöltése
          </div>
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
      </div>

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
                    {contract.sourceType === "written" ? "Platformon írt szerződés" : formatFileSize(contract.fileSize)} · feltöltve: {formatDate(contract.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <form action={sendContractAction.bind(null, customerId, contract.id)}>
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-graphite transition hover:bg-ink/5"
                      title="Szerződés kiküldése emailben"
                    >
                      <Mail size={16} />
                      Küldés
                    </button>
                  </form>
                  {contract.fileUrl ? (
                    <>
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
                    </>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-graphite/60">
                <p>Elküldve: {formatDate(contract.sentAt) ?? "még nincs"}</p>
                <p>Megnyitva: {formatDate(contract.openedAt) ?? "még nincs"}</p>
                <p>Aláírva: {formatDate(contract.signedAt) ?? "még nincs"}</p>
                {contract.accessTokenExpiresAt ? (
                  <p>Link lejár: {formatDate(contract.accessTokenExpiresAt)}</p>
                ) : null}
              </div>
              {contract.signedFileUrl ? (
                <div className="mt-4 flex flex-wrap gap-2 rounded-md bg-sage/10 p-3 text-sm text-sage">
                  <span className="mr-auto font-medium">Aláírt PDF elkészült</span>
                  <a
                    href={contract.signedFileUrl}
                    target="_blank"
                    className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 font-medium text-graphite transition hover:bg-ink/5"
                  >
                    <ExternalLink size={15} />
                    Megnyitás
                  </a>
                  <a
                    href={contract.signedFileUrl}
                    download={`signed-${contract.originalFilename}`}
                    className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 font-medium text-graphite transition hover:bg-ink/5"
                  >
                    <Download size={15} />
                    Letöltés
                  </a>
                </div>
              ) : null}
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
