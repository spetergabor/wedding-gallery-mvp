"use client";

import Image from "next/image";
import { Crosshair, MousePointer2, RotateCcw } from "lucide-react";
import { PointerEvent, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { updateCoverPositionAction } from "@/lib/gallery-actions";

type CoverPosition = {
  x: number;
  y: number;
};

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizePosition(x: number, y: number): CoverPosition {
  return {
    x: clampPercent(x),
    y: clampPercent(y)
  };
}

export function CoverPositionControl({
  galleryId,
  imageUrl,
  imageAlt,
  initialX,
  initialY
}: {
  galleryId: string;
  imageUrl: string;
  imageAlt: string;
  initialX: number;
  initialY: number;
}) {
  const [position, setPosition] = useState<CoverPosition>(() => normalizePosition(initialX, initialY));

  function updateFromPointer(event: PointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPosition(normalizePosition(x, y));
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  }

  function continueDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.buttons !== 1) {
      return;
    }

    updateFromPointer(event);
  }

  return (
    <section className="mb-8 rounded-md border border-ink/10 bg-white p-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-graphite/65">
            <Crosshair size={15} />
            Borítókép pozíció
          </div>
          <h2 className="mt-2 text-lg font-semibold text-ink">Állítsd be, mi legyen fókuszban</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
            Kattints vagy húzd a képen a fókuszpontot. Ezt használja a publikus galéria borítóképe is.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPosition({ x: 50, y: 50 })}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/30"
        >
          <RotateCcw size={15} />
          Középre
        </button>
      </div>

      <form action={updateCoverPositionAction.bind(null, galleryId)} className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <input type="hidden" name="coverPositionX" value={position.x} />
        <input type="hidden" name="coverPositionY" value={position.y} />

        <button
          type="button"
          onPointerDown={beginDrag}
          onPointerMove={continueDrag}
          className="relative h-52 w-full touch-none overflow-hidden rounded-md border border-ink/10 bg-ink text-left md:h-64"
          aria-label="Borítókép fókuszpontjának beállítása"
        >
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            unoptimized
            draggable={false}
            className="object-cover"
            sizes="(min-width: 1024px) 960px, 100vw"
            style={{ objectPosition: `${position.x}% ${position.y}%` }}
          />
          <span className="absolute inset-0 bg-ink/5" aria-hidden="true" />
          <span
            className="absolute grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/90 bg-ink/70 text-white shadow-soft"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            aria-hidden="true"
          >
            <MousePointer2 size={17} />
          </span>
        </button>

        <div className="rounded-md border border-ink/10 bg-paper p-4">
          <div className="space-y-4">
            <label className="block">
              <span className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-graphite/65">
                Vízszintes
                <span>{position.x}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={position.x}
                onChange={(event) => setPosition((current) => normalizePosition(Number(event.target.value), current.y))}
                className="mt-3 w-full accent-ink"
              />
            </label>

            <label className="block">
              <span className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-graphite/65">
                Függőleges
                <span>{position.y}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={position.y}
                onChange={(event) => setPosition((current) => normalizePosition(current.x, Number(event.target.value)))}
                className="mt-3 w-full accent-ink"
              />
            </label>
          </div>

          <FormSubmitButton className="mt-5 w-full" pendingLabel="Pozíció mentése...">
            Pozíció mentése
          </FormSubmitButton>
        </div>
      </form>
    </section>
  );
}
