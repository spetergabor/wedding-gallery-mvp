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
