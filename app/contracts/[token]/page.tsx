import { Download, ExternalLink, FileText, PenLine } from "lucide-react";
import { ContractSignaturePad } from "@/components/contract-signature-pad";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null) {
  if (!date) {
    return "Nincs dátum megadva";
  }

  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatDateTime(date: Date | null) {
  if (!date) {
    return null;
  }

  return date.toLocaleString("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function ContractUnavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5 py-10">
      <section className="w-full max-w-lg rounded-lg border border-ink/10 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-paper text-graphite">
          <FileText size={22} />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-ink">A szerződés nem érhető el</h1>
        <p className="mt-3 text-sm leading-6 text-graphite/70">
          A link hibás vagy lejárt. Kérlek, kérj új szerződés linket a fotóstól.
        </p>
      </section>
    </main>
  );
}

export default async function ContractPublicPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ signed?: string; signError?: string }>;
}) {
  const [{ token }, flags] = await Promise.all([params, searchParams]);
  const contract = await prisma.contract.findUnique({
    where: { accessToken: token },
    include: {
      customer: {
        select: {
          coupleName: true,
          primaryEmail: true,
          secondaryEmail: true,
          weddingDate: true,
          venue: true
        }
      }
    }
  });

  if (!contract || !contract.accessTokenExpiresAt || contract.accessTokenExpiresAt < new Date()) {
    return <ContractUnavailable />;
  }

  const openedAt = contract.openedAt ?? new Date();
  const currentPdfUrl = contract.signedFileUrl ?? contract.fileUrl;
  const currentPdfFilename = contract.signedFileUrl
    ? `signed-${contract.originalFilename}`
    : contract.originalFilename;

  if (!contract.openedAt) {
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        openedAt,
        status: contract.status === "sent" ? "opened" : contract.status
      }
    });
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-lg border border-ink/10 bg-white shadow-soft">
          <div className="grid gap-6 border-b border-ink/10 p-5 md:grid-cols-[1fr_auto] md:items-start md:p-8">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-brass">Szerződés</p>
              <h1 className="mt-3 text-3xl font-semibold text-ink md:text-4xl">{contract.title}</h1>
              <p className="mt-3 text-base text-graphite/75">{contract.customer.coupleName}</p>
              <div className="mt-5 grid gap-2 text-sm text-graphite/65 sm:grid-cols-2">
                <p>Esküvő dátuma: {formatDate(contract.customer.weddingDate)}</p>
                <p>Helyszín: {contract.customer.venue || "Nincs megadva"}</p>
                <p>Elküldve: {formatDateTime(contract.sentAt) ?? "nincs adat"}</p>
                <p>Link lejár: {formatDateTime(contract.accessTokenExpiresAt)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end">
              <a
                href={currentPdfUrl}
                target="_blank"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/10 px-4 text-sm font-medium text-graphite transition hover:bg-ink/5"
              >
                <ExternalLink size={16} />
                {contract.signedFileUrl ? "Aláírt PDF megnyitása" : "PDF megnyitása"}
              </a>
              <a
                href={currentPdfUrl}
                download={currentPdfFilename}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
              >
                <Download size={16} />
                {contract.signedFileUrl ? "Aláírt PDF letöltése" : "PDF letöltése"}
              </a>
            </div>
          </div>

          <div className="grid gap-6 p-4 md:p-6 lg:grid-cols-[1fr_320px]">
            <div className="overflow-hidden rounded-md border border-ink/10 bg-paper">
              <iframe
                title={contract.title}
                src={currentPdfUrl}
                className="h-[68vh] min-h-[520px] w-full bg-white"
              />
            </div>

            <aside className="rounded-md border border-ink/10 bg-paper p-5">
              <div className="flex size-11 items-center justify-center rounded-md bg-white text-graphite">
                <PenLine size={20} />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-ink">Aláírás</h2>
              {flags.signed ? (
                <div className="mt-3 rounded-md border border-sage/20 bg-sage/10 px-4 py-3 text-sm text-sage">
                  Köszönjük, a szerződés aláírása sikeresen mentve lett.
                </div>
              ) : null}
              {flags.signError === "missing" ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Kérlek, rajzolj aláírást a mezőbe.
                </div>
              ) : null}
              {flags.signError === "expired" ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  A link lejárt. Kérj új szerződés linket.
                </div>
              ) : null}
              {flags.signError === "server" ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Az aláírás mentése közben hiba történt. Kérlek, próbáld újra, vagy jelezd a fotósnak.
                </div>
              ) : null}
              <p className="mt-2 text-sm leading-6 text-graphite/70">
                Írjátok alá a szerződést ujjal vagy egérrel. Mentés után elkészül egy aláírt PDF példány.
              </p>
              <ContractSignaturePad token={token} disabled={Boolean(contract.signedAt && contract.signedFileUrl)} />
              <div className="mt-5 rounded-md bg-white px-4 py-3 text-sm text-graphite/70">
                Státusz: {contract.signedAt ? "Aláírva" : openedAt ? "Megnyitva" : "Elküldve"}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
