"use client";

import { useMemo, useState } from "react";
import { Link2, Wand2 } from "lucide-react";

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function SlugFields({
  defaultTitle = "",
  defaultSlug = ""
}: {
  defaultTitle?: string;
  defaultSlug?: string;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [slug, setSlug] = useState(defaultSlug || normalize(defaultTitle));
  const [autoSlug, setAutoSlug] = useState(!defaultSlug);
  const previewPath = useMemo(() => `/g/${slug || "galeria-slug"}`, [slug]);

  function updateTitle(value: string) {
    setTitle(value);

    if (autoSlug) {
      setSlug(normalize(value));
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <label className="space-y-2">
        <span className="text-sm font-medium text-graphite">Galéria neve</span>
        <input
          name="title"
          value={title}
          onChange={(event) => updateTitle(event.target.value)}
          required
          placeholder="Anna & Márk esküvője"
          className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="gallery-slug" className="text-sm font-medium text-graphite">
            Slug
          </label>
          <button
            type="button"
            onClick={() => {
              setAutoSlug(true);
              setSlug(normalize(title));
            }}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-graphite hover:bg-ink/5"
          >
            <Wand2 size={14} />
            Automatikus
          </button>
        </div>
        <input
          id="gallery-slug"
          name="slug"
          value={slug}
          onChange={(event) => {
            setAutoSlug(false);
            setSlug(normalize(event.target.value));
          }}
          required
          placeholder="anna-mark-2026"
          className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
        />
        <p className="flex items-center gap-2 text-xs text-graphite/70">
          <Link2 size={13} />
          {previewPath}
        </p>
      </div>
    </div>
  );
}
