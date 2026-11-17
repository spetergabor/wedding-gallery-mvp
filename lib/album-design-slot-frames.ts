import { getAlbumLayoutTemplate } from "@/lib/album-design-templates";

export type AlbumDesignSlotFrame = {
  slotIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type AlbumDesignSlotFrameSource = {
  slotIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampPercent(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, value));
}

function clampSizePercent(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(100, Math.max(1, value));
}

function normalizeFrame(
  slotIndex: number,
  value: Partial<AlbumDesignSlotFrameSource> | undefined,
  fallback: { x: number; y: number; width: number; height: number }
): AlbumDesignSlotFrame {
  const width = clampSizePercent(finiteNumber(value?.width, fallback.width), fallback.width);
  const height = clampSizePercent(finiteNumber(value?.height, fallback.height), fallback.height);
  const x = Math.min(100 - width, clampPercent(finiteNumber(value?.x, fallback.x), fallback.x));
  const y = Math.min(100 - height, clampPercent(finiteNumber(value?.y, fallback.y), fallback.y));

  return { slotIndex, x, y, width, height };
}

function storedFramesBySlot(value: unknown) {
  if (!Array.isArray(value)) {
    return new Map<number, Partial<AlbumDesignSlotFrameSource>>();
  }

  return new Map(
    value
      .filter((frame): frame is Record<string, unknown> => Boolean(frame) && typeof frame === "object")
      .map((frame) => {
        const slotIndex = typeof frame.slotIndex === "number" ? Math.trunc(frame.slotIndex) : -1;
        return [slotIndex, frame] as const;
      })
      .filter(([slotIndex]) => slotIndex >= 0)
  );
}

export function normalizeAlbumDesignSlotFrames(
  layoutKey: string,
  storedValue: unknown,
  itemFrames: AlbumDesignSlotFrameSource[] = []
) {
  const layout = getAlbumLayoutTemplate(layoutKey);
  const storedBySlot = storedFramesBySlot(storedValue);
  const itemsBySlot = new Map(itemFrames.map((frame) => [frame.slotIndex, frame]));

  return layout.slots.map((slot, slotIndex) =>
    normalizeFrame(slotIndex, storedBySlot.get(slotIndex) ?? itemsBySlot.get(slotIndex), slot)
  );
}

export function albumDesignSlotFramesToMap(frames: AlbumDesignSlotFrame[]) {
  return Object.fromEntries(
    frames.map((frame) => [
      frame.slotIndex,
      {
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height
      }
    ])
  );
}
