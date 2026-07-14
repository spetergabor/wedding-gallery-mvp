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
  previewSlotInsetPx?: number;
  exportSlotInsetPx?: number;
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
    key: "two-wide-panels-with-spine",
    name: "Két nagy kép gerinccel",
    photoCount: 2,
    previewSlotInsetPx: 0,
    exportSlotInsetPx: 0,
    slots: [
      { x: 0, y: 0, width: 36.5, height: 100 },
      { x: 37, y: 0, width: 63, height: 100 }
    ]
  },
  {
    key: "two-left-page-right-square",
    name: "Bal teljes oldal, jobb négyzet",
    photoCount: 2,
    previewSlotInsetPx: 0,
    exportSlotInsetPx: 0,
    slots: [
      { x: 0, y: 0, width: 50, height: 100 },
      { x: 58, y: 16, width: 34, height: 68 }
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
    key: "three-left-hero-right-portraits",
    name: "Bal nagy, jobb két portré",
    photoCount: 3,
    slots: [
      { x: 5, y: 18, width: 48, height: 64 },
      { x: 53, y: 18, width: 21, height: 64 },
      { x: 74, y: 18, width: 21, height: 64 }
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
    key: "four-left-story-right-hero",
    name: "Bal hármas történet, jobb nagy kép",
    photoCount: 4,
    slots: [
      { x: 5, y: 20, width: 21, height: 30 },
      { x: 5, y: 50, width: 21, height: 30 },
      { x: 26, y: 20, width: 19, height: 60 },
      { x: 55, y: 20, width: 40, height: 60 }
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
    key: "five-prep-panorama",
    name: "Öt képes készülődő panoráma",
    photoCount: 5,
    slots: [
      { x: 0, y: 22, width: 18.5, height: 56 },
      { x: 18.5, y: 22, width: 19, height: 56 },
      { x: 37.5, y: 22, width: 20.8, height: 28 },
      { x: 37.5, y: 50, width: 20.8, height: 28 },
      { x: 58.3, y: 22, width: 41.7, height: 56 }
    ]
  },
  {
    key: "five-left-mosaic-right-full-hero",
    name: "Bal négyes mozaik, jobb teljes kép",
    photoCount: 5,
    previewSlotInsetPx: 0,
    exportSlotInsetPx: 0,
    slots: [
      { x: 5, y: 10, width: 19.7, height: 39.7 },
      { x: 5, y: 50.7, width: 19.7, height: 39.3 },
      { x: 25.3, y: 10, width: 19.7, height: 56.2 },
      { x: 25.3, y: 67.2, width: 19.7, height: 22.8 },
      { x: 50, y: 0, width: 50, height: 100 }
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
    key: "five-left-page-hero-right-grid",
    name: "Bal nagy kép, jobb négyes rács",
    photoCount: 5,
    slots: [
      { x: 0, y: 0, width: 50, height: 100 },
      { x: 57.5, y: 15, width: 17.5, height: 35 },
      { x: 75, y: 15, width: 17.5, height: 35 },
      { x: 57.5, y: 50, width: 17.5, height: 35 },
      { x: 75, y: 50, width: 17.5, height: 35 }
    ]
  },
  {
    key: "five-left-grid-right-page-hero",
    name: "Bal négyes rács, jobb nagy kép",
    photoCount: 5,
    slots: [
      { x: 50, y: 0, width: 50, height: 100 },
      { x: 7.5, y: 15, width: 17.5, height: 35 },
      { x: 25, y: 15, width: 17.5, height: 35 },
      { x: 7.5, y: 50, width: 17.5, height: 35 },
      { x: 25, y: 50, width: 17.5, height: 35 }
    ]
  },
  {
    key: "five-side-heroes-center-cluster",
    name: "Két nagy oldal, középső hármas",
    photoCount: 5,
    slots: [
      { x: 0, y: 17, width: 33, height: 66 },
      { x: 67, y: 17, width: 33, height: 66 },
      { x: 34, y: 17, width: 32, height: 33 },
      { x: 34, y: 50, width: 16, height: 33 },
      { x: 50, y: 50, width: 16, height: 33 }
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
      { x: 0, y: 26, width: 16, height: 48 },
      { x: 16, y: 26, width: 16, height: 48 },
      { x: 32, y: 26, width: 29, height: 24 },
      { x: 61, y: 26, width: 15, height: 24 },
      { x: 76, y: 26, width: 24, height: 48 },
      { x: 32, y: 50, width: 15, height: 24 },
      { x: 47, y: 50, width: 14, height: 24 },
      { x: 61, y: 50, width: 15, height: 24 }
    ]
  },
  {
    key: "eight-centered-story-strip",
    name: "Nyolc képes középső történetsáv",
    photoCount: 8,
    slots: [
      { x: 0, y: 22, width: 12, height: 56 },
      { x: 13, y: 22, width: 25, height: 28 },
      { x: 39, y: 22, width: 12, height: 28 },
      { x: 52, y: 22, width: 25, height: 28 },
      { x: 78, y: 22, width: 10, height: 28 },
      { x: 89, y: 22, width: 11, height: 28 },
      { x: 13, y: 50, width: 38, height: 28 },
      { x: 52, y: 50, width: 48, height: 28 }
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
    key: "nine-full-bleed-editorial-grid",
    name: "Kilenc képes szélig futó mozaik",
    photoCount: 9,
    previewSlotInsetPx: 0,
    exportSlotInsetPx: 0,
    slots: [
      { x: 0, y: 0, width: 35, height: 66 },
      { x: 35.6, y: 0, width: 15.3, height: 32.4 },
      { x: 51.5, y: 0, width: 15.3, height: 32.4 },
      { x: 35.6, y: 33.6, width: 31.2, height: 32.4 },
      { x: 67.4, y: 0, width: 32.6, height: 66 },
      { x: 0, y: 67.2, width: 17.2, height: 32.8 },
      { x: 17.8, y: 67.2, width: 17.2, height: 32.8 },
      { x: 35.6, y: 67.2, width: 31.2, height: 32.8 },
      { x: 67.4, y: 67.2, width: 32.6, height: 32.8 }
    ]
  },
  {
    key: "nine-party-mosaic-right-hero",
    name: "Bal party mozaik, jobb nagy kép",
    photoCount: 9,
    slots: [
      { x: 0, y: 10, width: 15, height: 15 },
      { x: 0, y: 25, width: 15, height: 25 },
      { x: 15, y: 10, width: 15, height: 40 },
      { x: 30, y: 10, width: 20, height: 40 },
      { x: 0, y: 50, width: 15, height: 20 },
      { x: 0, y: 70, width: 15, height: 20 },
      { x: 15, y: 50, width: 19, height: 40 },
      { x: 34, y: 50, width: 16, height: 40 },
      { x: 50, y: 10, width: 50, height: 80 }
    ]
  },
  {
    key: "ten-left-group-right-six-grid",
    name: "Bal csoportkép, jobb hatos rács",
    photoCount: 10,
    slots: [
      { x: 5, y: 10, width: 40, height: 62 },
      { x: 5, y: 72, width: 13.33, height: 18 },
      { x: 18.33, y: 72, width: 13.34, height: 18 },
      { x: 31.67, y: 72, width: 13.33, height: 18 },
      { x: 55, y: 10, width: 20, height: 26.67 },
      { x: 75, y: 10, width: 20, height: 26.67 },
      { x: 55, y: 36.67, width: 20, height: 26.66 },
      { x: 75, y: 36.67, width: 20, height: 26.66 },
      { x: 55, y: 63.33, width: 20, height: 26.67 },
      { x: 75, y: 63.33, width: 20, height: 26.67 }
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

export function getAlbumLayoutPreviewSlotInsetPx(layoutKey: string) {
  return getAlbumLayoutTemplate(layoutKey).previewSlotInsetPx ?? ALBUM_SPREAD_PREVIEW_SLOT_INSET_PX;
}

export function getAlbumLayoutExportSlotInsetPx(layoutKey: string) {
  return getAlbumLayoutTemplate(layoutKey).exportSlotInsetPx ?? ALBUM_SPREAD_EXPORT_SLOT_INSET_PX;
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
