import { CheckCircle2, Clock, Heart, Mail, PackageCheck } from "lucide-react";
import { Button } from "@/components/button";
import { updateGalleryProofingStatusAction } from "@/lib/gallery-actions";
import {
  PROOFING_STATUSES,
  PROOFING_STATUS_DELIVERED,
  PROOFING_STATUS_IN_PROGRESS,
  PROOFING_STATUS_NOT_OPENED,
  PROOFING_STATUS_PROCESSING,
  PROOFING_STATUS_SUBMITTED,
  proofingStatusDescription,
  proofingStatusLabel,
  type ProofingStatus
} from "@/lib/proofing";

type ProofingStatusPanelProps = {
  galleryId: string;
  status: string;
  updatedAt: Date | null;
  metrics: {
    rawPhotoCount: number;
    selectedPhotoCount: number;
    submittedListCount: number;
    finalPhotoCount: number;
    clientEmail: string | null;
    proofingInviteSentAt: Date | null;
    finalDeliveryEmailSentAt: Date | null;
  };
};

function statusClass(status: string, currentStatus: string) {
  if (status === currentStatus) {
    return "border-brass/40 bg-brass/10 text-ink";
  }

  return "border-ink/10 bg-paper text-graphite";
}

function nextStepForStatus(status: string, metrics: ProofingStatusPanelProps["metrics"]) {
  if (status === PROOFING_STATUS_NOT_OPENED) {
    return metrics.proofingInviteSentAt
      ? "Várakozás az ügyfél első megnyitására."
      : "Küldd ki a válogató linket az ügyfélnek.";
  }

  if (status === PROOFING_STATUS_IN_PROGRESS) {
    return "Az ügyfél válogat. A leadott lista itt jelenik meg.";
  }

  if (status === PROOFING_STATUS_SUBMITTED) {
    return "Dolgozd ki a kiválasztott képeket, majd töltsd fel őket kész képként.";
  }

  if (status === PROOFING_STATUS_PROCESSING) {
    return metrics.finalPhotoCount > 0
      ? "Ellenőrizd a kész képeket, majd add át a galériát."
      : "A kész képek feltöltése még hiányzik.";
  }

  if (status === PROOFING_STATUS_DELIVERED) {
    return metrics.finalDeliveryEmailSentAt
      ? "A kész képek átadása és az email értesítés megtörtént."
      : "A kész képek át vannak adva, az email újraküldhető.";
  }

  return "Ellenőrizd a válogatási státuszt és a feltöltött képeket.";
}

export function ProofingStatusPanel({ galleryId, status, updatedAt, metrics }: ProofingStatusPanelProps) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
            <Clock size={15} />
            Ügyfélválogató státusz
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">{proofingStatusLabel(status)}</h2>
          <p className="mt-1 text-sm text-graphite/70">{proofingStatusDescription(status)}</p>
          {updatedAt ? (
            <p className="mt-2 text-xs text-graphite/60">
              Frissítve:{" "}
              {updatedAt.toLocaleString("hu-HU", {
                dateStyle: "medium",
                timeStyle: "short"
              })}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 rounded-md bg-paper px-3 py-2 text-sm text-graphite">
          <PackageCheck size={16} />
          Nyers válogatás
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Nyers képek", value: metrics.rawPhotoCount, icon: PackageCheck },
          { label: "Kiválasztva", value: metrics.selectedPhotoCount, icon: Heart },
          { label: "Leadott listák", value: metrics.submittedListCount, icon: CheckCircle2 },
          { label: "Kész képek", value: metrics.finalPhotoCount, icon: PackageCheck }
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="rounded-md bg-paper px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">
                <Icon size={14} />
                {item.label}
              </div>
              <p className="mt-2 text-2xl font-semibold text-ink">{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-ink/10 bg-paper px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">Következő lépés</p>
          <p className="mt-2 text-sm font-medium leading-6 text-ink">{nextStepForStatus(status, metrics)}</p>
        </div>
        <div className="rounded-md border border-ink/10 bg-paper px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">
            <Mail size={14} />
            Email értesítések
          </div>
          <p className="mt-2 text-sm font-medium text-ink">{metrics.clientEmail ?? "Nincs ügyfél email"}</p>
          <p className="mt-1 text-xs leading-5 text-graphite/70">
            Válogató: {metrics.proofingInviteSentAt ? metrics.proofingInviteSentAt.toLocaleString("hu-HU") : "még nincs kiküldve"}
            <br />
            Kész képek: {metrics.finalDeliveryEmailSentAt ? metrics.finalDeliveryEmailSentAt.toLocaleString("hu-HU") : "még nincs kiküldve"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {PROOFING_STATUSES.map((item, index) => (
          <div
            key={item.key}
            className={`grid gap-3 rounded-md border px-4 py-3 md:grid-cols-[1fr_auto] md:items-center ${statusClass(item.key, status)}`}
          >
            <div className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-graphite shadow-sm">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{item.label}</p>
                <p className="mt-1 text-sm text-graphite/70">{item.description}</p>
              </div>
            </div>
            {item.key === status ? (
              <span className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-sage shadow-sm">
                <CheckCircle2 size={16} />
                Aktuális
              </span>
            ) : (
              <form action={updateGalleryProofingStatusAction.bind(null, galleryId, item.key as ProofingStatus)}>
                <Button type="submit" variant="secondary">
                  Erre állítom
                </Button>
              </form>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
