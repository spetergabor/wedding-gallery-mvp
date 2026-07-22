"use client";

import Image from "next/image";
import { type CSSProperties, FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, CreditCard, Download, Heart, Images, Mail, Maximize2, Play, Share2, ShieldCheck, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { APP_TIME_ZONE } from "@/lib/date-format";
import {
  createFavoriteListAction,
  getFavoriteListsAction,
  getGalleryDownloadPackageAction,
  getPaidGalleryPurchaseDownloadState,
  requestGalleryDownloadPackageAction,
  submitFavoriteListAction,
  toggleFavoritePhotoAction
} from "@/lib/public-actions";
import { createPaidGalleryCheckoutAction } from "@/lib/gallery-sales-actions";
import { dateLocaleForCustomer, type CustomerLanguage } from "@/lib/customer-language";
import { DEFAULT_GALLERY_DOWNLOAD_QUALITY } from "@/lib/download-quality";
import { GALLERY_DELIVERY_PAID, normalizeGalleryDeliveryMode } from "@/lib/gallery-delivery";
import { normalizeGalleryGridGap, normalizeGalleryImageRadius } from "@/lib/gallery-appearance";
import {
  priceForGalleryPhotoQuantity,
  pricingTierLabel,
  type GallerySalePricingTier
} from "@/lib/gallery-sale-pricing";

const GALLERY_COPY = {
  de: {
    selection: "Bildauswahl",
    favoritesList: "Favoritenliste",
    newListPlaceholder: "Neue Liste, z. B. Album",
    createList: "Liste erstellen",
    selected: "ausgewählt",
    favorites: "Favoriten",
    noActiveSelection: "Keine aktive Auswahl",
    noActiveList: "Keine aktive Liste",
    sent: "Abgeschickt",
    completed: "Abgeschlossen",
    selectionReady: "Wenn deine Auswahl fertig ist, schicke sie ab.",
    listReady: "Wenn deine Auswahl fertig ist, schließe die Liste ab.",
    saving: "Wird gespeichert...",
    updateSelection: "Auswahl aktualisieren",
    sendSelection: "Auswahl abschicken",
    finishSelection: "Auswahl abschließen",
    zipPreparing: "ZIP wird vorbereitet",
    zipEmail: "Herunterladen",
    downloadAlbum: "Album herunterladen",
    downloadIntro: "Gib deine E-Mail-Adresse ein. Wir schicken dir die ZIP-Links.",
    close: "Schließen",
    email: "E-Mail-Adresse",
    zipPartsInfo: "Große Galerien können aus mehreren ZIP-Teilen bestehen.",
    zipTimeInfo: "Große Galerien können mehrere Minuten dauern.",
    zipSpamInfo: "Falls die E-Mail nicht ankommt, prüfe bitte auch deinen Spam- oder Werbung-Ordner.",
    directZipReady: "Der ZIP-Download ist bereit.",
    directZipIntro: "Die Links kommen zusätzlich per E-Mail.",
    directZipDownload: "ZIP direkt herunterladen",
    directZipPartDownload: (part: number, total: number) => `ZIP Teil ${part}/${total} herunterladen`,
    zipLinksPreparing: "ZIP-Links werden vorbereitet",
    requestDownloadLinks: "Download-Links anfordern",
    cancel: "Abbrechen",
    reviewSelection: "Auswahl prüfen",
    reviewSelectionText: (count: number) => `Du hast ${count} ${count === 1 ? "Foto" : "Fotos"} ausgewählt. Bitte prüfe die Auswahl, bevor du sie abschickst.`,
    moreSelected: (count: number) => `+${count} weitere ausgewählte Fotos`,
    filenames: "Dateinamen",
    backToSelection: "Zurück zur Auswahl",
    sending: "Wird abgeschickt...",
    saveSelection: "Bildauswahl speichern",
    saveFavorites: "Favoriten speichern",
    saveSelectionIntro: "Gib deine E-Mail-Adresse ein, damit wir deine Auswahl zuordnen können.",
    saveFavoritesIntro: "Gib deine E-Mail-Adresse ein. Deine ausgewählten Lieblingsfotos werden damit gespeichert.",
    saveSelectionButton: "Auswahl speichern",
    saveFavoriteButton: "Favorit speichern",
    choose: "Auswählen",
    favorite: "Favorit",
    chooseAria: "auswählen",
    favoriteAria: "zu den Favoriten hinzufügen",
    loading: "Lädt...",
    download: "Herunterladen",
    share: "Teilen",
    shareCopied: "Link kopiert",
    shareFailed: "Teilen fehlgeschlagen",
    previousPhoto: "Vorheriges Foto",
    nextPhoto: "Nächstes Foto",
    saveError: "Die Auswahl konnte nicht gespeichert werden.",
    downloadLinksSent: "Die Download-Links wurden in einer E-Mail gesendet.",
    zipProcessing: "Die ZIP-Teile werden erstellt. Du bekommst eine E-Mail mit allen Links.",
    zipWaiting: "Die ZIP-Teile warten auf Verarbeitung. Du bekommst eine E-Mail mit allen Links.",
    downloadPreparing: "Download-Paket wird vorbereitet...",
    zipPrepareFailed: "Die ZIP-Datei konnte nicht vorbereitet werden.",
    zipCreateFailed: "Die ZIP-Datei konnte nicht erstellt werden.",
    photoDownloadFailed: "Das Foto konnte nicht heruntergeladen werden.",
    selectionNotFound: "Die Auswahl konnte nicht gefunden werden.",
    favoriteListNotFound: "Die Favoritenliste konnte nicht gefunden werden.",
    defaultSelectionName: "Auswahl",
    defaultFavoritesName: "Favoriten",
    favoriteSaveError: "Der Favorit konnte nicht gespeichert werden.",
    emailRequired: "Bitte gib deine E-Mail-Adresse ein.",
    listNameRequired: "Bitte gib einen Namen für die Liste ein.",
    listCreateError: "Die Liste konnte nicht erstellt werden.",
    selectionSaved: "Die Auswahl wurde gespeichert.",
    openPhoto: "Foto öffnen",
    videoSectionTitle: "Videos",
    videoCount: (count: number) => `${count} ${count === 1 ? "Video" : "Videos"}`,
    paidTitle: "Galerie kaufen",
    paidIntro: "Diese Galerie ist als Vorschau geschützt. Du kannst einzelne Fotos oder die ganze Galerie kaufen.",
    paidNoCostIntro: "Diese Galerie nutzt einen 0-EUR-Test-Checkout. Stripe schließt den Ablauf ohne Kartendaten ab.",
    paidName: "Name",
    paidEmail: "E-Mail-Adresse",
    paidButton: "Mit Stripe bezahlen",
    paidNoCostButton: "Test-Checkout starten",
    paidSecure: "Sichere Zahlung über Stripe. Der Fotograf erhält die Zahlung direkt über sein eigenes Stripe-Konto.",
    paidSuccess: "Zahlung erhalten. Dein Kauf wird freigeschaltet.",
    paidCancelled: "Die Zahlung wurde abgebrochen. Du kannst den Kauf jederzeit erneut starten.",
    paidError: "Der Kauf konnte nicht gestartet werden. Bitte versuche es später erneut.",
    paidDownloadReady: "Dein Download ist bereit. Wir schicken den Link zusätzlich per E-Mail.",
    paidDownloadPreparing: "Dein Download wird vorbereitet. Diese Seite aktualisiert den Status automatisch, und du bekommst den Link per E-Mail.",
    paidDownloadFailed: "Der Download konnte nicht vorbereitet werden. Bitte kontaktiere den Fotografen.",
    paidDownloadButton: "Galerie herunterladen",
    paidDownloadPartButton: (part: number, total: number) => `Teil ${part}/${total} herunterladen`,
    paidPhotosUnlocked: "Die gekauften Fotos sind freigeschaltet. Du kannst sie direkt in der Galerie herunterladen.",
    paidPhotosUnlockedHint: "Die gekauften Fotos sind unten direkt als Download verfügbar.",
    paidPhotoDownloadButton: "Foto herunterladen",
    paidPhotoDownloadMore: (count: number) => `+ ${count} weitere Fotos direkt in der Galerie`,
    wholeGalleryTitle: "Komplette Galerie",
    buyWholeGallery: "Komplette Galerie kaufen",
    photoCartTitle: "Einzelne Fotos kaufen",
    photoCartIntro: "Lege Fotos in den Warenkorb. Der Preis passt sich automatisch an die Menge an.",
    addToCart: "In den Warenkorb",
    removeFromCart: "Aus dem Warenkorb entfernen",
    inCart: "Im Warenkorb",
    purchased: "Gekauft",
    cartEmpty: "Wähle unten Fotos aus.",
    selectedPhotos: (count: number) => `${count} ${count === 1 ? "Foto" : "Fotos"}`,
    cartTotal: "Summe",
    cartCheckout: "Warenkorb kaufen",
    priceTiers: "Mengenpreise",
    baseUnitPrice: "Einzelpreis",
    buyerDetails: "Käuferdaten",
    checkoutSummary: "Bestellübersicht",
    selectedPhotosLabel: "Ausgewählte Fotos",
    cartActionRequired: "Wähle unten Fotos aus, um den Warenkorb zu kaufen.",
    wholeGalleryIncluded: "Alle freigeschalteten Fotos als Download.",
    selectedCheckoutHint: "Ausgewählte Fotos kaufen",
    wholeGalleryCheckoutHint: "Alle Fotos kaufen"
  },
  hu: {
    selection: "Képválogatás",
    favoritesList: "Kedvencek listája",
    newListPlaceholder: "Új lista, pl. Album",
    createList: "Lista létrehozása",
    selected: "kiválasztva",
    favorites: "kedvenc",
    noActiveSelection: "Nincs aktív válogatás",
    noActiveList: "Nincs aktív lista",
    sent: "Elküldve",
    completed: "Lezárva",
    selectionReady: "Ha kész a válogatás, küldd el.",
    listReady: "Ha kész a válogatás, zárd le a listát.",
    saving: "Mentés...",
    updateSelection: "Válogatás frissítése",
    sendSelection: "Válogatás elküldése",
    finishSelection: "Válogatás lezárása",
    zipPreparing: "ZIP előkészítése",
    zipEmail: "Letöltés",
    downloadAlbum: "Album letöltése",
    downloadIntro: "Add meg az e-mail címed, elküldjük a ZIP linkeket.",
    close: "Bezárás",
    email: "E-mail cím",
    zipPartsInfo: "A nagy galériák több ZIP-részből is állhatnak.",
    zipTimeInfo: "Nagy galériánál az előkészítés több percig is tarthat.",
    zipSpamInfo: "Ha nem érkezik meg az e-mail, nézd meg a spam vagy promóciók mappát is.",
    directZipReady: "A ZIP letöltés készen van.",
    directZipIntro: "A linkeket e-mailben is elküldjük.",
    directZipDownload: "ZIP közvetlen letöltése",
    directZipPartDownload: (part: number, total: number) => `${part}/${total}. ZIP rész letöltése`,
    zipLinksPreparing: "ZIP-linkek előkészítése",
    requestDownloadLinks: "Letöltési linkek kérése",
    cancel: "Mégse",
    reviewSelection: "Válogatás ellenőrzése",
    reviewSelectionText: (count: number) => `${count} fotót választottál ki. Küldés előtt ellenőrizd a válogatást.`,
    moreSelected: (count: number) => `+${count} további kiválasztott fotó`,
    filenames: "Fájlnevek",
    backToSelection: "Vissza a válogatáshoz",
    sending: "Küldés...",
    saveSelection: "Képválogatás mentése",
    saveFavorites: "Kedvencek mentése",
    saveSelectionIntro: "Add meg az e-mail címed, hogy hozzá tudjuk rendelni a válogatásodat.",
    saveFavoritesIntro: "Add meg az e-mail címed. Így tudjuk menteni a kiválasztott kedvenc fotóidat.",
    saveSelectionButton: "Válogatás mentése",
    saveFavoriteButton: "Kedvenc mentése",
    choose: "Kiválasztás",
    favorite: "Kedvenc",
    chooseAria: "kiválasztása",
    favoriteAria: "hozzáadása a kedvencekhez",
    loading: "Betöltés...",
    download: "Letöltés",
    share: "Megosztás",
    shareCopied: "Link másolva",
    shareFailed: "A megosztás nem sikerült",
    previousPhoto: "Előző fotó",
    nextPhoto: "Következő fotó",
    saveError: "A válogatást nem sikerült menteni.",
    downloadLinksSent: "A letöltési linkeket elküldtük e-mailben.",
    zipProcessing: "A ZIP-részek készülnek. Egy e-mailben megkapod az összes linket.",
    zipWaiting: "A ZIP-részek feldolgozásra várnak. Egy e-mailben megkapod az összes linket.",
    downloadPreparing: "Letöltési csomag előkészítése...",
    zipPrepareFailed: "A ZIP fájlt nem sikerült előkészíteni.",
    zipCreateFailed: "A ZIP fájlt nem sikerült létrehozni.",
    photoDownloadFailed: "A fotót nem sikerült letölteni.",
    selectionNotFound: "A válogatást nem sikerült megtalálni.",
    favoriteListNotFound: "A kedvenclistát nem sikerült megtalálni.",
    defaultSelectionName: "Válogatás",
    defaultFavoritesName: "Kedvencek",
    favoriteSaveError: "A kedvencet nem sikerült menteni.",
    emailRequired: "Add meg az e-mail címed.",
    listNameRequired: "Adj nevet a listának.",
    listCreateError: "A listát nem sikerült létrehozni.",
    selectionSaved: "A válogatást mentettük.",
    openPhoto: "Fotó megnyitása",
    videoSectionTitle: "Videók",
    videoCount: (count: number) => `${count} videó`,
    paidTitle: "Galéria megvásárlása",
    paidIntro: "Ez a galéria előnézetként védett. Megvehetsz egyes fotókat vagy a teljes galériát.",
    paidNoCostIntro: "Ez 0 EUR-os teszt Checkout. A Stripe kártyaadat nélkül zárja le a folyamatot.",
    paidName: "Név",
    paidEmail: "E-mail cím",
    paidButton: "Fizetés Stripe-pal",
    paidNoCostButton: "Teszt Checkout indítása",
    paidSecure: "Biztonságos fizetés Stripe-on keresztül. A fizetés közvetlenül a fotós saját Stripe fiókjához kapcsolódik.",
    paidSuccess: "A fizetés sikeres. A vásárlás feloldása folyamatban van.",
    paidCancelled: "A fizetés megszakadt. A vásárlást bármikor újraindíthatod.",
    paidError: "A vásárlást nem sikerült elindítani. Próbáld újra később.",
    paidDownloadReady: "A letöltés készen van. A linket e-mailben is elküldjük.",
    paidDownloadPreparing: "A letöltés előkészítés alatt van. Ez az oldal automatikusan frissíti az állapotot, és e-mailben is megkapod a linket.",
    paidDownloadFailed: "A letöltést nem sikerült előkészíteni. Kérlek, vedd fel a kapcsolatot a fotóssal.",
    paidDownloadButton: "Galéria letöltése",
    paidDownloadPartButton: (part: number, total: number) => `${part}/${total}. rész letöltése`,
    paidPhotosUnlocked: "A megvásárolt képek feloldva. Közvetlenül a galériából le tudod tölteni őket.",
    paidPhotosUnlockedHint: "A megvásárolt képek itt is közvetlenül letölthetők.",
    paidPhotoDownloadButton: "Kép letöltése",
    paidPhotoDownloadMore: (count: number) => `+ ${count} további kép közvetlenül a galériában`,
    wholeGalleryTitle: "Teljes galéria",
    buyWholeGallery: "Teljes galéria megvásárlása",
    photoCartTitle: "Képek vásárlása darabonként",
    photoCartIntro: "Tedd kosárba a képeket. Az ár automatikusan igazodik a darabszámhoz.",
    addToCart: "Kosárba",
    removeFromCart: "Kivétel a kosárból",
    inCart: "Kosárban",
    purchased: "Megvásárolva",
    cartEmpty: "Válassz képeket lent.",
    selectedPhotos: (count: number) => `${count} kép`,
    cartTotal: "Összesen",
    cartCheckout: "Kosár megvásárlása",
    priceTiers: "Darabszám szerinti árak",
    baseUnitPrice: "Darabár",
    buyerDetails: "Vásárlói adatok",
    checkoutSummary: "Rendelés összegzése",
    selectedPhotosLabel: "Kiválasztott képek",
    cartActionRequired: "Válassz lent képeket a kosár megvásárlásához.",
    wholeGalleryIncluded: "Az összes feloldott fotó letölthető.",
    selectedCheckoutHint: "Kiválasztott képek megvásárlása",
    wholeGalleryCheckoutHint: "Teljes galéria megvásárlása"
  }
} as const;

type PublicPhoto = {
  id: string;
  sectionId?: string | null;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  mediaType: string;
  processingStatus: string;
  imageWidth: number;
  imageHeight: number;
};

type PublicGallerySection = {
  id: string;
  title: string;
  slug: string;
};

type PublicPhotoItem = {
  photo: PublicPhoto;
  index: number;
};

type DownloadPackageStatus = "pending" | "processing" | "completed" | "failed";

type DownloadPackageLink = {
  id: string;
  downloadUrl: string;
  filename: string;
  partIndex: number;
  partCount: number;
};

type PaidGalleryDownloadState = {
  ok: boolean;
  paid: boolean;
  message: string;
  status: DownloadPackageStatus | string;
  packageId: string | null;
  downloadUrl: string | null;
  filename: string | null;
  packages: DownloadPackageLink[];
  purchaseKind?: string | null;
  purchasedPhotoIds?: string[];
};

type GallerySaleSettings = {
  priceCents: number;
  unitPriceCents: number;
  pricingTiers: GallerySalePricingTier[];
  currency: string;
  priceLabel: string;
  purchaseStatus?: string | null;
  purchaseSessionId?: string | null;
  purchaseDownload?: PaidGalleryDownloadState | null;
  purchasedPhotoIds?: string[];
  fullGalleryPurchased?: boolean;
};

type StickyToolbarSettings = {
  title: string;
  subtitle?: string | null;
  sharePath: string;
};

type GalleryAnchorLink = {
  href: string;
  label: string;
  count: number;
};

type FavoriteListState = {
  id: string;
  name: string;
  submittedAt: string | null;
  photoIds: string[];
};

function photoFileName(photo: PublicPhoto, index: number) {
  const fallback = `photo-${String(index + 1).padStart(3, "0")}.jpg`;
  return (photo.filename || fallback).replace(/[\\/:*?"<>|]/g, "-");
}

function formatSaleMoney(cents: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: (currency || "eur").toUpperCase()
  }).format(Math.max(0, cents) / 100);
}

function hasImageDimensions(photo: PublicPhoto) {
  return photo.mediaType !== "video" && photo.imageWidth > 0 && photo.imageHeight > 0;
}

function hasMediaDimensions(photo: PublicPhoto) {
  return photo.imageWidth > 0 && photo.imageHeight > 0;
}

function isVideo(photo: PublicPhoto) {
  return photo.mediaType === "video";
}

function videoPosterUrl(photo: PublicPhoto) {
  if (!isVideo(photo)) {
    return undefined;
  }

  if (photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl) {
    return photo.thumbnailUrl;
  }

  if (photo.previewUrl && photo.previewUrl !== photo.imageUrl) {
    return photo.previewUrl;
  }

  return undefined;
}

function primeVideoCoverFrame(video: HTMLVideoElement, hasPoster: boolean) {
  if (hasPoster || video.currentTime > 0.05) {
    return;
  }

  try {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const preferredCoverTime = duration > 0 ? Math.max(2, Math.min(5, duration * 0.15)) : 2;
    video.currentTime = duration > 0 ? Math.min(preferredCoverTime, Math.max(0, duration - 0.1)) : preferredCoverTime;
  } catch {
    // Some browsers block seeking until more metadata is available. The video remains playable.
  }
}

function PublicVideoPreview({ photo }: { photo: PublicPhoto }) {
  const posterUrl = videoPosterUrl(photo);

  return (
    <span className="relative block aspect-[4/5] w-full overflow-hidden bg-ink">
      <video
        src={photo.imageUrl}
        poster={posterUrl}
        preload="metadata"
        muted
        playsInline
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;

          primeVideoCoverFrame(video, Boolean(posterUrl));
        }}
        className="h-full w-full object-cover opacity-90 transition duration-500 ease-out group-hover:scale-[1.025]"
      />
      <span className="absolute inset-0 grid place-items-center bg-ink/15 text-white">
        <span className="grid size-14 place-items-center rounded-full bg-white/90 text-ink shadow-soft">
          <Play size={22} fill="currentColor" />
        </span>
      </span>
    </span>
  );
}

function normalizeDownloadLinks(result: {
  downloadUrl: string | null;
  filename: string | null;
  packages?: DownloadPackageLink[];
}) {
  if (result.packages?.length) {
    return result.packages.filter((downloadPackage) => Boolean(downloadPackage.downloadUrl));
  }

  if (!result.downloadUrl) {
    return [];
  }

  return [
    {
      id: "single-download",
      downloadUrl: result.downloadUrl,
      filename: result.filename ?? "gallery.zip",
      partIndex: 0,
      partCount: 1
    }
  ];
}

function hasLightweightThumbnail(photo: PublicPhoto) {
  return !isVideo(photo) && photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl;
}

function hasLightweightPreview(photo: PublicPhoto) {
  return !isVideo(photo) && photo.previewUrl && photo.previewUrl !== photo.imageUrl;
}

function getColumnCount(width: number) {
  if (width >= 1280) {
    return 4;
  }

  if (width >= 1024) {
    return 3;
  }

  if (width >= 640) {
    return 2;
  }

  return 1;
}

function createPhotoColumns(items: PublicPhotoItem[], columnCount: number) {
  const safeColumnCount = Math.max(1, columnCount);
  const columns = Array.from({ length: safeColumnCount }, () => [] as PublicPhotoItem[]);
  const columnHeights = Array.from({ length: safeColumnCount }, () => 0);

  items.forEach(({ photo, index }) => {
    const shortestColumnIndex = columnHeights.reduce((shortestIndex, height, currentIndex) => {
      return height < columnHeights[shortestIndex] ? currentIndex : shortestIndex;
    }, 0);
    const estimatedRatio = hasMediaDimensions(photo) ? photo.imageHeight / photo.imageWidth : isVideo(photo) ? 9 / 16 : 1;

    columns[shortestColumnIndex].push({ photo, index });
    columnHeights[shortestColumnIndex] += estimatedRatio;
  });

  return columns;
}

export function PublicGallery({
  galleryId,
  gallerySlug,
  title,
  photos,
  sections = [],
  downloadsEnabled,
  deliveryMode = "free_download",
  sale = null,
  favoritesEnabled = true,
  favoriteMode = "favorites",
  language = "de",
  mobileColumns = 1,
  gridGap = 8,
  imageRadius = 8,
  textColor = "#111111",
  fontFamily,
  stickyToolbar = null,
  extraAnchorLinks = []
}: {
  galleryId: string;
  gallerySlug: string;
  title: string;
  photos: PublicPhoto[];
  sections?: PublicGallerySection[];
  downloadsEnabled: boolean;
  deliveryMode?: string;
  sale?: GallerySaleSettings | null;
  favoritesEnabled?: boolean;
  favoriteMode?: "favorites" | "proofing";
  language?: CustomerLanguage;
  mobileColumns?: number;
  gridGap?: number;
  imageRadius?: number;
  textColor?: string;
  fontFamily?: string;
  stickyToolbar?: StickyToolbarSettings | null;
  extraAnchorLinks?: GalleryAnchorLink[];
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const downloadQuality = DEFAULT_GALLERY_DOWNLOAD_QUALITY;
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [zipProgress, setZipProgress] = useState("");
  const [zipPackageId, setZipPackageId] = useState<string | null>(null);
  const [zipPackageStatus, setZipPackageStatus] = useState<DownloadPackageStatus | null>(null);
  const [zipDownloadLinks, setZipDownloadLinks] = useState<DownloadPackageLink[]>([]);
  const [paidDownloadState, setPaidDownloadState] = useState<PaidGalleryDownloadState | null>(sale?.purchaseDownload ?? null);
  const [favoriteEmail, setFavoriteEmail] = useState("");
  const [favoriteEmailDraft, setFavoriteEmailDraft] = useState("");
  const [favoriteLists, setFavoriteLists] = useState<FavoriteListState[]>([]);
  const [activeFavoriteListId, setActiveFavoriteListId] = useState("");
  const [newFavoriteListName, setNewFavoriteListName] = useState("");
  const [favoriteError, setFavoriteError] = useState("");
  const [favoritePromptPhotoId, setFavoritePromptPhotoId] = useState<string | null>(null);
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null);
  const [lastFavoritePulseId, setLastFavoritePulseId] = useState<string | null>(null);
  const [isSubmittingFavoriteList, setIsSubmittingFavoriteList] = useState(false);
  const [isSubmittingFavoriteEmail, setIsSubmittingFavoriteEmail] = useState(false);
  const [favoriteSuccess, setFavoriteSuccess] = useState("");
  const [columnCount, setColumnCount] = useState(1);
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [cartPhotoIds, setCartPhotoIds] = useState<string[]>([]);
  const [isSelectionSummaryOpen, setIsSelectionSummaryOpen] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");
  const [isFilteringFavorites, startFavoritesFilterTransition] = useTransition();
  const copy = GALLERY_COPY[language];
  const paidGallery = normalizeGalleryDeliveryMode(deliveryMode) === GALLERY_DELIVERY_PAID;
  const fullGalleryPurchased = Boolean(sale?.fullGalleryPurchased);
  const unlockedPaidPhotoIds = useMemo(
    () => new Set([...(sale?.purchasedPhotoIds ?? []), ...(paidDownloadState?.purchasedPhotoIds ?? [])]),
    [paidDownloadState?.purchasedPhotoIds, sale?.purchasedPhotoIds]
  );
  const cartPhotoIdSet = useMemo(() => new Set(cartPhotoIds), [cartPhotoIds]);
  const locale = dateLocaleForCustomer(language);
  const cartTotalCents = sale
    ? priceForGalleryPhotoQuantity({
        quantity: cartPhotoIds.length,
        fallbackUnitPriceCents: sale.unitPriceCents,
        tiers: sale.pricingTiers
      })
    : 0;
  const cartTotalLabel = sale ? formatSaleMoney(cartTotalCents, sale.currency, locale) : "";
  const unitPriceLabel = sale ? formatSaleMoney(sale.unitPriceCents, sale.currency, locale) : "";
  const showBaseUnitPrice = Boolean(sale && (sale.unitPriceCents > 0 || sale.pricingTiers.length === 0));
  const canDownload = downloadsEnabled && !paidGallery;
  const hasPaidCartBar = paidGallery && Boolean(sale) && !fullGalleryPurchased;
  const purchaseNotice =
    sale?.purchaseStatus === "success"
      ? { tone: "success", text: copy.paidSuccess }
      : sale?.purchaseStatus === "cancelled"
        ? { tone: "info", text: copy.paidCancelled }
        : sale?.purchaseStatus && sale.purchaseStatus !== "success"
          ? { tone: "error", text: copy.paidError }
          : null;
  const proofingSelection = favoritesEnabled && favoriteMode === "proofing";
  const safeMobileColumns = Math.min(3, Math.max(1, mobileColumns));
  const safeGridGap = normalizeGalleryGridGap(gridGap);
  const safeImageRadius = normalizeGalleryImageRadius(imageRadius);
  const mobileImageSize = safeMobileColumns === 1 ? "100vw" : safeMobileColumns === 2 ? "50vw" : "33vw";
  const imageSizes = `(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, ${mobileImageSize}`;
  const activeFavoriteList = favoriteLists.find((list) => list.id === activeFavoriteListId) ?? favoriteLists[0] ?? null;
  const favoriteIds = useMemo(
    () => new Set(favoritesEnabled ? activeFavoriteList?.photoIds ?? [] : []),
    [activeFavoriteList, favoritesEnabled]
  );

  const visiblePhotos = useMemo(() => {
    if (!favoritesEnabled || !showFavoritesOnly) {
      return photos;
    }

    return photos.filter((photo) => favoriteIds.has(photo.id));
  }, [favoriteIds, favoritesEnabled, photos, showFavoritesOnly]);
  const visibleItems = useMemo(
    () => visiblePhotos.map((photo, index) => ({ photo, index })),
    [visiblePhotos]
  );
  const visibleVideoItems = useMemo(
    () => visibleItems.filter(({ photo }) => isVideo(photo)),
    [visibleItems]
  );
  const visibleImageItems = useMemo(
    () => visibleItems.filter(({ photo }) => !isVideo(photo)),
    [visibleItems]
  );

  const selectedPhoto = useMemo(() => {
    if (selectedIndex === null) {
      return null;
    }

    return visiblePhotos[selectedIndex] ?? null;
  }, [selectedIndex, visiblePhotos]);
  const selectedFavoritePhotos = useMemo(
    () => photos.filter((photo) => favoriteIds.has(photo.id)),
    [favoriteIds, photos]
  );
  const purchasedPhotoDownloadItems = useMemo(
    () => photos.filter((photo) => unlockedPaidPhotoIds.has(photo.id) && !isVideo(photo)),
    [photos, unlockedPaidPhotoIds]
  );

  const selectedPosition = selectedIndex === null ? 0 : selectedIndex + 1;
  const favoriteCount = favoriteIds.size;
  const galleryGridStyle: CSSProperties = {
    gap: `${safeGridGap}px`,
    gridTemplateColumns: `repeat(${Math.max(1, columnCount)}, minmax(0, 1fr))`
  };
  const galleryColumnStyle: CSSProperties = {
    gap: `${safeGridGap}px`
  };
  const galleryItemStyle: CSSProperties = {
    borderRadius: `${safeImageRadius}px`
  };
  const galleryThemeStyle = {
    "--gallery-body-text-color": textColor,
    "--gallery-body-font-family": fontFamily ?? "inherit"
  } as CSSProperties & Record<"--gallery-body-text-color" | "--gallery-body-font-family", string>;
  const photoColumns = useMemo(() => {
    return createPhotoColumns(visibleImageItems, columnCount);
  }, [columnCount, visibleImageItems]);
  const sectionBlocks = useMemo(() => {
    if (sections.length === 0) {
      return [];
    }

    const knownSectionIds = new Set(sections.map((section) => section.id));
    const blocks = sections
      .map((section) => {
        const imageItems = visibleImageItems.filter(({ photo }) => photo.sectionId === section.id);

        if (imageItems.length === 0) {
          return null;
        }

        return {
          key: section.id,
          anchorId: `gallery-section-${section.slug}`,
          title: section.title,
          count: imageItems.length,
          imageColumns: createPhotoColumns(imageItems, columnCount)
        };
      })
      .filter((block): block is NonNullable<typeof block> => Boolean(block));
    const remainderItems = visibleImageItems.filter(({ photo }) => !photo.sectionId || !knownSectionIds.has(photo.sectionId));

    if (remainderItems.length > 0) {
      blocks.push({
        key: "rest",
        anchorId: "gallery-section-rest",
        title: language === "hu" ? "További képek" : "Weitere Bilder",
        count: remainderItems.length,
        imageColumns: createPhotoColumns(remainderItems, columnCount)
      });
    }

    return blocks;
  }, [columnCount, language, sections, visibleImageItems]);
  const stickyAnchorLinks = useMemo(() => {
    if (!stickyToolbar) {
      return [];
    }

    return [
      ...(visibleVideoItems.length > 0
        ? [
            {
              href: "#public-gallery-videos",
              label: language === "hu" ? "Videók" : "Videos",
              count: visibleVideoItems.length
            }
          ]
        : []),
      ...sectionBlocks.map((block) => ({
        href: `#${block.anchorId}`,
        label: block.title,
        count: block.count
      })),
      ...extraAnchorLinks
    ];
  }, [extraAnchorLinks, language, sectionBlocks, stickyToolbar, visibleVideoItems.length]);

  useEffect(() => {
    if (!favoritesEnabled) {
      setShowFavoritesOnly(false);
      return;
    }

    if (showFavoritesOnly && favoriteCount === 0) {
      setShowFavoritesOnly(false);
    }
  }, [favoriteCount, favoritesEnabled, showFavoritesOnly]);

  useEffect(() => {
    setPaidDownloadState(sale?.purchaseDownload ?? null);
  }, [sale?.purchaseDownload]);

  useEffect(() => {
    if (!paidGallery || unlockedPaidPhotoIds.size === 0) {
      return;
    }

    setCartPhotoIds((current) => current.filter((photoId) => !unlockedPaidPhotoIds.has(photoId)));
  }, [paidGallery, unlockedPaidPhotoIds]);

  useEffect(() => {
    if (!paidGallery || !sale?.purchaseSessionId || !paidDownloadState?.paid) {
      return;
    }

    if (paidDownloadState.status === "completed" || paidDownloadState.status === "failed") {
      return;
    }

    let isMounted = true;
    const sessionId = sale.purchaseSessionId;

    async function refreshPaidDownloadState() {
      const result = await getPaidGalleryPurchaseDownloadState(galleryId, sessionId);

      if (!isMounted) {
        return;
      }

      setPaidDownloadState(result as PaidGalleryDownloadState);
    }

    const interval = window.setInterval(refreshPaidDownloadState, 4000);
    void refreshPaidDownloadState();

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [galleryId, paidDownloadState?.paid, paidDownloadState?.status, paidGallery, sale?.purchaseSessionId]);

  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= visiblePhotos.length) {
      setSelectedIndex(visiblePhotos.length > 0 ? visiblePhotos.length - 1 : null);
    }
  }, [selectedIndex, visiblePhotos.length]);

  useEffect(() => {
    function updateColumnCount() {
      setColumnCount(window.innerWidth < 640 ? safeMobileColumns : getColumnCount(window.innerWidth));
    }

    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);

    return () => window.removeEventListener("resize", updateColumnCount);
  }, [safeMobileColumns]);

  useEffect(() => {
    if (!favoritesEnabled) {
      setFavoriteEmail("");
      setFavoriteEmailDraft("");
      setFavoriteLists([]);
      setActiveFavoriteListId("");
      setFavoritePromptPhotoId(null);
      setFavoriteError("");
      setFavoriteSuccess("");
      return;
    }

    const storedEmail = window.localStorage.getItem(`wgm-favorite-email-${galleryId}`);

    if (!storedEmail) {
      return;
    }

    setFavoriteEmail(storedEmail);
    setFavoriteEmailDraft(storedEmail);
    getFavoriteListsAction(galleryId, storedEmail).then((result) => {
      if (result.ok) {
        setFavoriteLists(result.lists);
        setActiveFavoriteListId(result.lists[0]?.id ?? "");
      }
    });
  }, [favoritesEnabled, galleryId]);

  function showPreviousPhoto() {
    setSelectedIndex((current) => {
      if (current === null || visiblePhotos.length === 0) {
        return current;
      }

      return current === 0 ? visiblePhotos.length - 1 : current - 1;
    });
  }

  function showNextPhoto() {
    setSelectedIndex((current) => {
      if (current === null || visiblePhotos.length === 0) {
        return current;
      }

      return current === visiblePhotos.length - 1 ? 0 : current + 1;
    });
  }

  useEffect(() => {
    if (selectedIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedIndex(null);
      }

      if (event.key === "ArrowLeft") {
        showPreviousPhoto();
      }

      if (event.key === "ArrowRight") {
        showNextPhoto();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, visiblePhotos.length]);

  function closeDownloadDialog() {
    setIsEmailOpen(false);
    setIsZipping(false);
    setZipPackageId(null);
    setZipPackageStatus(null);
    setZipDownloadLinks([]);
    setZipProgress("");
    setEmailError("");
  }

  useEffect(() => {
    if (!zipPackageId || !isEmailOpen || !isZipping) {
      return;
    }

    let isMounted = true;
    const packageId = zipPackageId;

    async function checkPackage() {
      const result = await getGalleryDownloadPackageAction(packageId);

      if (!isMounted) {
        return;
      }

      if (!result.ok) {
        setEmailError(result.message);
        setZipPackageStatus("failed");
        setZipDownloadLinks([]);
        setIsZipping(false);
        setZipProgress("");
        return;
      }

      setZipPackageStatus(result.status as DownloadPackageStatus);

      if (result.status === "completed") {
        setZipDownloadLinks(normalizeDownloadLinks(result));
        setZipProgress(copy.downloadLinksSent);
        setIsZipping(false);
        setZipPackageId(null);
        setZipPackageStatus("completed");
        return;
      }

      setZipProgress(
        result.status === "processing"
          ? copy.zipProcessing
          : copy.zipWaiting
      );
    }

    const interval = window.setInterval(checkPackage, 3000);
    void checkPackage();

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [copy.downloadLinksSent, copy.zipProcessing, copy.zipWaiting, isEmailOpen, isZipping, title, zipPackageId]);

  async function createZipDownload() {
    if (isZipping || !canDownload) {
      return;
    }

    setIsZipping(true);
    setEmailError("");
    setZipPackageId(null);
    setZipPackageStatus(null);
    setZipDownloadLinks([]);
    setZipProgress(copy.downloadPreparing);

    try {
      const result = await requestGalleryDownloadPackageAction(galleryId, email, downloadQuality);

      if (!result.ok) {
        throw new Error(result.message);
      }

      if (result.status === "completed") {
        setZipDownloadLinks(normalizeDownloadLinks(result));
        setZipProgress(copy.downloadLinksSent);
        setIsZipping(false);
        setZipPackageStatus("completed");
        return;
      }

      if (!result.packageId) {
        throw new Error(copy.zipPrepareFailed);
      }

      setZipPackageId(result.packageId);
      setZipPackageStatus(result.status as DownloadPackageStatus);
      setZipProgress(
        result.status === "processing"
          ? copy.zipProcessing
          : copy.zipWaiting
      );
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : copy.zipCreateFailed);
      setIsZipping(false);
      setZipProgress("");
    }
  }

  async function submitDownloadEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError("");

    await createZipDownload();
  }

  function canDownloadPhoto(photo: PublicPhoto) {
    return canDownload || (paidGallery && !isVideo(photo) && (fullGalleryPurchased || unlockedPaidPhotoIds.has(photo.id)));
  }

  function toggleCartPhoto(photoId: string) {
    setCartPhotoIds((current) =>
      current.includes(photoId)
        ? current.filter((currentPhotoId) => currentPhotoId !== photoId)
        : [...current, photoId]
    );
  }

  async function downloadSinglePhoto(photo: PublicPhoto) {
    if (downloadingPhotoId || !canDownloadPhoto(photo)) {
      return;
    }

    setDownloadingPhotoId(photo.id);

    try {
      const response = await fetch(photo.imageUrl, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(copy.photoDownloadFailed);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = photoFileName(photo, selectedIndex ?? 0);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setDownloadingPhotoId(null);
    }
  }

  async function toggleFavorite(photoId: string, emailOverride?: string, listIdOverride?: string) {
    if (!favoritesEnabled) {
      return;
    }

    const emailForFavorite = emailOverride ?? favoriteEmail;

    if (!emailForFavorite) {
      setFavoritePromptPhotoId(photoId);
      setFavoriteError("");
      return;
    }

    setPendingFavoriteId(photoId);
    setFavoriteError("");
    setLastFavoritePulseId(photoId);

    window.setTimeout(() => {
      setLastFavoritePulseId((current) => (current === photoId ? null : current));
    }, 260);

    const previousLists = favoriteLists;
    const targetListId = listIdOverride ?? activeFavoriteList?.id;
    const optimisticListId = targetListId ?? "";
    const wasFavorite = favoriteIds.has(photoId);

    if (optimisticListId) {
      setFavoriteLists((current) =>
        current.map((list) => {
          if (list.id !== optimisticListId) {
            return list;
          }

          const photoIds = new Set(list.photoIds);

          if (wasFavorite) {
            photoIds.delete(photoId);
          } else {
            photoIds.add(photoId);
          }

          return { ...list, photoIds: Array.from(photoIds) };
        })
      );
    }

    try {
      const result = await toggleFavoritePhotoAction(galleryId, photoId, emailForFavorite, targetListId);

      if (!result.ok) {
        throw new Error(result.message);
      }

      if (!result.listId) {
        throw new Error(proofingSelection ? copy.selectionNotFound : copy.favoriteListNotFound);
      }

      const resultListId = result.listId;
      const resultListName = result.listName ?? (proofingSelection ? copy.defaultSelectionName : copy.defaultFavoritesName);

      setFavoriteLists((current) =>
        current.some((list) => list.id === resultListId)
          ? current.map((list) => {
              if (list.id !== resultListId) {
                return list;
              }

              const photoIds = new Set(list.photoIds);

              if (result.isFavorite) {
                photoIds.add(photoId);
              } else {
                photoIds.delete(photoId);
              }

              return { ...list, photoIds: Array.from(photoIds) };
            })
          : [
              {
                id: resultListId,
                name: resultListName,
                submittedAt: null,
                photoIds: result.isFavorite ? [photoId] : []
              },
              ...current
            ]
      );
      setActiveFavoriteListId(resultListId);
    } catch (error) {
      setFavoriteLists(previousLists);
      setFavoriteError(error instanceof Error ? error.message : proofingSelection ? copy.saveError : copy.favoriteSaveError);
    } finally {
      setPendingFavoriteId(null);
    }
  }

  async function submitFavoriteEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingFavoriteEmail) {
      return;
    }

    if (!favoritesEnabled) {
      return;
    }

    const normalizedEmail = favoriteEmailDraft.trim().toLowerCase();

    if (!normalizedEmail) {
      setFavoriteError(copy.emailRequired);
      return;
    }

    setIsSubmittingFavoriteEmail(true);
    setFavoriteError("");

    setFavoriteEmail(normalizedEmail);
    window.localStorage.setItem(`wgm-favorite-email-${galleryId}`, normalizedEmail);
    const queuedPhotoId = favoritePromptPhotoId;
    setFavoritePromptPhotoId(null);

    try {
      let listsResult = await getFavoriteListsAction(galleryId, normalizedEmail);

      if (listsResult.ok && listsResult.lists.length === 0) {
        const created = await createFavoriteListAction(galleryId, normalizedEmail, proofingSelection ? copy.defaultSelectionName : copy.defaultFavoritesName);

        if (created.ok && created.list) {
          listsResult = {
            ok: true,
            lists: [created.list]
          };
        }
      }

      if (listsResult.ok) {
        const nextActiveListId = listsResult.lists[0]?.id ?? "";
        setFavoriteLists(listsResult.lists);
        setActiveFavoriteListId(nextActiveListId);

        if (queuedPhotoId) {
          await toggleFavorite(queuedPhotoId, normalizedEmail, nextActiveListId);
          return;
        }
      }

      if (queuedPhotoId) {
        await toggleFavorite(queuedPhotoId, normalizedEmail);
      }
    } finally {
      setIsSubmittingFavoriteEmail(false);
    }
  }

  async function createNewFavoriteList() {
    if (!favoritesEnabled) {
      return;
    }

    const normalizedEmail = favoriteEmail || favoriteEmailDraft.trim().toLowerCase();
    const listName = newFavoriteListName.trim();

    if (!normalizedEmail) {
      setFavoritePromptPhotoId(photos[0]?.id ?? "");
      return;
    }

    if (!listName) {
      setFavoriteError(copy.listNameRequired);
      return;
    }

    setFavoriteError("");
    const result = await createFavoriteListAction(galleryId, normalizedEmail, listName);

    if (!result.ok || !result.list) {
      setFavoriteError(result.message ?? copy.listCreateError);
      return;
    }

    setFavoriteLists((current) => {
      const withoutDuplicate = current.filter((list) => list.id !== result.list?.id);
      return [result.list!, ...withoutDuplicate];
    });
    setActiveFavoriteListId(result.list.id);
    setNewFavoriteListName("");
    setShowFavoritesOnly(false);
  }

  async function submitActiveFavoriteList() {
    if (!favoritesEnabled || !activeFavoriteList || !favoriteEmail || isSubmittingFavoriteList) {
      return;
    }

    setIsSubmittingFavoriteList(true);
    setFavoriteError("");
    setFavoriteSuccess("");

    try {
      const result = await submitFavoriteListAction(galleryId, favoriteEmail, activeFavoriteList.id);

      if (!result.ok || !result.submittedAt) {
        throw new Error(result.message);
      }

      setFavoriteLists((current) =>
        current.map((list) =>
          list.id === activeFavoriteList.id ? { ...list, submittedAt: result.submittedAt } : list
        )
      );
      setFavoriteSuccess(result.message ?? copy.selectionSaved);
      setIsSelectionSummaryOpen(false);
    } catch (error) {
      setFavoriteError(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setIsSubmittingFavoriteList(false);
    }
  }

  function handleSelectionSubmitClick() {
    if (!proofingSelection) {
      void submitActiveFavoriteList();
      return;
    }

    setFavoriteError("");
    setFavoriteSuccess("");
    setIsSelectionSummaryOpen(true);
  }

  function formatSubmittedAt(value: string) {
    return new Intl.DateTimeFormat(dateLocaleForCustomer(language), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: APP_TIME_ZONE
    }).format(new Date(value));
  }

  function favoriteButtonClass(photoId: string) {
    return favoriteIds.has(photoId)
      ? "bg-brass text-white shadow-soft"
      : "bg-white/90 text-ink shadow-sm hover:bg-white";
  }

  function toggleFavoritesFilter() {
    if (!favoritesEnabled || favoriteCount === 0) {
      return;
    }

    startFavoritesFilterTransition(() => {
      setShowFavoritesOnly((current) => !current);
    });
  }

  async function shareGallery() {
    if (!stickyToolbar) {
      return;
    }

    const shareUrl = new URL(stickyToolbar.sharePath, window.location.origin).toString();

    try {
      if (navigator.share) {
        await navigator.share({
          title: stickyToolbar.title,
          text: stickyToolbar.subtitle ?? undefined,
          url: shareUrl
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 1600);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setShareState("failed");
      window.setTimeout(() => setShareState("idle"), 1600);
    }
  }

  function renderPaidDownloadStatus() {
    if (!sale?.purchaseSessionId || sale.purchaseStatus !== "success") {
      return null;
    }

    const state = paidDownloadState;

    if (state?.paid && state.purchaseKind === "photos") {
      const visiblePurchasedDownloads = purchasedPhotoDownloadItems.slice(0, 8);
      const remainingPurchasedDownloads = Math.max(0, purchasedPhotoDownloadItems.length - visiblePurchasedDownloads.length);

      return (
        <div className="mt-4 rounded-md border border-sage/20 bg-sage/10 px-3 py-3 text-sm text-sage">
          <p className="font-medium">{copy.paidPhotosUnlocked}</p>
          {visiblePurchasedDownloads.length > 0 ? (
            <>
              <p className="mt-1 text-xs text-sage/80">{copy.paidPhotosUnlockedHint}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {visiblePurchasedDownloads.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => void downloadSinglePhoto(photo)}
                    disabled={downloadingPhotoId === photo.id}
                    className="inline-flex min-h-10 items-center justify-between gap-3 rounded-md border border-sage/20 bg-white px-3 text-left text-xs font-semibold text-ink transition hover:border-sage/40 hover:bg-paper disabled:opacity-60"
                  >
                    <span className="truncate">{photo.filename}</span>
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <Download size={14} />
                      {downloadingPhotoId === photo.id ? copy.loading : copy.paidPhotoDownloadButton}
                    </span>
                  </button>
                ))}
              </div>
              {remainingPurchasedDownloads > 0 ? (
                <p className="mt-2 text-xs text-sage/80">{copy.paidPhotoDownloadMore(remainingPurchasedDownloads)}</p>
              ) : null}
            </>
          ) : null}
        </div>
      );
    }

    const paidLinks =
      state?.packages?.length
        ? state.packages
        : state?.downloadUrl
          ? [
              {
                id: "paid-download",
                downloadUrl: state.downloadUrl,
                filename: state.filename ?? "gallery.zip",
                partIndex: 0,
                partCount: 1
              }
            ]
          : [];
    const isReady = state?.status === "completed" && paidLinks.length > 0;
    const isFailed = state?.status === "failed";

    return (
      <div
        className={`mt-4 rounded-md border px-3 py-3 text-sm ${
          isFailed
            ? "border-red-200 bg-red-50 text-red-700"
            : isReady
              ? "border-sage/20 bg-sage/10 text-sage"
              : "border-ink/10 bg-paper text-graphite"
        }`}
      >
        <p className="font-medium">
          {isFailed
            ? copy.paidDownloadFailed
            : isReady
              ? copy.paidDownloadReady
              : copy.paidDownloadPreparing}
        </p>
        {isReady ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {paidLinks.map((downloadPackage) => (
              <a
                key={downloadPackage.id}
                href={downloadPackage.downloadUrl}
                download={downloadPackage.filename}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-graphite"
              >
                <Download size={16} />
                {downloadPackage.partCount > 1
                  ? copy.paidDownloadPartButton(downloadPackage.partIndex + 1, downloadPackage.partCount)
                  : copy.paidDownloadButton}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderVideoItem({ photo, index }: PublicPhotoItem) {
    return (
      <div
        key={photo.id}
        className={`group block w-full overflow-hidden bg-mist text-left transition-[box-shadow,transform,opacity] duration-200 ease-out ${
          favoritesEnabled && favoriteIds.has(photo.id)
            ? "ring-2 ring-brass ring-offset-2 ring-offset-paper"
            : "ring-0"
        } ${isFilteringFavorites ? "opacity-80" : "opacity-100"}`}
        style={galleryItemStyle}
      >
        <span className="relative block w-full">
          <button
            type="button"
            title={copy.openPhoto}
            aria-label={`${copy.openPhoto}: ${photo.filename}`}
            onClick={() => setSelectedIndex(index)}
            className="relative z-0 block w-full text-left"
          >
            <PublicVideoPreview photo={photo} />
            <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-md bg-white/90 opacity-0 shadow-sm transition duration-200 group-hover:opacity-100">
              <Maximize2 size={16} />
            </span>
          </button>
          {favoritesEnabled ? (
            <button
              type="button"
              title={proofingSelection ? "Auswählen" : "Favorit"}
              aria-label={`${photo.filename} ${proofingSelection ? "auswählen" : "zu den Favoriten hinzufügen"}`}
              onClick={() => void toggleFavorite(photo.id)}
              className={`absolute left-3 top-3 z-10 flex size-10 items-center justify-center rounded-md transition duration-150 ease-out active:scale-95 ${favoriteButtonClass(photo.id)} ${
                pendingFavoriteId === photo.id ? "opacity-80" : ""
              } ${
                lastFavoritePulseId === photo.id ? "scale-110" : "scale-100"
              }`}
            >
              <Heart
                size={17}
                className="transition-transform duration-150"
                fill={favoriteIds.has(photo.id) ? "currentColor" : "none"}
              />
            </button>
          ) : null}
        </span>
      </div>
    );
  }

  function renderImageItem({ photo, index }: PublicPhotoItem) {
    const isUnlockedPaidPhoto = fullGalleryPurchased || unlockedPaidPhotoIds.has(photo.id);
    const isInCart = cartPhotoIdSet.has(photo.id);

    return (
      <div
        key={photo.id}
        className={`group block w-full overflow-hidden bg-mist text-left transition-[box-shadow,transform,opacity] duration-200 ease-out ${
          favoritesEnabled && favoriteIds.has(photo.id)
            ? "ring-2 ring-brass ring-offset-2 ring-offset-paper"
            : "ring-0"
        } ${isFilteringFavorites ? "opacity-80" : "opacity-100"}`}
        style={galleryItemStyle}
      >
        <span className="relative block w-full">
          <button
            type="button"
            title={copy.openPhoto}
            aria-label={`${copy.openPhoto}: ${photo.filename}`}
            onClick={() => setSelectedIndex(index)}
            className="relative z-0 block w-full text-left"
          >
            {hasImageDimensions(photo) ? (
              <Image
                src={hasLightweightThumbnail(photo) ? photo.thumbnailUrl : photo.imageUrl}
                alt={photo.filename}
                width={photo.imageWidth}
                height={photo.imageHeight}
                unoptimized
                draggable={!paidGallery}
                onDragStart={paidGallery ? (event) => event.preventDefault() : undefined}
                className="block h-auto w-full transition duration-500 ease-out group-hover:scale-[1.025]"
                sizes={imageSizes}
              />
            ) : (
              <img
                src={hasLightweightThumbnail(photo) ? photo.thumbnailUrl : photo.imageUrl}
                alt={photo.filename}
                loading="lazy"
                draggable={!paidGallery}
                onDragStart={paidGallery ? (event) => event.preventDefault() : undefined}
                className="block h-auto w-full transition duration-500 ease-out group-hover:scale-[1.025]"
              />
            )}
            <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-md bg-white/90 opacity-0 shadow-sm transition duration-200 group-hover:opacity-100">
              <Maximize2 size={16} />
            </span>
          </button>
          {favoritesEnabled ? (
            <button
              type="button"
              title={proofingSelection ? "Auswählen" : "Favorit"}
              aria-label={`${photo.filename} ${proofingSelection ? "auswählen" : "zu den Favoriten hinzufügen"}`}
              onClick={() => void toggleFavorite(photo.id)}
              className={`absolute left-3 top-3 z-10 flex size-10 items-center justify-center rounded-md transition duration-150 ease-out active:scale-95 ${favoriteButtonClass(photo.id)} ${
                pendingFavoriteId === photo.id ? "opacity-80" : ""
              } ${
                lastFavoritePulseId === photo.id ? "scale-110" : "scale-100"
              }`}
            >
              <Heart
                size={17}
                className="transition-transform duration-150"
                fill={favoriteIds.has(photo.id) ? "currentColor" : "none"}
              />
            </button>
          ) : null}
          {paidGallery && sale && !fullGalleryPurchased ? (
            isUnlockedPaidPhoto ? (
              <span className="absolute bottom-3 right-3 z-10 inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-sage px-3 text-xs font-semibold text-white shadow-soft">
                <Check size={15} />
                {copy.purchased}
              </span>
            ) : (
              <button
                type="button"
                title={isInCart ? copy.removeFromCart : copy.addToCart}
                aria-label={`${photo.filename}: ${isInCart ? copy.removeFromCart : copy.addToCart}`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleCartPhoto(photo.id);
                }}
                className={`absolute inset-x-3 bottom-3 z-10 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold shadow-[0_18px_36px_rgba(0,0,0,0.35)] ring-2 transition duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98] ${
                  isInCart
                    ? "bg-brass text-white ring-white/75 hover:bg-brass/90"
                    : "bg-white text-ink ring-white/80 hover:bg-ink hover:text-white"
                }`}
              >
                <ShoppingCart size={15} />
                {isInCart ? copy.inCart : copy.addToCart}
              </button>
            )
          ) : null}
        </span>
      </div>
    );
  }

  return (
    <div className="public-gallery-text-theme" style={galleryThemeStyle}>
      <style>{`
        .public-gallery-text-theme {
          font-family: var(--gallery-body-font-family);
        }
        .public-gallery-text-theme :where(.font-playfair) {
          font-family: var(--gallery-body-font-family);
        }
        .public-gallery-text-theme :where(.text-ink, .text-graphite, .text-graphite\\/75, .text-graphite\\/70, .text-graphite\\/65, .text-graphite\\/60, .text-graphite\\/55, .text-graphite\\/50) {
          color: var(--gallery-body-text-color);
        }
      `}</style>
      <section
        className="space-y-10"
        onContextMenu={paidGallery ? (event) => event.preventDefault() : undefined}
      >
        {stickyToolbar ? (
          <div className="sticky top-0 z-30 isolate py-2 sm:py-2.5">
            <div className="pointer-events-none absolute left-1/2 top-0 z-0 h-full w-screen -translate-x-1/2 border-b border-ink/10 bg-paper/95 shadow-[0_14px_30px_rgba(17,17,17,0.06)] backdrop-blur" />
            <div className="relative z-10 grid w-full gap-2 lg:grid-cols-[minmax(150px,0.8fr)_minmax(0,1.4fr)_auto] lg:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-ink sm:text-base">{stickyToolbar.title}</p>
                {stickyToolbar.subtitle ? (
                  <p className="mt-0.5 truncate text-[11px] leading-tight text-graphite/65 sm:text-xs">{stickyToolbar.subtitle}</p>
                ) : null}
              </div>
              {stickyAnchorLinks.length > 0 ? (
                <nav
                  className="order-3 -mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 [scrollbar-width:none] lg:order-2 lg:mx-0 lg:justify-center lg:px-0 [&::-webkit-scrollbar]:hidden"
                  aria-label={language === "hu" ? "Galéria szekciók" : "Galerie Abschnitte"}
                >
                  {stickyAnchorLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-ink/10 bg-white px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-paper sm:min-h-9 sm:text-sm"
                    >
                      <span className="max-w-[9rem] truncate">{link.label}</span>
                      <span className="text-[11px] text-graphite/60">{link.count}</span>
                    </a>
                  ))}
                </nav>
              ) : null}
              <div className="order-2 flex shrink-0 items-center justify-end gap-1 sm:gap-1.5 lg:order-3">
                {hasPaidCartBar ? (
                  <a
                    href="#paid-gallery-checkout"
                    title={copy.photoCartTitle}
                    aria-label={copy.photoCartTitle}
                    className={`group/toolbar relative inline-flex size-9 items-center justify-center rounded-md border text-sm transition sm:size-10 ${
                      cartPhotoIds.length > 0
                        ? "border-ink bg-ink text-white hover:bg-graphite"
                        : "border-ink/10 bg-white text-graphite hover:border-ink/25 hover:text-ink"
                    }`}
                  >
                    <ShoppingCart size={17} />
                    <span className="pointer-events-none absolute right-0 top-[calc(100%+8px)] hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-soft transition group-hover/toolbar:opacity-100 group-focus-visible/toolbar:opacity-100 sm:block">
                      {cartPhotoIds.length > 0 ? copy.selectedPhotos(cartPhotoIds.length) : copy.photoCartTitle}
                    </span>
                    {cartPhotoIds.length > 0 ? (
                      <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-brass px-1 text-[10px] font-semibold leading-5 text-white">
                        {cartPhotoIds.length}
                      </span>
                    ) : null}
                  </a>
                ) : null}
                {favoritesEnabled ? (
                  <button
                    type="button"
                    title={proofingSelection ? copy.selection : copy.favorites}
                    aria-label={proofingSelection ? copy.selection : copy.favorites}
                    onClick={toggleFavoritesFilter}
                    disabled={favoriteCount === 0}
                    className={`group/toolbar relative inline-flex size-9 items-center justify-center rounded-md transition sm:size-10 ${
                      showFavoritesOnly ? "bg-ink text-white" : "bg-white text-graphite hover:bg-ink/5 hover:text-ink"
                    } disabled:cursor-not-allowed disabled:opacity-50 ${isFilteringFavorites ? "opacity-70" : ""}`}
                  >
                    <Heart size={17} fill={showFavoritesOnly ? "currentColor" : "none"} />
                    <span className="pointer-events-none absolute right-0 top-[calc(100%+8px)] hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-soft transition group-hover/toolbar:opacity-100 group-focus-visible/toolbar:opacity-100 sm:block">
                      {proofingSelection ? copy.selection : copy.favorites}
                    </span>
                    {favoriteCount > 0 ? (
                      <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-brass px-1 text-[10px] font-semibold leading-5 text-white">
                        {favoriteCount}
                      </span>
                    ) : null}
                  </button>
                ) : null}
                {canDownload ? (
                  <button
                    type="button"
                    title={copy.download}
                    aria-label={copy.download}
                    onClick={() => setIsEmailOpen(true)}
                    disabled={isZipping || photos.length === 0}
                    className="group/toolbar relative inline-flex size-9 items-center justify-center rounded-md bg-ink text-white transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-60 sm:size-10"
                  >
                    <Download size={17} />
                    <span className="pointer-events-none absolute right-0 top-[calc(100%+8px)] hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-soft transition group-hover/toolbar:opacity-100 group-focus-visible/toolbar:opacity-100 sm:block">
                      {copy.download}
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  title={shareState === "copied" ? copy.shareCopied : shareState === "failed" ? copy.shareFailed : copy.share}
                  aria-label={shareState === "copied" ? copy.shareCopied : copy.share}
                  onClick={() => void shareGallery()}
                  className={`group/toolbar relative inline-flex h-9 min-w-9 items-center justify-center gap-2 rounded-md border px-0 transition sm:h-10 sm:min-w-10 ${
                    shareState === "copied"
                      ? "border-sage/25 bg-sage/10 text-sage"
                      : shareState === "failed"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-ink/10 bg-white text-graphite hover:border-ink/25 hover:text-ink"
                  }`}
                >
                  <Share2 size={17} />
                  <span className="pointer-events-none absolute right-0 top-[calc(100%+8px)] hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-soft transition group-hover/toolbar:opacity-100 group-focus-visible/toolbar:opacity-100 sm:block">
                    {shareState === "copied" ? copy.shareCopied : shareState === "failed" ? copy.shareFailed : copy.share}
                  </span>
                  {shareState !== "idle" ? (
                    <span className="hidden max-w-28 truncate pr-2 text-xs font-semibold sm:inline">
                      {shareState === "copied" ? copy.shareCopied : copy.shareFailed}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>
            {shareState !== "idle" ? (
              <div className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-20 sm:hidden">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold shadow-soft ${
                    shareState === "copied" ? "bg-sage text-white" : "bg-red-700 text-white"
                  }`}
                >
                  {shareState === "copied" ? copy.shareCopied : copy.shareFailed}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {favoritesEnabled && favoriteEmail ? (
          <div className="col-span-full mb-4 rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-graphite">{proofingSelection ? copy.selection : copy.favoritesList}</span>
                <select
                  value={activeFavoriteList?.id ?? ""}
                  onChange={(event) => {
                    setActiveFavoriteListId(event.target.value);
                    setShowFavoritesOnly(false);
                    setFavoriteSuccess("");
                    setFavoriteError("");
                  }}
                  className="h-10 min-w-0 rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50 sm:min-w-52"
                >
                  {favoriteLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.photoIds.length})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
                {proofingSelection ? null : (
                  <>
                    <input
                      value={newFavoriteListName}
                      onChange={(event) => setNewFavoriteListName(event.target.value)}
                      placeholder={copy.newListPlaceholder}
                      className="h-10 min-w-0 rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50 sm:w-64"
                    />
                    <Button type="button" variant="secondary" onClick={() => void createNewFavoriteList()}>
                      {copy.createList}
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-ink/10 pt-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-ink">
                  {activeFavoriteList
                    ? `${activeFavoriteList.name}: ${favoriteCount} ${proofingSelection ? copy.selected : copy.favorites}`
                    : proofingSelection
                      ? copy.noActiveSelection
                      : copy.noActiveList}
                </p>
                <p className="mt-1 text-sm text-graphite/70">
                  {activeFavoriteList?.submittedAt
                    ? `${proofingSelection ? copy.sent : copy.completed}: ${formatSubmittedAt(activeFavoriteList.submittedAt)}`
                    : proofingSelection
                      ? copy.selectionReady
                      : copy.listReady}
                </p>
              </div>
              <Button
                type="button"
                onClick={handleSelectionSubmitClick}
                disabled={!activeFavoriteList || favoriteCount === 0 || isSubmittingFavoriteList}
                className="lg:shrink-0"
              >
                <Heart size={16} />
                {isSubmittingFavoriteList
                  ? copy.saving
                  : activeFavoriteList?.submittedAt
                    ? copy.updateSelection
                    : proofingSelection
                      ? copy.sendSelection
                      : copy.finishSelection}
              </Button>
            </div>
            {favoriteSuccess ? (
              <p className="mt-2 rounded-md border border-sage/20 bg-sage/10 px-3 py-2 text-sm text-sage">
                {favoriteSuccess}
              </p>
            ) : null}
            {favoriteError ? <p className="mt-2 text-sm text-red-700">{favoriteError}</p> : null}
          </div>
        ) : null}

        {paidGallery && sale ? (
          <section id="paid-gallery-checkout" className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft md:p-6">
            <div className="flex flex-col gap-4 border-b border-ink/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-ink text-white">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-ink">{copy.paidTitle}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite/75">
                    {sale.priceCents <= 0 ? copy.paidNoCostIntro : copy.paidIntro}
                  </p>
                </div>
              </div>
              <div className="flex w-fit items-center gap-2 rounded-full bg-brass/10 px-3 py-1 text-sm font-semibold text-brass">
                <ShieldCheck size={15} />
                {sale.priceLabel}
              </div>
            </div>

            {purchaseNotice ? (
              <p
                className={`mt-4 rounded-md border px-3 py-2 text-sm ${
                  purchaseNotice.tone === "success"
                    ? "border-sage/20 bg-sage/10 text-sage"
                    : purchaseNotice.tone === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-ink/10 bg-paper text-graphite"
                }`}
              >
                {purchaseNotice.text}
              </p>
            ) : null}
            {renderPaidDownloadStatus()}

            <form action={createPaidGalleryCheckoutAction} className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
              <input type="hidden" name="galleryId" value={galleryId} />
              <input type="hidden" name="gallerySlug" value={gallerySlug} />
              <input type="hidden" name="photoIds" value={cartPhotoIds.join(",")} />

              <div className="space-y-4">
                {!fullGalleryPurchased ? (
                  <div
                    className={`rounded-lg border p-4 transition md:p-5 ${
                      cartPhotoIds.length > 0
                        ? "border-brass/35 bg-brass/[0.06] shadow-soft"
                        : "border-ink/10 bg-paper"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brass shadow-sm">
                          <ShoppingCart size={14} />
                          {copy.photoCartTitle}
                        </div>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite/70">{copy.photoCartIntro}</p>
                      </div>
                      <p className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-graphite shadow-sm">
                        {cartPhotoIds.length > 0 ? copy.selectedPhotos(cartPhotoIds.length) : copy.cartEmpty}
                      </p>
                    </div>
                    <div className="mt-5 grid gap-3 rounded-md bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <div>
                        <p className="text-sm font-semibold text-ink">{copy.selectedCheckoutHint}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-graphite/50">{copy.cartTotal}</p>
                      </div>
                      <p className="text-3xl font-semibold text-ink sm:text-right">{cartTotalLabel}</p>
                    </div>
                    {cartPhotoIds.length === 0 ? (
                      <p className="mt-3 text-xs leading-5 text-graphite/60">{copy.cartActionRequired}</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-lg border border-ink/10 bg-paper p-4 md:p-5">
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div>
                      <p className="font-semibold text-ink">{copy.wholeGalleryCheckoutHint}</p>
                      <p className="mt-2 text-sm leading-6 text-graphite/70">{copy.wholeGalleryIncluded}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      <ShieldCheck size={18} className="shrink-0 text-brass" />
                      <p className="text-3xl font-semibold text-ink">{sale.priceLabel}</p>
                    </div>
                  </div>
                </div>

                {showBaseUnitPrice || sale.pricingTiers.length > 0 ? (
                  <div className="rounded-lg border border-ink/10 bg-white p-4">
                    <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                      {showBaseUnitPrice ? (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-graphite/55">{copy.baseUnitPrice}</p>
                          <p className="mt-1 text-lg font-semibold text-ink">{unitPriceLabel}</p>
                        </div>
                      ) : null}
                      {sale.pricingTiers.length > 0 ? (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-graphite/55">{copy.priceTiers}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium text-graphite">
                            {sale.pricingTiers.map((tier) => (
                              <span key={`${tier.from}-${tier.to ?? "plus"}-${tier.unitPriceCents}`} className="rounded-full bg-white px-2 py-1">
                                {pricingTierLabel(tier, sale.currency, locale, language === "hu" ? "kép" : "Foto")}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <p className="text-xs leading-5 text-graphite/60">{copy.paidSecure}</p>
              </div>

              <div className="rounded-lg border border-ink/10 bg-paper p-4 shadow-soft lg:sticky lg:top-24">
                <div className="mb-4 space-y-3 border-b border-ink/10 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink">{copy.checkoutSummary}</p>
                    <CreditCard size={18} className="text-brass" />
                  </div>
                  <div className="grid gap-2 text-sm">
                    {!fullGalleryPurchased ? (
                      <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                        <span className="text-graphite/70">{copy.selectedPhotosLabel}</span>
                        <span className="font-semibold text-ink">{copy.selectedPhotos(cartPhotoIds.length)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                      <span className="text-graphite/70">{copy.wholeGalleryTitle}</span>
                      <span className="font-semibold text-ink">{sale.priceLabel}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="font-semibold text-ink">{copy.buyerDetails}</p>
                  <ShieldCheck size={18} className="text-brass" />
                </div>
                <div className="space-y-3">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-graphite">{copy.paidName}</span>
                    <input
                      name="name"
                      autoComplete="name"
                      className="h-11 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm outline-none transition focus:border-ink/50"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-graphite">{copy.paidEmail}</span>
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      className="h-11 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm outline-none transition focus:border-ink/50"
                    />
                  </label>
                  <div className="space-y-3 pt-2">
                    {!fullGalleryPurchased ? (
                      <div className="rounded-md border border-ink/10 bg-white p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-ink">{copy.photoCartTitle}</p>
                          <p className="text-sm font-semibold text-brass">{cartTotalLabel}</p>
                        </div>
                        <FormSubmitButton
                          name="purchaseKind"
                          value="photos"
                          pendingLabel={copy.sending}
                          disabled={cartPhotoIds.length === 0}
                          className="h-12 w-full disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <ShoppingCart size={16} />
                          {cartTotalCents <= 0 ? copy.paidNoCostButton : copy.cartCheckout}
                        </FormSubmitButton>
                        {cartPhotoIds.length === 0 ? (
                          <p className="mt-2 text-xs leading-5 text-graphite/60">{copy.cartActionRequired}</p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="rounded-md border border-ink/10 bg-white p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-ink">{copy.wholeGalleryTitle}</p>
                        <p className="text-sm font-semibold text-brass">{sale.priceLabel}</p>
                      </div>
                      <FormSubmitButton name="purchaseKind" value="gallery" pendingLabel={copy.sending} className="h-12 w-full">
                        <CreditCard size={16} />
                        {sale.priceCents <= 0 ? copy.paidNoCostButton : copy.buyWholeGallery}
                      </FormSubmitButton>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </section>
        ) : null}

        {visibleVideoItems.length > 0 ? (
          <section id="public-gallery-videos" className="scroll-mt-32 space-y-4" aria-labelledby="public-gallery-videos-title">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-graphite/55">{copy.videoCount(visibleVideoItems.length)}</p>
              <h2 id="public-gallery-videos-title" className="font-playfair mt-1 text-3xl font-semibold text-ink md:text-4xl">
                {copy.videoSectionTitle}
              </h2>
            </div>
            <div className="grid" style={galleryGridStyle}>
              {visibleVideoItems.map((item) => renderVideoItem(item))}
            </div>
          </section>
        ) : null}

        {sectionBlocks.length > 0 ? (
          <div className="space-y-16">
            {sectionBlocks.map((block) => (
              <section key={block.key} id={block.anchorId} className="scroll-mt-32 space-y-5" aria-labelledby={`${block.anchorId}-title`}>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-graphite/55">
                    {block.count} {language === "hu" ? "média" : "Medien"}
                  </p>
                  <h2 id={`${block.anchorId}-title`} className="font-playfair mt-1 text-3xl font-semibold text-ink md:text-4xl">
                    {block.title}
                  </h2>
                </div>
                {block.imageColumns.some((column) => column.length > 0) ? (
                  <div className="grid" style={galleryGridStyle}>
                    {block.imageColumns.map((column, columnIndex) => (
                      <div key={columnIndex} className="grid content-start" style={galleryColumnStyle}>
                        {column.map((item) => renderImageItem(item))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        ) : null}

        {sectionBlocks.length === 0 && visibleImageItems.length > 0 ? (
          <section className="grid" style={galleryGridStyle}>
            {photoColumns.map((column, columnIndex) => (
              <div key={columnIndex} className="grid content-start" style={galleryColumnStyle}>
                {column.map((item) => renderImageItem(item))}
              </div>
            ))}
          </section>
        ) : null}
      </section>

      {!stickyToolbar && (favoritesEnabled || canDownload || hasPaidCartBar) ? (
        <div className="fixed bottom-3 left-1/2 z-20 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border border-ink/10 bg-white/90 px-3 py-2 shadow-soft backdrop-blur sm:bottom-5 sm:flex-nowrap sm:gap-3 sm:py-3">
          <span className="hidden items-center gap-2 px-2 text-sm text-graphite sm:flex">
            <Images size={16} />
            {showFavoritesOnly ? `${visiblePhotos.length}/${photos.length} Medien` : `${photos.length} Medien`}
          </span>
          {favoritesEnabled ? (
            <button
              type="button"
              onClick={toggleFavoritesFilter}
              disabled={favoriteCount === 0}
              className={`flex h-10 items-center gap-2 rounded-md px-2 text-sm transition ${
                showFavoritesOnly ? "bg-ink text-white" : "text-graphite hover:bg-ink/5"
              } disabled:cursor-not-allowed disabled:opacity-50 ${isFilteringFavorites ? "opacity-70" : ""}`}
            >
              <Heart size={16} />
              {favoriteCount} {proofingSelection ? copy.selected : copy.favorites}
            </button>
          ) : null}
          {canDownload ? (
            <Button type="button" onClick={() => setIsEmailOpen(true)} disabled={isZipping || photos.length === 0}>
              <Download size={16} />
              {isZipping ? copy.zipPreparing : copy.zipEmail}
            </Button>
          ) : null}
          {hasPaidCartBar ? (
            <a
              href="#paid-gallery-checkout"
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                cartPhotoIds.length > 0
                  ? "bg-ink text-white hover:bg-graphite"
                  : "border border-ink/10 bg-white text-graphite hover:border-ink/25 hover:text-ink"
              }`}
            >
              <ShoppingCart size={16} />
              {cartPhotoIds.length > 0
                ? `${copy.selectedPhotos(cartPhotoIds.length)} · ${cartTotalLabel}`
                : copy.photoCartTitle}
            </a>
          ) : null}
        </div>
      ) : null}

      {isEmailOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-hidden bg-ink/60 px-4 py-5 backdrop-blur-sm">
          <form onSubmit={submitDownloadEmail} className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-soft sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex size-11 items-center justify-center rounded-md bg-paper text-graphite">
                  <Mail size={20} />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-ink">{copy.downloadAlbum}</h2>
                <p className="mt-2 text-sm text-graphite/70">
                  {copy.downloadIntro}
                </p>
              </div>
              <button
                type="button"
                title={copy.close}
                onClick={closeDownloadDialog}
                className="flex size-9 items-center justify-center rounded-md text-graphite hover:bg-ink/5"
              >
                <X size={18} />
              </button>
            </div>

            {zipDownloadLinks.length > 0 ? (
              <div className="mt-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                <p className="font-semibold">{copy.directZipReady}</p>
                <p className="mt-1 text-green-900/75">{copy.directZipIntro} {copy.zipSpamInfo}</p>
                <div className="mt-3 grid gap-2">
                  {zipDownloadLinks.map((downloadLink) => (
                    <a
                      key={downloadLink.id}
                      href={downloadLink.downloadUrl}
                      download={downloadLink.filename}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-green-700/20 bg-white px-4 py-2 font-semibold text-green-950 transition hover:border-green-700/40 hover:bg-green-100"
                    >
                      <Download size={16} />
                      {downloadLink.partCount > 1
                        ? copy.directZipPartDownload(downloadLink.partIndex + 1, downloadLink.partCount)
                        : copy.directZipDownload}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {zipDownloadLinks.length === 0 ? (
              <>
                <label className="mt-5 block space-y-2">
                  <span className="text-sm font-medium text-graphite">{copy.email}</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    required
                    placeholder="email@example.com"
                    className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
                  />
                </label>

                <div className="mt-4 rounded-md border border-ink/10 bg-paper px-4 py-3 text-sm leading-6 text-graphite/75">
                  <p>{copy.zipTimeInfo} {copy.zipSpamInfo}</p>
                </div>
              </>
            ) : null}

            {emailError ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {emailError}
              </div>
            ) : null}

            {zipProgress && zipDownloadLinks.length === 0 ? (
              <div className="mt-4 rounded-md border border-ink/10 bg-paper px-4 py-3 text-sm text-graphite">
                <div className="flex items-center justify-between gap-3">
                  <span>{zipProgress}</span>
                  {zipPackageStatus ? (
                    <span className="rounded-full bg-white px-2 py-1 text-xs uppercase tracking-[0.12em] text-graphite/60">
                      {zipPackageStatus}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {zipDownloadLinks.length === 0 ? (
                <FormSubmitButton
                  type="submit"
                  disabled={isZipping}
                  className="sm:flex-1"
                  busy={isZipping}
                  pendingLabel={copy.zipLinksPreparing}
                >
                  <Download size={16} />
                  {copy.requestDownloadLinks}
                </FormSubmitButton>
              ) : null}
              <Button type="button" variant="secondary" onClick={closeDownloadDialog}>
                {zipDownloadLinks.length > 0 ? copy.close : copy.cancel}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {proofingSelection && isSelectionSummaryOpen && activeFavoriteList ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/60 px-5 backdrop-blur-sm">
          <section className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
            <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-5">
              <div>
                <div className="flex size-11 items-center justify-center rounded-md bg-paper text-graphite">
                  <Heart size={20} />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-ink">{copy.reviewSelection}</h2>
                <p className="mt-2 text-sm leading-6 text-graphite/70">
                  {copy.reviewSelectionText(favoriteCount)}
                </p>
              </div>
              <button
                type="button"
                title={copy.close}
                onClick={() => setIsSelectionSummaryOpen(false)}
                className="flex size-9 items-center justify-center rounded-md text-graphite hover:bg-ink/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-auto px-5 py-4">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {selectedFavoritePhotos.slice(0, 18).map((photo) => (
                  <div key={photo.id} className="overflow-hidden rounded-md border border-ink/10 bg-paper">
                    <div className="relative aspect-square bg-mist">
                      {isVideo(photo) ? (
                        <video
                          src={photo.imageUrl}
                          poster={videoPosterUrl(photo)}
                          preload="metadata"
                          muted
                          playsInline
                          onLoadedMetadata={(event) => primeVideoCoverFrame(event.currentTarget, Boolean(videoPosterUrl(photo)))}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Image
                          src={hasLightweightThumbnail(photo) ? photo.thumbnailUrl : photo.imageUrl}
                          alt={photo.filename}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="120px"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {selectedFavoritePhotos.length > 18 ? (
                <p className="mt-3 text-sm text-graphite/70">
                  {copy.moreSelected(selectedFavoritePhotos.length - 18)}
                </p>
              ) : null}

              <div className="mt-4 rounded-md bg-paper p-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/60">{copy.filenames}</p>
                <div className="mt-2 max-h-44 overflow-auto rounded-md bg-white px-3 py-2">
                  <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-5 text-graphite">
                    {selectedFavoritePhotos.map((photo) => photo.filename).join("\n")}
                  </pre>
                </div>
              </div>

              {favoriteError ? (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {favoriteError}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-ink/10 p-5 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setIsSelectionSummaryOpen(false)}>
                {copy.backToSelection}
              </Button>
              <Button type="button" onClick={() => void submitActiveFavoriteList()} disabled={isSubmittingFavoriteList}>
                <Heart size={16} />
                {isSubmittingFavoriteList ? copy.sending : copy.sendSelection}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {favoritesEnabled && favoritePromptPhotoId ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/60 px-5 backdrop-blur-sm">
          <form onSubmit={submitFavoriteEmail} className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex size-11 items-center justify-center rounded-md bg-paper text-graphite">
                  <Heart size={20} />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-ink">
                  {proofingSelection ? copy.saveSelection : copy.saveFavorites}
                </h2>
                <p className="mt-2 text-sm text-graphite/70">
                  {proofingSelection
                    ? copy.saveSelectionIntro
                    : copy.saveFavoritesIntro}
                </p>
              </div>
              <button
                type="button"
                title={copy.close}
                onClick={() => setFavoritePromptPhotoId(null)}
                className="flex size-9 items-center justify-center rounded-md text-graphite hover:bg-ink/5"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-medium text-graphite">{copy.email}</span>
              <input
                value={favoriteEmailDraft}
                onChange={(event) => setFavoriteEmailDraft(event.target.value)}
                type="email"
                required
                placeholder="email@example.com"
                className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
              />
            </label>

            {favoriteError ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {favoriteError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <FormSubmitButton
                type="submit"
                className="sm:flex-1"
                busy={isSubmittingFavoriteEmail}
                pendingLabel={copy.saving}
                disabled={isSubmittingFavoriteEmail}
              >
                <Heart size={16} />
                {proofingSelection ? copy.saveSelectionButton : copy.saveFavoriteButton}
              </FormSubmitButton>
              <Button type="button" variant="secondary" onClick={() => setFavoritePromptPhotoId(null)}>
                {copy.cancel}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {selectedPhoto ? (
        <div
          className="fixed inset-0 z-50 animate-[galleryFadeIn_160ms_ease-out] bg-ink/95 p-4 text-white"
          onContextMenu={paidGallery ? (event) => event.preventDefault() : undefined}
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="truncate text-sm text-white/80">{selectedPhoto.filename}</p>
            <div className="flex items-center gap-2">
              {favoritesEnabled ? (
                <button
                  title={proofingSelection ? copy.choose : copy.favorite}
                  aria-label={`${selectedPhoto.filename} ${proofingSelection ? copy.chooseAria : copy.favoriteAria}`}
                  onClick={() => void toggleFavorite(selectedPhoto.id)}
                  className={`flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition duration-150 active:scale-95 ${favoriteIds.has(selectedPhoto.id) ? "bg-brass text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
                >
                  <Heart size={16} fill={favoriteIds.has(selectedPhoto.id) ? "currentColor" : "none"} />
                  {proofingSelection ? copy.choose : copy.favorite}
                </button>
              ) : null}
              {canDownloadPhoto(selectedPhoto) ? (
                <button
                  type="button"
                  onClick={() => void downloadSinglePhoto(selectedPhoto)}
                  disabled={downloadingPhotoId === selectedPhoto.id}
                  className="flex h-10 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-ink disabled:opacity-60"
                >
                  <Download size={16} />
                  {downloadingPhotoId === selectedPhoto.id ? copy.loading : copy.download}
                </button>
              ) : null}
              <button
                title={copy.close}
                onClick={() => setSelectedIndex(null)}
                className="flex size-10 items-center justify-center rounded-md bg-white/10 hover:bg-white/20"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {visiblePhotos.length > 1 ? (
            <>
              <button
                type="button"
                title={copy.previousPhoto}
                onClick={showPreviousPhoto}
                className="absolute left-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-md bg-white/15 text-white backdrop-blur transition hover:bg-white/25 md:left-4 md:size-12"
              >
                <ChevronLeft size={26} />
              </button>
              <button
                type="button"
                title={copy.nextPhoto}
                onClick={showNextPhoto}
                className="absolute right-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-md bg-white/15 text-white backdrop-blur transition hover:bg-white/25 md:right-4 md:size-12"
              >
                <ChevronRight size={26} />
              </button>
            </>
          ) : null}

          <div className="relative h-[calc(100vh-6rem)] w-full">
            {isVideo(selectedPhoto) ? (
              <video
                src={selectedPhoto.imageUrl}
                poster={videoPosterUrl(selectedPhoto)}
                controls
                controlsList={paidGallery ? "nodownload noplaybackrate" : undefined}
                autoPlay
                playsInline
                draggable={!paidGallery}
                onDragStart={paidGallery ? (event) => event.preventDefault() : undefined}
                className="h-full w-full object-contain"
              />
            ) : (
              <>
                <Image
                  src={hasLightweightPreview(selectedPhoto) ? selectedPhoto.previewUrl : selectedPhoto.imageUrl}
                  alt={selectedPhoto.filename}
                  fill
                  unoptimized
                  draggable={!paidGallery}
                  onDragStart={paidGallery ? (event) => event.preventDefault() : undefined}
                  className="object-contain"
                  sizes="100vw"
                  priority
                />
              </>
            )}
          </div>
          {visiblePhotos.length > 1 ? <p className="mt-3 text-center text-sm text-white/70">{selectedPosition}/{visiblePhotos.length}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
