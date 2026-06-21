import { CheckCircle2, Clock, PackageCheck } from "lucide-react";
import { Button } from "@/components/button";
import { updateGalleryProofingStatusAction } from "@/lib/gallery-actions";
import { PROOFING_STATUSES, proofingStatusDescription, proofingStatusLabel, type ProofingStatus } from "@/lib/proofing";

type ProofingStatusPanelProps = {
  galleryId: string;
  status: string;
  updatedAt: Date | null;
};

function statusClass(status: string, currentStatus: string) {
  if (status === currentStatus) {
    return "border-brass/40 bg-brass/10 text-ink";
  }

  return "border-ink/10 bg-paper text-graphite";
}

export function ProofingStatusPanel({ galleryId, status, updatedAt }: ProofingStatusPanelProps) {
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
