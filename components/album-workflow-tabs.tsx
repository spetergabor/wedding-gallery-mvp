"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LayoutTemplate, Upload } from "lucide-react";

type AlbumMode = "editor" | "upload";

type AlbumWorkflowTabsProps = {
  initialMode: AlbumMode;
  initialOpen: boolean;
  backHref: string;
  dashboardContent: ReactNode;
  editorContent: ReactNode;
  uploadContent: ReactNode;
};

const workflowKeys = [
  "albumMode",
  "albumWorkspace",
  "albumDesignId",
  "albumEditor",
  "albumActiveSpread",
  "albumCreated",
  "albumDeleted",
  "albumUpdated",
  "albumUploaded",
  "albumError",
  "albumDesignCreated",
  "albumDesignDeleted",
  "albumDesignUpdated",
  "albumDesignExported",
  "albumDesignError",
  "albumSpreadAutoCreated",
  "albumSpreadCreated",
  "albumSpreadRegenerated",
  "albumSpreadUpdated",
  "albumSpreadSlotUpdated",
  "albumSpreadDeleted"
] as const;

function hasAlbumWorkflowParams(params: Pick<URLSearchParams, "has">) {
  return workflowKeys.some((key) => params.has(key));
}

const modeCopy: Record<AlbumMode, { title: string; description: string; icon: typeof LayoutTemplate }> = {
  editor: {
    title: "Online album létrehozása",
    description: "Spetly albumterv készítése template-ekkel, meglévő galériából, favorite listából vagy saját feltöltésből.",
    icon: LayoutTemplate
  },
  upload: {
    title: "Kész albumterv feltöltése",
    description: "SmartAlbumsból vagy más programból exportált oldalpárok ellenőrzője, ügyfél linkkel és kommentelési lehetőséggel.",
    icon: Upload
  }
};

export function AlbumWorkflowTabs({
  initialMode,
  initialOpen,
  backHref,
  dashboardContent,
  editorContent,
  uploadContent
}: AlbumWorkflowTabsProps) {
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();
  const tabParam = searchParams.get("tab");
  const albumModeParam = searchParams.get("albumMode");
  const [mode, setMode] = useState<AlbumMode>(initialMode);
  const [isOpen, setIsOpen] = useState(initialOpen);

  useEffect(() => {
    if (tabParam !== "album") {
      return;
    }

    const nextParams = new URLSearchParams(searchString);
    setMode(albumModeParam === "upload" ? "upload" : "editor");
    setIsOpen(hasAlbumWorkflowParams(nextParams));
  }, [albumModeParam, searchString, tabParam]);

  if (!isOpen) {
    return <>{dashboardContent}</>;
  }

  const activeCopy = modeCopy[mode];
  const ActiveIcon = activeCopy.icon;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-ink text-white">
              <ActiveIcon size={19} />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-brass">Album munkafolyamat</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">{activeCopy.title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-graphite/70">{activeCopy.description}</p>
            </div>
          </div>
          <Link
            href={backHref}
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition hover:border-ink/30"
          >
            <ArrowLeft size={15} />
            Vissza az albumokhoz
          </Link>
        </div>
      </section>

      <div hidden={mode !== "editor"}>{editorContent}</div>
      <div hidden={mode !== "upload"}>{uploadContent}</div>
    </div>
  );
}
