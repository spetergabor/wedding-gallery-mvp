import { Mail } from "lucide-react";

type DownloadEntry = {
  id: string;
  email: string;
  createdAt: Date;
};

export function DownloadLog({ downloads }: { downloads: DownloadEntry[] }) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Album letöltések</h2>
          <p className="mt-1 text-sm text-graphite/70">Email címek a ZIP letöltésekhez.</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
          <Mail size={18} />
        </div>
      </div>

      {downloads.length === 0 ? (
        <div className="mt-5 rounded-md bg-paper px-4 py-3">
          <p className="text-sm font-medium text-ink">Még nincs letöltés</p>
          <p className="mt-1 text-sm text-graphite/70">A ZIP letöltések itt jelennek meg.</p>
        </div>
      ) : (
        <div className="mt-5 max-h-72 divide-y divide-ink/10 overflow-auto rounded-md border border-ink/10">
          {downloads.map((download) => (
            <div key={download.id} className="grid gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-ink">{download.email}</p>
                <time className="text-sm text-graphite/70" dateTime={download.createdAt.toISOString()}>
                  {download.createdAt.toLocaleString("hu-HU", {
                    dateStyle: "medium",
                    timeStyle: "short"
                  })}
                </time>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
