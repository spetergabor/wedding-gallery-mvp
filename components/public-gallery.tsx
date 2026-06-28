"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Download, Heart, Images, Mail, Maximize2, Play, X } from "lucide-react";
import { Button } from "@/components/button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { APP_TIME_ZONE } from "@/lib/date-format";
import {
  createFavoriteListAction,
  getFavoriteListsAction,
  getGalleryDownloadPackageAction,
  requestGalleryDownloadPackageAction,
  submitFavoriteListAction,
  toggleFavoritePhotoAction
} from "@/lib/public-actions";
import { dateLocaleForCustomer, type CustomerLanguage } from "@/lib/customer-language";
import { DEFAULT_GALLERY_DOWNLOAD_QUALITY, type GalleryDownloadQuality } from "@/lib/download-quality";

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
    downloadIntro: "Gib deine E-Mail-Adresse ein. Bei großen Galerien senden wir dir eine E-Mail mit allen ZIP-Teilen.",
    downloadQuality: "Download-Größe",
    webQuality: "Webgröße",
    webQualityDescription: "Kompakte JPGs bis 2400 px. Schnell, praktisch zum Teilen und meist deutlich kleiner.",
    originalQuality: "Volle Auflösung",
    originalQualityDescription: "Originaldateien in voller Qualität. Ideal zum Archivieren und Drucken.",
    close: "Schließen",
    email: "E-Mail-Adresse",
    zipPartsInfo: "Große Galerien können aus mehreren ZIP-Teilen bestehen. Du erhältst trotzdem nur eine E-Mail mit allen Download-Links.",
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
    openPhoto: "Foto öffnen"
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
    downloadIntro: "Add meg az e-mail címed. Nagy galériáknál egy e-mailben küldjük el az összes ZIP-rész linkjét.",
    downloadQuality: "Letöltési méret",
    webQuality: "Webes méret",
    webQualityDescription: "Kompakt JPG-ek max. 2400 px méretben. Gyors, megosztáshoz praktikus, sokkal kisebb.",
    originalQuality: "Teljes felbontás",
    originalQualityDescription: "Eredeti fájlok teljes minőségben. Archiváláshoz és nyomtatáshoz ideális.",
    close: "Bezárás",
    email: "E-mail cím",
    zipPartsInfo: "A nagy galériák több ZIP-részből is állhatnak. Ettől függetlenül csak egy e-mailt kapsz az összes letöltési linkkel.",
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
    openPhoto: "Fotó megnyitása"
  }
} as const;

type PublicPhoto = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  mediaType: string;
  processingStatus: string;
  imageWidth: number;
  imageHeight: number;
};

type FavoriteListState = {
  id: string;
  name: string;
  submittedAt: string | null;
  photoIds: string[];
};

type DownloadPackageStatus = "pending" | "processing" | "completed" | "failed";

function photoFileName(photo: PublicPhoto, index: number) {
  const fallback = `photo-${String(index + 1).padStart(3, "0")}.jpg`;
  return (photo.filename || fallback).replace(/[\\/:*?"<>|]/g, "-");
}

function hasImageDimensions(photo: PublicPhoto) {
  return photo.mediaType !== "video" && photo.imageWidth > 0 && photo.imageHeight > 0;
}

function isVideo(photo: PublicPhoto) {
  return photo.mediaType === "video";
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

export function PublicGallery({
  galleryId,
  title,
  photos,
  downloadsEnabled,
  favoritesEnabled = true,
  favoriteMode = "favorites",
  language = "de"
}: {
  galleryId: string;
  title: string;
  photos: PublicPhoto[];
  downloadsEnabled: boolean;
  favoritesEnabled?: boolean;
  favoriteMode?: "favorites" | "proofing";
  language?: CustomerLanguage;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [downloadQuality, setDownloadQuality] = useState<GalleryDownloadQuality>(DEFAULT_GALLERY_DOWNLOAD_QUALITY);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [zipProgress, setZipProgress] = useState("");
  const [zipPackageId, setZipPackageId] = useState<string | null>(null);
  const [zipPackageStatus, setZipPackageStatus] = useState<DownloadPackageStatus | null>(null);
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
  const [isSelectionSummaryOpen, setIsSelectionSummaryOpen] = useState(false);
  const [isFilteringFavorites, startFavoritesFilterTransition] = useTransition();
  const copy = GALLERY_COPY[language];
  const proofingSelection = favoritesEnabled && favoriteMode === "proofing";
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

  const selectedPosition = selectedIndex === null ? 0 : selectedIndex + 1;
  const favoriteCount = favoriteIds.size;
  const photoColumns = useMemo(() => {
    const safeColumnCount = Math.max(1, columnCount);
    const columns = Array.from({ length: safeColumnCount }, () => [] as Array<{ photo: PublicPhoto; index: number }>);
    const columnHeights = Array.from({ length: safeColumnCount }, () => 0);

    visiblePhotos.forEach((photo, index) => {
      const shortestColumnIndex = columnHeights.reduce((shortestIndex, height, currentIndex) => {
        return height < columnHeights[shortestIndex] ? currentIndex : shortestIndex;
      }, 0);
      const estimatedRatio = isVideo(photo) ? 9 / 16 : hasImageDimensions(photo) ? photo.imageHeight / photo.imageWidth : 1;

      columns[shortestColumnIndex].push({ photo, index });
      columnHeights[shortestColumnIndex] += estimatedRatio;
    });

    return columns;
  }, [columnCount, visiblePhotos]);

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
    if (selectedIndex !== null && selectedIndex >= visiblePhotos.length) {
      setSelectedIndex(visiblePhotos.length > 0 ? visiblePhotos.length - 1 : null);
    }
  }, [selectedIndex, visiblePhotos.length]);

  useEffect(() => {
    function updateColumnCount() {
      setColumnCount(getColumnCount(window.innerWidth));
    }

    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);

    return () => window.removeEventListener("resize", updateColumnCount);
  }, []);

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
        setIsZipping(false);
        setZipProgress("");
        return;
      }

      setZipPackageStatus(result.status as DownloadPackageStatus);

      if (result.status === "completed") {
        setZipProgress(result.message || copy.downloadLinksSent);
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
    if (isZipping || !downloadsEnabled) {
      return;
    }

    setIsZipping(true);
    setEmailError("");
    setZipPackageId(null);
    setZipPackageStatus(null);
    setZipProgress(copy.downloadPreparing);

    try {
      const result = await requestGalleryDownloadPackageAction(galleryId, email, downloadQuality);

      if (!result.ok) {
        throw new Error(result.message);
      }

      if (result.status === "completed") {
        setZipProgress(result.message || copy.downloadLinksSent);
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

  async function downloadSinglePhoto(photo: PublicPhoto) {
    if (downloadingPhotoId || !downloadsEnabled) {
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

  return (
    <>
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        {photoColumns.map((column, columnIndex) => (
          <div key={columnIndex} className="grid content-start gap-2">
            {column.map(({ photo, index }) => (
              <div
                key={photo.id}
                className={`group block w-full overflow-hidden rounded-lg bg-mist text-left transition-[box-shadow,transform,opacity] duration-200 ease-out ${
                  favoritesEnabled && favoriteIds.has(photo.id)
                    ? "ring-2 ring-brass ring-offset-2 ring-offset-paper"
                    : "ring-0"
                } ${isFilteringFavorites ? "opacity-80" : "opacity-100"}`}
              >
                <span className="relative block w-full">
                  <button
                    type="button"
                    title={copy.openPhoto}
                    aria-label={`${copy.openPhoto}: ${photo.filename}`}
                    onClick={() => setSelectedIndex(index)}
                    className="relative z-0 block w-full text-left"
                  >
                    {isVideo(photo) ? (
                      <span className="relative block aspect-video w-full overflow-hidden bg-ink">
                        <video
                          src={photo.imageUrl}
                          preload="metadata"
                          muted
                          playsInline
                          className="h-full w-full object-cover opacity-90 transition duration-500 ease-out group-hover:scale-[1.025]"
                        />
                        <span className="absolute inset-0 grid place-items-center bg-ink/20 text-white">
                          <span className="grid size-14 place-items-center rounded-full bg-white/90 text-ink shadow-soft">
                            <Play size={22} fill="currentColor" />
                          </span>
                        </span>
                      </span>
                    ) : hasImageDimensions(photo) ? (
                      <Image
                        src={hasLightweightThumbnail(photo) ? photo.thumbnailUrl : photo.imageUrl}
                        alt={photo.filename}
                        width={photo.imageWidth}
                        height={photo.imageHeight}
                        unoptimized
                        className="block h-auto w-full transition duration-500 ease-out group-hover:scale-[1.025]"
                        sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      />
                    ) : (
                      <img
                        src={hasLightweightThumbnail(photo) ? photo.thumbnailUrl : photo.imageUrl}
                        alt={photo.filename}
                        loading="lazy"
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
                </span>
              </div>
            ))}
          </div>
        ))}
      </section>

      {favoritesEnabled || downloadsEnabled ? (
        <div className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-ink/10 bg-white/90 px-3 py-3 shadow-soft backdrop-blur">
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
          {downloadsEnabled ? (
            <Button type="button" onClick={() => setIsEmailOpen(true)} disabled={isZipping || photos.length === 0}>
              <Download size={16} />
              {isZipping ? copy.zipPreparing : copy.zipEmail}
            </Button>
          ) : null}
        </div>
      ) : null}

      {isEmailOpen ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/60 px-5 backdrop-blur-sm">
          <form onSubmit={submitDownloadEmail} className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
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

            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-graphite">{copy.downloadQuality}</legend>
              <div className="mt-2 grid gap-2">
                {[
                  {
                    value: "web" as const,
                    title: copy.webQuality,
                    description: copy.webQualityDescription
                  },
                  {
                    value: "original" as const,
                    title: copy.originalQuality,
                    description: copy.originalQualityDescription
                  }
                ].map((option) => {
                  const isActive = downloadQuality === option.value;

                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer gap-3 rounded-md border px-4 py-3 transition ${
                        isActive ? "border-ink bg-ink text-white" : "border-ink/10 bg-paper text-ink hover:border-ink/25"
                      } ${isZipping ? "cursor-not-allowed opacity-70" : ""}`}
                    >
                      <input
                        type="radio"
                        name="downloadQuality"
                        value={option.value}
                        checked={isActive}
                        disabled={isZipping}
                        onChange={() => setDownloadQuality(option.value)}
                        className="mt-1 size-4"
                      />
                      <span>
                        <span className="block text-sm font-semibold">{option.title}</span>
                        <span className={`mt-1 block text-xs leading-5 ${isActive ? "text-white/70" : "text-graphite/70"}`}>
                          {option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

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

            <div className="mt-4 rounded-md border border-ink/10 bg-paper px-4 py-3 text-sm text-graphite/75">
              {copy.zipPartsInfo}
            </div>

            {emailError ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {emailError}
              </div>
            ) : null}

            {zipProgress ? (
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
              <Button type="button" variant="secondary" onClick={closeDownloadDialog}>
                {copy.cancel}
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
                        <video src={photo.imageUrl} preload="metadata" muted playsInline className="h-full w-full object-cover" />
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
        <div className="fixed inset-0 z-50 animate-[galleryFadeIn_160ms_ease-out] bg-ink/95 p-4 text-white">
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
              {downloadsEnabled ? (
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
                controls
                autoPlay
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              <Image
                src={hasLightweightPreview(selectedPhoto) ? selectedPhoto.previewUrl : selectedPhoto.imageUrl}
                alt={selectedPhoto.filename}
                fill
                unoptimized
                className="object-contain"
                sizes="100vw"
                priority
              />
            )}
          </div>
          {visiblePhotos.length > 1 ? <p className="mt-3 text-center text-sm text-white/70">{selectedPosition}/{visiblePhotos.length}</p> : null}
        </div>
      ) : null}
    </>
  );
}
