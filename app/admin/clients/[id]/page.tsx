import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Camera,
  CheckCircle2,
  Circle,
  Clock3,
  ExternalLink,
  FileText,
  FolderKanban,
  Heart,
  ImagePlus,
  ListChecks,
  Mail,
  MessageSquare,
  Plus,
  ReceiptText,
  Trash2
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AlbumDesignManager } from "@/components/album-design-manager";
import { AlbumReviewManager } from "@/components/album-review-manager";
import { AlbumWorkflowTabs } from "@/components/album-workflow-tabs";
import { Alert } from "@/components/alert";
import { ButtonLink } from "@/components/button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ContractManager } from "@/components/contract-manager";
import { CustomerForm, CustomerProfileCard } from "@/components/customer-form";
import { CustomerMeetingManager } from "@/components/customer-meeting-manager";
import { CustomerPortalManager } from "@/components/customer-portal-manager";
import { CustomerProjectManager } from "@/components/customer-project-manager";
import { CustomerTabController } from "@/components/customer-tab-controller";
import { CustomerTaskManager } from "@/components/customer-task-manager";
import { DismissibleNextAction } from "@/components/dismissible-next-action";
import { InvoiceManager } from "@/components/invoice-manager";
import { ensureAlbumReviewApprovalSchema } from "@/lib/album-review-actions";
import { requireAdmin } from "@/lib/auth";
import { customerAccessWhere } from "@/lib/admin-scope";
import { dateLocaleForAdmin, getAdminLanguage, type AdminLanguage } from "@/lib/admin-language";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { customerProjectStatusLabel, customerProjectTypeLabel } from "@/lib/customer-project-options";
import { customerTaskPriorityLabel, customerTaskStatusLabel, customerTaskTypeLabel, isClosedCustomerTaskStatus } from "@/lib/customer-task-options";
import { CUSTOMER_STATUSES, customerStatusDisplayLabel, customerStatusLabel, customerTypeLabelForLanguage, normalizeCustomerStatus } from "@/lib/customer-options";
import { customerPortalUrl } from "@/lib/email";
import { getCustomerWorkflowSummary } from "@/lib/customer-workflow";
import { getProjectWorkflowSummary } from "@/lib/project-workflow";
import { deleteCustomerAction, updateCustomerStatusAction } from "@/lib/customer-actions";
import { prisma } from "@/lib/prisma";
import {
  GALLERY_MODE_FULL,
  GALLERY_MODE_PROOFING,
  PHOTO_DELIVERY_STAGE_FINAL,
  PROOFING_STATUS_PROCESSING,
  PROOFING_STATUS_SUBMITTED,
  proofingStatusLabel
} from "@/lib/proofing";

function formatDate(date: Date | null, language: AdminLanguage) {
  if (!date) {
    return CLIENT_DETAIL_COPY[language].common.noDate;
  }

  return date.toLocaleDateString(dateLocaleForAdmin(language), {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

function formatDateTime(date: Date | null, language: AdminLanguage) {
  if (!date) {
    return null;
  }

  return date.toLocaleString(dateLocaleForAdmin(language), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE
  });
}

function formatProjectTimeRange(project: { startTime: string | null; endTime: string | null }) {
  if (!project.startTime || !project.endTime) {
    return null;
  }

  return `${project.startTime} - ${project.endTime}`;
}

type CustomerTask = {
  title: string;
  detail: string;
  state: "action" | "done" | "info" | "waiting";
  href?: string;
};

type TimelineEvent = {
  date: Date;
  title: string;
  detail: string;
  href?: string;
};

type CustomerProjectOverview = {
  id: string;
  title: string;
  projectType: string;
  status: string;
  eventDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  createdAt: Date;
  galleries: Array<{
    id: string;
    title: string;
    slug: string;
    galleryMode: string;
    proofingStatus: string;
    proofingInviteSentAt: Date | null;
    finalDeliveryEmailSentAt: Date | null;
    _count: {
      photos: number;
    };
  }>;
  contracts: Array<{
    id: string;
    title: string;
    status: string;
    sentAt: Date | null;
    signedAt: Date | null;
    createdAt: Date;
  }>;
  invoices: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: Date | null;
    sentAt: Date | null;
    paidAt: Date | null;
    createdAt: Date;
  }>;
  albumReviews: Array<{
    id: string;
    status: string;
    createdAt: Date;
    spreads: Array<{
      approvedAt: Date | null;
      comments: Array<{
        status: string;
      }>;
    }>;
  }>;
  albumDesigns: Array<{
    id: string;
    status: string;
    createdAt: Date;
  }>;
  _count: {
    galleries: number;
    contracts: number;
    invoices: number;
    albumReviews: number;
    albumDesigns: number;
  };
};

type CustomerTab = "overview" | "tasks" | "projects" | "meetings" | "galleries" | "proofing" | "album" | "contracts" | "invoices" | "communication" | "portal" | "details";
type AlbumMode = "editor" | "upload";

const customerTabs: Array<{
  key: CustomerTab;
  label: string;
  icon: "CheckCircle2" | "ListChecks" | "FolderKanban" | "CalendarClock" | "Camera" | "Heart" | "ImagePlus" | "FileText" | "ReceiptText" | "MessageSquare" | "Globe2" | "Settings";
}> = [
  { key: "overview", label: "Áttekintés", icon: "CheckCircle2" },
  { key: "tasks", label: "Feladatok", icon: "ListChecks" },
  { key: "projects", label: "Projektek", icon: "FolderKanban" },
  { key: "meetings", label: "Meetingek", icon: "CalendarClock" },
  { key: "galleries", label: "Galériák", icon: "Camera" },
  { key: "proofing", label: "Válogatás", icon: "Heart" },
  { key: "album", label: "Album", icon: "ImagePlus" },
  { key: "contracts", label: "Szerződések", icon: "FileText" },
  { key: "invoices", label: "Számlák", icon: "ReceiptText" },
  { key: "communication", label: "Kommunikáció", icon: "MessageSquare" },
  { key: "portal", label: "Portál", icon: "Globe2" },
  { key: "details", label: "Adatok", icon: "Settings" }
];

const CLIENT_DETAIL_COPY = {
  hu: {
    common: {
      client: "Ügyfél",
      noDate: "Nincs dátum megadva",
      notProvided: "Nincs megadva",
      noVenue: "nincs helyszín",
      media: "média",
      gallery: "galéria",
      active: "Aktív",
      archived: "Archivált",
      manage: "Kezelés",
      rawProofing: "Nyers válogatás",
      fullGallery: "Teljes galéria"
    },
    header: {
      mainStatus: "Fő státusz",
      save: "Mentés"
    },
    tabs: {
      overview: "Áttekintés",
      tasks: "Feladatok",
      projects: "Projektek",
      meetings: "Meetingek",
      galleries: "Galériák",
      proofing: "Válogatás",
      album: "Album",
      contracts: "Szerződések",
      invoices: "Számlák",
      communication: "Kommunikáció",
      portal: "Portál",
      details: "Adatok"
    },
    tasks: {
      eyebrow: "Teendők",
      title: "Leadás előtti checklist",
      description: "A rendszer a galéria, válogatás, kész képek és szerződés állapotából számolja.",
      clientEmail: "Ügyfél email",
      missingEmail: "Hiányzik az elsődleges email cím",
      gallery: "Galéria",
      noGallery: "Még nincs galéria ehhez az ügyfélhez.",
      selectionLink: "Válogató link",
      sentToClient: "Kiküldve az ügyfélnek.",
      notSentYet: "Még nincs kiküldve.",
      clientSelection: "Ügyfél válogatás",
      finalPhotos: "Kész képek",
      hasFinalPhotos: "Van feltöltött kész anyag.",
      noFinalPhotos: "Még nincs kész kép feltöltve.",
      contract: "Szerződés",
      signed: "Aláírva.",
      sentWaiting: "Kiküldve, ügyfélre vár.",
      uploadedNotSent: "Feltöltve, de még nincs kiküldve.",
      noContract: "Még nincs szerződés rögzítve ehhez az ügyfélhez.",
      invoice: "Számla",
      openInvoice: "Nyitott számla",
      invoiceUploadedNotSent: "Feltöltve, de még nincs kiküldve",
      allInvoicesPaid: "Minden rögzített számla fizetett.",
      noInvoice: "Még nincs számla feltöltve ehhez az ügyfélhez.",
      currentFocus: "Aktuális fókusz",
      status: {
        action: "Lépés",
        done: "Kész",
        info: "Info",
        waiting: "Vár"
      }
    },
    projects: {
      eyebrow: "Projekt naptár",
      title: "Következő projektek",
      description: "Ügyfélhez tartozó fotózások és munkák dátum szerint rendezve.",
      manage: "Projektek kezelése",
      emptyTitle: "Még nincs projekt létrehozva",
      emptyDescription: "Hozz létre projektet, hogy az áttekintésben lásd a következő fotózást vagy album munkát.",
      nextProject: "Következő projekt",
      next: "Következő",
      nextPrefix: "Most ez a következő:",
      nextShortPrefix: "Következő:"
    },
    timeline: {
      eyebrow: "Timeline",
      title: "Legutóbbi események",
      clientCreated: "Ügyfél létrehozva",
      clientCreatedDetail: "Az ügyfél bekerült a rendszerbe.",
      contractCreated: "Szerződés létrehozva",
      contractSent: "Szerződés elküldve",
      contractOpened: "Szerződés megnyitva",
      contractSigned: "Szerződés aláírva",
      invoiceUploaded: "Számla feltöltve",
      invoiceSent: "Számla elküldve",
      invoicePaid: "Számla fizetett",
      galleryCreated: "Galéria létrehozva",
      uploadCompleted: "Feltöltés befejezve",
      uploadUpdated: "Feltöltés frissült",
      uploadFailedSuffix: "hibás",
      proofingStatusUpdated: "Válogatás státusz frissült",
      proofingLinkSent: "Válogató link kiküldve",
      selectionSubmitted: "Válogatás leadva",
      selectedPhotos: "kiválasztott kép",
      finalDeliverySent: "Kész képek átadva",
      taskCreated: "Feladat létrehozva",
      taskCompleted: "Feladat készre állítva"
    },
    galleries: {
      eyebrow: "Galériák",
      title: "Ügyfélhez tartozó galériák",
      description: "Innen induljon az új feltöltés. Így a galéria, a válogatás, az átadás és a szerződések egy ügyfél alatt maradnak.",
      newGallery: "Új galéria",
      emptyTitle: "Még nincs galéria ehhez az ügyfélhez",
      emptyDescription: "Hozd létre az első galériát, majd ott tudod feltölteni a képeket."
    },
    proofing: {
      eyebrow: "Válogatás",
      title: "Nyers képes workflow",
      description: "Itt látod az ügyfél válogató galériáit, leadott listáit és a kész képek átadási pontját.",
      emptyTitle: "Nincs nyers válogatás ehhez az ügyfélhez",
      emptyDescription: "Ha ilyen workflow kell, hozz létre nyers képes válogatás típusú galériát.",
      submittedLists: "leadott lista",
      hasFinalPhotos: "van kész kép feltöltve",
      noFinalPhotos: "nincs kész kép feltöltve"
    },
    communication: {
      eyebrow: "Kommunikáció",
      title: "Kiküldött email események",
      description: "Szerződés, válogató link és kész galéria email állapotok egy helyen.",
      emptyTitle: "Még nincs kiküldött email esemény",
      emptyDescription: "Itt fog megjelenni a szerződés, válogató és kész galéria kiküldése.",
      contractEmail: "Szerződés email",
      invoiceEmail: "Számla email",
      proofingEmail: "Válogató link email",
      finalGalleryEmail: "Kész galéria email"
    },
    details: {
      quickData: "Gyors adatok",
      type: "Típus",
      primaryEmail: "Elsődleges email",
      secondaryEmail: "Másodlagos email",
      phone: "Telefon",
      venue: "Helyszín",
      dangerZone: "Veszélyzóna",
      dangerDescription: "Az ügyfél törlése eltávolítja az adatlapot és a hozzá tartozó szerződés rekordokat. A galériák megmaradnak, de ügyfél nélküli régi galériaként folytatják. A művelet nem vonható vissza.",
      deleteClient: "Ügyfél törlése",
      deleteConfirm: (name: string) => `Biztosan törlöd ezt az ügyfelet: ${name}? Ez nem vonható vissza.`
    },
    projectWorkflow: {
      states: {
        action: "Te jössz",
        done: "Rendben",
        info: "Figyelni",
        waiting: "Ügyfélre vár"
      },
      titles: {}
    }
  },
  de: {
    common: {
      client: "Kunde",
      noDate: "Kein Datum angegeben",
      notProvided: "Nicht angegeben",
      noVenue: "kein Ort",
      media: "Medien",
      gallery: "Galerie",
      active: "Aktiv",
      archived: "Archiviert",
      manage: "Verwalten",
      rawProofing: "Rohbild-Auswahl",
      fullGallery: "Vollständige Galerie"
    },
    header: {
      mainStatus: "Hauptstatus",
      save: "Speichern"
    },
    tabs: {
      overview: "Übersicht",
      tasks: "Aufgaben",
      projects: "Projekte",
      meetings: "Meetings",
      galleries: "Galerien",
      proofing: "Auswahl",
      album: "Album",
      contracts: "Verträge",
      invoices: "Rechnungen",
      communication: "Kommunikation",
      portal: "Portal",
      details: "Daten"
    },
    tasks: {
      eyebrow: "To-dos",
      title: "Checkliste vor der Lieferung",
      description: "Das System berechnet sie aus Galerie, Auswahl, fertigen Bildern und Vertrag.",
      clientEmail: "Kunden-E-Mail",
      missingEmail: "Primäre E-Mail-Adresse fehlt",
      gallery: "Galerie",
      noGallery: "Für diesen Kunden gibt es noch keine Galerie.",
      selectionLink: "Auswahllink",
      sentToClient: "An den Kunden gesendet.",
      notSentYet: "Noch nicht gesendet.",
      clientSelection: "Kundenauswahl",
      finalPhotos: "Fertige Bilder",
      hasFinalPhotos: "Fertiges Material ist hochgeladen.",
      noFinalPhotos: "Noch keine fertigen Bilder hochgeladen.",
      contract: "Vertrag",
      signed: "Unterschrieben.",
      sentWaiting: "Gesendet, wartet auf den Kunden.",
      uploadedNotSent: "Hochgeladen, aber noch nicht gesendet.",
      noContract: "Für diesen Kunden ist noch kein Vertrag gespeichert.",
      invoice: "Rechnung",
      openInvoice: "Offene Rechnung",
      invoiceUploadedNotSent: "Hochgeladen, aber noch nicht gesendet",
      allInvoicesPaid: "Alle gespeicherten Rechnungen sind bezahlt.",
      noInvoice: "Für diesen Kunden ist noch keine Rechnung hochgeladen.",
      currentFocus: "Aktueller Fokus",
      status: {
        action: "Schritt",
        done: "Fertig",
        info: "Info",
        waiting: "Wartet"
      }
    },
    projects: {
      eyebrow: "Projektkalender",
      title: "Nächste Projekte",
      description: "Shootings und Arbeiten dieses Kunden nach Datum sortiert.",
      manage: "Projekte verwalten",
      emptyTitle: "Noch kein Projekt erstellt",
      emptyDescription: "Erstelle ein Projekt, damit du das nächste Shooting oder die nächste Albumarbeit in der Übersicht siehst.",
      nextProject: "Nächstes Projekt",
      next: "Nächstes",
      nextPrefix: "Als nächstes:",
      nextShortPrefix: "Nächster Schritt:"
    },
    timeline: {
      eyebrow: "Timeline",
      title: "Letzte Ereignisse",
      clientCreated: "Kunde erstellt",
      clientCreatedDetail: "Der Kunde wurde im System angelegt.",
      contractCreated: "Vertrag erstellt",
      contractSent: "Vertrag gesendet",
      contractOpened: "Vertrag geöffnet",
      contractSigned: "Vertrag unterschrieben",
      invoiceUploaded: "Rechnung hochgeladen",
      invoiceSent: "Rechnung gesendet",
      invoicePaid: "Rechnung bezahlt",
      galleryCreated: "Galerie erstellt",
      uploadCompleted: "Upload abgeschlossen",
      uploadUpdated: "Upload aktualisiert",
      uploadFailedSuffix: "fehlgeschlagen",
      proofingStatusUpdated: "Auswahlstatus aktualisiert",
      proofingLinkSent: "Auswahllink gesendet",
      selectionSubmitted: "Auswahl abgegeben",
      selectedPhotos: "ausgewählte Bilder",
      finalDeliverySent: "Fertige Bilder geliefert",
      taskCreated: "Aufgabe erstellt",
      taskCompleted: "Aufgabe erledigt"
    },
    galleries: {
      eyebrow: "Galerien",
      title: "Galerien dieses Kunden",
      description: "Starte neue Uploads von hier. So bleiben Galerie, Auswahl, Lieferung und Verträge unter einem Kunden.",
      newGallery: "Neue Galerie",
      emptyTitle: "Für diesen Kunden gibt es noch keine Galerie",
      emptyDescription: "Erstelle die erste Galerie, danach kannst du dort die Bilder hochladen."
    },
    proofing: {
      eyebrow: "Auswahl",
      title: "Rohbild-Workflow",
      description: "Hier siehst du Auswahlgalerien, abgegebene Listen und die Lieferung der fertigen Bilder.",
      emptyTitle: "Keine Rohbild-Auswahl für diesen Kunden",
      emptyDescription: "Wenn du diesen Workflow brauchst, erstelle eine Galerie vom Typ Rohbild-Auswahl.",
      submittedLists: "abgegebene Listen",
      hasFinalPhotos: "fertige Bilder vorhanden",
      noFinalPhotos: "keine fertigen Bilder vorhanden"
    },
    communication: {
      eyebrow: "Kommunikation",
      title: "Gesendete E-Mail-Ereignisse",
      description: "Status von Vertrags-, Auswahllink- und finalen Galerie-E-Mails an einem Ort.",
      emptyTitle: "Noch keine gesendeten E-Mail-Ereignisse",
      emptyDescription: "Hier erscheinen gesendete Verträge, Auswahllinks und finale Galerie-E-Mails.",
      contractEmail: "Vertrags-E-Mail",
      invoiceEmail: "Rechnungs-E-Mail",
      proofingEmail: "Auswahllink-E-Mail",
      finalGalleryEmail: "Finale Galerie-E-Mail"
    },
    details: {
      quickData: "Schnelldaten",
      type: "Typ",
      primaryEmail: "Primäre E-Mail",
      secondaryEmail: "Sekundäre E-Mail",
      phone: "Telefon",
      venue: "Ort",
      dangerZone: "Gefahrenzone",
      dangerDescription: "Das Löschen des Kunden entfernt das Profil und die zugehörigen Vertragsdatensätze. Galerien bleiben erhalten, laufen aber als alte Galerien ohne Kunden weiter. Diese Aktion kann nicht rückgängig gemacht werden.",
      deleteClient: "Kunde löschen",
      deleteConfirm: (name: string) => `Diesen Kunden wirklich löschen: ${name}? Das kann nicht rückgängig gemacht werden.`
    },
    projectWorkflow: {
      states: {
        action: "Du bist dran",
        done: "In Ordnung",
        info: "Beobachten",
        waiting: "Wartet auf Kunde"
      },
      titles: {
        "Fotózás előkészítése": "Shooting vorbereiten",
        "Galéria vagy válogatás indítása": "Galerie oder Auswahl starten",
        "Válogató link kiküldése": "Auswahllink senden",
        "Ügyfél válogatásra vár": "Wartet auf Kundenauswahl",
        "Képek kidolgozása": "Bilder bearbeiten",
        "Kidolgozás alatt": "In Bearbeitung",
        "Kész képek átadva": "Fertige Bilder geliefert",
        "Képek feltöltése": "Bilder hochladen",
        "Nyitott számla követése": "Offene Rechnung verfolgen",
        "Galéria használatban": "Galerie in Nutzung",
        "Projekt lezárva": "Projekt abgeschlossen",
        "Projekt archiválva": "Projekt archiviert"
      }
    }
  },
  en: {
    common: {
      client: "Client",
      noDate: "No date set",
      notProvided: "Not provided",
      noVenue: "no venue",
      media: "media",
      gallery: "gallery",
      active: "Active",
      archived: "Archived",
      manage: "Manage",
      rawProofing: "Raw selection",
      fullGallery: "Full gallery"
    },
    header: {
      mainStatus: "Main status",
      save: "Save"
    },
    tabs: {
      overview: "Overview",
      tasks: "Tasks",
      projects: "Projects",
      meetings: "Meetings",
      galleries: "Galleries",
      proofing: "Selection",
      album: "Album",
      contracts: "Contracts",
      invoices: "Invoices",
      communication: "Communication",
      portal: "Client portal",
      details: "Details"
    },
    tasks: {
      eyebrow: "To-dos",
      title: "Pre-delivery checklist",
      description: "Calculated from the gallery, selection, final photos and contract status.",
      clientEmail: "Client email",
      missingEmail: "Primary email address is missing",
      gallery: "Gallery",
      noGallery: "There is no gallery for this client yet.",
      selectionLink: "Selection link",
      sentToClient: "Sent to the client.",
      notSentYet: "Not sent yet.",
      clientSelection: "Client selection",
      finalPhotos: "Final photos",
      hasFinalPhotos: "Final material has been uploaded.",
      noFinalPhotos: "No final photos uploaded yet.",
      contract: "Contract",
      signed: "Signed.",
      sentWaiting: "Sent, waiting for the client.",
      uploadedNotSent: "Uploaded, but not sent yet.",
      noContract: "No contract is recorded for this client yet.",
      invoice: "Invoice",
      openInvoice: "Open invoice",
      invoiceUploadedNotSent: "Uploaded, but not sent yet",
      allInvoicesPaid: "All recorded invoices are paid.",
      noInvoice: "No invoice has been uploaded for this client yet.",
      currentFocus: "Current focus",
      status: {
        action: "Step",
        done: "Done",
        info: "Info",
        waiting: "Waiting"
      }
    },
    projects: {
      eyebrow: "Project calendar",
      title: "Upcoming projects",
      description: "Client shoots and work items sorted by date.",
      manage: "Manage projects",
      emptyTitle: "No project created yet",
      emptyDescription: "Create a project to see the next shoot or album job in the overview.",
      nextProject: "Next project",
      next: "Next",
      nextPrefix: "Next up:",
      nextShortPrefix: "Next:"
    },
    timeline: {
      eyebrow: "Timeline",
      title: "Recent events",
      clientCreated: "Client created",
      clientCreatedDetail: "The client was added to the system.",
      contractCreated: "Contract created",
      contractSent: "Contract sent",
      contractOpened: "Contract opened",
      contractSigned: "Contract signed",
      invoiceUploaded: "Invoice uploaded",
      invoiceSent: "Invoice sent",
      invoicePaid: "Invoice paid",
      galleryCreated: "Gallery created",
      uploadCompleted: "Upload completed",
      uploadUpdated: "Upload updated",
      uploadFailedSuffix: "failed",
      proofingStatusUpdated: "Selection status updated",
      proofingLinkSent: "Selection link sent",
      selectionSubmitted: "Selection submitted",
      selectedPhotos: "selected photos",
      finalDeliverySent: "Final photos delivered",
      taskCreated: "Task created",
      taskCompleted: "Task completed"
    },
    galleries: {
      eyebrow: "Galleries",
      title: "Client galleries",
      description: "Start new uploads from here so galleries, selections, delivery and contracts stay under one client.",
      newGallery: "New gallery",
      emptyTitle: "There is no gallery for this client yet",
      emptyDescription: "Create the first gallery, then upload the photos there."
    },
    proofing: {
      eyebrow: "Selection",
      title: "Raw photo workflow",
      description: "See the client's selection galleries, submitted lists and final photo delivery point.",
      emptyTitle: "No raw selection for this client",
      emptyDescription: "If you need this workflow, create a raw photo selection gallery.",
      submittedLists: "submitted lists",
      hasFinalPhotos: "final photos uploaded",
      noFinalPhotos: "no final photos uploaded"
    },
    communication: {
      eyebrow: "Communication",
      title: "Sent email events",
      description: "Contract, selection link and final gallery email states in one place.",
      emptyTitle: "No sent email events yet",
      emptyDescription: "Contract, selection and final gallery sends will appear here.",
      contractEmail: "Contract email",
      invoiceEmail: "Invoice email",
      proofingEmail: "Selection link email",
      finalGalleryEmail: "Final gallery email"
    },
    details: {
      quickData: "Quick data",
      type: "Type",
      primaryEmail: "Primary email",
      secondaryEmail: "Secondary email",
      phone: "Phone",
      venue: "Venue",
      dangerZone: "Danger zone",
      dangerDescription: "Deleting the client removes the profile and linked contract records. Galleries remain, but continue as old galleries without a client. This action cannot be undone.",
      deleteClient: "Delete client",
      deleteConfirm: (name: string) => `Delete this client: ${name}? This cannot be undone.`
    },
    projectWorkflow: {
      states: {
        action: "Your turn",
        done: "Done",
        info: "Watch",
        waiting: "Waiting for client"
      },
      titles: {
        "Fotózás előkészítése": "Prepare shoot",
        "Galéria vagy válogatás indítása": "Start gallery or selection",
        "Válogató link kiküldése": "Send selection link",
        "Ügyfél válogatásra vár": "Waiting for client selection",
        "Képek kidolgozása": "Edit photos",
        "Kidolgozás alatt": "Editing in progress",
        "Kész képek átadva": "Final photos delivered",
        "Képek feltöltése": "Upload photos",
        "Nyitott számla követése": "Follow up open invoice",
        "Galéria használatban": "Gallery in use",
        "Projekt lezárva": "Project closed",
        "Projekt archiválva": "Project archived"
      }
    }
  }
} as const;

type ClientDetailCopy = (typeof CLIENT_DETAIL_COPY)[AdminLanguage];

type CustomerWorkflowInput = {
  id: string;
  createdAt: Date;
  primaryEmail: string;
  contracts: Array<{
    id: string;
    title: string;
    status: string;
    sentAt: Date | null;
    openedAt: Date | null;
    signedAt: Date | null;
    createdAt: Date;
  }>;
  invoices: Array<{
    id: string;
    title: string;
    status: string;
    amountCents: number | null;
    currency: string;
    dueDate: Date | null;
    sentAt: Date | null;
    paidAt: Date | null;
    createdAt: Date;
  }>;
  galleries: Array<{
    id: string;
    title: string;
    galleryMode: string;
    proofingStatus: string;
    proofingStatusUpdatedAt: Date | null;
    proofingInviteSentAt: Date | null;
    finalDeliveryEmailSentAt: Date | null;
    createdAt: Date;
    _count: {
      photos: number;
    };
    photos: Array<{ id: string }>;
    favoriteLists: Array<{
      email: string;
      name: string;
      submittedAt: Date | null;
      _count: { items: number };
    }>;
    uploadSessions: Array<{
      status: string;
      deliveryStage: string;
      totalCount: number;
      completedCount: number;
      failedCount: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    taskType: string;
    status: string;
    priority: string;
    dueDate: Date | null;
    dueTime: string | null;
    completedAt: Date | null;
    createdAt: Date;
    project: {
      title: string;
    } | null;
  }>;
};

function createCustomerTasks(
  customer: CustomerWorkflowInput,
  nextAction: ReturnType<typeof getCustomerWorkflowSummary>,
  copy: ClientDetailCopy,
  language: AdminLanguage
) {
  const latestGallery = customer.galleries[0] ?? null;
  const activeProofingGallery = customer.galleries.find(
    (gallery) => gallery.galleryMode === GALLERY_MODE_PROOFING && ["not_opened", "in_progress", "submitted", "processing"].includes(gallery.proofingStatus)
  );
  const contract = customer.contracts[0] ?? null;
  const openInvoice = customer.invoices.find((invoice) => invoice.status !== "paid") ?? null;
  const tasks: CustomerTask[] = [
    {
      title: copy.tasks.clientEmail,
      detail: customer.primaryEmail ? customer.primaryEmail : copy.tasks.missingEmail,
      state: customer.primaryEmail ? "done" : "action",
      href: customer.primaryEmail ? undefined : `/admin/clients/${customer.id}?edit=1`
    }
  ];

  if (!latestGallery) {
    tasks.push({
      title: copy.tasks.gallery,
      detail: copy.tasks.noGallery,
      state: "action",
      href: `/admin/galleries/new?customerId=${customer.id}`
    });
  } else {
    tasks.push({
      title: copy.tasks.gallery,
      detail: `${latestGallery.title} · ${latestGallery._count.photos} ${copy.common.media}`,
      state: latestGallery._count.photos > 0 ? "done" : "action",
      href: `/admin/galleries/${latestGallery.id}?tab=photos`
    });
  }

  if (activeProofingGallery) {
    const hasFinalPhotos = activeProofingGallery.photos.length > 0;

    tasks.push({
      title: copy.tasks.selectionLink,
      detail: activeProofingGallery.proofingInviteSentAt ? copy.tasks.sentToClient : copy.tasks.notSentYet,
      state: activeProofingGallery.proofingInviteSentAt ? "done" : "action",
      href: `/admin/galleries/${activeProofingGallery.id}?tab=client`
    });
    tasks.push({
      title: copy.tasks.clientSelection,
      detail: proofingStatusLabel(activeProofingGallery.proofingStatus, language),
      state:
        activeProofingGallery.proofingStatus === PROOFING_STATUS_SUBMITTED ||
        activeProofingGallery.proofingStatus === PROOFING_STATUS_PROCESSING
          ? "done"
          : "waiting",
      href: `/admin/galleries/${activeProofingGallery.id}?tab=client`
    });
    tasks.push({
      title: copy.tasks.finalPhotos,
      detail: hasFinalPhotos ? copy.tasks.hasFinalPhotos : copy.tasks.noFinalPhotos,
      state: hasFinalPhotos ? "done" : activeProofingGallery.proofingStatus === PROOFING_STATUS_SUBMITTED ? "action" : "info",
      href: `/admin/galleries/${activeProofingGallery.id}?tab=client`
    });
  }

  if (contract) {
    tasks.push({
      title: copy.tasks.contract,
      detail: contract.signedAt
        ? copy.tasks.signed
        : contract.sentAt
          ? copy.tasks.sentWaiting
          : copy.tasks.uploadedNotSent,
      state: contract.signedAt ? "done" : contract.sentAt ? "waiting" : "action"
    });
  } else {
    tasks.push({
      title: copy.tasks.contract,
      detail: copy.tasks.noContract,
      state: "info"
    });
  }

  if (openInvoice) {
    tasks.push({
      title: copy.tasks.invoice,
      detail: openInvoice.sentAt
        ? `${copy.tasks.openInvoice}: ${openInvoice.title}`
        : `${copy.tasks.invoiceUploadedNotSent}: ${openInvoice.title}`,
      state: openInvoice.sentAt ? "waiting" : "action",
      href: `/admin/clients/${customer.id}?tab=invoices`
    });
  } else if (customer.invoices.length > 0) {
    tasks.push({
      title: copy.tasks.invoice,
      detail: copy.tasks.allInvoicesPaid,
      state: "done",
      href: `/admin/clients/${customer.id}?tab=invoices`
    });
  } else {
    tasks.push({
      title: copy.tasks.invoice,
      detail: copy.tasks.noInvoice,
      state: "info",
      href: `/admin/clients/${customer.id}?tab=invoices`
    });
  }

  tasks.push({
    title: copy.tasks.currentFocus,
    detail: nextAction.title,
    state: nextAction.lane === "complete" ? "done" : nextAction.lane === "waiting_client" ? "waiting" : "action",
    href: nextAction.href
  });

  return tasks;
}

function createCustomerTimeline(customer: CustomerWorkflowInput, copy: ClientDetailCopy, language: AdminLanguage) {
  const events: TimelineEvent[] = [
    {
      date: customer.createdAt,
      title: copy.timeline.clientCreated,
      detail: copy.timeline.clientCreatedDetail,
      href: `/admin/clients/${customer.id}`
    }
  ];

  customer.contracts.forEach((contract) => {
    events.push({
      date: contract.createdAt,
      title: copy.timeline.contractCreated,
      detail: contract.title
    });

    if (contract.sentAt) {
      events.push({
        date: contract.sentAt,
        title: copy.timeline.contractSent,
        detail: contract.title
      });
    }

    if (contract.openedAt) {
      events.push({
        date: contract.openedAt,
        title: copy.timeline.contractOpened,
        detail: contract.title
      });
    }

    if (contract.signedAt) {
      events.push({
        date: contract.signedAt,
        title: copy.timeline.contractSigned,
        detail: contract.title
      });
    }
  });

  customer.invoices.forEach((invoice) => {
    events.push({
      date: invoice.createdAt,
      title: copy.timeline.invoiceUploaded,
      detail: invoice.title,
      href: `/admin/clients/${customer.id}?tab=invoices`
    });

    if (invoice.sentAt) {
      events.push({
        date: invoice.sentAt,
        title: copy.timeline.invoiceSent,
        detail: invoice.title,
        href: `/admin/clients/${customer.id}?tab=invoices`
      });
    }

    if (invoice.paidAt) {
      events.push({
        date: invoice.paidAt,
        title: copy.timeline.invoicePaid,
        detail: invoice.title,
        href: `/admin/clients/${customer.id}?tab=invoices`
      });
    }
  });

  customer.tasks.forEach((task) => {
    const dueText = task.dueDate ? ` · ${formatDate(task.dueDate, language)}${task.dueTime ? ` ${task.dueTime}` : ""}` : "";
    const projectText = task.project ? ` · ${task.project.title}` : "";
    const detail = [
      task.title,
      customerTaskTypeLabel(task.taskType),
      customerTaskStatusLabel(task.status),
      customerTaskPriorityLabel(task.priority)
    ].join(" · ");

    events.push({
      date: task.createdAt,
      title: copy.timeline.taskCreated,
      detail: `${detail}${projectText}${dueText}`,
      href: `/admin/clients/${customer.id}?tab=tasks`
    });

    if (task.completedAt) {
      events.push({
        date: task.completedAt,
        title: copy.timeline.taskCompleted,
        detail: `${task.title}${projectText}${dueText}`,
        href: `/admin/clients/${customer.id}?tab=tasks`
      });
    }
  });

  customer.galleries.forEach((gallery) => {
    events.push({
      date: gallery.createdAt,
      title: copy.timeline.galleryCreated,
      detail: gallery.title,
      href: `/admin/galleries/${gallery.id}`
    });

    gallery.uploadSessions.forEach((session) => {
      events.push({
        date: session.updatedAt,
        title: session.status === "completed" ? copy.timeline.uploadCompleted : copy.timeline.uploadUpdated,
        detail: `${gallery.title} · ${session.completedCount}/${session.totalCount} ${copy.common.media} · ${session.failedCount} ${copy.timeline.uploadFailedSuffix}`,
        href: `/admin/galleries/${gallery.id}?tab=photos`
      });
    });

    if (gallery.proofingStatusUpdatedAt) {
      events.push({
        date: gallery.proofingStatusUpdatedAt,
        title: copy.timeline.proofingStatusUpdated,
        detail: `${gallery.title} · ${proofingStatusLabel(gallery.proofingStatus, language)}`,
        href: `/admin/galleries/${gallery.id}?tab=client`
      });
    }

    if (gallery.proofingInviteSentAt) {
      events.push({
        date: gallery.proofingInviteSentAt,
        title: copy.timeline.proofingLinkSent,
        detail: gallery.title,
        href: `/admin/galleries/${gallery.id}?tab=client`
      });
    }

    gallery.favoriteLists.forEach((list) => {
      if (!list.submittedAt) {
        return;
      }

      events.push({
        date: list.submittedAt,
        title: copy.timeline.selectionSubmitted,
        detail: `${list.email} · ${list._count.items} ${copy.timeline.selectedPhotos}`,
        href: `/admin/galleries/${gallery.id}?tab=client`
      });
    });

    if (gallery.finalDeliveryEmailSentAt) {
      events.push({
        date: gallery.finalDeliveryEmailSentAt,
        title: copy.timeline.finalDeliverySent,
        detail: gallery.title,
        href: `/admin/galleries/${gallery.id}?tab=client`
      });
    }
  });

  return events.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 12);
}

function createCommunicationEvents(customer: CustomerWorkflowInput, copy: ClientDetailCopy) {
  const events: TimelineEvent[] = [];

  customer.contracts.forEach((contract) => {
    if (contract.sentAt) {
      events.push({
        date: contract.sentAt,
        title: copy.communication.contractEmail,
        detail: contract.title
      });
    }
  });

  customer.invoices.forEach((invoice) => {
    if (invoice.sentAt) {
      events.push({
        date: invoice.sentAt,
        title: copy.communication.invoiceEmail,
        detail: invoice.title,
        href: `/admin/clients/${customer.id}?tab=invoices`
      });
    }
  });

  customer.galleries.forEach((gallery) => {
    if (gallery.proofingInviteSentAt) {
      events.push({
        date: gallery.proofingInviteSentAt,
        title: copy.communication.proofingEmail,
        detail: gallery.title,
        href: `/admin/galleries/${gallery.id}?tab=client`
      });
    }

    if (gallery.finalDeliveryEmailSentAt) {
      events.push({
        date: gallery.finalDeliveryEmailSentAt,
        title: copy.communication.finalGalleryEmail,
        detail: gallery.title,
        href: `/admin/galleries/${gallery.id}?tab=client`
      });
    }
  });

  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function sortProjectsForOverview(projects: CustomerProjectOverview[], today: Date) {
  return [...projects].sort((a, b) => {
    const aTime = a.eventDate?.getTime();
    const bTime = b.eventDate?.getTime();
    const aUpcoming = typeof aTime === "number" && aTime >= today.getTime();
    const bUpcoming = typeof bTime === "number" && bTime >= today.getTime();

    if (aUpcoming !== bUpcoming) {
      return aUpcoming ? -1 : 1;
    }

    if (typeof aTime === "number" && typeof bTime === "number") {
      return aUpcoming ? aTime - bTime : bTime - aTime;
    }

    if (typeof aTime === "number") {
      return -1;
    }

    if (typeof bTime === "number") {
      return 1;
    }

    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

function getNextProject(projects: CustomerProjectOverview[], today: Date) {
  return projects
    .filter((project) => project.eventDate && project.eventDate.getTime() >= today.getTime())
    .sort((a, b) => (a.eventDate?.getTime() ?? 0) - (b.eventDate?.getTime() ?? 0))[0] ?? null;
}

function taskStyles(state: CustomerTask["state"], copy: ClientDetailCopy) {
  if (state === "done") {
    return {
      icon: CheckCircle2,
      className: "border-sage/20 bg-sage/10 text-sage",
      label: copy.tasks.status.done
    };
  }

  if (state === "waiting") {
    return {
      icon: Clock3,
      className: "border-brass/25 bg-brass/10 text-brass",
      label: copy.tasks.status.waiting
    };
  }

  if (state === "action") {
    return {
      icon: ArrowRight,
      className: "border-ink/15 bg-ink text-white",
      label: copy.tasks.status.action
    };
  }

  return {
    icon: Circle,
    className: "border-ink/10 bg-paper text-graphite",
    label: copy.tasks.status.info
  };
}

function localizeProjectWorkflowSummary(
  summary: ReturnType<typeof getProjectWorkflowSummary>,
  copy: ClientDetailCopy
): ReturnType<typeof getProjectWorkflowSummary> {
  const titleMap = copy.projectWorkflow.titles as Record<string, string>;

  return {
    ...summary,
    title: titleMap[summary.title] ?? summary.title,
    stateLabel: copy.projectWorkflow.states[summary.state]
  };
}

function getActiveTab(flags: {
  edit?: string;
  tab?: string;
  contractUploaded?: string;
  contractWritten?: string;
  contractSent?: string;
  contractDeleted?: string;
  contractFieldsSaved?: string;
  contractFlow?: string;
  contractId?: string;
  invoiceUploaded?: string;
  invoiceSent?: string;
  invoiceStatusUpdated?: string;
  portalCreated?: string;
  meetingCreated?: string;
  meetingUpdated?: string;
  meetingDeleted?: string;
  meetingStatusUpdated?: string;
  meetingError?: string;
}): CustomerTab {
  if (flags.edit === "1") {
    return "details";
  }

  if (flags.invoiceUploaded || flags.invoiceSent || flags.invoiceStatusUpdated) {
    return "invoices";
  }

  if (
    flags.contractUploaded ||
    flags.contractWritten ||
    flags.contractSent ||
    flags.contractDeleted ||
    flags.contractFieldsSaved ||
    flags.contractFlow
  ) {
    return "contracts";
  }

  if (flags.portalCreated) {
    return "portal";
  }

  if (flags.meetingCreated || flags.meetingUpdated || flags.meetingDeleted || flags.meetingStatusUpdated || flags.meetingError) {
    return "meetings";
  }

  if (customerTabs.some((tab) => tab.key === flags.tab)) {
    return flags.tab as CustomerTab;
  }

  return "overview";
}

function getAlbumMode(flags: { albumMode?: string }): AlbumMode {
  return flags.albumMode === "upload" ? "upload" : "editor";
}

export default async function AdminClientDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    error?: string;
    contractUploaded?: string;
    contractWritten?: string;
    contractSent?: string;
    contractDeleted?: string;
    contractFieldsSaved?: string;
    contractFlow?: string;
    contractId?: string;
    contractError?: string;
    invoiceUploaded?: string;
    invoiceSent?: string;
    invoiceStatusUpdated?: string;
    invoiceError?: string;
    portalCreated?: string;
    portalError?: string;
    edit?: string;
    projectCreated?: string;
    projectDeleted?: string;
    projectError?: string;
    projectUpdated?: string;
    projectStatusUpdated?: string;
    meetingCreated?: string;
    meetingUpdated?: string;
    meetingDeleted?: string;
    meetingStatusUpdated?: string;
    meetingError?: string;
    taskCreated?: string;
    taskUpdated?: string;
    taskDeleted?: string;
    taskStatusUpdated?: string;
    taskError?: string;
    statusUpdated?: string;
    tab?: string;
    albumCreated?: string;
    albumDeleted?: string;
    albumUpdated?: string;
    albumMode?: string;
    albumUploaded?: string;
    albumError?: string;
    albumDesignCreated?: string;
    albumDesignDeleted?: string;
    albumDesignUpdated?: string;
    albumDesignExported?: string;
    albumSpreadAutoCreated?: string;
    albumSpreadCreated?: string;
    albumSpreadRegenerated?: string;
    albumSpreadUpdated?: string;
    albumSpreadSlotUpdated?: string;
    albumSpreadDeleted?: string;
    albumDesignError?: string;
    albumWorkspace?: string;
    albumDesignId?: string;
    albumEditor?: string;
  }>;
}) {
  const [admin, language, { id }, flags] = await Promise.all([requireAdmin(), getAdminLanguage(), params, searchParams]);
  const copy = CLIENT_DETAIL_COPY[language];
  const activeTab = getActiveTab(flags);
  const albumMode = getAlbumMode(flags);
  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, id),
    select: {
      id: true,
      customerType: true,
      coupleName: true,
      primaryEmail: true,
      secondaryEmail: true,
      phone: true,
      weddingDate: true,
      venue: true,
      preferredLanguage: true,
      portalToken: true,
      admin: {
        select: {
          siteSettings: {
            select: {
              publicSubdomain: true
            }
          }
        }
      },
      wifeName: true,
      wifeEmail: true,
      wifePhone: true,
      husbandName: true,
      husbandEmail: true,
      husbandPhone: true,
      partnerName: true,
      partnerEmail: true,
      partnerPhone: true,
      weddingLocation: true,
      weddingAddress: true,
      gettingReadyLocation: true,
      churchCeremonyLocation: true,
      civilCeremonyLocation: true,
      mainLocation: true,
      ceremonyLocation: true,
      receptionLocation: true,
      weddingSchedule: true,
      weddingStyleNotes: true,
      importantPeopleNotes: true,
      portalNotes: true,
      status: true,
      tags: true,
      notes: true,
      createdAt: true,
      contracts: {
        orderBy: { createdAt: "desc" }
      },
      portalImages: {
        orderBy: { createdAt: "desc" }
      },
      vendors: {
        orderBy: [{ role: "asc" }, { name: "asc" }]
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        include: {
          project: {
            select: {
              id: true,
              title: true
            }
          }
        }
      },
      galleries: {
        orderBy: { createdAt: "desc" },
        include: {
          project: {
            select: {
              id: true,
              title: true
            }
          },
          favoriteLists: {
            where: { submittedAt: { not: null } },
            orderBy: { submittedAt: "desc" },
            take: 3,
            select: {
              email: true,
              name: true,
              submittedAt: true,
              _count: {
                select: { items: true }
              }
            }
          },
          photos: {
            where: { deliveryStage: PHOTO_DELIVERY_STAGE_FINAL },
            select: { id: true },
            take: 1
          },
          uploadSessions: {
            orderBy: { updatedAt: "desc" },
            take: 3,
            select: {
              status: true,
              deliveryStage: true,
              totalCount: true,
              completedCount: true,
              failedCount: true,
              createdAt: true,
              updatedAt: true
            }
          },
          _count: {
            select: { photos: true }
          }
        }
      },
      projects: {
        orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
        include: {
          galleries: {
            orderBy: { createdAt: "desc" },
            take: 6,
            include: {
              _count: {
                select: { photos: true }
              }
            }
          },
          contracts: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              status: true,
              sentAt: true,
              signedAt: true,
              createdAt: true
            }
          },
          invoices: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              status: true,
              dueDate: true,
              sentAt: true,
              paidAt: true,
              createdAt: true
            }
          },
          albumReviews: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              status: true,
              createdAt: true,
              spreads: {
                select: {
                  approvedAt: true,
                  comments: {
                    select: {
                      status: true
                    }
                  }
                }
              }
            }
          },
          albumDesigns: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              status: true,
              createdAt: true
            }
          },
          _count: {
            select: {
              galleries: true,
              contracts: true,
              invoices: true,
              albumReviews: true,
              albumDesigns: true
            }
          }
        }
      },
      meetings: {
        orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          meetingType: true,
          status: true,
          eventDate: true,
          startTime: true,
          endTime: true,
          location: true,
          notes: true,
          googleCalendarSyncedAt: true,
          googleCalendarSyncError: true,
          createdAt: true
        }
      },
      tasks: {
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          taskType: true,
          status: true,
          priority: true,
          dueDate: true,
          dueTime: true,
          notes: true,
          completedAt: true,
          createdAt: true,
          project: {
            select: {
              id: true,
              title: true
            }
          }
        }
      }
    }
  });

  if (!customer) {
    notFound();
  }

  await ensureAlbumReviewApprovalSchema();

  const [albumReviews, albumFavoriteLists, albumDesigns, unassignedAlbumReviewCount, unassignedAlbumDesignCount] =
    await Promise.all([
      prisma.albumReview.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        include: {
          spreads: {
            orderBy: [{ filename: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              comments: {
                orderBy: { createdAt: "asc" }
              }
            }
          }
        }
      }),
      prisma.galleryFavoriteList.findMany({
        where: {
          gallery: {
            customerId: customer.id
          }
        },
        orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
        include: {
          gallery: {
            select: {
              title: true
            }
          },
          _count: {
            select: { items: true }
          },
          items: {
            orderBy: { createdAt: "asc" },
            take: 120,
            select: {
              photo: {
                select: {
                  id: true,
                  filename: true,
                  imageUrl: true,
                  thumbnailUrl: true
                }
              }
            }
          }
        }
      }),
      prisma.albumDesign.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        include: {
          sourceGallery: {
            select: {
              id: true,
              title: true,
              galleryMode: true,
              photos: {
                where: { mediaType: "image" },
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                select: {
                  id: true,
                  filename: true,
                  imageUrl: true,
                  thumbnailUrl: true
                }
              }
            }
          },
          favoriteList: {
            include: {
              gallery: {
                select: { title: true }
              },
              _count: {
                select: { items: true }
              },
              items: {
                orderBy: { createdAt: "asc" },
                take: 120,
                select: {
                  photo: {
                    select: {
                      id: true,
                      filename: true,
                      imageUrl: true,
                      thumbnailUrl: true
                    }
                  }
                }
              }
            }
          },
          spreads: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              items: {
                orderBy: { slotIndex: "asc" },
                include: {
                  photo: {
                    select: {
                      id: true,
                      filename: true,
                      imageUrl: true,
                      thumbnailUrl: true
                    }
                  }
                }
              }
            }
          }
        }
      }),
      prisma.albumReview.count({ where: { customerId: customer.id, projectId: null } }),
      prisma.albumDesign.count({ where: { customerId: customer.id, projectId: null } })
    ]);
  const unassignedProjectCounts = {
    galleries: customer.galleries.filter((gallery) => !gallery.projectId).length,
    contracts: customer.contracts.filter((contract) => !contract.projectId).length,
    invoices: customer.invoices.filter((invoice) => !invoice.projectId).length,
    albumReviews: unassignedAlbumReviewCount,
    albumDesigns: unassignedAlbumDesignCount
  };
  const isEditing = flags.edit === "1";
  const typeLabel = customerTypeLabelForLanguage(customer.customerType, language);
  const nextAction = getCustomerWorkflowSummary(customer, language);
  const customerTasks = createCustomerTasks(customer, nextAction, copy, language);
  const timelineEvents = createCustomerTimeline(customer, copy, language);
  const communicationEvents = createCommunicationEvents(customer, copy);
  const proofingGalleries = customer.galleries.filter((gallery) => gallery.galleryMode === GALLERY_MODE_PROOFING);
  const today = startOfToday();
  const projectsByDate = sortProjectsForOverview(customer.projects, today);
  const nextProject = getNextProject(customer.projects, today);
  const albumProjectOptions = projectsByDate
    .filter((project) => project.projectType === "album" && project.status !== "archived")
    .map((project) => ({ id: project.id, title: project.title }));
  const taskProjectOptions = projectsByDate
    .filter((project) => project.status !== "archived")
    .map((project) => ({ id: project.id, title: project.title }));
  const statusLabel = customerStatusDisplayLabel(customer.status, {
    hasKnownWorkDate: Boolean(customer.weddingDate || customer.projects.some((project) => project.eventDate)),
    referenceDate: today,
    workDate: nextProject?.eventDate ?? customer.weddingDate,
    language
  });
  const localizedCustomerTabs = customerTabs.map((tab) => ({ ...tab, label: copy.tabs[tab.key] }));
  const projectWorkflowSummaries = new Map(
    projectsByDate.map((project) => [
      project.id,
      localizeProjectWorkflowSummary(getProjectWorkflowSummary(customer.id, project, {
        today,
        unassignedAlbumReviews: unassignedProjectCounts.albumReviews,
        unassignedAlbumDesigns: unassignedProjectCounts.albumDesigns
      }), copy)
    ])
  );
  const nextProjectWorkflow = nextProject ? projectWorkflowSummaries.get(nextProject.id) : null;
  const publicSubdomain = customer.admin.siteSettings?.publicSubdomain ?? null;
  const portalUrl = customer.portalToken ? customerPortalUrl(customer.portalToken, publicSubdomain) : null;

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">{copy.common.client}</p>
        <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-semibold text-ink">{customer.coupleName}</h1>
            <p className="mt-3 text-sm text-graphite/70">
              {typeLabel} · {statusLabel} · {formatDate(nextProject?.eventDate ?? customer.weddingDate, language)}
            </p>
            {customer.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {customer.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-ink">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <form action={updateCustomerStatusAction.bind(null, customer.id)} className="rounded-md border border-ink/10 bg-white p-3">
            <label className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <span className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">{copy.header.mainStatus}</span>
              <select
                  name="status"
                  defaultValue={normalizeCustomerStatus(customer.status)}
                  className="h-10 w-full min-w-56 rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                >
                  {CUSTOMER_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {customerStatusLabel(status.value, language)}
                    </option>
                  ))}
                </select>
              </span>
              <FormSubmitButton className="h-10 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite">
                {copy.header.save}
              </FormSubmitButton>
            </label>
          </form>
        </div>
      </div>

      <div className="mb-5 space-y-3">
        {flags.created ? <Alert title="Ügyfél létrehozva." variant="success" /> : null}
        {flags.updated ? <Alert title="Ügyfél mentve." variant="success" /> : null}
        {flags.projectCreated ? <Alert title="Projekt létrehozva." variant="success" /> : null}
        {flags.projectUpdated ? <Alert title="Projekt időpont és adatok mentve." variant="success" /> : null}
        {flags.projectDeleted ? <Alert title="Projekt törölve." variant="success" /> : null}
        {flags.projectStatusUpdated ? <Alert title="Projekt státusz mentve." variant="success" /> : null}
        {flags.projectError === "missing" ? <Alert title="A projekt nem található vagy hiányzik a neve." variant="error" /> : null}
        {flags.projectError === "time" ? <Alert title="A kezdési és befejezési időt együtt add meg." variant="error" /> : null}
        {flags.projectError === "date" ? <Alert title="Időpont mentéséhez dátumot is meg kell adni." variant="error" /> : null}
        {flags.meetingCreated ? <Alert title="Meeting létrehozva." variant="success" /> : null}
        {flags.meetingUpdated ? <Alert title="Meeting adatok mentve." variant="success" /> : null}
        {flags.meetingDeleted ? <Alert title="Meeting törölve." variant="success" /> : null}
        {flags.meetingStatusUpdated ? <Alert title="Meeting státusz mentve." variant="success" /> : null}
        {flags.meetingError === "missing" ? <Alert title="A meeting nem található, vagy hiányzik a név/dátum." variant="error" /> : null}
        {flags.meetingError === "time" ? <Alert title="A meetinghez kötelező érvényes kezdési és befejezési időt megadni." variant="error" /> : null}
        {flags.taskCreated ? <Alert title="Feladat létrehozva." variant="success" /> : null}
        {flags.taskUpdated ? <Alert title="Feladat mentve." variant="success" /> : null}
        {flags.taskDeleted ? <Alert title="Feladat törölve." variant="success" /> : null}
        {flags.taskStatusUpdated ? <Alert title="Feladat státusz mentve." variant="success" /> : null}
        {flags.taskError === "missing" ? <Alert title="A feladat nem található, vagy hiányzik a címe." variant="error" /> : null}
        {flags.taskError === "time" ? <Alert title="A feladat időpontja nem érvényes." variant="error" /> : null}
        {flags.taskError === "project" ? <Alert title="A kiválasztott projekt nem ehhez az ügyfélhez tartozik." variant="error" /> : null}
        {flags.contractUploaded ? <Alert title="Szerződés feltöltve." variant="success" /> : null}
        {flags.contractWritten ? <Alert title="Saját szerződés létrehozva." variant="success" /> : null}
        {flags.contractSent ? <Alert title="Szerződés elküldve emailben." variant="success" /> : null}
        {flags.contractDeleted ? <Alert title="Szerződés törölve." variant="success" /> : null}
        {flags.contractFieldsSaved ? <Alert title="PDF kitöltendő mezők mentve." variant="success" /> : null}
        {flags.invoiceUploaded ? <Alert title="Számla feltöltve." variant="success" /> : null}
        {flags.invoiceSent ? <Alert title="Számla elküldve emailben." variant="success" /> : null}
        {flags.invoiceStatusUpdated ? <Alert title="Számla státusz frissítve." variant="success" /> : null}
        {flags.portalCreated ? <Alert title="Ügyfélportál létrehozva." variant="success" /> : null}
        {flags.portalError === "type" ? <Alert title="Ügyfélportál csak esküvős párnál elérhető." variant="error" /> : null}
        {flags.statusUpdated ? <Alert title="Ügyfél státusz frissítve." variant="success" /> : null}
        {flags.albumCreated ? <Alert title="Album ellenőrző létrehozva." variant="success" /> : null}
        {flags.albumDeleted ? <Alert title="Album ellenőrző törölve." variant="success" /> : null}
        {flags.albumUpdated ? <Alert title="Album ellenőrző projektkapcsolata mentve." variant="success" /> : null}
        {flags.albumUploaded ? <Alert title={`${flags.albumUploaded} album oldalpár feltöltve.`} variant="success" /> : null}
        {flags.albumDesignCreated ? <Alert title="Albumterv létrehozva." variant="success" /> : null}
        {flags.albumDesignDeleted ? <Alert title="Albumterv törölve." variant="success" /> : null}
        {flags.albumDesignUpdated ? <Alert title="Albumterv projektkapcsolata mentve." variant="success" /> : null}
        {flags.albumDesignExported ? <Alert title={`${flags.albumDesignExported} albumterv oldalpár bekerült az album ellenőrzőbe.`} variant="success" /> : null}
        {flags.albumSpreadAutoCreated ? <Alert title="Automatikus album oldalpár létrehozva." variant="success" /> : null}
        {flags.albumSpreadCreated ? <Alert title="Album oldalpár létrehozva." variant="success" /> : null}
        {flags.albumSpreadRegenerated ? <Alert title="Album oldalpár újragenerálva." variant="success" /> : null}
        {flags.albumSpreadUpdated ? <Alert title="Album oldalpár frissítve." variant="success" /> : null}
        {flags.albumSpreadSlotUpdated ? <Alert title="Album oldalpár képe frissítve." variant="success" /> : null}
        {flags.albumSpreadDeleted ? <Alert title="Album oldalpár törölve." variant="success" /> : null}
        {flags.albumError === "no-files" ? <Alert title="Nem választottál ki album oldalpár képet." variant="error" /> : null}
        {flags.albumError === "missing" ? <Alert title="Az album ellenőrző nem található." variant="error" /> : null}
        {flags.albumError === "project" ? <Alert title="A kiválasztott album projekt nem található." variant="error" /> : null}
        {flags.albumDesignError === "favorite-list" ? <Alert title="Válassz favorite listát az albumtervhez." variant="error" /> : null}
        {flags.albumDesignError === "source-gallery" ? <Alert title="A kiválasztott galéria nem található vagy nincs benne kép." variant="error" /> : null}
        {flags.albumDesignError === "project" ? <Alert title="A kiválasztott album projekt nem található." variant="error" /> : null}
        {flags.albumDesignError === "photo-count" ? <Alert title="A kiválasztott képek száma nem passzol a layout sablonhoz." variant="error" /> : null}
        {flags.albumDesignError === "layout-count" ? <Alert title="Ehhez a képszámhoz még nincs album layout sablon." variant="error" /> : null}
        {flags.albumDesignError === "no-spreads" ? <Alert title="Nincs exportálható album oldalpár ebben a tervben." variant="error" /> : null}
        {flags.albumDesignError === "export-failed" ? <Alert title="Az albumterv JPG exportja nem sikerült." variant="error" /> : null}
        {flags.albumDesignError === "invalid-photos" ? <Alert title="A kiválasztott képek nem ehhez a favorite listához tartoznak." variant="error" /> : null}
        {flags.albumDesignError === "slot" ? <Alert title="A kiválasztott album slot nem érvényes." variant="error" /> : null}
        {flags.albumDesignError === "missing" ? <Alert title="Az albumterv nem található." variant="error" /> : null}
        {flags.error === "missing" ? (
          <Alert title="Hiányzó kötelező mező." variant="error">
            Az ügyfél/projekt neve és az elsődleges email cím kötelező.
          </Alert>
        ) : null}
        {flags.contractError === "missing" ? (
          <Alert title="Hiányzó szerződés adat." variant="error">
            Adj meg címet és válassz ki egy PDF fájlt.
          </Alert>
        ) : null}
        {flags.contractError === "type" ? (
          <Alert title="Csak PDF tölthető fel." variant="error">
            A szerződés első verzióban PDF fájl lehet.
          </Alert>
        ) : null}
        {flags.contractError === "written-missing" ? (
          <Alert title="Hiányzó szerződés szöveg." variant="error">
            Adj meg címet és szerződés szöveget.
          </Alert>
        ) : null}
        {flags.contractError === "not-found" ? (
          <Alert title="A szerződés nem található." variant="error">
            Frissítsd az oldalt, és próbáld újra.
          </Alert>
        ) : null}
        {flags.contractError === "no-recipient" ? (
          <Alert title="Nincs kiválasztott címzett." variant="error">
            Válassz legalább egy e-mail címet, vagy adj meg további címzettet.
          </Alert>
        ) : null}
        {flags.contractError === "invalid-reply-to" ? (
          <Alert title="Érvénytelen válasz e-mail." variant="error">
            Adj meg egy érvényes válasz e-mail címet, vagy hagyd üresen a mezőt.
          </Alert>
        ) : null}
        {flags.contractError === "pdf-fields" ? (
          <Alert title="A PDF mezők nem menthetők." variant="error">
            Frissítsd az oldalt, és rajzold fel újra a mezőket.
          </Alert>
        ) : null}
        {flags.invoiceError === "missing" ? (
          <Alert title="Hiányzó számla adat." variant="error">
            Adj meg címet és válassz ki egy PDF fájlt.
          </Alert>
        ) : null}
        {flags.invoiceError === "type" ? (
          <Alert title="Csak PDF tölthető fel." variant="error">
            A számla első verzióban PDF fájl lehet.
          </Alert>
        ) : null}
        {flags.invoiceError === "not-found" ? (
          <Alert title="A számla nem található." variant="error">
            Frissítsd az oldalt, és próbáld újra.
          </Alert>
        ) : null}
        {flags.invoiceError === "email" ? (
          <Alert title="A számla email küldése nem sikerült." variant="error">
            Ellenőrizd a Resend beállítást és az ügyfél email címét, majd próbáld újra.
          </Alert>
        ) : null}
      </div>

      <DismissibleNextAction
        customerId={customer.id}
        title={nextAction.title}
        description={nextAction.description}
        buttonLabel={nextAction.buttonLabel}
        href={nextAction.href}
        iconKey={nextAction.iconKey}
      />

      <CustomerTabController tabs={localizedCustomerTabs} initialTab={activeTab} language={language} />

      <div data-customer-tab-panel="overview" hidden={activeTab !== "overview"}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <section className="rounded-md border border-ink/10 bg-white p-5">
              <div className="flex flex-col justify-between gap-3 border-b border-ink/10 pb-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-graphite/65">
                    <CheckCircle2 size={15} />
                    {copy.tasks.eyebrow}
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-ink">{copy.tasks.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-graphite/70">
                    {copy.tasks.description}
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
                  {nextAction.laneLabel}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {customerTasks.map((task) => {
                  const styles = taskStyles(task.state, copy);
                  const TaskIcon = styles.icon;
                  const content = (
                    <>
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-md border ${styles.className}`}>
                        <TaskIcon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-ink">{task.title}</p>
                          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-graphite">
                            {styles.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-5 text-graphite/70">{task.detail}</p>
                      </div>
                    </>
                  );

                  return task.href ? (
                    <Link key={`${task.title}-${task.detail}`} href={task.href} className="flex gap-3 rounded-md border border-ink/10 bg-paper p-3 transition hover:border-ink/20 hover:bg-ink/[0.03]">
                      {content}
                    </Link>
                  ) : (
                    <div key={`${task.title}-${task.detail}`} className="flex gap-3 rounded-md border border-ink/10 bg-paper p-3">
                      {content}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-md border border-ink/10 bg-white p-5">
              <div className="flex flex-col justify-between gap-3 border-b border-ink/10 pb-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-graphite/65">
                    <FolderKanban size={15} />
                    {copy.projects.eyebrow}
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-ink">{copy.projects.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-graphite/70">
                    {copy.projects.description}
                  </p>
                </div>
                <Link
                  href={`/admin/clients/${customer.id}?tab=projects`}
                  data-customer-tab-target="projects"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition hover:border-ink/30"
                >
                  {copy.projects.manage}
                </Link>
              </div>

              {projectsByDate.length === 0 ? (
                <div className="mt-4 rounded-md bg-paper px-4 py-4">
                  <p className="text-sm font-medium text-ink">{copy.projects.emptyTitle}</p>
                  <p className="mt-1 text-sm text-graphite/70">{copy.projects.emptyDescription}</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {nextProject ? (
                    <Link
                      href={`/admin/clients/${customer.id}?tab=projects`}
                      data-customer-tab-target="projects"
                      className="block rounded-md border border-brass/30 bg-brass/10 p-4 transition hover:bg-brass/15"
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-graphite/65">{copy.projects.nextProject}</p>
                          <h3 className="mt-2 text-base font-semibold text-ink">{nextProject.title}</h3>
                          <p className="mt-1 text-sm text-graphite/75">
                            {customerProjectTypeLabel(nextProject.projectType, language)} · {formatDate(nextProject.eventDate, language)}
                            {formatProjectTimeRange(nextProject) ? ` · ${formatProjectTimeRange(nextProject)}` : ""}
                            {nextProject.venue ? ` · ${nextProject.venue}` : ""}
                          </p>
                          {nextProjectWorkflow ? (
                            <p className="mt-2 text-sm font-medium text-ink">
                              {copy.projects.nextPrefix} {nextProjectWorkflow.title}
                            </p>
                          ) : null}
                        </div>
                        <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-brass">
                          {nextProjectWorkflow?.stateLabel ?? customerProjectStatusLabel(nextProject.status, language)}
                        </span>
                      </div>
                    </Link>
                  ) : null}

                  <div className="divide-y divide-ink/10 rounded-md border border-ink/10">
                    {projectsByDate.slice(0, 5).map((project) => {
                      const workflow = projectWorkflowSummaries.get(project.id);

                      return (
                        <Link
                          key={project.id}
                          href={`/admin/clients/${customer.id}?tab=projects`}
                          data-customer-tab-target="projects"
                          className="grid gap-3 px-4 py-3 transition hover:bg-ink/[0.03] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-ink">{project.title}</p>
                              {project.id === nextProject?.id ? (
                                <span className="rounded-full bg-brass/10 px-2 py-0.5 text-[11px] font-medium text-brass">
                                  {copy.projects.next}
                                </span>
                              ) : null}
                              {workflow ? (
                                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-graphite">
                                  {workflow.stateLabel}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-graphite/70">
                              {customerProjectTypeLabel(project.projectType, language)} · {project.venue || copy.common.noVenue}
                            </p>
                            {workflow ? (
                              <p className="mt-1 text-sm text-graphite/75">
                                {copy.projects.nextShortPrefix} {workflow.title}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                              {formatDate(project.eventDate, language)}
                            </span>
                            {formatProjectTimeRange(project) ? (
                              <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                                {formatProjectTimeRange(project)}
                              </span>
                            ) : null}
                            <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                              {project._count.galleries} {copy.common.gallery}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>

          <section className="rounded-md border border-ink/10 bg-white p-5">
            <div className="border-b border-ink/10 pb-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-graphite/65">
                <CalendarClock size={15} />
                {copy.timeline.eyebrow}
              </div>
              <h2 className="mt-2 text-base font-semibold text-ink">{copy.timeline.title}</h2>
            </div>
            <div className="mt-4 space-y-4">
              {timelineEvents.map((event) => {
                const content = (
                  <>
                    <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-paper text-brass">
                      <FileText size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{event.title}</p>
                      <p className="mt-1 text-sm leading-5 text-graphite/70">{event.detail}</p>
                      <p className="mt-1 text-xs text-graphite/55">{formatDateTime(event.date, language)}</p>
                    </div>
                  </>
                );

                return event.href ? (
                  <Link key={`${event.title}-${event.date.toISOString()}`} href={event.href} className="flex gap-3 rounded-md p-2 transition hover:bg-ink/[0.03]">
                    {content}
                  </Link>
                ) : (
                  <div key={`${event.title}-${event.date.toISOString()}`} className="flex gap-3 rounded-md p-2">
                    {content}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <div data-customer-tab-panel="tasks" hidden={activeTab !== "tasks"}>
        <CustomerTaskManager customerId={customer.id} tasks={customer.tasks} projects={taskProjectOptions} />
      </div>

      <div data-customer-tab-panel="projects" hidden={activeTab !== "projects"}>
        <CustomerProjectManager
          customerId={customer.id}
          projects={customer.projects}
          unassignedCounts={unassignedProjectCounts}
          defaultEventDate={customer.weddingDate}
          defaultVenue={customer.venue}
        />
      </div>

      <div data-customer-tab-panel="meetings" hidden={activeTab !== "meetings"}>
        <CustomerMeetingManager
          customerId={customer.id}
          customerName={customer.coupleName}
          meetings={customer.meetings}
          defaultLocation={customer.venue}
        />
      </div>

      <div data-customer-tab-panel="galleries" hidden={activeTab !== "galleries"}>
        <section className="rounded-md border border-ink/10 bg-white p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-graphite/65">
                <Camera size={15} />
                {copy.galleries.eyebrow}
              </div>
              <h2 className="mt-2 text-base font-semibold text-ink">{copy.galleries.title}</h2>
              <p className="mt-1 text-sm leading-6 text-graphite/70">
                {copy.galleries.description}
              </p>
            </div>
            <ButtonLink href={`/admin/galleries/new?customerId=${customer.id}`}>
              <Plus size={16} />
              {copy.galleries.newGallery}
            </ButtonLink>
          </div>

          {customer.galleries.length === 0 ? (
            <div className="mt-5 rounded-md bg-paper px-4 py-4">
              <p className="text-sm font-medium text-ink">{copy.galleries.emptyTitle}</p>
              <p className="mt-1 text-sm text-graphite/70">{copy.galleries.emptyDescription}</p>
            </div>
          ) : (
            <div className="mt-5 divide-y divide-ink/10 rounded-md border border-ink/10">
              {customer.galleries.map((gallery) => (
                <div key={gallery.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <Link href={`/admin/galleries/${gallery.id}`} className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{gallery.title}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${gallery.isActive ? "bg-sage/15 text-sage" : "bg-ink/5 text-graphite"}`}>
                        {gallery.isActive ? copy.common.active : copy.common.archived}
                      </span>
                      <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                        {gallery.galleryMode === GALLERY_MODE_PROOFING ? copy.common.rawProofing : copy.common.fullGallery}
                      </span>
                      {gallery.project ? (
                        <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                          {gallery.project.title}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-graphite/70">/g/{gallery.slug} · {gallery._count.photos} {copy.common.media}</p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <ButtonLink href={`/admin/galleries/${gallery.id}`} variant="secondary" className="h-10">
                      {copy.common.manage}
                    </ButtonLink>
                    <a className="flex size-10 items-center justify-center rounded-md border border-ink/10 hover:bg-ink/5" href={`/g/${gallery.slug}`} target="_blank">
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div data-customer-tab-panel="proofing" hidden={activeTab !== "proofing"}>
        <section className="rounded-md border border-ink/10 bg-white p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-graphite/65">
            <Heart size={15} />
            {copy.proofing.eyebrow}
          </div>
          <h2 className="mt-2 text-base font-semibold text-ink">{copy.proofing.title}</h2>
          <p className="mt-1 text-sm leading-6 text-graphite/70">
            {copy.proofing.description}
          </p>

          {proofingGalleries.length === 0 ? (
            <div className="mt-5 rounded-md bg-paper px-4 py-4">
              <p className="text-sm font-medium text-ink">{copy.proofing.emptyTitle}</p>
              <p className="mt-1 text-sm text-graphite/70">{copy.proofing.emptyDescription}</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {proofingGalleries.map((gallery) => (
                <Link key={gallery.id} href={`/admin/galleries/${gallery.id}?tab=client`} className="rounded-md border border-ink/10 bg-paper p-4 transition hover:border-ink/20 hover:bg-ink/[0.03]">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{gallery.title}</p>
                        <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                          {proofingStatusLabel(gallery.proofingStatus, language)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-graphite/70">
                        {gallery.favoriteLists.length} {copy.proofing.submittedLists} · {gallery.photos.length > 0 ? copy.proofing.hasFinalPhotos : copy.proofing.noFinalPhotos}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                      {copy.common.manage}
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div data-customer-tab-panel="album" hidden={activeTab !== "album"}>
        <AlbumWorkflowTabs
          initialMode={albumMode}
          editorCount={albumDesigns.length}
          reviewCount={albumReviews.length}
          editorContent={
            <AlbumDesignManager
              customerId={customer.id}
              favoriteLists={albumFavoriteLists.filter((list) => list._count.items > 0)}
              sourceGalleries={customer.galleries
                .filter((gallery) => gallery.galleryMode === GALLERY_MODE_FULL && gallery._count.photos > 0)
                .map((gallery) => ({
                  id: gallery.id,
                  title: gallery.title,
                  customerName: null,
                  photoCount: gallery._count.photos
                }))}
              designs={albumDesigns}
              projects={albumProjectOptions}
              workspaceView={flags.albumWorkspace === "new" ? "new" : "projects"}
              activeDesignId={flags.albumDesignId ?? null}
              initialEditorOpen={flags.albumEditor === "1"}
            />
          }
          uploadContent={<AlbumReviewManager customerId={customer.id} reviews={albumReviews} projects={albumProjectOptions} />}
        />
      </div>

      <div data-customer-tab-panel="contracts" hidden={activeTab !== "contracts"}>
        <ContractManager
          customerId={customer.id}
          customer={{
            coupleName: customer.coupleName,
            primaryEmail: customer.primaryEmail,
            secondaryEmail: customer.secondaryEmail,
            wifeName: customer.wifeName,
            wifeEmail: customer.wifeEmail,
            husbandName: customer.husbandName,
            husbandEmail: customer.husbandEmail,
            partnerName: customer.partnerName,
            partnerEmail: customer.partnerEmail
          }}
          admin={{ name: admin.name, email: admin.email }}
          contracts={customer.contracts}
          initialFlow={flags.contractFlow}
          selectedContractId={flags.contractId}
        />
      </div>

      <div data-customer-tab-panel="invoices" hidden={activeTab !== "invoices"}>
        <InvoiceManager
          customerId={customer.id}
          invoices={customer.invoices}
          projects={customer.projects.map((project) => ({
            id: project.id,
            title: project.title,
            eventDate: project.eventDate
          }))}
        />
      </div>

      <div data-customer-tab-panel="communication" hidden={activeTab !== "communication"}>
        <section className="rounded-md border border-ink/10 bg-white p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-graphite/65">
            <MessageSquare size={15} />
            {copy.communication.eyebrow}
          </div>
          <h2 className="mt-2 text-base font-semibold text-ink">{copy.communication.title}</h2>
          <p className="mt-1 text-sm leading-6 text-graphite/70">
            {copy.communication.description}
          </p>

          {communicationEvents.length === 0 ? (
            <div className="mt-5 rounded-md bg-paper px-4 py-4">
              <p className="text-sm font-medium text-ink">{copy.communication.emptyTitle}</p>
              <p className="mt-1 text-sm text-graphite/70">{copy.communication.emptyDescription}</p>
            </div>
          ) : (
            <div className="mt-5 divide-y divide-ink/10 rounded-md border border-ink/10">
              {communicationEvents.map((event) => {
                const content = (
                  <>
                    <div>
                      <p className="font-medium text-ink">{event.title}</p>
                      <p className="mt-1 text-sm text-graphite/70">{event.detail}</p>
                    </div>
                    <p className="text-sm text-graphite/60">{formatDateTime(event.date, language)}</p>
                  </>
                );

                return event.href ? (
                  <Link key={`${event.title}-${event.date.toISOString()}`} href={event.href} className="grid gap-2 px-4 py-4 transition hover:bg-ink/[0.03] sm:grid-cols-[1fr_auto] sm:items-center">
                    {content}
                  </Link>
                ) : (
                  <div key={`${event.title}-${event.date.toISOString()}`} className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div data-customer-tab-panel="portal" hidden={activeTab !== "portal"}>
        <CustomerPortalManager customer={customer} portalUrl={portalUrl} />
      </div>

      <div data-customer-tab-panel="details" hidden={activeTab !== "details"}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div>{isEditing ? <CustomerForm customer={customer} /> : <CustomerProfileCard customer={customer} statusLabel={statusLabel} />}</div>
          <aside className="space-y-6">
            <section className="rounded-md border border-ink/10 bg-white p-5">
              <h2 className="text-base font-semibold text-ink">{copy.details.quickData}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-graphite/60">{copy.details.type}</dt>
                  <dd className="font-medium text-ink">{typeLabel}</dd>
                </div>
                <div>
                  <dt className="text-graphite/60">{copy.details.primaryEmail}</dt>
                  <dd className="font-medium text-ink">{customer.primaryEmail}</dd>
                </div>
                <div>
                  <dt className="text-graphite/60">{copy.details.secondaryEmail}</dt>
                  <dd className="font-medium text-ink">{customer.secondaryEmail || copy.common.notProvided}</dd>
                </div>
                <div>
                  <dt className="text-graphite/60">{copy.details.phone}</dt>
                  <dd className="font-medium text-ink">{customer.phone || copy.common.notProvided}</dd>
                </div>
                <div>
                  <dt className="text-graphite/60">{copy.details.venue}</dt>
                  <dd className="font-medium text-ink">{customer.venue || copy.common.notProvided}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-md border border-red-200 bg-white p-5">
              <h2 className="text-base font-semibold text-ink">{copy.details.dangerZone}</h2>
              <p className="mt-2 text-sm leading-6 text-graphite/70">
                {copy.details.dangerDescription}
              </p>
              <form action={deleteCustomerAction.bind(null, customer.id)} className="mt-4">
                <ConfirmSubmitButton
                  variant="danger"
                  message={copy.details.deleteConfirm(customer.coupleName)}
                  className="w-full"
                >
                  <Trash2 size={16} />
                  {copy.details.deleteClient}
                </ConfirmSubmitButton>
              </form>
            </section>
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}
