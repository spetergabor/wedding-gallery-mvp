export type AlbumLayoutSlot = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AlbumLayoutTemplate = {
  key: string;
  name: string;
  photoCount: number;
  slots: AlbumLayoutSlot[];
};

export const ALBUM_LAYOUT_TEMPLATES: AlbumLayoutTemplate[] = [
  {
    key: "spread-hero",
    name: "1 nagy kép teljes oldalpáron",
    photoCount: 1,
    slots: [{ x: 0, y: 0, width: 100, height: 100 }]
  },
  {
    key: "two-pages",
    name: "Bal és jobb oldal",
    photoCount: 2,
    slots: [
      { x: 0, y: 0, width: 50, height: 100 },
      { x: 50, y: 0, width: 50, height: 100 }
    ]
  },
  {
    key: "left-hero-right-stack",
    name: "Bal nagy, jobb két kép",
    photoCount: 3,
    slots: [
      { x: 0, y: 0, width: 50, height: 100 },
      { x: 50, y: 0, width: 50, height: 50 },
      { x: 50, y: 50, width: 50, height: 50 }
    ]
  },
  {
    key: "right-hero-left-stack",
    name: "Bal két kép, jobb nagy",
    photoCount: 3,
    slots: [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 0, y: 50, width: 50, height: 50 },
      { x: 50, y: 0, width: 50, height: 100 }
    ]
  },
  {
    key: "four-grid",
    name: "Négyes rács",
    photoCount: 4,
    slots: [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 50, y: 0, width: 50, height: 50 },
      { x: 0, y: 50, width: 50, height: 50 },
      { x: 50, y: 50, width: 50, height: 50 }
    ]
  }
];

export function getAlbumLayoutTemplate(layoutKey: string) {
  return ALBUM_LAYOUT_TEMPLATES.find((template) => template.key === layoutKey) ?? ALBUM_LAYOUT_TEMPLATES[0];
}
