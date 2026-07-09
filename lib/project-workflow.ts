import {
  GALLERY_MODE_PROOFING,
  PROOFING_STATUS_DELIVERED,
  PROOFING_STATUS_IN_PROGRESS,
  PROOFING_STATUS_NOT_OPENED,
  PROOFING_STATUS_PROCESSING,
  PROOFING_STATUS_SUBMITTED,
  proofingStatusLabel
} from "@/lib/proofing";

export type ProjectWorkflowState = "action" | "done" | "info" | "waiting";
export type ProjectWorkflowIconKey =
  | "archive"
  | "arrow"
  | "book"
  | "camera"
  | "check"
  | "clock"
  | "file"
  | "heart"
  | "image"
  | "invoice"
  | "list"
  | "message"
  | "sparkles";

export type ProjectWorkflowSummary = {
  title: string;
  detail: string;
  href: string;
  buttonLabel: string;
  state: ProjectWorkflowState;
  stateLabel: string;
  iconKey: ProjectWorkflowIconKey;
};

export type ProjectWorkflowGallery = {
  id: string;
  title: string;
  galleryMode: string;
  proofingStatus: string;
  proofingInviteSentAt: Date | null;
  finalDeliveryEmailSentAt: Date | null;
  _count: {
    photos: number;
  };
};

export type ProjectWorkflowContract = {
  id: string;
  title: string;
  status: string;
  sentAt: Date | null;
  signedAt: Date | null;
  createdAt: Date;
};

export type ProjectWorkflowInvoice = {
  id: string;
  title: string;
  status: string;
  dueDate: Date | null;
  sentAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
};

export type ProjectWorkflowAlbumReview = {
  id: string;
  status: string;
  createdAt: Date;
  spreads?: Array<{
    approvedAt: Date | null;
    comments?: Array<{
      status?: string | null;
    }>;
  }>;
};

export type ProjectWorkflowAlbumDesign = {
  id: string;
  status: string;
  createdAt: Date;
};

export type ProjectWorkflowProject = {
  id: string;
  title: string;
  projectType: string;
  status: string;
  eventDate: Date | null;
  venue: string | null;
  createdAt: Date;
  galleries: ProjectWorkflowGallery[];
  contracts?: ProjectWorkflowContract[];
  invoices?: ProjectWorkflowInvoice[];
  albumReviews?: ProjectWorkflowAlbumReview[];
  albumDesigns?: ProjectWorkflowAlbumDesign[];
  _count?: {
    galleries?: number;
    contracts?: number;
    invoices?: number;
    albumReviews?: number;
    albumDesigns?: number;
  };
};

const PROJECT_PHASES = {
  planned: 0,
  in_progress: 1,
  proofing: 2,
  editing: 3,
  delivered: 4
} as const;

function stateLabel(state: ProjectWorkflowState) {
  if (state === "done") {
    return "Rendben";
  }

  if (state === "waiting") {
    return "Ügyfélre vár";
  }

  if (state === "action") {
    return "Te jössz";
  }

  return "Figyelni";
}

function sortByNewest<T extends { createdAt: Date }>(items: T[]) {
  return [...items].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

function countAlbumReviews(project: ProjectWorkflowProject) {
  return project.albumReviews?.length ?? project._count?.albumReviews ?? 0;
}

function countAlbumDesigns(project: ProjectWorkflowProject) {
  return project.albumDesigns?.length ?? project._count?.albumDesigns ?? 0;
}

function getPrimaryGallery(project: ProjectWorkflowProject) {
  return project.galleries.find((gallery) => gallery.galleryMode === GALLERY_MODE_PROOFING) ?? project.galleries[0] ?? null;
}

function openAlbumCommentCount(project: ProjectWorkflowProject) {
  return (project.albumReviews ?? []).reduce((total, review) => {
    return total + (review.spreads ?? []).reduce((spreadTotal, spread) => {
      return spreadTotal + (spread.comments ?? []).filter((comment) => (comment.status ?? "open") === "open").length;
    }, 0);
  }, 0);
}

function approvedAlbumSpreadCount(project: ProjectWorkflowProject) {
  return (project.albumReviews ?? []).reduce((total, review) => {
    return total + (review.spreads ?? []).filter((spread) => spread.approvedAt).length;
  }, 0);
}

function albumSpreadCount(project: ProjectWorkflowProject) {
  return (project.albumReviews ?? []).reduce((total, review) => total + (review.spreads?.length ?? 0), 0);
}

export function getProjectPhaseIndex(project: ProjectWorkflowProject) {
  if (project.projectType === "album") {
    if (project.status === "delivered") {
      return 4;
    }

    if (project.status === "editing") {
      return 3;
    }

    if (countAlbumReviews(project) > 0 || project.status === "proofing") {
      return 2;
    }

    if (countAlbumDesigns(project) > 0 || project.status === "in_progress") {
      return 1;
    }

    return 0;
  }

  if (project.status in PROJECT_PHASES) {
    return PROJECT_PHASES[project.status as keyof typeof PROJECT_PHASES];
  }

  const proofingGallery = project.galleries.find((gallery) => gallery.galleryMode === GALLERY_MODE_PROOFING);

  if (proofingGallery?.proofingStatus === PROOFING_STATUS_DELIVERED || proofingGallery?.finalDeliveryEmailSentAt) {
    return 4;
  }

  if (proofingGallery?.proofingStatus === PROOFING_STATUS_PROCESSING || proofingGallery?.proofingStatus === PROOFING_STATUS_SUBMITTED) {
    return 3;
  }

  if (proofingGallery) {
    return 2;
  }

  if (project.galleries.length > 0) {
    return 1;
  }

  return 0;
}

export function getProjectWorkflowSummary(
  customerId: string,
  project: ProjectWorkflowProject,
  options: { today?: Date; unassignedAlbumReviews?: number; unassignedAlbumDesigns?: number } = {}
): ProjectWorkflowSummary {
  const today = options.today ?? new Date();
  const proofingGallery = project.galleries.find((gallery) => gallery.galleryMode === GALLERY_MODE_PROOFING) ?? null;
  const primaryGallery = getPrimaryGallery(project);
  const isAlbumProject = project.projectType === "album";
  const contracts = sortByNewest(project.contracts ?? []);
  const invoices = sortByNewest(project.invoices ?? []);
  const waitingContract = contracts.find((contract) => contract.sentAt && !contract.signedAt);
  const draftContract = contracts.find((contract) => !contract.sentAt && !contract.signedAt && contract.status !== "signed");
  const openInvoices = invoices.filter((invoice) => invoice.status !== "paid" && !invoice.paidAt);
  const overdueInvoice = openInvoices.find((invoice) => invoice.dueDate && invoice.dueDate.getTime() < today.getTime());
  const unsentInvoice = openInvoices.find((invoice) => !invoice.sentAt);
  const openComments = openAlbumCommentCount(project);
  const approvedSpreads = approvedAlbumSpreadCount(project);
  const totalAlbumSpreads = albumSpreadCount(project);
  const isFutureEvent = Boolean(project.eventDate && project.eventDate.getTime() >= today.getTime());

  if (project.status === "archived") {
    return {
      title: "Projekt archiválva",
      detail: "Ez a munka lezárt archívumban van. Innen már csak visszakeresésre érdemes megnyitni.",
      href: `/admin/clients/${customerId}?tab=projects`,
      buttonLabel: "Projekt megnyitása",
      state: "info",
      stateLabel: stateLabel("info"),
      iconKey: "archive"
    };
  }

  if (project.status === "delivered") {
    return {
      title: "Projekt lezárva",
      detail: "A munka átadott állapotban van. Ha új módosítás érkezik, kézzel vissza tudod állítani aktív státuszra.",
      href: primaryGallery ? `/admin/galleries/${primaryGallery.id}` : `/admin/clients/${customerId}?tab=${isAlbumProject ? "album&albumMode=upload" : "projects"}`,
      buttonLabel: primaryGallery ? "Anyag megnyitása" : isAlbumProject ? "Album megnyitása" : "Projekt megnyitása",
      state: "done",
      stateLabel: stateLabel("done"),
      iconKey: "check"
    };
  }

  if (project.status === "lead" && !waitingContract && !draftContract) {
    return {
      title: "Foglalás tisztázása",
      detail: "Ez a projekt még érdeklődő státuszban van. A következő döntés, hogy lesz-e belőle tényleges munka.",
      href: `/admin/clients/${customerId}?tab=projects`,
      buttonLabel: "Projekt státusz megnyitása",
      state: "action",
      stateLabel: stateLabel("action"),
      iconKey: "arrow"
    };
  }

  if (waitingContract) {
    return {
      title: "Szerződés aláírásra vár",
      detail: `${waitingContract.title} ki lett küldve. Most az ügyfél aláírására vársz.`,
      href: `/admin/clients/${customerId}?tab=contracts`,
      buttonLabel: "Szerződések megnyitása",
      state: "waiting",
      stateLabel: stateLabel("waiting"),
      iconKey: "file"
    };
  }

  if (draftContract) {
    return {
      title: "Szerződés kiküldése",
      detail: `${draftContract.title} előkészítve van, de még nem ment ki az ügyfélnek.`,
      href: `/admin/clients/${customerId}?tab=contracts`,
      buttonLabel: "Szerződés kezelése",
      state: "action",
      stateLabel: stateLabel("action"),
      iconKey: "file"
    };
  }

  if (overdueInvoice) {
    return {
      title: "Lejárt számla követése",
      detail: `${overdueInvoice.title} nyitott és már lejárt. Érdemes ránézni fizetés előtt/után.`,
      href: `/admin/clients/${customerId}?tab=invoices`,
      buttonLabel: "Számlák megnyitása",
      state: "action",
      stateLabel: stateLabel("action"),
      iconKey: "invoice"
    };
  }

  if (unsentInvoice) {
    return {
      title: "Számla kiküldése",
      detail: `${unsentInvoice.title} feltöltve van, de még nincs elküldve az ügyfélnek.`,
      href: `/admin/clients/${customerId}?tab=invoices`,
      buttonLabel: "Számla kezelése",
      state: "action",
      stateLabel: stateLabel("action"),
      iconKey: "invoice"
    };
  }

  if (isAlbumProject) {
    if (openComments > 0) {
      return {
        title: "Album megjegyzések megválaszolása",
        detail: `${openComments} nyitott ügyfélmegjegyzés vár rád az album ellenőrzőben.`,
        href: `/admin/clients/${customerId}?tab=album&albumMode=upload`,
        buttonLabel: "Album ellenőrző megnyitása",
        state: "action",
        stateLabel: stateLabel("action"),
        iconKey: "message"
      };
    }

    if (countAlbumReviews(project) > 0) {
      if (totalAlbumSpreads > 0 && approvedSpreads === totalAlbumSpreads) {
        return {
          title: "Album jóváhagyva",
          detail: `${approvedSpreads} oldalpárt jóváhagyott az ügyfél. Ha a rendelés vagy gyártás is rendben van, zárd le a projektet a Készre állítás gombbal.`,
          href: `/admin/clients/${customerId}?tab=album&albumMode=upload`,
          buttonLabel: "Album ellenőrző megnyitása",
          state: "action",
          stateLabel: stateLabel("action"),
          iconKey: "check"
        };
      }

      return {
        title: "Album ellenőrzés követése",
        detail: approvedSpreads > 0
          ? `${approvedSpreads} oldalpárt már rendben jelölt az ügyfél. A többi visszajelzés itt követhető.`
          : "Az album ellenőrző elkészült. Itt látod, ha az ügyfél megjegyzést ír vagy oldalpárt rendben jelöl.",
        href: `/admin/clients/${customerId}?tab=album&albumMode=upload`,
        buttonLabel: "Album ellenőrző megnyitása",
        state: "waiting",
        stateLabel: stateLabel("waiting"),
        iconKey: "book"
      };
    }

    if (countAlbumDesigns(project) > 0) {
      return {
        title: "Albumterv ellenőrzővé alakítása",
        detail: "Az albumterv elindult. Ha készen van egy verzió, exportáld album ellenőrzőként az ügyfélnek.",
        href: `/admin/clients/${customerId}?tab=album&albumMode=editor`,
        buttonLabel: "Albumterv megnyitása",
        state: "action",
        stateLabel: stateLabel("action"),
        iconKey: "book"
      };
    }

    if ((options.unassignedAlbumReviews ?? 0) > 0 || (options.unassignedAlbumDesigns ?? 0) > 0) {
      const albumPieces = [
        (options.unassignedAlbumReviews ?? 0) > 0 ? `${options.unassignedAlbumReviews} album ellenőrző` : "",
        (options.unassignedAlbumDesigns ?? 0) > 0 ? `${options.unassignedAlbumDesigns} albumterv` : ""
      ].filter(Boolean);

      return {
        title: "Album anyag kapcsolása",
        detail: `Az ügyfélnél van kapcsolatlan ${albumPieces.join(" és ")}. Kapcsold ehhez az album projekthez, hogy pontos legyen a következő lépés.`,
        href: `/admin/clients/${customerId}?tab=album&albumMode=upload`,
        buttonLabel: "Album fül megnyitása",
        state: "action",
        stateLabel: stateLabel("action"),
        iconKey: "book"
      };
    }

    return {
      title: "Nincs album anyag kapcsolva",
      detail: "Ez az album projekt még nincs összekötve album ellenőrzővel vagy albumtervvel. Kapcsolj hozzá meglévőt, vagy hozz létre újat az Album fülön.",
      href: `/admin/clients/${customerId}?tab=album&albumMode=upload`,
      buttonLabel: "Album fül megnyitása",
      state: "info",
      stateLabel: stateLabel("info"),
      iconKey: "book"
    };
  }

  if (!primaryGallery && isFutureEvent) {
    return {
      title: "Fotózás előkészítése",
      detail: "A projekt dátuma megvan. A galériát akkor érdemes indítani, amikor már van feltöltendő nyers vagy kész anyag.",
      href: `/admin/galleries/new?customerId=${customerId}&projectId=${project.id}`,
      buttonLabel: "Galéria indítása",
      state: "waiting",
      stateLabel: stateLabel("waiting"),
      iconKey: "camera"
    };
  }

  if (!primaryGallery) {
    return {
      title: "Galéria vagy válogatás indítása",
      detail: "Ehhez a projekthez még nincs kapcsolt galéria. Innen indulhat a nyers válogatás vagy a kész galéria.",
      href: `/admin/galleries/new?customerId=${customerId}&projectId=${project.id}`,
      buttonLabel: "Galéria indítása",
      state: "action",
      stateLabel: stateLabel("action"),
      iconKey: "camera"
    };
  }

  if (proofingGallery) {
    if (!proofingGallery.proofingInviteSentAt) {
      return {
        title: "Válogató link kiküldése",
        detail: "A nyers galéria megvan, de az ügyfél még nem kapta meg a válogató linket.",
        href: `/admin/galleries/${proofingGallery.id}?tab=client`,
        buttonLabel: "Kiküldés kezelése",
        state: "action",
        stateLabel: stateLabel("action"),
        iconKey: "heart"
      };
    }

    if (proofingGallery.proofingStatus === PROOFING_STATUS_NOT_OPENED || proofingGallery.proofingStatus === PROOFING_STATUS_IN_PROGRESS) {
      return {
        title: "Ügyfél válogatásra vár",
        detail: proofingStatusLabel(proofingGallery.proofingStatus),
        href: `/admin/galleries/${proofingGallery.id}?tab=client`,
        buttonLabel: "Válogatás megnyitása",
        state: "waiting",
        stateLabel: stateLabel("waiting"),
        iconKey: "clock"
      };
    }

    if (proofingGallery.proofingStatus === PROOFING_STATUS_SUBMITTED) {
      return {
        title: "Képek kidolgozása",
        detail: "Az ügyfél leadta a válogatást. Most a kiválasztott képek feldolgozása következik.",
        href: `/admin/galleries/${proofingGallery.id}?tab=client`,
        buttonLabel: "Leadott válogatás",
        state: "action",
        stateLabel: stateLabel("action"),
        iconKey: "list"
      };
    }

    if (proofingGallery.proofingStatus === PROOFING_STATUS_PROCESSING) {
      return {
        title: "Kidolgozás alatt",
        detail: "A válogatás feldolgozás alatt van. Ha elkészültél, a kész képek átadása következik.",
        href: `/admin/galleries/${proofingGallery.id}?tab=client`,
        buttonLabel: "Kész képek kezelése",
        state: "waiting",
        stateLabel: stateLabel("waiting"),
        iconKey: "sparkles"
      };
    }

    return {
      title: "Kész képek átadva",
      detail: "A végleges anyag át lett adva az ügyfélnek. A projekt lezárását továbbra is kézzel döntöd el.",
      href: `/admin/galleries/${proofingGallery.id}?tab=client`,
      buttonLabel: "Átadás megnyitása",
      state: "done",
      stateLabel: stateLabel("done"),
      iconKey: "check"
    };
  }

  if (primaryGallery._count.photos === 0) {
    return {
      title: "Képek feltöltése",
      detail: "A galéria létrejött, de még nincs benne média.",
      href: `/admin/galleries/${primaryGallery.id}?tab=photos`,
      buttonLabel: "Feltöltés megnyitása",
      state: "action",
      stateLabel: stateLabel("action"),
      iconKey: "image"
    };
  }

  if (openInvoices.length > 0) {
    return {
      title: "Nyitott számla követése",
      detail: `${openInvoices[0].title} még nincs fizetett állapotban. Ha rendeződött, itt tudod lezárni.`,
      href: `/admin/clients/${customerId}?tab=invoices`,
      buttonLabel: "Számlák megnyitása",
      state: "waiting",
      stateLabel: stateLabel("waiting"),
      iconKey: "invoice"
    };
  }

  return {
    title: "Galéria használatban",
    detail: "Van feltöltött anyag. Ha minden rendben, a következő döntés az átadás vagy a projekt lezárása.",
    href: `/admin/galleries/${primaryGallery.id}`,
    buttonLabel: "Galéria kezelése",
    state: project.status === "editing" ? "action" : "info",
    stateLabel: stateLabel(project.status === "editing" ? "action" : "info"),
    iconKey: "arrow"
  };
}
