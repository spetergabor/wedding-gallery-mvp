import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarClock,
  Camera,
  CheckCircle2,
  Clock3,
  FileText,
  Film,
  FolderKanban,
  Heart,
  ImagePlus,
  ListChecks,
  Mail,
  MessageSquare,
  ReceiptText
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { ButtonLink } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { LeadPipelineBoard } from "@/components/lead-pipeline-board";
import { ViewLocationMap } from "@/components/view-location-map";
import { adminOwnedWhere, notificationWhere } from "@/lib/admin-scope";
import { dateLocaleForAdmin, getAdminLanguage, type AdminLanguage } from "@/lib/admin-language";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createViewLocationPoints } from "@/lib/view-location-points";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { customerProjectStatusLabel, customerProjectTypeLabel } from "@/lib/customer-project-options";
import { ensureLeadPipelineSchema, normalizeLeadStatus } from "@/lib/leads";
import {
  GALLERY_MODE_PROOFING,
  PHOTO_DELIVERY_STAGE_FINAL,
  PROOFING_STATUS_DELIVERED,
  PROOFING_STATUS_IN_PROGRESS,
  PROOFING_STATUS_NOT_OPENED,
  PROOFING_STATUS_PROCESSING,
  PROOFING_STATUS_SUBMITTED,
  proofingStatusLabel
} from "@/lib/proofing";

type DashboardTaskPriority = "high" | "medium" | "low";

type DashboardTask = {
  key: string;
  title: string;
  detail: string;
  href: string;
  label: string;
  priority: DashboardTaskPriority;
  icon: LucideIcon;
  createdAt: Date;
};

type DashboardStat = {
  label: string;
  value: string | number;
  detail: string;
};

const sectionMetaClass = "flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-brass";
const sectionTitleClass = "text-base font-semibold text-ink";

function formatStorageSize(bytes: number) {
  if (bytes <= 0) {
    return "0 MB";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function formatDate(date: Date | null, language: AdminLanguage) {
  if (!date) {
    return language === "de" ? "Kein Datum" : "Nincs dátum";
  }

  return date.toLocaleDateString(dateLocaleForAdmin(language), {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function taskPriorityClass(priority: DashboardTaskPriority) {
  if (priority === "high") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (priority === "medium") {
    return "bg-brass/10 text-brass ring-brass/25";
  }

  return "bg-ink/[0.05] text-graphite ring-ink/10";
}

function taskIconClass(priority: DashboardTaskPriority) {
  if (priority === "high") {
    return "bg-red-50 text-red-700";
  }

  if (priority === "medium") {
    return "bg-brass/10 text-brass";
  }

  return "bg-paper text-graphite";
}

function sortDashboardTasks(tasks: DashboardTask[]) {
  const priorityWeight: Record<DashboardTaskPriority, number> = {
    high: 0,
    medium: 1,
    low: 2
  };

  return tasks.sort((left, right) => {
    const priorityDelta = priorityWeight[left.priority] - priorityWeight[right.priority];

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`rounded-md border border-brass/15 bg-white px-3 py-3 shadow-[0_1px_0_rgba(178,139,78,0.08)] transition hover:border-brass/30 sm:p-4 ${
            index === stats.length - 1 ? "col-span-2 md:col-span-1" : ""
          }`}
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-graphite/65 sm:text-xs sm:tracking-[0.16em]">
            {stat.label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold leading-tight text-ink sm:mt-2">{stat.value}</p>
          <div className="mt-2 h-0.5 w-8 rounded-full bg-brass/45" />
          <p className="mt-1 hidden text-sm text-graphite/75 sm:block">{stat.detail}</p>
        </div>
      ))}
    </div>
  );
}

const DASHBOARD_COPY = {
  hu: {
    area: "Admin",
    title: "Dashboard",
    intro: "Áttekintés a galériákról, ügyfélfolyamatokról és a következő fontos lépésekről.",
    newClient: "Új ügyfél",
    newGallery: "Új galéria",
    stats: {
      galleries: ["Galériák", "Összes létrehozott galéria"],
      active: ["Aktív", "Publikusan elérhető galériák"],
      media: ["Médiák", "Adatbázisban rögzített képek és videók"],
      storage: ["R2 tárhely", "Feltöltött médiák összmérete"],
      notifications: ["Új értesítések", "Olvasatlan admin jelzések"]
    },
    tasks: {
      deliverFinal: "Kész képek átadása",
      uploadFinal: "Kész képek feltöltése",
      finalReady: (name: string) => `${name}: van kész anyag, az átadás email vár kiküldésre.`,
      finalMissing: (name: string, status: string) => `${name}: ${status.toLowerCase()}, a kidolgozott képek még hiányoznak.`,
      waitingDelivery: "Átadásra vár",
      processing: "Feldolgozás",
      sendDeliveryEmail: "Átadás email kiküldése",
      deliveryEmailMissing: (name: string) => `${name}: a kész képek átadva státuszban vannak, de az email még nincs kiküldve.`,
      emailMissing: "Email hiányzik",
      sendProofingInvite: "Válogató link kiküldése",
      noClientEmail: "nincs ügyfél email",
      inviteDetail: (name: string, count: number, email: string) => `${name}: ${count} kép feltöltve, címzett: ${email}.`,
      waitingSend: "Küldésre vár",
      contractWaiting: "Szerződés aláírásra vár",
      waitingClient: "Ügyfélre vár",
      sendInvoice: "Számla kiküldése",
      overdueInvoice: "Lejárt nyitott számla",
      followInvoice: "Nyitott számla követése",
      overdue: "Lejárt",
      open: "Nyitott",
      due: "határidő",
      answerAlbumComment: "Album megjegyzés megválaszolása",
      albumReview: "Album ellenőrző",
      fixPreview: "Előnézet feldolgozás javítása",
      brokenPreview: "Hibás előnézet",
      fixZip: "ZIP előkészítés javítása",
      zipFallback: "a letöltési csomag beragadt vagy hibás.",
      stuck: "Beragadt",
      brokenZip: "Hibás ZIP"
    },
    focusEyebrow: "Mai fókusz",
    focusTitle: "Teendőközpont",
    focusDescription: "A legfontosabb ügyfél-, galéria- és háttérfolyamatok egy gyors listában.",
    urgent: "sürgős",
    noUrgentTitle: "Nincs sürgős admin teendő",
    noUrgentDescription: "A problémás feldolgozások, leadott válogatások és várakozó ügyfélfolyamatok itt jelennek meg, ha érkeznek.",
    projectsEyebrow: "Projektek",
    projectsTitle: "Következő projektek",
    openClients: "Ügyfelek megnyitása",
    noUpcomingTitle: "Nincs közelgő projekt",
    noUpcomingDescription: "Az ügyfél adatlapján létrehozott jövőbeli projektek itt jelennek majd meg időrendben.",
    gallery: "galéria",
    notificationsTitle: "Értesítések",
    all: "Összes",
    noNotificationsTitle: "Még nincs értesítés",
    noNotificationsDescription: "Egyelőre nincs nyitott üzenet vagy figyelmeztetés.",
    latestGalleriesTitle: "Legutóbbi galériák",
    media: "média",
    active: "Aktív",
    inactive: "Inaktív",
    noGalleriesTitle: "Még nincs galéria",
    noGalleriesDescription: "A frissen létrehozott galériáid itt fognak megjelenni."
  },
  de: {
    area: "Admin",
    title: "Dashboard",
    intro: "Überblick über Galerien, Kundenprozesse und die nächsten wichtigen Schritte.",
    newClient: "Neuer Kunde",
    newGallery: "Neue Galerie",
    stats: {
      galleries: ["Galerien", "Alle angelegten Galerien"],
      active: ["Aktiv", "Öffentlich erreichbare Galerien"],
      media: ["Medien", "Bilder und Videos in der Datenbank"],
      storage: ["R2 Speicher", "Gesamtgröße der hochgeladenen Medien"],
      notifications: ["Neue Hinweise", "Ungelesene Admin-Hinweise"]
    },
    tasks: {
      deliverFinal: "Fertige Bilder übergeben",
      uploadFinal: "Fertige Bilder hochladen",
      finalReady: (name: string) => `${name}: fertiges Material ist vorhanden, die Übergabe-E-Mail wartet noch.`,
      finalMissing: (name: string, status: string) => `${name}: ${status.toLowerCase()}, die fertig bearbeiteten Bilder fehlen noch.`,
      waitingDelivery: "Wartet auf Übergabe",
      processing: "In Bearbeitung",
      sendDeliveryEmail: "Übergabe-E-Mail senden",
      deliveryEmailMissing: (name: string) => `${name}: die fertigen Bilder sind übergeben, aber die E-Mail wurde noch nicht gesendet.`,
      emailMissing: "E-Mail fehlt",
      sendProofingInvite: "Auswahllink senden",
      noClientEmail: "keine Kunden-E-Mail",
      inviteDetail: (name: string, count: number, email: string) => `${name}: ${count} Bilder hochgeladen, Empfänger: ${email}.`,
      waitingSend: "Wartet auf Versand",
      contractWaiting: "Vertrag wartet auf Signatur",
      waitingClient: "Wartet auf Kunde",
      sendInvoice: "Rechnung senden",
      overdueInvoice: "Offene Rechnung überfällig",
      followInvoice: "Offene Rechnung verfolgen",
      overdue: "Überfällig",
      open: "Offen",
      due: "fällig",
      answerAlbumComment: "Albumkommentar beantworten",
      albumReview: "Albumfreigabe",
      fixPreview: "Vorschau-Verarbeitung prüfen",
      brokenPreview: "Vorschau fehlerhaft",
      fixZip: "ZIP-Vorbereitung prüfen",
      zipFallback: "das Download-Paket hängt oder ist fehlerhaft.",
      stuck: "Hängt",
      brokenZip: "ZIP fehlerhaft"
    },
    focusEyebrow: "Heute im Fokus",
    focusTitle: "Aufgabenzentrale",
    focusDescription: "Die wichtigsten Kunden-, Galerie- und Hintergrundprozesse in einer schnellen Liste.",
    urgent: "dringend",
    noUrgentTitle: "Keine dringenden Admin-Aufgaben",
    noUrgentDescription: "Problematische Verarbeitungen, abgegebene Auswahlen und wartende Kundenprozesse erscheinen hier.",
    projectsEyebrow: "Projekte",
    projectsTitle: "Nächste Projekte",
    openClients: "Kunden öffnen",
    noUpcomingTitle: "Keine anstehenden Projekte",
    noUpcomingDescription: "Zukünftige Projekte aus den Kundendaten erscheinen hier chronologisch.",
    gallery: "Galerie",
    notificationsTitle: "Benachrichtigungen",
    all: "Alle",
    noNotificationsTitle: "Noch keine Benachrichtigungen",
    noNotificationsDescription: "Aktuell gibt es keine offenen Nachrichten oder Hinweise.",
    latestGalleriesTitle: "Letzte Galerien",
    media: "Medien",
    active: "Aktiv",
    inactive: "Inaktiv",
    noGalleriesTitle: "Noch keine Galerie",
    noGalleriesDescription: "Frisch angelegte Galerien erscheinen hier."
  }
} as const;

function isSupersededDownloadPackageMessage(message: string | null | undefined) {
  return message?.toLowerCase().includes("superseded by") ?? false;
}

export default async function AdminDashboardPage() {
  const [admin, language] = await Promise.all([requireAdmin(), getAdminLanguage()]);
  const copy = DASHBOARD_COPY[language];
  await ensureLeadPipelineSchema(prisma);
  const galleryWhere = adminOwnedWhere(admin);
  const photoWhere = { gallery: adminOwnedWhere(admin) };
  const projectWhere = { customer: adminOwnedWhere(admin) };
  const adminNotificationWhere = notificationWhere(admin);
  const today = startOfToday();
  const staleZipCutoff = new Date(Date.now() - 15 * 60 * 1000);
  const contractWhere = { customer: adminOwnedWhere(admin) };
  const invoiceWhere = { customer: adminOwnedWhere(admin) };
  const albumCommentWhere = { spread: { review: { customer: adminOwnedWhere(admin) } } };
  const downloadPackageWhere = { gallery: adminOwnedWhere(admin) };

  const [
    galleryCount,
    activeCount,
    photoCount,
    photoStorage,
    unreadNotifications,
    latestNotifications,
    upcomingProjects,
    proofingInviteGalleries,
    submittedProofingGalleries,
    finishedProofingGalleries,
    waitingContracts,
    openInvoices,
    openAlbumComments,
    failedProcessingPhotos,
    problemZipPackages,
    latestGalleries,
    viewLocations,
    leads
  ] = await Promise.all([
    prisma.gallery.count({ where: galleryWhere }),
    prisma.gallery.count({ where: { ...galleryWhere, isActive: true } }),
    prisma.photo.count({ where: photoWhere }),
    prisma.photo.aggregate({ where: photoWhere, _sum: { fileSize: true } }),
    prisma.adminNotification.count({ where: { ...adminNotificationWhere, readAt: null } }),
    prisma.adminNotification.findMany({
      where: adminNotificationWhere,
      orderBy: { createdAt: "desc" },
      take: 4
    }),
    prisma.customerProject.findMany({
      where: {
        ...projectWhere,
        eventDate: { gte: today },
        status: { not: "archived" }
      },
      orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
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
    }),
    prisma.gallery.findMany({
      where: {
        ...galleryWhere,
        galleryMode: GALLERY_MODE_PROOFING,
        proofingStatus: { in: [PROOFING_STATUS_NOT_OPENED, PROOFING_STATUS_IN_PROGRESS] },
        proofingInviteSentAt: null,
        photos: { some: {} }
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
          }
        },
        _count: {
          select: {
            photos: true
          }
        }
      }
    }),
    prisma.gallery.findMany({
      where: {
        ...galleryWhere,
        galleryMode: GALLERY_MODE_PROOFING,
        proofingStatus: { in: [PROOFING_STATUS_SUBMITTED, PROOFING_STATUS_PROCESSING] }
      },
      orderBy: [{ proofingStatusUpdatedAt: "desc" }, { updatedAt: "desc" }],
      take: 6,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
          }
        },
        photos: {
          where: { deliveryStage: PHOTO_DELIVERY_STAGE_FINAL },
          select: { id: true },
          take: 1
        }
      }
    }),
    prisma.gallery.findMany({
      where: {
        ...galleryWhere,
        galleryMode: GALLERY_MODE_PROOFING,
        proofingStatus: PROOFING_STATUS_DELIVERED,
        finalDeliveryEmailSentAt: null
      },
      orderBy: [{ proofingStatusUpdatedAt: "desc" }, { updatedAt: "desc" }],
      take: 6,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
          }
        }
      }
    }),
    prisma.contract.findMany({
      where: {
        ...contractWhere,
        sentAt: { not: null },
        signedAt: null
      },
      orderBy: [{ sentAt: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
          }
        }
      }
    }),
    prisma.customerInvoice.findMany({
      where: {
        ...invoiceWhere,
        status: { not: "paid" }
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 8,
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            primaryEmail: true
          }
        },
        project: {
          select: {
            title: true
          }
        }
      }
    }),
    prisma.albumReviewComment.findMany({
      where: {
        ...albumCommentWhere,
        status: "open"
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        spread: {
          select: {
            title: true,
            review: {
              select: {
                id: true,
                title: true,
                customer: {
                  select: {
                    id: true,
                    coupleName: true
                  }
                }
              }
            }
          }
        }
      }
    }),
    prisma.photo.findMany({
      where: {
        ...photoWhere,
        OR: [{ processingStatus: "failed" }, { processingError: { not: null } }]
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        gallery: {
          select: {
            id: true,
            title: true
          }
        }
      }
    }),
    prisma.galleryDownloadPackage.findMany({
      where: {
        ...downloadPackageWhere,
        OR: [
          {
            status: "failed",
            NOT: {
              errorMessage: {
                startsWith: "Superseded by"
              }
            }
          },
          { status: "processing", updatedAt: { lt: staleZipCutoff } }
        ]
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
      include: {
        gallery: {
          select: {
            id: true,
            title: true
          }
        }
      }
    }),
    prisma.gallery.findMany({
      where: galleryWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        _count: { select: { photos: true } },
        photos: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, imageUrl: true, thumbnailUrl: true, filename: true, mediaType: true }
        }
      }
    }),
    prisma.galleryView.findMany({
      where: { gallery: adminOwnedWhere(admin) },
      select: {
        city: true,
        country: true,
        latitude: true,
        longitude: true
      }
    }),
    prisma.lead.findMany({
      where: adminOwnedWhere(admin),
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        eventType: true,
        eventDate: true,
        venue: true,
        notes: true,
        status: true,
        sortOrder: true
      }
    })
  ]);
  const locationPoints = createViewLocationPoints(viewLocations);
  const totalStorageBytes = photoStorage._sum.fileSize ?? 0;
  const seenZipGalleryIds = new Set<string>();
  const actionableZipPackages = problemZipPackages.filter((downloadPackage) => {
    if (isSupersededDownloadPackageMessage(downloadPackage.errorMessage)) {
      return false;
    }

    if (seenZipGalleryIds.has(downloadPackage.galleryId)) {
      return false;
    }

    seenZipGalleryIds.add(downloadPackage.galleryId);
    return true;
  });
  const dashboardTasks = sortDashboardTasks([
    ...submittedProofingGalleries.map((gallery): DashboardTask => {
      const hasFinalPhotos = gallery.photos.length > 0;
      const customerName = gallery.customer?.coupleName ?? gallery.title;

      return {
        key: `proofing-${gallery.id}`,
        title: hasFinalPhotos ? copy.tasks.deliverFinal : copy.tasks.uploadFinal,
        detail: hasFinalPhotos
          ? copy.tasks.finalReady(customerName)
          : copy.tasks.finalMissing(customerName, proofingStatusLabel(gallery.proofingStatus)),
        href: `/admin/galleries/${gallery.id}?tab=client`,
        label: hasFinalPhotos ? copy.tasks.waitingDelivery : copy.tasks.processing,
        priority: "high",
        icon: hasFinalPhotos ? CheckCircle2 : ImagePlus,
        createdAt: gallery.proofingStatusUpdatedAt ?? gallery.updatedAt
      };
    }),
    ...finishedProofingGalleries.map((gallery): DashboardTask => {
      const customerName = gallery.customer?.coupleName ?? gallery.title;

      return {
        key: `finished-proofing-${gallery.id}`,
        title: copy.tasks.sendDeliveryEmail,
        detail: copy.tasks.deliveryEmailMissing(customerName),
        href: `/admin/galleries/${gallery.id}?tab=client`,
        label: copy.tasks.emailMissing,
        priority: "high",
        icon: Mail,
        createdAt: gallery.proofingStatusUpdatedAt ?? gallery.updatedAt
      };
    }),
    ...proofingInviteGalleries.map((gallery): DashboardTask => {
      const customerName = gallery.customer?.coupleName ?? gallery.title;
      const emailText = gallery.customer?.primaryEmail ?? gallery.clientEmail ?? copy.tasks.noClientEmail;

      return {
        key: `invite-${gallery.id}`,
        title: copy.tasks.sendProofingInvite,
        detail: copy.tasks.inviteDetail(customerName, gallery._count.photos, emailText),
        href: `/admin/galleries/${gallery.id}?tab=client`,
        label: copy.tasks.waitingSend,
        priority: "medium",
        icon: Heart,
        createdAt: gallery.createdAt
      };
    }),
    ...waitingContracts.map((contract): DashboardTask => ({
      key: `contract-${contract.id}`,
      title: copy.tasks.contractWaiting,
      detail: `${contract.customer.coupleName}: ${contract.title}`,
      href: `/admin/clients/${contract.customer.id}?tab=contracts`,
      label: copy.tasks.waitingClient,
      priority: "medium",
      icon: FileText,
      createdAt: contract.sentAt ?? contract.createdAt
    })),
    ...openInvoices.map((invoice): DashboardTask => {
      const isOverdue = Boolean(invoice.dueDate && invoice.dueDate.getTime() < today.getTime());
      const isUnsent = !invoice.sentAt;
      const title = isUnsent ? copy.tasks.sendInvoice : isOverdue ? copy.tasks.overdueInvoice : copy.tasks.followInvoice;
      const label = isUnsent ? copy.tasks.waitingSend : isOverdue ? copy.tasks.overdue : copy.tasks.open;
      const projectText = invoice.project ? ` · ${invoice.project.title}` : "";
      const dueText = invoice.dueDate ? ` · ${copy.tasks.due}: ${formatDate(invoice.dueDate, language)}` : "";

      return {
        key: `invoice-${invoice.id}`,
        title,
        detail: `${invoice.customer.coupleName}${projectText}: ${invoice.title}${dueText}`,
        href: `/admin/clients/${invoice.customer.id}?tab=invoices`,
        label,
        priority: isUnsent || isOverdue ? "high" : "medium",
        icon: ReceiptText,
        createdAt: invoice.sentAt ?? invoice.createdAt
      };
    }),
    ...openAlbumComments.map((comment): DashboardTask => ({
      key: `album-comment-${comment.id}`,
      title: copy.tasks.answerAlbumComment,
      detail: `${comment.spread.review.customer.coupleName}: ${comment.text}`,
      href: `/admin/clients/${comment.spread.review.customer.id}?tab=album`,
      label: copy.tasks.albumReview,
      priority: "medium",
      icon: MessageSquare,
      createdAt: comment.createdAt
    })),
    ...failedProcessingPhotos.map((photo): DashboardTask => ({
      key: `processing-${photo.id}`,
      title: copy.tasks.fixPreview,
      detail: `${photo.gallery.title}: ${photo.filename}`,
      href: `/admin/galleries/${photo.gallery.id}?tab=photos`,
      label: copy.tasks.brokenPreview,
      priority: "high",
      icon: AlertCircle,
      createdAt: photo.createdAt
    })),
    ...actionableZipPackages.map((downloadPackage): DashboardTask => ({
      key: `zip-${downloadPackage.id}`,
      title: copy.tasks.fixZip,
      detail: `${downloadPackage.gallery.title}: ${downloadPackage.errorMessage ?? copy.tasks.zipFallback}`,
      href: `/admin/galleries/${downloadPackage.gallery.id}?tab=downloads`,
      label: downloadPackage.status === "processing" ? copy.tasks.stuck : copy.tasks.brokenZip,
      priority: "high",
      icon: AlertCircle,
      createdAt: downloadPackage.updatedAt
    }))
  ]).slice(0, 8);
  const urgentTaskCount = dashboardTasks.filter((task) => task.priority === "high").length;

  return (
    <AdminShell>
      <div className="mb-5 rounded-md border border-brass/15 bg-white px-4 py-4 shadow-[0_1px_0_rgba(178,139,78,0.08)] md:mb-8 md:px-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className={sectionMetaClass}>{copy.area}</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{copy.title}</h1>
          <p className="mt-2 max-w-xl text-sm text-graphite/70">
            {copy.intro}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <ButtonLink href="/admin/clients/new" variant="secondary" className="h-10 px-3 md:h-11 md:px-4">
            {copy.newClient}
          </ButtonLink>
          <ButtonLink href="/admin/galleries/new" className="h-10 px-3 md:h-11 md:px-4">
            {copy.newGallery}
          </ButtonLink>
        </div>
        </div>
      </div>

      <DashboardStats
        stats={[
          { label: copy.stats.galleries[0], value: galleryCount, detail: copy.stats.galleries[1] },
          { label: copy.stats.active[0], value: activeCount, detail: copy.stats.active[1] },
          { label: copy.stats.media[0], value: photoCount, detail: copy.stats.media[1] },
          { label: copy.stats.storage[0], value: formatStorageSize(totalStorageBytes), detail: copy.stats.storage[1] },
          { label: copy.stats.notifications[0], value: unreadNotifications, detail: copy.stats.notifications[1] }
        ]}
      />

      <LeadPipelineBoard
        language={language}
        initialLeads={leads.map((lead) => ({
          ...lead,
          eventDate: lead.eventDate?.toISOString() ?? null,
          status: normalizeLeadStatus(lead.status)
        }))}
      />

      <div className="mt-5 grid gap-6 md:mt-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <section className="rounded-md border border-brass/20 bg-white shadow-[0_1px_0_rgba(178,139,78,0.08)]">
          <div className="flex flex-col justify-between gap-3 border-b border-brass/15 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <div className={sectionMetaClass}>
                <ListChecks size={15} />
                {copy.focusEyebrow}
              </div>
              <h2 className={`mt-2 ${sectionTitleClass}`}>{copy.focusTitle}</h2>
              <p className="mt-1 text-sm text-graphite/70">
                {copy.focusDescription}
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brass/10 px-3 py-1.5 text-sm font-medium text-brass">
              <Clock3 size={15} />
              {urgentTaskCount} {copy.urgent}
            </span>
          </div>

          {dashboardTasks.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<CheckCircle2 size={18} className="text-ink" />}
                title={copy.noUrgentTitle}
                description={copy.noUrgentDescription}
              />
            </div>
          ) : (
            <div className="divide-y divide-ink/10">
              {dashboardTasks.map((task) => {
                const Icon = task.icon;

                return (
                  <Link
                    key={task.key}
                    href={task.href}
                    className="group flex items-start gap-4 px-5 py-4 transition hover:bg-brass/[0.04]"
                  >
                    <span className={`mt-1 flex size-10 shrink-0 items-center justify-center rounded-md ${taskIconClass(task.priority)}`}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{task.title}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${taskPriorityClass(task.priority)}`}>
                          {task.label}
                        </span>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-sm text-graphite/70">{task.detail}</span>
                    </span>
                    <ArrowRight size={18} className="mt-2 shrink-0 text-graphite/35 transition group-hover:translate-x-0.5 group-hover:text-brass" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-md border border-brass/20 bg-white shadow-[0_1px_0_rgba(178,139,78,0.08)]">
          <div className="flex flex-col justify-between gap-3 border-b border-brass/15 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <div className={sectionMetaClass}>
                <FolderKanban size={15} />
                {copy.projectsEyebrow}
              </div>
              <h2 className={`mt-2 ${sectionTitleClass}`}>{copy.projectsTitle}</h2>
            </div>
            <ButtonLink href="/admin/clients" variant="secondary" className="h-10">
              {copy.openClients}
            </ButtonLink>
          </div>

          {upcomingProjects.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<FolderKanban size={18} className="text-ink" />}
                title={copy.noUpcomingTitle}
                description={copy.noUpcomingDescription}
              />
            </div>
          ) : (
            <div className="grid gap-3 p-5">
              {upcomingProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/admin/clients/${project.customer.id}?tab=projects`}
                  className="rounded-md border border-ink/10 bg-paper p-4 transition hover:border-brass/35 hover:bg-brass/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-ink">{project.title}</p>
                      <p className="mt-1 truncate text-sm text-graphite/70">{project.customer.coupleName}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                      {customerProjectStatusLabel(project.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-graphite/75 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock size={14} />
                      {formatDate(project.eventDate, language)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Camera size={14} />
                      {project._count.galleries} {copy.gallery}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-graphite">
                      {customerProjectTypeLabel(project.projectType)}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-graphite">
                      {project.customer.primaryEmail}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <section className="rounded-md border border-ink/12 bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-ink/10 px-5 py-4">
            <h2 className={sectionTitleClass}>{copy.notificationsTitle}</h2>
            <Link href="/admin/notifications" className="text-sm font-medium text-ink hover:underline">
              {copy.all}
            </Link>
          </div>
          <div className="divide-y divide-ink/10">
            {latestNotifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.href ?? "/admin/notifications"}
                className="flex items-start gap-4 px-5 py-4 hover:bg-ink/[0.03]"
              >
                <span className={`mt-1 flex size-9 shrink-0 items-center justify-center rounded-md ${notification.readAt ? "bg-paper text-graphite" : "bg-brass/15 text-brass"}`}>
                  <Bell size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{notification.title}</span>
                  <span className="mt-1 block text-sm text-graphite/70">{notification.message}</span>
                  <span className="mt-2 block text-xs text-graphite/60">
                    {notification.createdAt.toLocaleString(dateLocaleForAdmin(language), {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: APP_TIME_ZONE
                    })}
                  </span>
                </span>
              </Link>
            ))}
            {latestNotifications.length === 0 ? (
              <div className="px-5 py-4">
                <EmptyState
                  icon={<Bell size={18} className="text-ink" />}
                  title={copy.noNotificationsTitle}
                  description={copy.noNotificationsDescription}
                />
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-md border border-ink/12 bg-white">
          <div className="border-b border-ink/10 px-5 py-4">
            <h2 className={sectionTitleClass}>{copy.latestGalleriesTitle}</h2>
          </div>
          <div className="divide-y divide-ink/10">
            {latestGalleries.map((gallery) => (
              <a
                key={gallery.id}
                href={`/admin/galleries/${gallery.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-ink/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-paper">
                    {(() => {
                      const cover =
                        gallery.photos.find((photo) => photo.id === gallery.coverPhotoId && photo.thumbnailUrl !== photo.imageUrl) ??
                        gallery.photos.find((photo) => photo.thumbnailUrl !== photo.imageUrl);

                      return cover ? (
                        cover.mediaType === "video" ? (
                          <div className="grid h-full place-items-center bg-ink text-white">
                            <Film size={18} />
                          </div>
                        ) : (
                          <Image
                            src={cover.thumbnailUrl}
                            alt={cover.filename}
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="56px"
                            style={{ objectPosition: `${gallery.coverPositionX ?? 50}% ${gallery.coverPositionY ?? 50}%` }}
                          />
                        )
                      ) : (
                        <div className="flex h-full items-center justify-center text-graphite/50">
                          <Camera size={18} />
                        </div>
                      );
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{gallery.title}</p>
                    <p className="truncate text-sm text-graphite/70">/g/{gallery.slug}</p>
                  </div>
                </div>
                <div className="text-right text-sm text-graphite/70">
                  <p>{gallery._count.photos} {copy.media}</p>
                  <p>{gallery.isActive ? copy.active : copy.inactive}</p>
                </div>
              </a>
            ))}
            {latestGalleries.length === 0 ? (
              <div className="px-5 pb-4">
                <EmptyState
                  icon={<Camera size={18} className="text-ink" />}
                  title={copy.noGalleriesTitle}
                  description={copy.noGalleriesDescription}
                />
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <ViewLocationMap points={locationPoints} />
    </AdminShell>
  );
}
