"use client";

import { useState } from "react";
import { Check, Copy, Heart } from "lucide-react";
import { Button } from "@/components/button";

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

function filenamesText(list: FavoriteList) {
  return list.items.map((item) => item.photo.filename).join("\n");
}

export function FavoriteListsLog({ lists }: { lists: FavoriteList[] }) {
  const [copiedListId, setCopiedListId] = useState<string | null>(null);

  async function handleCopy(list: FavoriteList) {
    try {
      await window.navigator.clipboard.writeText(filenamesText(list));
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
          <h2 className="text-lg font-semibold text-ink">Kedvenc listák</h2>
          <p className="mt-1 text-sm text-graphite/70">Email címhez mentett képkiválasztások, teljes fájlnévlistával.</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
          <Heart size={18} />
        </div>
      </div>

      {lists.length === 0 ? (
        <div className="mt-5 rounded-md bg-paper px-4 py-3">
          <p className="text-sm font-medium text-ink">Még nincs kedvenc lista</p>
          <p className="mt-1 text-sm text-graphite/70">Ha a pár kedvenceket jelöl, itt fogod látni email szerint.</p>
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
                      {list.submittedAt ? "Lezárva" : "Folyamatban"}
                    </span>
                  </div>
                  <p className="text-sm text-graphite/70">{list.email}</p>
                  <p className="text-sm text-graphite/70">
                    {list.items.length} kedvenc kép · frissítve:{" "}
                    {list.updatedAt.toLocaleString("hu-HU", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </p>
                  {list.submittedAt ? (
                    <p className="text-sm text-graphite/70">
                      lezárva:{" "}
                      {list.submittedAt.toLocaleString("hu-HU", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </p>
                  ) : null}
                </div>
                <Button type="button" variant="secondary" onClick={() => void handleCopy(list)} className="shrink-0">
                  {copiedListId === list.id ? <Check size={16} /> : <Copy size={16} />}
                  {copiedListId === list.id ? "Másolva" : "Fájlnevek másolása"}
                </Button>
              </div>

              {list.items.length > 0 ? (
                <div className="mt-4 rounded-md bg-paper p-3">
                  <div className="max-h-72 overflow-auto rounded-md bg-white px-3 py-2">
                    <pre className="whitespace-pre-wrap break-all font-mono text-sm leading-6 text-graphite">
                      {filenamesText(list)}
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
