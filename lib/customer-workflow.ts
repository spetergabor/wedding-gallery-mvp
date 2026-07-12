import {
  GALLERY_MODE_PROOFING,
  PROOFING_STATUS_DELIVERED,
  PROOFING_STATUS_IN_PROGRESS,
  PROOFING_STATUS_NOT_OPENED,
  PROOFING_STATUS_PROCESSING,
  PROOFING_STATUS_SUBMITTED
} from "@/lib/proofing";
import { normalizeCustomerStatus } from "@/lib/customer-options";
import type { AdminLanguage } from "@/lib/admin-language";

export const CUSTOMER_WORKFLOW_LANES = [
  { value: "needs_work", label: "Most dolgozni kell rajta" },
  { value: "waiting_client", label: "Ügyfélre vár" },
  { value: "delivery_ready", label: "Átadásra vár" },
  { value: "complete", label: "Kész / archív" }
] as const;

const CUSTOMER_WORKFLOW_COPY: Record<AdminLanguage, {
  lanes: Record<CustomerWorkflowLane, string>;
  archivedTitle: string;
  manuallyCompletedTitle: string;
  manuallyCompletedDescription: string;
  openGallery: string;
  editStatus: string;
  createFirstGalleryTitle: string;
  createFirstGalleryDescription: string;
  newGallery: string;
  uploadPhotosTitle: string;
  uploadPhotosDescription: (title: string) => string;
  openUpload: string;
  deliverFinalPhotosTitle: string;
  uploadFinalPhotosTitle: string;
  deliverAfterSubmittedDescription: string;
  uploadAfterSubmittedDescription: string;
  manageDelivery: string;
  uploadFinalPhotos: string;
  editingInProgressTitle: string;
  deliverFromProcessingDescription: string;
  processingDescription: string;
  openDelivery: string;
  trackSelectionTitle: string;
  sendSelectionLinkTitle: string;
  trackSelectionDescription: string;
  sendSelectionLinkDescription: string;
  openSelection: string;
  sendLink: string;
  deliverySentTitle: string;
  finalPhotosReadyTitle: string;
  deliverySentDescription: string;
  finalPhotosReadyDescription: string;
  galleryInUseTitle: string;
  galleryInUseDescription: string;
}> = {
  hu: {
    lanes: {
      needs_work: "Most dolgozni kell rajta",
      waiting_client: "Ügyfélre vár",
      delivery_ready: "Átadásra vár",
      complete: "Kész / archív"
    },
    archivedTitle: "Archivált ügyfél",
    manuallyCompletedTitle: "Kézzel készre állítva",
    manuallyCompletedDescription: "Ez az ügyfél azért van kész állapotban, mert te így állítottad be az ügyfél státuszát. A feltöltött galéria önmagában nem zárja le a folyamatot.",
    openGallery: "Galéria megnyitása",
    editStatus: "Státusz szerkesztése",
    createFirstGalleryTitle: "Első galéria létrehozása",
    createFirstGalleryDescription: "Az ügyfél megvan. A következő lépés egy galéria vagy nyers válogatás indítása ehhez az ügyfélhez.",
    newGallery: "Új galéria",
    uploadPhotosTitle: "Képek feltöltése",
    uploadPhotosDescription: (title) => `${title} már létrejött, de még nincs benne fotó. Innen érdemes folytatni a munkát.`,
    openUpload: "Feltöltés megnyitása",
    deliverFinalPhotosTitle: "Kész képek átadása",
    uploadFinalPhotosTitle: "Kész képek feltöltése",
    deliverAfterSubmittedDescription: "Az ügyfél leadta a válogatást, és már van kész kép feltöltve. A következő lépés az átadás emaillel.",
    uploadAfterSubmittedDescription: "Az ügyfél leadta a válogatást. Most a kidolgozott képeket töltsd vissza ugyanebbe a galériába.",
    manageDelivery: "Átadás kezelése",
    uploadFinalPhotos: "Kész képek feltöltése",
    editingInProgressTitle: "Kidolgozás folyamatban",
    deliverFromProcessingDescription: "A galéria feldolgozás alatt van, és már van kész anyag. Innen tudod lezárni és elküldeni az ügyfélnek.",
    processingDescription: "A válogatás feldolgozás alatt van jelölve. Ha elkészültek a képek, ide töltsd fel őket.",
    openDelivery: "Átadás megnyitása",
    trackSelectionTitle: "Válogatás követése",
    sendSelectionLinkTitle: "Válogató link kiküldése",
    trackSelectionDescription: "A nyers válogató link már ki lett küldve. Itt látod, hogy az ügyfél hol tart a kiválasztással.",
    sendSelectionLinkDescription: "A nyers képes galéria készen áll. A következő lépés a válogató link emailes kiküldése.",
    openSelection: "Válogatás megnyitása",
    sendLink: "Link küldése",
    deliverySentTitle: "Átadás kiküldve",
    finalPhotosReadyTitle: "Kész képek átadásra várnak",
    deliverySentDescription: "A kész galéria átadás emailje már ki lett küldve, de az ügyfelet csak te állítod készre az ügyfél státuszával.",
    finalPhotosReadyDescription: "A kész galéria átadott állapotban van, de az ügyfél folyamatát kézzel érdemes lezárni.",
    galleryInUseTitle: "Galéria használatban",
    galleryInUseDescription: "A galéria fent van, de az ügyfél még válogathat, kedvenceket készíthet vagy visszajelezhet. Készre csak kézzel, az ügyfél státuszával állítod."
  },
  de: {
    lanes: {
      needs_work: "Jetzt bearbeiten",
      waiting_client: "Wartet auf Kunde",
      delivery_ready: "Bereit zur Lieferung",
      complete: "Fertig / Archiv"
    },
    archivedTitle: "Archivierter Kunde",
    manuallyCompletedTitle: "Manuell als fertig markiert",
    manuallyCompletedDescription: "Dieser Kunde ist fertig, weil du den Kundenstatus so gesetzt hast. Eine hochgeladene Galerie schließt den Ablauf nicht automatisch ab.",
    openGallery: "Galerie öffnen",
    editStatus: "Status bearbeiten",
    createFirstGalleryTitle: "Erste Galerie erstellen",
    createFirstGalleryDescription: "Der Kunde ist angelegt. Als nächstes kannst du eine Galerie oder eine Rohbild-Auswahl starten.",
    newGallery: "Neue Galerie",
    uploadPhotosTitle: "Bilder hochladen",
    uploadPhotosDescription: (title) => `${title} ist angelegt, enthält aber noch keine Fotos. Hier solltest du weitermachen.`,
    openUpload: "Upload öffnen",
    deliverFinalPhotosTitle: "Fertige Bilder liefern",
    uploadFinalPhotosTitle: "Fertige Bilder hochladen",
    deliverAfterSubmittedDescription: "Der Kunde hat die Auswahl abgegeben und es gibt bereits fertige Bilder. Als nächstes folgt die Lieferung per E-Mail.",
    uploadAfterSubmittedDescription: "Der Kunde hat die Auswahl abgegeben. Lade jetzt die bearbeiteten Bilder in dieselbe Galerie hoch.",
    manageDelivery: "Lieferung verwalten",
    uploadFinalPhotos: "Fertige Bilder hochladen",
    editingInProgressTitle: "Bearbeitung läuft",
    deliverFromProcessingDescription: "Die Galerie ist in Bearbeitung und es gibt bereits fertiges Material. Von hier kannst du abschließen und an den Kunden senden.",
    processingDescription: "Die Auswahl ist als in Bearbeitung markiert. Wenn die Bilder fertig sind, lade sie hier hoch.",
    openDelivery: "Lieferung öffnen",
    trackSelectionTitle: "Auswahl verfolgen",
    sendSelectionLinkTitle: "Auswahllink senden",
    trackSelectionDescription: "Der Link zur Rohbild-Auswahl wurde gesendet. Hier siehst du, wie weit der Kunde ist.",
    sendSelectionLinkDescription: "Die Rohbild-Galerie ist bereit. Als nächstes sendest du den Auswahllink per E-Mail.",
    openSelection: "Auswahl öffnen",
    sendLink: "Link senden",
    deliverySentTitle: "Lieferung gesendet",
    finalPhotosReadyTitle: "Fertige Bilder warten auf Lieferung",
    deliverySentDescription: "Die E-Mail zur fertigen Galerie wurde bereits gesendet, aber den Kunden schließt du weiterhin manuell über den Kundenstatus ab.",
    finalPhotosReadyDescription: "Die fertige Galerie ist ausgeliefert. Den Kundenablauf solltest du manuell abschließen.",
    galleryInUseTitle: "Galerie in Nutzung",
    galleryInUseDescription: "Die Galerie ist online, der Kunde kann aber noch auswählen, Favoriten anlegen oder Feedback geben. Fertig setzt du den Kunden manuell über den Status."
  },
  en: {
    lanes: {
      needs_work: "Needs work now",
      waiting_client: "Waiting for client",
      delivery_ready: "Ready to deliver",
      complete: "Done / archive"
    },
    archivedTitle: "Archived client",
    manuallyCompletedTitle: "Manually marked done",
    manuallyCompletedDescription: "This client is complete because you set the client status that way. Uploading a gallery alone does not close the workflow.",
    openGallery: "Open gallery",
    editStatus: "Edit status",
    createFirstGalleryTitle: "Create first gallery",
    createFirstGalleryDescription: "The client exists. The next step is to start a gallery or raw photo selection for this client.",
    newGallery: "New gallery",
    uploadPhotosTitle: "Upload photos",
    uploadPhotosDescription: (title) => `${title} has been created, but it does not contain photos yet. Continue from here.`,
    openUpload: "Open upload",
    deliverFinalPhotosTitle: "Deliver final photos",
    uploadFinalPhotosTitle: "Upload final photos",
    deliverAfterSubmittedDescription: "The client submitted the selection and final photos are already uploaded. The next step is the delivery email.",
    uploadAfterSubmittedDescription: "The client submitted the selection. Upload the edited photos back into this gallery.",
    manageDelivery: "Manage delivery",
    uploadFinalPhotos: "Upload final photos",
    editingInProgressTitle: "Editing in progress",
    deliverFromProcessingDescription: "The gallery is marked as processing and already has final material. You can close and send it to the client from here.",
    processingDescription: "The selection is marked as processing. Upload the finished photos here when they are ready.",
    openDelivery: "Open delivery",
    trackSelectionTitle: "Track selection",
    sendSelectionLinkTitle: "Send selection link",
    trackSelectionDescription: "The raw photo selection link has been sent. This is where you can track the client's progress.",
    sendSelectionLinkDescription: "The raw photo gallery is ready. The next step is sending the selection link by email.",
    openSelection: "Open selection",
    sendLink: "Send link",
    deliverySentTitle: "Delivery sent",
    finalPhotosReadyTitle: "Final photos ready to deliver",
    deliverySentDescription: "The final gallery delivery email has already been sent, but you still close the client manually with the client status.",
    finalPhotosReadyDescription: "The final gallery is delivered, but you should manually close the client workflow.",
    galleryInUseTitle: "Gallery in use",
    galleryInUseDescription: "The gallery is online, but the client can still select photos, create favorites or send feedback. You mark the client done manually with the status."
  }
};

export type CustomerWorkflowLane = (typeof CUSTOMER_WORKFLOW_LANES)[number]["value"];
export type CustomerWorkflowIconKey = "camera" | "check" | "heart" | "mail" | "plus" | "upload";
export type CustomerWorkflowSummary = {
  lane: CustomerWorkflowLane;
  laneLabel: string;
  iconKey: CustomerWorkflowIconKey;
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
};

type WorkflowGallery = {
  id: string;
  title: string;
  galleryMode: string;
  proofingStatus: string;
  proofingInviteSentAt: Date | null;
  finalDeliveryEmailSentAt: Date | null;
  _count: {
    photos: number;
  };
  photos: Array<{
    id: string;
  }>;
};

type WorkflowCustomer = {
  id: string;
  status: string;
  galleries: WorkflowGallery[];
};

function laneLabel(lane: CustomerWorkflowLane, language: AdminLanguage = "hu") {
  return CUSTOMER_WORKFLOW_COPY[language].lanes[lane] ?? CUSTOMER_WORKFLOW_COPY[language].lanes.needs_work;
}

export function normalizeCustomerWorkflowLane(value: string | null | undefined) {
  return CUSTOMER_WORKFLOW_LANES.some((item) => item.value === value) ? (value as CustomerWorkflowLane) : "";
}

export function getCustomerWorkflowSummary(customer: WorkflowCustomer, language: AdminLanguage = "hu"): CustomerWorkflowSummary {
  const copy = CUSTOMER_WORKFLOW_COPY[language];
  const latestGallery = customer.galleries[0] ?? null;
  const normalizedStatus = normalizeCustomerStatus(customer.status);
  const manuallyCompleted = normalizedStatus === "delivered" || normalizedStatus === "archived";
  const proofingGallery = customer.galleries.find(
    (gallery) => gallery.galleryMode === GALLERY_MODE_PROOFING && gallery.proofingStatus !== PROOFING_STATUS_DELIVERED
  );
  const finishedProofingGallery = customer.galleries.find(
    (gallery) => gallery.galleryMode === GALLERY_MODE_PROOFING && gallery.proofingStatus === PROOFING_STATUS_DELIVERED
  );

  if (manuallyCompleted) {
    const lane = "complete" satisfies CustomerWorkflowLane;

    return {
      lane,
      laneLabel: laneLabel(lane, language),
      iconKey: "check" satisfies CustomerWorkflowIconKey,
      title: normalizedStatus === "archived" ? copy.archivedTitle : copy.manuallyCompletedTitle,
      description: copy.manuallyCompletedDescription,
      href: latestGallery ? `/admin/galleries/${latestGallery.id}` : `/admin/clients/${customer.id}?edit=1`,
      buttonLabel: latestGallery ? copy.openGallery : copy.editStatus
    };
  }

  if (!latestGallery) {
    const lane = "needs_work" satisfies CustomerWorkflowLane;

    return {
      lane,
      laneLabel: laneLabel(lane, language),
      iconKey: "plus" satisfies CustomerWorkflowIconKey,
      title: copy.createFirstGalleryTitle,
      description: copy.createFirstGalleryDescription,
      href: `/admin/galleries/new?customerId=${customer.id}`,
      buttonLabel: copy.newGallery
    };
  }

  if (latestGallery._count.photos === 0) {
    const lane = "needs_work" satisfies CustomerWorkflowLane;

    return {
      lane,
      laneLabel: laneLabel(lane, language),
      iconKey: "upload" satisfies CustomerWorkflowIconKey,
      title: copy.uploadPhotosTitle,
      description: copy.uploadPhotosDescription(latestGallery.title),
      href: `/admin/galleries/${latestGallery.id}?tab=photos`,
      buttonLabel: copy.openUpload
    };
  }

  if (proofingGallery?.proofingStatus === PROOFING_STATUS_SUBMITTED) {
    const hasFinalPhotos = proofingGallery.photos.length > 0;
    const lane = hasFinalPhotos ? "delivery_ready" : "needs_work";

    return {
      lane,
      laneLabel: laneLabel(lane, language),
      iconKey: hasFinalPhotos ? ("check" satisfies CustomerWorkflowIconKey) : ("upload" satisfies CustomerWorkflowIconKey),
      title: hasFinalPhotos ? copy.deliverFinalPhotosTitle : copy.uploadFinalPhotosTitle,
      description: hasFinalPhotos ? copy.deliverAfterSubmittedDescription : copy.uploadAfterSubmittedDescription,
      href: `/admin/galleries/${proofingGallery.id}?tab=client`,
      buttonLabel: hasFinalPhotos ? copy.manageDelivery : copy.uploadFinalPhotos
    };
  }

  if (proofingGallery?.proofingStatus === PROOFING_STATUS_PROCESSING) {
    const hasFinalPhotos = proofingGallery.photos.length > 0;
    const lane = hasFinalPhotos ? "delivery_ready" : "needs_work";

    return {
      lane,
      laneLabel: laneLabel(lane, language),
      iconKey: hasFinalPhotos ? ("check" satisfies CustomerWorkflowIconKey) : ("upload" satisfies CustomerWorkflowIconKey),
      title: hasFinalPhotos ? copy.deliverFinalPhotosTitle : copy.editingInProgressTitle,
      description: hasFinalPhotos ? copy.deliverFromProcessingDescription : copy.processingDescription,
      href: `/admin/galleries/${proofingGallery.id}?tab=client`,
      buttonLabel: hasFinalPhotos ? copy.openDelivery : copy.uploadFinalPhotos
    };
  }

  if (
    proofingGallery?.proofingStatus === PROOFING_STATUS_NOT_OPENED ||
    proofingGallery?.proofingStatus === PROOFING_STATUS_IN_PROGRESS
  ) {
    const lane = proofingGallery.proofingInviteSentAt ? "waiting_client" : "needs_work";

    return {
      lane,
      laneLabel: laneLabel(lane, language),
      iconKey: proofingGallery.proofingInviteSentAt ? ("heart" satisfies CustomerWorkflowIconKey) : ("mail" satisfies CustomerWorkflowIconKey),
      title: proofingGallery.proofingInviteSentAt ? copy.trackSelectionTitle : copy.sendSelectionLinkTitle,
      description: proofingGallery.proofingInviteSentAt ? copy.trackSelectionDescription : copy.sendSelectionLinkDescription,
      href: `/admin/galleries/${proofingGallery.id}?tab=client`,
      buttonLabel: proofingGallery.proofingInviteSentAt ? copy.openSelection : copy.sendLink
    };
  }

  if (finishedProofingGallery) {
    const lane = finishedProofingGallery.finalDeliveryEmailSentAt ? "waiting_client" : "delivery_ready";

    return {
      lane,
      laneLabel: laneLabel(lane, language),
      iconKey: "check" satisfies CustomerWorkflowIconKey,
      title: finishedProofingGallery.finalDeliveryEmailSentAt ? copy.deliverySentTitle : copy.finalPhotosReadyTitle,
      description: finishedProofingGallery.finalDeliveryEmailSentAt ? copy.deliverySentDescription : copy.finalPhotosReadyDescription,
      href: `/admin/galleries/${finishedProofingGallery.id}?tab=client`,
      buttonLabel: copy.openDelivery
    };
  }

  const lane = "waiting_client" satisfies CustomerWorkflowLane;

  return {
    lane,
    laneLabel: laneLabel(lane, language),
    iconKey: "camera" satisfies CustomerWorkflowIconKey,
    title: copy.galleryInUseTitle,
    description: copy.galleryInUseDescription,
    href: `/admin/galleries/${latestGallery.id}`,
    buttonLabel: copy.openGallery
  };
}
