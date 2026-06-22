import {
  GALLERY_MODE_PROOFING,
  PROOFING_STATUS_DELIVERED,
  PROOFING_STATUS_IN_PROGRESS,
  PROOFING_STATUS_NOT_OPENED,
  PROOFING_STATUS_PROCESSING,
  PROOFING_STATUS_SUBMITTED
} from "@/lib/proofing";
import { normalizeCustomerStatus } from "@/lib/customer-options";

export const CUSTOMER_WORKFLOW_LANES = [
  { value: "needs_work", label: "Most dolgozni kell rajta" },
  { value: "waiting_client", label: "Ügyfélre vár" },
  { value: "delivery_ready", label: "Átadásra vár" },
  { value: "complete", label: "Kész / archív" }
] as const;

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

function laneLabel(lane: CustomerWorkflowLane) {
  return CUSTOMER_WORKFLOW_LANES.find((item) => item.value === lane)?.label ?? "Most dolgozni kell rajta";
}

export function normalizeCustomerWorkflowLane(value: string | null | undefined) {
  return CUSTOMER_WORKFLOW_LANES.some((item) => item.value === value) ? (value as CustomerWorkflowLane) : "";
}

export function getCustomerWorkflowSummary(customer: WorkflowCustomer): CustomerWorkflowSummary {
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
      laneLabel: laneLabel(lane),
      iconKey: "check" satisfies CustomerWorkflowIconKey,
      title: normalizedStatus === "archived" ? "Archivált ügyfél" : "Kézzel készre állítva",
      description: "Ez az ügyfél azért van kész állapotban, mert te így állítottad be az ügyfél státuszát. A feltöltött galéria önmagában nem zárja le a folyamatot.",
      href: latestGallery ? `/admin/galleries/${latestGallery.id}` : `/admin/clients/${customer.id}?edit=1`,
      buttonLabel: latestGallery ? "Galéria megnyitása" : "Státusz szerkesztése"
    };
  }

  if (!latestGallery) {
    const lane = "needs_work" satisfies CustomerWorkflowLane;

    return {
      lane,
      laneLabel: laneLabel(lane),
      iconKey: "plus" satisfies CustomerWorkflowIconKey,
      title: "Első galéria létrehozása",
      description: "Az ügyfél megvan. A következő lépés egy galéria vagy nyers válogatás indítása ehhez az ügyfélhez.",
      href: `/admin/galleries/new?customerId=${customer.id}`,
      buttonLabel: "Új galéria"
    };
  }

  if (latestGallery._count.photos === 0) {
    const lane = "needs_work" satisfies CustomerWorkflowLane;

    return {
      lane,
      laneLabel: laneLabel(lane),
      iconKey: "upload" satisfies CustomerWorkflowIconKey,
      title: "Képek feltöltése",
      description: `${latestGallery.title} már létrejött, de még nincs benne fotó. Innen érdemes folytatni a munkát.`,
      href: `/admin/galleries/${latestGallery.id}?tab=photos`,
      buttonLabel: "Feltöltés megnyitása"
    };
  }

  if (proofingGallery?.proofingStatus === PROOFING_STATUS_SUBMITTED) {
    const hasFinalPhotos = proofingGallery.photos.length > 0;
    const lane = hasFinalPhotos ? "delivery_ready" : "needs_work";

    return {
      lane,
      laneLabel: laneLabel(lane),
      iconKey: hasFinalPhotos ? ("check" satisfies CustomerWorkflowIconKey) : ("upload" satisfies CustomerWorkflowIconKey),
      title: hasFinalPhotos ? "Kész képek átadása" : "Kész képek feltöltése",
      description: hasFinalPhotos
        ? "Az ügyfél leadta a válogatást, és már van kész kép feltöltve. A következő lépés az átadás emaillel."
        : "Az ügyfél leadta a válogatást. Most a kidolgozott képeket töltsd vissza ugyanebbe a galériába.",
      href: `/admin/galleries/${proofingGallery.id}?tab=client`,
      buttonLabel: hasFinalPhotos ? "Átadás kezelése" : "Kész képek feltöltése"
    };
  }

  if (proofingGallery?.proofingStatus === PROOFING_STATUS_PROCESSING) {
    const hasFinalPhotos = proofingGallery.photos.length > 0;
    const lane = hasFinalPhotos ? "delivery_ready" : "needs_work";

    return {
      lane,
      laneLabel: laneLabel(lane),
      iconKey: hasFinalPhotos ? ("check" satisfies CustomerWorkflowIconKey) : ("upload" satisfies CustomerWorkflowIconKey),
      title: hasFinalPhotos ? "Kész képek átadása" : "Kidolgozás folyamatban",
      description: hasFinalPhotos
        ? "A galéria feldolgozás alatt van, és már van kész anyag. Innen tudod lezárni és elküldeni az ügyfélnek."
        : "A válogatás feldolgozás alatt van jelölve. Ha elkészültek a képek, ide töltsd fel őket.",
      href: `/admin/galleries/${proofingGallery.id}?tab=client`,
      buttonLabel: hasFinalPhotos ? "Átadás megnyitása" : "Kész képek feltöltése"
    };
  }

  if (
    proofingGallery?.proofingStatus === PROOFING_STATUS_NOT_OPENED ||
    proofingGallery?.proofingStatus === PROOFING_STATUS_IN_PROGRESS
  ) {
    const lane = proofingGallery.proofingInviteSentAt ? "waiting_client" : "needs_work";

    return {
      lane,
      laneLabel: laneLabel(lane),
      iconKey: proofingGallery.proofingInviteSentAt ? ("heart" satisfies CustomerWorkflowIconKey) : ("mail" satisfies CustomerWorkflowIconKey),
      title: proofingGallery.proofingInviteSentAt ? "Válogatás követése" : "Válogató link kiküldése",
      description: proofingGallery.proofingInviteSentAt
        ? "A nyers válogató link már ki lett küldve. Itt látod, hogy az ügyfél hol tart a kiválasztással."
        : "A nyers képes galéria készen áll. A következő lépés a válogató link emailes kiküldése.",
      href: `/admin/galleries/${proofingGallery.id}?tab=client`,
      buttonLabel: proofingGallery.proofingInviteSentAt ? "Válogatás megnyitása" : "Link küldése"
    };
  }

  if (finishedProofingGallery) {
    const lane = finishedProofingGallery.finalDeliveryEmailSentAt ? "waiting_client" : "delivery_ready";

    return {
      lane,
      laneLabel: laneLabel(lane),
      iconKey: "check" satisfies CustomerWorkflowIconKey,
      title: finishedProofingGallery.finalDeliveryEmailSentAt ? "Átadás kiküldve" : "Kész képek átadásra várnak",
      description: finishedProofingGallery.finalDeliveryEmailSentAt
        ? "A kész galéria átadás emailje már ki lett küldve, de az ügyfelet csak te állítod készre az ügyfél státuszával."
        : "A kész galéria átadott állapotban van, de az ügyfél folyamatát kézzel érdemes lezárni.",
      href: `/admin/galleries/${finishedProofingGallery.id}?tab=client`,
      buttonLabel: "Átadás megnyitása"
    };
  }

  const lane = "waiting_client" satisfies CustomerWorkflowLane;

  return {
    lane,
    laneLabel: laneLabel(lane),
    iconKey: "camera" satisfies CustomerWorkflowIconKey,
    title: "Galéria használatban",
    description: "A galéria fent van, de az ügyfél még válogathat, kedvenceket készíthet vagy visszajelezhet. Készre csak kézzel, az ügyfél státuszával állítod.",
    href: `/admin/galleries/${latestGallery.id}`,
    buttonLabel: "Galéria megnyitása"
  };
}
