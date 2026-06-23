import { Download, ExternalLink, FileText, PenLine } from "lucide-react";
import { ContractSignaturePad } from "@/components/contract-signature-pad";
import {
  contractFieldDisplayLabel,
  contractFieldInputName,
  fieldKeysInContractTemplate,
  parseContractAnswers,
  parseContractFields,
  parseContractTemplateParts,
  type ContractFieldDefinition
} from "@/lib/contract-fields";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null) {
  if (!date) {
    return "Kein Datum angegeben";
  }

  return date.toLocaleDateString("de-AT", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

function formatDateTime(date: Date | null) {
  if (!date) {
    return null;
  }

  return date.toLocaleString("de-AT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE
  });
}

function ContractUnavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5 py-10">
      <section className="w-full max-w-lg rounded-lg border border-ink/10 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-paper text-graphite">
          <FileText size={22} />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-ink">Der Vertrag ist nicht verfügbar</h1>
        <p className="mt-3 text-sm leading-6 text-graphite/70">
          Der Link ist ungültig oder abgelaufen. Bitte fordert beim Fotografen einen neuen Vertragslink an.
        </p>
      </section>
    </main>
  );
}

function ContractInlineInput({
  field,
  defaultValue,
  formId
}: {
  field: ContractFieldDefinition;
  defaultValue: string;
  formId: string;
}) {
  const inputName = contractFieldInputName(field.key);
  const label = contractFieldDisplayLabel(field);

  if (field.type === "textarea") {
    return (
      <label className="my-3 block rounded-md border border-ink/10 bg-paper p-3">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-brass">
          {label}
        </span>
        <textarea
          form={formId}
          name={inputName}
          defaultValue={defaultValue}
          required
          rows={3}
          className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/50"
        />
      </label>
    );
  }

  return (
    <label className="mx-1 inline-flex translate-y-1 flex-col gap-1 align-baseline">
      <span className="sr-only">{label}</span>
      <input
        form={formId}
        name={inputName}
        type={field.type}
        defaultValue={defaultValue}
        required
        placeholder={label}
        className="h-9 min-w-44 rounded-md border border-brass/40 bg-brass/10 px-3 text-sm font-medium text-ink outline-none transition placeholder:text-graphite/45 focus:border-brass"
      />
    </label>
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
          phone: true,
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
  const isWrittenContract = contract.sourceType === "written";
  const contractFields = parseContractFields(contract.clientFields);
  const completedFields = parseContractAnswers(contract.completedFields);
  const signatureFormId = `contract-signature-form-${contract.id}`;
  const templateParts = parseContractTemplateParts(contract.bodyText ?? "", contractFields);
  const templateFieldKeys = fieldKeysInContractTemplate(contract.bodyText ?? "");
  const extraContractFields = contractFields.filter((field) => !templateFieldKeys.has(field.key));
  const customerDefaults: Record<string, string> = {
    coupleName: contract.customer.coupleName,
    primaryEmail: contract.customer.primaryEmail,
    phone: contract.customer.phone ?? "",
    weddingDate: contract.customer.weddingDate ? contract.customer.weddingDate.toISOString().slice(0, 10) : "",
    venue: contract.customer.venue ?? ""
  };

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
              <p className="text-sm uppercase tracking-[0.24em] text-brass">Vertrag</p>
              <h1 className="mt-3 text-3xl font-semibold text-ink md:text-4xl">{contract.title}</h1>
              <p className="mt-3 text-base text-graphite/75">{contract.customer.coupleName}</p>
              <div className="mt-5 grid gap-2 text-sm text-graphite/65 sm:grid-cols-2">
                <p>Datum: {formatDate(contract.customer.weddingDate)}</p>
                <p>Location: {contract.customer.venue || "Nicht angegeben"}</p>
                <p>Gesendet: {formatDateTime(contract.sentAt) ?? "keine Angabe"}</p>
                <p>Link gültig bis: {formatDateTime(contract.accessTokenExpiresAt)}</p>
              </div>
            </div>

            {currentPdfUrl ? (
              <div className="flex flex-wrap gap-2 md:justify-end">
                <a
                  href={currentPdfUrl}
                  target="_blank"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/10 px-4 text-sm font-medium text-graphite transition hover:bg-ink/5"
                >
                  <ExternalLink size={16} />
                  {contract.signedFileUrl ? "Signiertes PDF öffnen" : "PDF öffnen"}
                </a>
                <a
                  href={currentPdfUrl}
                  download={currentPdfFilename}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
                >
                  <Download size={16} />
                  {contract.signedFileUrl ? "Signiertes PDF herunterladen" : "PDF herunterladen"}
                </a>
              </div>
            ) : null}
          </div>

          <div className="grid gap-6 p-4 md:p-6 lg:grid-cols-[1fr_320px]">
            <div className="overflow-hidden rounded-md border border-ink/10 bg-paper">
              {currentPdfUrl ? (
                <iframe
                  title={contract.title}
                  src={currentPdfUrl}
                  className="h-[68vh] min-h-[520px] w-full bg-white"
                />
              ) : (
                <div className="min-h-[520px] bg-white p-6 md:p-8">
                  <h2 className="text-2xl font-semibold text-ink">{contract.title}</h2>
                  <div className="mt-6 text-sm leading-8 text-graphite">
                    {templateParts.map((part, index) => {
                      if (part.type === "text") {
                        return (
                          <span key={`${part.type}-${index}`} className="whitespace-pre-wrap">
                            {part.value}
                          </span>
                        );
                      }

                      return (
                        <ContractInlineInput
                          key={`${part.field.key}-${index}`}
                          field={part.field}
                          formId={signatureFormId}
                          defaultValue={completedFields[part.field.key] ?? customerDefaults[part.field.key] ?? ""}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <aside className="rounded-md border border-ink/10 bg-paper p-5">
              <div className="flex size-11 items-center justify-center rounded-md bg-white text-graphite">
                <PenLine size={20} />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-ink">Unterschrift</h2>
              {flags.signed ? (
                <div className="mt-3 rounded-md border border-sage/20 bg-sage/10 px-4 py-3 text-sm text-sage">
                  Vielen Dank, der Vertrag wurde erfolgreich unterschrieben.
                </div>
              ) : null}
              {flags.signError === "missing" ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Bitte zeichnet eure Unterschrift in das Feld.
                </div>
              ) : null}
              {flags.signError === "expired" ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Der Link ist abgelaufen. Bitte fordert einen neuen Vertragslink an.
                </div>
              ) : null}
              {flags.signError === "server" ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Beim Speichern der Unterschrift ist ein Fehler aufgetreten. Bitte versucht es erneut oder kontaktiert den Fotografen.
                </div>
              ) : null}
              <p className="mt-2 text-sm leading-6 text-graphite/70">
                {isWrittenContract
                  ? "Füllt die erforderlichen Angaben aus und unterschreibt anschließend. Nach dem Speichern wird ein signiertes PDF erstellt."
                  : "Unterschreibt den Vertrag mit Finger oder Maus. Nach dem Speichern wird eine signierte PDF-Kopie erstellt."}
              </p>
              <ContractSignaturePad
                token={token}
                formId={signatureFormId}
                disabled={Boolean(contract.signedAt && contract.signedFileUrl)}
              >
                {isWrittenContract ? (
                  <div className="rounded-md border border-ink/10 bg-white p-4 text-sm leading-6 text-graphite/70">
                    Die auszufüllenden Felder erscheinen im Vertragstext. Prüft die Angaben und unterschreibt anschließend.
                  </div>
                ) : null}
                {isWrittenContract && extraContractFields.length > 0 ? (
                  <div className="space-y-3 rounded-md border border-ink/10 bg-white p-4">
                    <p className="text-sm font-semibold text-ink">Weitere auszufüllende Angaben</p>
                    {extraContractFields.map((field) => {
                      const defaultValue = completedFields[field.key] ?? customerDefaults[field.key] ?? "";
                      const inputName = contractFieldInputName(field.key);
                      const label = contractFieldDisplayLabel(field);

                      return (
                        <label key={field.key} className="block space-y-1.5">
                          <span className="text-xs font-medium text-graphite">{label}</span>
                          {field.type === "textarea" ? (
                            <textarea
                              name={inputName}
                              defaultValue={defaultValue}
                              required
                              rows={3}
                              className="w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/50"
                            />
                          ) : (
                            <input
                              name={inputName}
                              type={field.type}
                              defaultValue={defaultValue}
                              required
                              className="h-10 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </ContractSignaturePad>
              <div className="mt-5 rounded-md bg-white px-4 py-3 text-sm text-graphite/70">
                Status: {contract.signedAt ? "Unterzeichnet" : openedAt ? "Geöffnet" : "Gesendet"}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
