import { Download, ImageIcon, UserRound } from "lucide-react";
import { APP_TIME_ZONE } from "@/lib/date-format";

type PhotoDownloadEntry = {
  id: string;
  photoId: string | null;
  email: string;
  filename: string;
  source: string;
  country: string | null;
  region: string | null;
  city: string | null;
  createdAt: Date;
};

function sourceLabel(source: string) {
  return source === "purchase_panel" ? "Vásárlási panel" : "Galéria képnézet";
}

function locationLabel(entry: PhotoDownloadEntry) {
  return [entry.city, entry.region, entry.country].filter(Boolean).join(", ");
}

export function PhotoDownloadLog({ downloads }: { downloads: PhotoDownloadEntry[] }) {
  const uniqueEmails = new Set(downloads.map((download) => download.email)).size;
  const uniquePhotos = new Set(downloads.map((download) => download.photoId ?? download.filename)).size;

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Egyedi képletöltések</h2>
          <p className="mt-1 text-sm text-graphite/70">Az egyes fotók letöltésének indítása e-mail-címhez rendelve.</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
          <Download size={18} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/60">Letöltés</p>
          <p className="mt-1 text-xl font-semibold text-ink">{downloads.length}</p>
        </div>
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/60">Különböző kép</p>
          <p className="mt-1 text-xl font-semibold text-ink">{uniquePhotos}</p>
        </div>
        <div className="rounded-md bg-paper px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/60">E-mail-cím</p>
          <p className="mt-1 text-xl font-semibold text-ink">{uniqueEmails}</p>
        </div>
      </div>

      {downloads.length === 0 ? (
        <div className="mt-5 rounded-md bg-paper px-4 py-3">
          <p className="text-sm font-medium text-ink">Még nincs egyedi képletöltés</p>
          <p className="mt-1 text-sm text-graphite/70">Az első e-mailhez rendelt képletöltés itt fog megjelenni.</p>
        </div>
      ) : (
        <div className="mt-5 max-h-96 divide-y divide-ink/10 overflow-auto rounded-md border border-ink/10">
          {downloads.map((download) => {
            const location = locationLabel(download);
            return (
              <div key={download.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-medium text-ink">
                    <ImageIcon size={15} className="shrink-0 text-graphite/60" />
                    <span className="truncate">{download.filename}</span>
                  </p>
                  <p className="mt-1 flex items-center gap-2 break-all text-sm text-graphite/70">
                    <UserRound size={14} className="shrink-0" />
                    {download.email}
                  </p>
                  <p className="mt-1 text-xs text-graphite/55">
                    {sourceLabel(download.source)}{location ? ` · ${location}` : ""}
                  </p>
                </div>
                <time className="text-xs text-graphite/60 sm:text-right" dateTime={download.createdAt.toISOString()}>
                  {download.createdAt.toLocaleString("hu-HU", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: APP_TIME_ZONE
                  })}
                </time>
              </div>
            );
          })}
        </div>
      )}

      {downloads.length >= 500 ? (
        <p className="mt-3 text-xs text-graphite/55">A legutóbbi 500 egyedi letöltés látható.</p>
      ) : null}
    </section>
  );
}
