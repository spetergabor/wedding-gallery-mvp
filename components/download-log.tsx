import { Mail } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

type DownloadEntry = {
  id: string;
  email: string;
  createdAt: Date;
};

export function DownloadLog({ downloads }: { downloads: DownloadEntry[] }) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white shadow-soft">
      <div className="border-b border-ink/10 px-6 py-5">
        <h2 className="text-xl font-semibold text-ink">Album letöltések</h2>
        <p className="mt-1 text-sm text-graphite/70">Itt látod, ki adta meg az email címét a teljes ZIP letöltéshez.</p>
      </div>

      {downloads.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={<Mail size={22} />}
            title="Még nincs album letöltés"
            description="Ha valaki ZIP-ben letölti a galériát, az email címe és a letöltés időpontja itt fog megjelenni."
          />
        </div>
      ) : (
        <div className="divide-y divide-ink/10">
          {downloads.map((download) => (
            <div key={download.id} className="grid gap-2 px-6 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-md bg-paper text-graphite">
                  <Mail size={16} />
                </div>
                <p className="font-medium text-ink">{download.email}</p>
              </div>
              <time className="text-sm text-graphite/70" dateTime={download.createdAt.toISOString()}>
                {download.createdAt.toLocaleString("hu-HU", {
                  dateStyle: "medium",
                  timeStyle: "short"
                })}
              </time>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
