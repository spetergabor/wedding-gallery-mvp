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

export const ALBUM_SPREAD_BACKGROUND = "#ffffff";
export const ALBUM_SPREAD_PREVIEW_SLOT_INSET_PX = 4;
export const ALBUM_SPREAD_EXPORT_SLOT_INSET_PX = 14;

export const ALBUM_LAYOUT_TEMPLATES: AlbumLayoutTemplate[] = [
  {
    key: "spread-hero",
    name: "1 nagy kép teljes oldalpáron",
    photoCount: 1,
    slots: [{ x: 0, y: 0, width: 100, height: 100 }]
  },
  {
    key: "single-left-page",
    name: "1 kép bal oldalon",
    photoCount: 1,
    slots: [{ x: 5, y: 8, width: 40, height: 84 }]
  },
  {
    key: "single-right-page",
    name: "1 kép jobb oldalon",
    photoCount: 1,
    slots: [{ x: 55, y: 8, width: 40, height: 84 }]
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
    key: "two-centered-panels",
    name: "Két középre zárt kép",
    photoCount: 2,
    slots: [
      { x: 6, y: 10, width: 38, height: 80 },
      { x: 56, y: 10, width: 38, height: 80 }
    ]
  },
  {
    key: "two-wide-stack",
    name: "Két panoráma sáv",
    photoCount: 2,
    slots: [
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 0, y: 50, width: 100, height: 50 }
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
    key: "top-hero-bottom-pair",
    name: "Felső nagy, alul két kép",
    photoCount: 3,
    slots: [
      { x: 0, y: 0, width: 100, height: 58 },
      { x: 0, y: 58, width: 50, height: 42 },
      { x: 50, y: 58, width: 50, height: 42 }
    ]
  },
  {
    key: "center-hero-side-accents",
    name: "Középső nagy, két oldalsó kép",
    photoCount: 3,
    slots: [
      { x: 22, y: 0, width: 56, height: 100 },
      { x: 0, y: 12, width: 22, height: 76 },
      { x: 78, y: 12, width: 22, height: 76 }
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
  },
  {
    key: "four-filmstrip",
    name: "Négy kép filmszalagban",
    photoCount: 4,
    slots: [
      { x: 0, y: 18, width: 25, height: 64 },
      { x: 25, y: 18, width: 25, height: 64 },
      { x: 50, y: 18, width: 25, height: 64 },
      { x: 75, y: 18, width: 25, height: 64 }
    ]
  },
  {
    key: "four-hero-left-grid-right",
    name: "Bal nagy, jobb hármas",
    photoCount: 4,
    slots: [
      { x: 0, y: 0, width: 56, height: 100 },
      { x: 56, y: 0, width: 44, height: 34 },
      { x: 56, y: 34, width: 44, height: 33 },
      { x: 56, y: 67, width: 44, height: 33 }
    ]
  },
  {
    key: "five-hero-cross",
    name: "Öt kép központi nagy képpel",
    photoCount: 5,
    slots: [
      { x: 25, y: 18, width: 50, height: 64 },
      { x: 0, y: 0, width: 25, height: 50 },
      { x: 0, y: 50, width: 25, height: 50 },
      { x: 75, y: 0, width: 25, height: 50 },
      { x: 75, y: 50, width: 25, height: 50 }
    ]
  },
  {
    key: "five-left-stack-right-grid",
    name: "Bal két kép, jobb hármas",
    photoCount: 5,
    slots: [
      { x: 0, y: 0, width: 42, height: 50 },
      { x: 0, y: 50, width: 42, height: 50 },
      { x: 42, y: 0, width: 58, height: 34 },
      { x: 42, y: 34, width: 58, height: 33 },
      { x: 42, y: 67, width: 58, height: 33 }
    ]
  },
  {
    key: "six-even-grid",
    name: "Hat képes rács",
    photoCount: 6,
    slots: [
      { x: 0, y: 0, width: 33.33, height: 50 },
      { x: 33.33, y: 0, width: 33.34, height: 50 },
      { x: 66.67, y: 0, width: 33.33, height: 50 },
      { x: 0, y: 50, width: 33.33, height: 50 },
      { x: 33.33, y: 50, width: 33.34, height: 50 },
      { x: 66.67, y: 50, width: 33.33, height: 50 }
    ]
  },
  {
    key: "six-hero-and-mosaic",
    name: "Hat kép nagy kiemeléssel",
    photoCount: 6,
    slots: [
      { x: 0, y: 0, width: 50, height: 100 },
      { x: 50, y: 0, width: 25, height: 50 },
      { x: 75, y: 0, width: 25, height: 50 },
      { x: 50, y: 50, width: 16.67, height: 50 },
      { x: 66.67, y: 50, width: 16.66, height: 50 },
      { x: 83.33, y: 50, width: 16.67, height: 50 }
    ]
  },
  {
    key: "seven-wide-mosaic-strip",
    name: "Hét képes széles mozaik",
    photoCount: 7,
    slots: [
      { x: 8, y: 18, width: 12, height: 32 },
      { x: 20, y: 18, width: 28, height: 32 },
      { x: 48, y: 18, width: 12, height: 32 },
      { x: 60, y: 18, width: 32, height: 32 },
      { x: 8, y: 50, width: 26, height: 32 },
      { x: 34, y: 50, width: 14, height: 32 },
      { x: 48, y: 50, width: 44, height: 32 }
    ]
  },
  {
    key: "seven-left-run-right-hero",
    name: "Bal mozaik, jobb nagy kép",
    photoCount: 7,
    slots: [
      { x: 0, y: 12, width: 12, height: 38 },
      { x: 12, y: 12, width: 15, height: 38 },
      { x: 27, y: 12, width: 30, height: 38 },
      { x: 57, y: 12, width: 15, height: 38 },
      { x: 12, y: 50, width: 14, height: 38 },
      { x: 26, y: 50, width: 31, height: 38 },
      { x: 72, y: 12, width: 28, height: 76 }
    ]
  },
  {
    key: "eight-balanced-mosaic",
    name: "Nyolc képes kiegyensúlyozott mozaik",
    photoCount: 8,
    slots: [
      { x: 7, y: 18, width: 12, height: 31 },
      { x: 19, y: 18, width: 26, height: 31 },
      { x: 45, y: 18, width: 12, height: 31 },
      { x: 57, y: 18, width: 36, height: 31 },
      { x: 7, y: 49, width: 27, height: 32 },
      { x: 34, y: 49, width: 11, height: 32 },
      { x: 45, y: 49, width: 12, height: 32 },
      { x: 57, y: 49, width: 36, height: 32 }
    ]
  },
  {
    key: "eight-center-cluster",
    name: "Nyolc képes középső klaszter",
    photoCount: 8,
    slots: [
      { x: 0, y: 16, width: 16, height: 48 },
      { x: 16, y: 16, width: 16, height: 48 },
      { x: 32, y: 16, width: 29, height: 24 },
      { x: 61, y: 16, width: 15, height: 24 },
      { x: 76, y: 16, width: 24, height: 48 },
      { x: 32, y: 40, width: 15, height: 24 },
      { x: 47, y: 40, width: 14, height: 24 },
      { x: 61, y: 40, width: 15, height: 24 }
    ]
  },
  {
    key: "nine-left-story-right-grid",
    name: "Bal történet, jobb négyes blokk",
    photoCount: 9,
    slots: [
      { x: 0, y: 18, width: 10, height: 30 },
      { x: 10, y: 18, width: 26, height: 30 },
      { x: 36, y: 18, width: 21, height: 30 },
      { x: 0, y: 48, width: 14, height: 30 },
      { x: 14, y: 48, width: 23, height: 30 },
      { x: 37, y: 48, width: 20, height: 30 },
      { x: 70, y: 18, width: 15, height: 30 },
      { x: 85, y: 18, width: 15, height: 30 },
      { x: 70, y: 48, width: 30, height: 30 }
    ]
  },
  {
    key: "nine-hero-left-grid-right",
    name: "Bal nagy kép, jobb nyolcas rács",
    photoCount: 9,
    slots: [
      { x: 0, y: 0, width: 34, height: 100 },
      { x: 34, y: 0, width: 16.5, height: 50 },
      { x: 50.5, y: 0, width: 16.5, height: 50 },
      { x: 67, y: 0, width: 16.5, height: 50 },
      { x: 83.5, y: 0, width: 16.5, height: 50 },
      { x: 34, y: 50, width: 16.5, height: 50 },
      { x: 50.5, y: 50, width: 16.5, height: 50 },
      { x: 67, y: 50, width: 16.5, height: 50 },
      { x: 83.5, y: 50, width: 16.5, height: 50 }
    ]
  },
  {
    key: "ten-dense-story-grid",
    name: "Tíz képes sűrű történet",
    photoCount: 10,
    slots: [
      { x: 0, y: 16, width: 25, height: 34 },
      { x: 25, y: 16, width: 24, height: 34 },
      { x: 49, y: 16, width: 25, height: 34 },
      { x: 74, y: 16, width: 12, height: 34 },
      { x: 86, y: 16, width: 14, height: 34 },
      { x: 0, y: 50, width: 25, height: 34 },
      { x: 25, y: 50, width: 12, height: 34 },
      { x: 37, y: 50, width: 12, height: 34 },
      { x: 49, y: 50, width: 25, height: 34 },
      { x: 74, y: 50, width: 26, height: 34 }
    ]
  }
];

export function getAlbumLayoutTemplate(layoutKey: string) {
  return ALBUM_LAYOUT_TEMPLATES.find((template) => template.key === layoutKey) ?? ALBUM_LAYOUT_TEMPLATES[0];
}

export function getAlbumLayoutTemplatesByPhotoCount(photoCount: number) {
  return ALBUM_LAYOUT_TEMPLATES.filter((template) => template.photoCount === photoCount);
}

export function pickRandomAlbumLayoutTemplate(photoCount: number, excludedLayoutKey?: string) {
  const templates = getAlbumLayoutTemplatesByPhotoCount(photoCount);
  const eligibleTemplates = excludedLayoutKey ? templates.filter((template) => template.key !== excludedLayoutKey) : templates;
  const pool = eligibleTemplates.length > 0 ? eligibleTemplates : templates;

  if (pool.length === 0) {
    return null;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}
