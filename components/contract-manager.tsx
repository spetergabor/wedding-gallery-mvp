import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Mail,
  PenLine,
  Trash2,
  UploadCloud
} from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PdfContractFieldEditor } from "@/components/pdf-contract-field-editor";
import { WrittenContractEditor } from "@/components/written-contract-editor";
import { deleteContractAction, sendContractAction, uploadContractAction } from "@/lib/contract-actions";
import { parseContractPdfFields } from "@/lib/contract-pdf-fields";
import { APP_TIME_ZONE } from "@/lib/date-format";

type Contract = {
  id: string;
  title: string;
  status: string;
  sourceType: string;
  originalFilename: string;
  fileUrl: string;
  fileSize: number;
  clientFields: unknown;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
  sentAt: Date | null;
  openedAt: Date | null;
  signedAt: Date | null;
  signedFileUrl: string | null;
  documentHash: string | null;
  signedPdfHash: string | null;
  signatureIpAddress: string | null;
  signatureUserAgent: string | null;
  acceptedTermsAt: Date | null;
  acceptedPrivacyAt: Date | null;
  createdAt: Date;
};

type ContractCustomer = {
  coupleName: string;
  primaryEmail: string;
  secondaryEmail: string | null;
  wifeName: string | null;
  wifeEmail: string | null;
  husbandName: string | null;
  husbandEmail: string | null;
  partnerName: string | null;
  partnerEmail: string | null;
};

type RecipientOption = {
  key: string;
  label: string;
  email: string;
  defaultChecked: boolean;
};

type ContractFlow = "choice" | "write" | "upload" | "fields" | "email";

const statusLabels: Record<string, string> = {
  draft: "Vázlat",
  sent: "Elküldve",
  opened: "Megnyitva",
  signed: "Aláírva"
};

const flowLabels: Record<Exclude<ContractFlow, "choice">, string> = {
  write: "Szerződés írása",
  upload: "PDF feltöltése",
  fields: "PDF mezők",
  email: "Email küldés"
};

function normalizeContractFlow(value: string | undefined): ContractFlow {
  return value === "write" || value === "upload" || value === "fields" || value === "email" ? value : "choice";
}

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
    timeStyle: "short",
    timeZone: APP_TIME_ZONE
  });
}

function shortHash(value: string | null) {
  return value ? `${value.slice(0, 12)}...${value.slice(-8)}` : "nincs";
}

function addRecipientOption(options: RecipientOption[], option: RecipientOption) {
  const normalized = option.email.trim().toLowerCase();

  if (!normalized || options.some((item) => item.email.trim().toLowerCase() === normalized)) {
    return;
  }

  options.push({ ...option, email: normalized });
}

function recipientOptions(customer: ContractCustomer, admin: { name: string | null; email: string }) {
  const options: RecipientOption[] = [];

  addRecipientOption(options, {
    key: "wife",
    label: customer.wifeName ? `Feleség: ${customer.wifeName}` : "Feleség",
    email: customer.wifeEmail ?? "",
    defaultChecked: true
  });
  addRecipientOption(options, {
    key: "husband",
    label: customer.husbandName ? `Férj: ${customer.husbandName}` : "Férj",
    email: customer.husbandEmail ?? "",
    defaultChecked: true
  });
  addRecipientOption(options, {
    key: "partner",
    label: customer.partnerName ? `Partner: ${customer.partnerName}` : "Partner",
    email: customer.partnerEmail ?? "",
    defaultChecked: true
  });
  addRecipientOption(options, {
    key: "primary",
    label: "Elsődleges e-mail",
    email: customer.primaryEmail,
    defaultChecked: true
  });
  addRecipientOption(options, {
    key: "secondary",
    label: "Másodlagos e-mail",
    email: customer.secondaryEmail ?? "",
    defaultChecked: true
  });
  addRecipientOption(options, {
    key: "admin",
    label: admin.name ? `Saját másolat: ${admin.name}` : "Saját másolat",
    email: admin.email,
    defaultChecked: false
  });

  return options;
}

function contractFlowHref(customerId: string, flow: ContractFlow, contractId?: string) {
  const params = new URLSearchParams({ tab: "contracts" });

  if (flow !== "choice") {
    params.set("contractFlow", flow);
  }

  if (contractId) {
    params.set("contractId", contractId);
  }

  return `/admin/clients/${customerId}?${params.toString()}`;
}

function flowSteps(flow: ContractFlow, contract?: Contract | null) {
  if (flow === "write" || (flow === "email" && contract?.sourceType === "written")) {
    return ["Szerződés típusa", "Szerződés írása", "Email küldés"];
  }

  return ["Szerződés típusa", "PDF feltöltése", "Mezők elhelyezése", "Email küldés"];
}

function currentStepIndex(flow: ContractFlow, contract?: Contract | null) {
  if (flow === "write") {
    return 1;
  }

  if (flow === "upload") {
    return 1;
  }

  if (flow === "fields") {
    return 2;
  }

  if (flow === "email") {
    return contract?.sourceType === "written" ? 2 : 3;
  }

  return 0;
}

function ContractProgress({ flow, contract }: { flow: ContractFlow; contract?: Contract | null }) {
  if (flow === "choice") {
    return null;
  }

  const steps = flowSteps(flow, contract);
  const activeIndex = currentStepIndex(flow, contract);

  return (
    <ol className="mt-5 grid gap-2 rounded-md border border-ink/10 bg-paper p-3 text-xs font-medium text-graphite sm:grid-cols-3 lg:grid-cols-4">
      {steps.map((step, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;

        return (
          <li
            key={step}
            className={`flex items-center gap-2 rounded-md px-3 py-2 ${
              isActive ? "bg-ink text-white" : isDone ? "bg-white text-sage" : "bg-white text-graphite/60"
            }`}
          >
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[11px] ${
                isActive ? "bg-white/15 text-white" : isDone ? "bg-sage/10 text-sage" : "bg-paper text-graphite/60"
              }`}
            >
              {isDone ? <CheckCircle2 size={13} /> : index + 1}
            </span>
            {step}
          </li>
        );
      })}
    </ol>
  );
}

function ContractStatusMeta({ contract }: { contract: Contract }) {
  return (
    <div className="mt-3 grid gap-2 text-xs text-graphite/60 sm:grid-cols-2">
      <p>Elküldve: {formatDate(contract.sentAt) ?? "még nincs"}</p>
      <p>Megnyitva: {formatDate(contract.openedAt) ?? "még nincs"}</p>
      <p>Aláírva: {formatDate(contract.signedAt) ?? "még nincs"}</p>
      {contract.accessTokenExpiresAt ? <p>Link lejár: {formatDate(contract.accessTokenExpiresAt)}</p> : null}
      {contract.signedAt ? (
        <>
          <p>Szerződés hash: {shortHash(contract.documentHash)}</p>
          <p>Aláírt PDF hash: {shortHash(contract.signedPdfHash)}</p>
          <p>IP: {contract.signatureIpAddress ?? "nincs adat"}</p>
          <p>Böngésző: {contract.signatureUserAgent ? contract.signatureUserAgent.slice(0, 120) : "nincs adat"}</p>
        </>
      ) : null}
    </div>
  );
}

function ContractSummary({
  customerId,
  contract,
  compact = false
}: {
  customerId: string;
  contract: Contract;
  compact?: boolean;
}) {
  const isPdf = contract.sourceType !== "written" && contract.fileUrl;

  return (
    <div className="rounded-md border border-ink/10 bg-white p-4">
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

        <div className="flex shrink-0 flex-wrap gap-2">
          {isPdf ? (
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
          <form action={deleteContractAction.bind(null, customerId, contract.id)}>
            <ConfirmSubmitButton
              variant="danger"
              className="size-10 px-0"
              message={`Biztosan törlöd ezt a szerződést: ${contract.title}? A PDF is törlődik a tárhelyről.`}
              title="Szerződés törlése"
            >
              <Trash2 size={16} />
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      {!compact ? <ContractStatusMeta contract={contract} /> : null}

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
    </div>
  );
}

function ContractEmailForm({
  customerId,
  contract,
  recipients
}: {
  customerId: string;
  contract: Contract;
  recipients: RecipientOption[];
}) {
  return (
    <form action={sendContractAction.bind(null, customerId, contract.id)} className="space-y-4 rounded-md border border-ink/10 bg-paper p-5">
      <div>
        <div className="flex items-center gap-2 text-base font-semibold text-ink">
          <Mail size={18} />
          Szerződés kiküldése
        </div>
        <p className="mt-1 text-sm text-graphite/70">
          Válaszd ki a címzetteket, írj rövid üzenetet, majd küldd ki az aláírási linket.
        </p>
      </div>

      <div>
        <p className="text-sm font-medium text-graphite">Címzettek</p>
        {recipients.length > 0 ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {recipients.map((recipient) => (
              <label
                key={`${recipient.key}-${recipient.email}`}
                className="flex items-start gap-2 rounded-md border border-ink/10 bg-white px-3 py-2 text-sm text-graphite"
              >
                <input
                  type="checkbox"
                  name="recipients"
                  value={recipient.email}
                  defaultChecked={recipient.defaultChecked}
                  className="mt-1 size-4 accent-ink"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{recipient.label}</span>
                  <span className="block break-all text-xs text-graphite/60">{recipient.email}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-md bg-white px-3 py-2 text-sm text-graphite/70">
            Nincs mentett e-mail cím ehhez az ügyfélhez.
          </p>
        )}
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-graphite">További címzettek</span>
        <input
          name="additionalRecipients"
          placeholder="pl. masolat@email.com, planner@email.com"
          className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-graphite">Email tárgya</span>
        <input
          name="emailSubject"
          placeholder={`Üresen hagyva automatikus: ${contract.title}`}
          className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-graphite">Rövid üzenet</span>
        <textarea
          name="emailMessage"
          rows={4}
          placeholder="pl. Sziasztok, itt találjátok a szerződést aláírásra. Köszönöm!"
          className="w-full rounded-md border border-ink/15 bg-white px-3 py-3 text-sm leading-6 text-ink outline-none transition focus:border-ink/50"
        />
      </label>

      <FormSubmitButton
        variant="primary"
        className="w-full sm:w-auto"
        pendingLabel="Küldés..."
        title="Szerződés kiküldése emailben"
      >
        <Mail size={16} />
        Email küldése
      </FormSubmitButton>
    </form>
  );
}

export function ContractManager({
  customerId,
  customer,
  admin,
  contracts,
  initialFlow,
  selectedContractId
}: {
  customerId: string;
  customer: ContractCustomer;
  admin: { name: string | null; email: string };
  contracts: Contract[];
  initialFlow?: string;
  selectedContractId?: string;
}) {
  const recipients = recipientOptions(customer, admin);
  const requestedFlow = normalizeContractFlow(initialFlow);
  const selectedContract = selectedContractId ? contracts.find((contract) => contract.id === selectedContractId) ?? null : null;
  const fallbackContract = contracts[0] ?? null;
  const selectedOrFallbackContract = selectedContract ?? fallbackContract;
  const selectedPdfContract =
    selectedContract && selectedContract.sourceType !== "written"
      ? selectedContract
      : contracts.find((contract) => contract.sourceType !== "written" && contract.fileUrl) ?? null;
  const activeFlow =
    requestedFlow === "fields" && !selectedPdfContract
      ? "upload"
      : requestedFlow === "email" && !selectedOrFallbackContract
        ? "choice"
        : requestedFlow;
  const emailContract = selectedOrFallbackContract;

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
      <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-5 md:flex-row md:items-start">
        <div>
          <div className="flex size-11 items-center justify-center rounded-md bg-paper text-graphite">
            <FileText size={20} />
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-ink">Szerződések</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">
            Válaszd ki, hogy platformon írsz szerződést, vagy kész PDF sablont töltesz fel, majd lépésenként küldd ki aláírásra.
          </p>
          <ContractProgress flow={activeFlow} contract={emailContract} />
        </div>
        <div className="rounded-md bg-paper px-4 py-3 text-sm text-graphite">
          {contracts.length} szerződés
        </div>
      </div>

      {activeFlow !== "choice" ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={contractFlowHref(customerId, "choice")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 bg-white px-3 text-sm font-medium text-graphite transition hover:bg-ink/5"
          >
            <ArrowLeft size={15} />
            Vissza a választáshoz
          </Link>
          <p className="rounded-md bg-paper px-3 py-2 text-sm font-medium text-graphite">
            {flowLabels[activeFlow as Exclude<ContractFlow, "choice">]}
          </p>
        </div>
      ) : null}

      {activeFlow === "choice" ? (
        <div className="mt-6 space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brass">Új szerződés</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">Hogyan szeretnéd elkészíteni?</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href={contractFlowHref(customerId, "write")}
              className="group rounded-md border border-ink/10 bg-paper p-5 transition hover:border-ink/25 hover:bg-white"
            >
              <div className="flex size-11 items-center justify-center rounded-md bg-white text-graphite transition group-hover:bg-ink group-hover:text-white">
                <PenLine size={20} />
              </div>
              <h4 className="mt-4 text-lg font-semibold text-ink">Új szerződés írása a platformon</h4>
              <p className="mt-2 text-sm leading-6 text-graphite/70">
                Akkor jó, ha itt szeretnéd megírni vagy bemásolni a szerződés szövegét, és változókat szúrnál be a szövegbe.
              </p>
            </Link>

            <Link
              href={contractFlowHref(customerId, "upload")}
              className="group rounded-md border border-ink/10 bg-paper p-5 transition hover:border-ink/25 hover:bg-white"
            >
              <div className="flex size-11 items-center justify-center rounded-md bg-white text-graphite transition group-hover:bg-ink group-hover:text-white">
                <UploadCloud size={20} />
              </div>
              <h4 className="mt-4 text-lg font-semibold text-ink">Kész PDF sablon feltöltése</h4>
              <p className="mt-2 text-sm leading-6 text-graphite/70">
                Akkor használd, ha már van kész PDF szerződésed, és csak kitöltendő mezőket szeretnél ráhelyezni.
              </p>
            </Link>
          </div>

          {contracts.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-5">
                <h3 className="text-base font-semibold text-ink">Meglévő szerződések</h3>
                <span className="text-sm text-graphite/60">{contracts.length} db</span>
              </div>
              {contracts.map((contract) => (
                <div key={contract.id} className="space-y-2">
                  <ContractSummary customerId={customerId} contract={contract} compact />
                  <div className="flex flex-wrap gap-2">
                    {contract.sourceType !== "written" && contract.fileUrl ? (
                      <Link
                        href={contractFlowHref(customerId, "fields", contract.id)}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm font-medium text-graphite transition hover:bg-ink/5"
                      >
                        <FileText size={15} />
                        PDF mezők
                      </Link>
                    ) : null}
                    <Link
                      href={contractFlowHref(customerId, "email", contract.id)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white transition hover:bg-graphite"
                    >
                      <Mail size={15} />
                      Email küldés
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md bg-paper px-4 py-3 text-sm text-graphite/70">
              Még nincs feltöltött vagy létrehozott szerződés.
            </div>
          )}
        </div>
      ) : null}

      {activeFlow === "write" ? (
        <div className="mt-6">
          <WrittenContractEditor customerId={customerId} />
        </div>
      ) : null}

      {activeFlow === "upload" ? (
        <form action={uploadContractAction.bind(null, customerId)} className="mt-6 space-y-4 rounded-md border border-ink/10 bg-paper p-5">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-ink">
              <UploadCloud size={18} />
              Kész PDF sablon feltöltése
            </div>
            <p className="mt-1 text-sm text-graphite/70">
              Add meg a szerződés címét, töltsd fel a PDF-et, majd a következő lépésben elhelyezheted rajta a kitöltendő mezőket.
            </p>
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Szerződés címe</span>
            <input
              name="title"
              required
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
              className="block w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            />
          </label>
          <FormSubmitButton className="w-full sm:w-auto" pendingLabel="Feltöltés...">
            <UploadCloud size={16} />
            PDF feltöltése és tovább
          </FormSubmitButton>
        </form>
      ) : null}

      {activeFlow === "fields" ? (
        <div className="mt-6 space-y-4">
          {selectedPdfContract ? (
            <>
              <ContractSummary customerId={customerId} contract={selectedPdfContract} />
              <PdfContractFieldEditor
                customerId={customerId}
                contractId={selectedPdfContract.id}
                fileUrl={selectedPdfContract.fileUrl}
                title={selectedPdfContract.title}
                initialFields={parseContractPdfFields(selectedPdfContract.clientFields)}
                defaultOpen
              />
            </>
          ) : (
            <div className="rounded-md bg-paper px-4 py-3 text-sm text-graphite/70">
              Ehhez a lépéshez előbb tölts fel egy PDF szerződést.
            </div>
          )}
        </div>
      ) : null}

      {activeFlow === "email" ? (
        <div className="mt-6 space-y-4">
          {emailContract ? (
            <>
              <ContractSummary customerId={customerId} contract={emailContract} />
              <ContractEmailForm customerId={customerId} contract={emailContract} recipients={recipients} />
            </>
          ) : (
            <div className="rounded-md bg-paper px-4 py-3 text-sm text-graphite/70">
              Még nincs kiküldhető szerződés.
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
