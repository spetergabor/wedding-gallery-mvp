"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, FileSpreadsheet, Heart, LoaderCircle } from "lucide-react";
import { Button } from "@/components/button";
import {
  getAdminFavoriteListZipStateAction,
  requestAdminFavoriteListZipAction
} from "@/lib/admin-favorite-download-actions";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { lightroomFilenameList } from "@/lib/photo-filename";

type FavoriteList = {
  id: string;
  email: string;
  name: string;
  submittedAt: Date | null;
  updatedAt: Date;
  items: {
    id: string;
    photo: {
      id: string;
      filename: string;
    };
  }[];
};

function filenamesText(list: FavoriteList, withoutExtensions: boolean) {
  const filenames = list.items.map((item) => item.photo.filename);

  return withoutExtensions ? lightroomFilenameList(filenames) : filenames.join("\n");
}

type FavoriteZipState = Awaited<ReturnType<typeof requestAdminFavoriteListZipAction>>;

function FavoriteListZipDownload({ listId }: { listId: string }) {
  const [zipState, setZipState] = useState<FavoriteZipState | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  async function startDownload() {
    if (isStarting || zipState?.status === "pending" || zipState?.status === "processing") {
      return;
    }

    setIsStarting(true);

    try {
      setZipState(await requestAdminFavoriteListZipAction(listId));
    } catch {
      setZipState({
        ok: false,
        message: "A ZIP készítését nem sikerült elindítani.",
        status: "failed",
        packageId: null,
        processedCount: 0,
        photoCount: 0,
        packages: []
      });
    } finally {
      setIsStarting(false);
    }
  }

  useEffect(() => {
    const packageId = zipState?.packageId;

    if (!packageId || !["pending", "processing"].includes(zipState.status)) {
      return;
    }

    const activePackageId = packageId;
    let mounted = true;

    async function refreshState() {
      try {
        const result = await getAdminFavoriteListZipStateAction(activePackageId);

        if (mounted) {
          setZipState(result);
        }
      } catch {
        if (mounted) {
          setZipState((current) =>
            current
              ? {
                  ...current,
                  ok: false,
                  message: "A ZIP állapotát nem sikerült lekérni.",
                  status: "failed"
                }
              : current
          );
        }
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshState();
      }
    };
    const interval = window.setInterval(refreshWhenVisible, 3000);

    document.addEventListener("visibilitychange", refreshWhenVisible);
    void refreshState();

    return () => {
      mounted = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [zipState?.packageId, zipState?.status]);

  if (zipState?.status === "completed" && zipState.packages.length > 0) {
    return (
      <div className="flex flex-wrap gap-2">
        {zipState.packages.map((downloadPackage) => (
          <a
            key={downloadPackage.id}
            href={downloadPackage.downloadUrl}
            download={downloadPackage.filename}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
          >
            <Download size={16} />
            {downloadPackage.partCount > 1
              ? `Képek ZIP ${downloadPackage.partIndex + 1}/${downloadPackage.partCount}`
              : "Képek ZIP letöltése"}
          </a>
        ))}
      </div>
    );
  }

  const isPreparing = isStarting || zipState?.status === "pending" || zipState?.status === "processing";
  const progressLabel =
    zipState?.photoCount && zipState.processedCount > 0
      ? ` (${zipState.processedCount}/${zipState.photoCount})`
      : "";

  return (
    <div>
      <Button type="button" onClick={() => void startDownload()} disabled={isPreparing}>
        {isPreparing ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
        {isStarting
          ? "Indítás…"
          : zipState?.status === "processing"
            ? `ZIP készül${progressLabel}`
            : zipState?.status === "pending"
              ? "ZIP várakozik"
              : "Képek letöltése"}
      </Button>
      {zipState && (!zipState.ok || isPreparing) ? (
        <p className={`mt-1 max-w-64 text-xs ${zipState.ok ? "text-graphite/60" : "text-red-700"}`}>
          {zipState.message}
        </p>
      ) : null}
    </div>
  );
}

export function FavoriteListsLog({ lists, mode = "favorites" }: { lists: FavoriteList[]; mode?: "favorites" | "proofing" }) {
  const [copiedListId, setCopiedListId] = useState<string | null>(null);
  const proofingMode = mode === "proofing";

  async function handleCopy(list: FavoriteList) {
    try {
      await window.navigator.clipboard.writeText(filenamesText(list, proofingMode));
      setCopiedListId(list.id);
      window.setTimeout(() => setCopiedListId(null), 2000);
    } catch {
      setCopiedListId(null);
    }
  }

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">{proofingMode ? "Ügyfélválogatások" : "Kedvenc listák"}</h2>
          <p className="mt-1 text-sm text-graphite/70">
            {proofingMode
              ? "Az ügyfél által kiválasztott képek email cím szerint, Lightroomhoz használható, kiterjesztés nélküli fájlnévlistával."
              : "Email címhez mentett képkiválasztások, teljes fájlnévlistával. A listák CSV-ként is letölthetők."}
          </p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
          <Heart size={18} />
        </div>
      </div>

      {lists.length === 0 ? (
        <div className="mt-5 rounded-md bg-paper px-4 py-3">
          <p className="text-sm font-medium text-ink">{proofingMode ? "Még nincs ügyfélválogatás" : "Még nincs kedvenc lista"}</p>
          <p className="mt-1 text-sm text-graphite/70">
            {proofingMode
              ? "Ha az ügyfél elkezdi kiválasztani a képeket, itt fogod látni a listát."
              : "Ha a pár kedvenceket jelöl, itt fogod látni email szerint."}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {lists.map((list) => (
            <div key={list.id} className="rounded-md border border-ink/10 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{list.name}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        list.submittedAt ? "bg-sage/15 text-sage" : "bg-ink/5 text-graphite"
                      }`}
                    >
                      {list.submittedAt ? (proofingMode ? "Leadva" : "Lezárva") : "Folyamatban"}
                    </span>
                  </div>
                  <p className="text-sm text-graphite/70">{list.email}</p>
                  <p className="text-sm text-graphite/70">
                    {list.items.length} {proofingMode ? "kiválasztott kép" : "kedvenc kép"} · frissítve:{" "}
                    {list.updatedAt.toLocaleString("hu-HU", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: APP_TIME_ZONE
                    })}
                  </p>
                  {list.submittedAt ? (
                    <p className="text-sm text-graphite/70">
                      lezárva:{" "}
                      {list.submittedAt.toLocaleString("hu-HU", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: APP_TIME_ZONE
                      })}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-start gap-2">
                  <FavoriteListZipDownload listId={list.id} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => void handleCopy(list)}>
                      {copiedListId === list.id ? <Check size={16} /> : <Copy size={16} />}
                      {copiedListId === list.id ? "Másolva" : "Fájlnevek másolása"}
                    </Button>
                    <a
                      href={`/api/admin/favorite-lists/${encodeURIComponent(list.id)}/download`}
                      download
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition hover:border-ink/30"
                    >
                      <FileSpreadsheet size={16} />
                      CSV
                    </a>
                  </div>
                </div>
              </div>

              {list.items.length > 0 ? (
                <div className="mt-4 rounded-md bg-paper p-3">
                  <div className="max-h-72 overflow-auto rounded-md bg-white px-3 py-2">
                    <pre className="whitespace-pre-wrap break-all font-mono text-sm leading-6 text-graphite">
                      {filenamesText(list, proofingMode)}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
