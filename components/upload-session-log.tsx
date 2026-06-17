import { AlertCircle, CheckCircle2, UploadCloud } from "lucide-react";

type UploadSession = {
  id: string;
  status: string;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    filename: string;
    status: string;
    errorMessage: string | null;
  }[];
};

function statusText(session: UploadSession) {
  if (session.status === "completed") {
    return "Kész";
  }

  if (session.failedCount > 0) {
    return "Részben kész";
  }

  return "Folyamatban";
}

function statusClass(session: UploadSession) {
  if (session.status === "completed") {
    return "bg-sage/15 text-sage";
  }

  if (session.failedCount > 0) {
    return "bg-red-50 text-red-700";
  }

  return "bg-brass/15 text-brass";
}

export function UploadSessionLog({ sessions }: { sessions: UploadSession[] }) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Feltöltési előzmények</h2>
          <p className="mt-1 text-sm text-graphite/70">Nagy feltöltések állapota és hibás fájlok ellenőrzése.</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
          <UploadCloud size={18} />
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="mt-5 rounded-md bg-paper px-4 py-3">
          <p className="text-sm font-medium text-ink">Még nincs rögzített feltöltés</p>
          <p className="mt-1 text-sm text-graphite/70">A következő nagy feltöltés állapota itt is látszani fog.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {sessions.map((session) => {
            const failedItems = session.items.filter((item) => item.status === "failed");

            return (
              <div key={session.id} className="rounded-md border border-ink/10 p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">
                        {session.completedCount}/{session.totalCount} kép mentve
                      </p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(session)}`}>
                        {statusText(session)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-graphite/70">
                      Indítva:{" "}
                      {session.createdAt.toLocaleString("hu-HU", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-graphite/70">
                    {session.failedCount > 0 ? <AlertCircle size={16} className="text-red-700" /> : <CheckCircle2 size={16} className="text-sage" />}
                    {session.failedCount} hibás
                  </div>
                </div>

                {failedItems.length > 0 ? (
                  <div className="mt-4 rounded-md bg-red-50 p-3">
                    <p className="text-sm font-medium text-red-800">Hibás fájlok</p>
                    <div className="mt-2 max-h-40 overflow-auto rounded-md bg-white px-3 py-2">
                      <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-5 text-red-800">
                        {failedItems.map((item) => `${item.filename}${item.errorMessage ? ` - ${item.errorMessage}` : ""}`).join("\n")}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
