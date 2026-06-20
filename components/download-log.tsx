import { Archive, Mail } from "lucide-react";

type DownloadEntry = {
  id: string;
  email: string;
  createdAt: Date;
};

type DownloadPackage = {
  id: string;
  status: string;
  photoCount: number;
  fileSize: number | bigint;
  downloadUrl: string | null;
  errorMessage: string | null;
  generatedAt: Date | null;
  createdAt: Date;
};

function formatBytes(bytes: number | bigint) {
  const value = Number(bytes);

  if (value <= 0) {
    return "0 MB";
  }

  if (value >= 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function packageStatusLabel(status: string) {
  if (status === "completed") {
    return "Kész";
  }

  if (status === "failed") {
    return "Hibás";
  }

  return "Készül";
}

function packageStatusClass(status: string) {
  if (status === "completed") {
    return "bg-sage/15 text-sage";
  }

  if (status === "failed") {
    return "bg-red-50 text-red-700";
  }

  return "bg-brass/15 text-brass";
}

export function DownloadLog({ downloads, packages }: { downloads: DownloadEntry[]; packages: DownloadPackage[] }) {
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

      <div className="mt-5 rounded-md border border-ink/10 bg-paper p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <Archive size={16} />
          ZIP csomagok
        </div>
        {packages.length === 0 ? (
          <p className="mt-2 text-sm text-graphite/70">Még nincs előre generált ZIP csomag.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {packages.map((downloadPackage) => (
              <div key={downloadPackage.id} className="rounded-md bg-white px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {downloadPackage.photoCount} fotó · {formatBytes(downloadPackage.fileSize)}
                    </p>
                    <p className="text-xs text-graphite/70">
                      {downloadPackage.generatedAt
                        ? downloadPackage.generatedAt.toLocaleString("hu-HU", {
                            dateStyle: "medium",
                            timeStyle: "short"
                          })
                        : downloadPackage.createdAt.toLocaleString("hu-HU", {
                            dateStyle: "medium",
                            timeStyle: "short"
                          })}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${packageStatusClass(downloadPackage.status)}`}>
                    {packageStatusLabel(downloadPackage.status)}
                  </span>
                </div>
                {downloadPackage.errorMessage ? (
                  <p className="mt-2 text-xs text-red-700">{downloadPackage.errorMessage}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
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
