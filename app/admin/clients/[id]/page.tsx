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
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ContractManager } from "@/components/contract-manager";
import { CustomerForm, CustomerProfileCard } from "@/components/customer-form";
import { CustomerProjectManager } from "@/components/customer-project-manager";
import { CustomerTabController } from "@/components/customer-tab-controller";
import { DismissibleNextAction } from "@/components/dismissible-next-action";
import { InvoiceManager } from "@/components/invoice-manager";
import { requireAdmin } from "@/lib/auth";
import { customerAccessWhere } from "@/lib/admin-scope";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { customerProjectStatusLabel, customerProjectTypeLabel } from "@/lib/customer-project-options";
import { CUSTOMER_STATUSES, customerStatusLabel, customerTypeLabel, normalizeCustomerStatus } from "@/lib/customer-options";
import { getCustomerWorkflowSummary } from "@/lib/customer-workflow";
import { deleteCustomerAction, updateCustomerStatusAction } from "@/lib/customer-actions";
import { prisma } from "@/lib/prisma";
import {
  GALLERY_MODE_PROOFING,
  PHOTO_DELIVERY_STAGE_FINAL,
  PROOFING_STATUS_PROCESSING,
  PROOFING_STATUS_SUBMITTED,
  proofingStatusLabel
} from "@/lib/proofing";

function formatDate(date: Date | null) {
  if (!date) {
    return "Nincs dátum megadva";
  }

  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

function formatDateTime(date: Date | null) {
  if (!date) {
    return null;
  }

  return date.toLocaleString("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE
  });
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
  venue: string | null;
  createdAt: Date;
  _count: {
    galleries: number;
    contracts: number;
    invoices: number;
    albumReviews: number;
    albumDesigns: number;
  };
};

type CustomerTab = "overview" | "projects" | "galleries" | "proofing" | "album" | "contracts" | "invoices" | "communication" | "details";
type AlbumMode = "editor" | "upload";

const customerTabs: Array<{
  key: CustomerTab;
  label: string;
  icon: "CheckCircle2" | "FolderKanban" | "Camera" | "Heart" | "ImagePlus" | "FileText" | "ReceiptText" | "MessageSquare" | "Settings";
}> = [
  { key: "overview", label: "Áttekintés", icon: "CheckCircle2" },
  { key: "projects", label: "Projektek", icon: "FolderKanban" },
  { key: "galleries", label: "Galériák", icon: "Camera" },
  { key: "proofing", label: "Válogatás", icon: "Heart" },
  { key: "album", label: "Album", icon: "ImagePlus" },
  { key: "contracts", label: "Szerződések", icon: "FileText" },
  { key: "invoices", label: "Számlák", icon: "ReceiptText" },
  { key: "communication", label: "Kommunikáció", icon: "MessageSquare" },
  { key: "details", label: "Adatok", icon: "Settings" }
];

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
};

function createCustomerTasks(customer: CustomerWorkflowInput, nextAction: ReturnType<typeof getCustomerWorkflowSummary>) {
  const latestGallery = customer.galleries[0] ?? null;
  const activeProofingGallery = customer.galleries.find(
    (gallery) => gallery.galleryMode === GALLERY_MODE_PROOFING && ["not_opened", "in_progress", "submitted", "processing"].includes(gallery.proofingStatus)
  );
  const contract = customer.contracts[0] ?? null;
  const openInvoice = customer.invoices.find((invoice) => invoice.status !== "paid") ?? null;
  const tasks: CustomerTask[] = [
    {
      title: "Ügyfél email",
      detail: customer.primaryEmail ? customer.primaryEmail : "Hiányzik az elsődleges email cím",
      state: customer.primaryEmail ? "done" : "action",
      href: customer.primaryEmail ? undefined : `/admin/clients/${customer.id}?edit=1`
    }
  ];

  if (!latestGallery) {
    tasks.push({
      title: "Galéria",
      detail: "Még nincs galéria ehhez az ügyfélhez.",
      state: "action",
      href: `/admin/galleries/new?customerId=${customer.id}`
    });
  } else {
    tasks.push({
      title: "Galéria",
      detail: `${latestGallery.title} · ${latestGallery._count.photos} média`,
      state: latestGallery._count.photos > 0 ? "done" : "action",
      href: `/admin/galleries/${latestGallery.id}?tab=photos`
    });
  }

  if (activeProofingGallery) {
    const hasFinalPhotos = activeProofingGallery.photos.length > 0;

    tasks.push({
      title: "Válogató link",
      detail: activeProofingGallery.proofingInviteSentAt ? "Kiküldve az ügyfélnek." : "Még nincs kiküldve.",
      state: activeProofingGallery.proofingInviteSentAt ? "done" : "action",
      href: `/admin/galleries/${activeProofingGallery.id}?tab=client`
    });
    tasks.push({
      title: "Ügyfél válogatás",
      detail: proofingStatusLabel(activeProofingGallery.proofingStatus),
      state:
        activeProofingGallery.proofingStatus === PROOFING_STATUS_SUBMITTED ||
        activeProofingGallery.proofingStatus === PROOFING_STATUS_PROCESSING
          ? "done"
          : "waiting",
      href: `/admin/galleries/${activeProofingGallery.id}?tab=client`
    });
    tasks.push({
      title: "Kész képek",
      detail: hasFinalPhotos ? "Van feltöltött kész anyag." : "Még nincs kész kép feltöltve.",
      state: hasFinalPhotos ? "done" : activeProofingGallery.proofingStatus === PROOFING_STATUS_SUBMITTED ? "action" : "info",
      href: `/admin/galleries/${activeProofingGallery.id}?tab=client`
    });
  }

  if (contract) {
    tasks.push({
      title: "Szerződés",
      detail: contract.signedAt
        ? "Aláírva."
        : contract.sentAt
          ? "Kiküldve, ügyfélre vár."
          : "Feltöltve, de még nincs kiküldve.",
      state: contract.signedAt ? "done" : contract.sentAt ? "waiting" : "action"
    });
  } else {
    tasks.push({
      title: "Szerződés",
      detail: "Még nincs szerződés rögzítve ehhez az ügyfélhez.",
      state: "info"
    });
  }

  if (openInvoice) {
    tasks.push({
      title: "Számla",
      detail: openInvoice.sentAt
        ? `Nyitott számla: ${openInvoice.title}`
        : `Feltöltve, de még nincs kiküldve: ${openInvoice.title}`,
      state: openInvoice.sentAt ? "waiting" : "action",
      href: `/admin/clients/${customer.id}?tab=invoices`
    });
  } else if (customer.invoices.length > 0) {
    tasks.push({
      title: "Számla",
      detail: "Minden rögzített számla fizetett.",
      state: "done",
      href: `/admin/clients/${customer.id}?tab=invoices`
    });
  } else {
    tasks.push({
      title: "Számla",
      detail: "Még nincs számla feltöltve ehhez az ügyfélhez.",
      state: "info",
      href: `/admin/clients/${customer.id}?tab=invoices`
    });
  }

  tasks.push({
    title: "Aktuális fókusz",
    detail: nextAction.title,
    state: nextAction.lane === "complete" ? "done" : nextAction.lane === "waiting_client" ? "waiting" : "action",
    href: nextAction.href
  });

  return tasks;
}

function createCustomerTimeline(customer: CustomerWorkflowInput) {
  const events: TimelineEvent[] = [
    {
      date: customer.createdAt,
      title: "Ügyfél létrehozva",
      detail: "Az ügyfél bekerült a rendszerbe.",
      href: `/admin/clients/${customer.id}`
    }
  ];

  customer.contracts.forEach((contract) => {
    events.push({
      date: contract.createdAt,
      title: "Szerződés létrehozva",
      detail: contract.title
    });

    if (contract.sentAt) {
      events.push({
        date: contract.sentAt,
        title: "Szerződés elküldve",
        detail: contract.title
      });
    }

    if (contract.openedAt) {
      events.push({
        date: contract.openedAt,
        title: "Szerződés megnyitva",
        detail: contract.title
      });
    }

    if (contract.signedAt) {
      events.push({
        date: contract.signedAt,
        title: "Szerződés aláírva",
        detail: contract.title
      });
    }
  });

  customer.invoices.forEach((invoice) => {
    events.push({
      date: invoice.createdAt,
      title: "Számla feltöltve",
      detail: invoice.title,
      href: `/admin/clients/${customer.id}?tab=invoices`
    });

    if (invoice.sentAt) {
      events.push({
        date: invoice.sentAt,
        title: "Számla elküldve",
        detail: invoice.title,
        href: `/admin/clients/${customer.id}?tab=invoices`
      });
    }

    if (invoice.paidAt) {
      events.push({
        date: invoice.paidAt,
        title: "Számla fizetett",
        detail: invoice.title,
        href: `/admin/clients/${customer.id}?tab=invoices`
      });
    }
  });

  customer.galleries.forEach((gallery) => {
    events.push({
      date: gallery.createdAt,
      title: "Galéria létrehozva",
      detail: gallery.title,
      href: `/admin/galleries/${gallery.id}`
    });

    gallery.uploadSessions.forEach((session) => {
      events.push({
        date: session.updatedAt,
        title: session.status === "completed" ? "Feltöltés befejezve" : "Feltöltés frissült",
        detail: `${gallery.title} · ${session.completedCount}/${session.totalCount} kép · ${session.failedCount} hibás`,
        href: `/admin/galleries/${gallery.id}?tab=photos`
      });
    });

    if (gallery.proofingStatusUpdatedAt) {
      events.push({
        date: gallery.proofingStatusUpdatedAt,
        title: "Válogatás státusz frissült",
        detail: `${gallery.title} · ${proofingStatusLabel(gallery.proofingStatus)}`,
        href: `/admin/galleries/${gallery.id}?tab=client`
      });
    }

    if (gallery.proofingInviteSentAt) {
      events.push({
        date: gallery.proofingInviteSentAt,
        title: "Válogató link kiküldve",
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
        title: "Válogatás leadva",
        detail: `${list.email} · ${list._count.items} kiválasztott kép`,
        href: `/admin/galleries/${gallery.id}?tab=client`
      });
    });

    if (gallery.finalDeliveryEmailSentAt) {
      events.push({
        date: gallery.finalDeliveryEmailSentAt,
        title: "Kész képek átadva",
        detail: gallery.title,
        href: `/admin/galleries/${gallery.id}?tab=client`
      });
    }
  });

  return events.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 12);
}

function createCommunicationEvents(customer: CustomerWorkflowInput) {
  const events: TimelineEvent[] = [];

  customer.contracts.forEach((contract) => {
    if (contract.sentAt) {
      events.push({
        date: contract.sentAt,
        title: "Szerződés email",
        detail: contract.title
      });
    }
  });

  customer.invoices.forEach((invoice) => {
    if (invoice.sentAt) {
      events.push({
        date: invoice.sentAt,
        title: "Számla email",
        detail: invoice.title,
        href: `/admin/clients/${customer.id}?tab=invoices`
      });
    }
  });

  customer.galleries.forEach((gallery) => {
    if (gallery.proofingInviteSentAt) {
      events.push({
        date: gallery.proofingInviteSentAt,
        title: "Válogató link email",
        detail: gallery.title,
        href: `/admin/galleries/${gallery.id}?tab=client`
      });
    }

    if (gallery.finalDeliveryEmailSentAt) {
      events.push({
        date: gallery.finalDeliveryEmailSentAt,
        title: "Kész galéria email",
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

function taskStyles(state: CustomerTask["state"]) {
  if (state === "done") {
    return {
      icon: CheckCircle2,
      className: "border-sage/20 bg-sage/10 text-sage",
      label: "Kész"
    };
  }

  if (state === "waiting") {
    return {
      icon: Clock3,
      className: "border-brass/25 bg-brass/10 text-brass",
      label: "Vár"
    };
  }

  if (state === "action") {
    return {
      icon: ArrowRight,
      className: "border-ink/15 bg-ink text-white",
      label: "Lépés"
    };
  }

  return {
    icon: Circle,
    className: "border-ink/10 bg-paper text-graphite",
    label: "Info"
  };
}

function getActiveTab(flags: {
  edit?: string;
  tab?: string;
  contractUploaded?: string;
  contractWritten?: string;
  contractSent?: string;
  invoiceUploaded?: string;
  invoiceSent?: string;
  invoiceStatusUpdated?: string;
}): CustomerTab {
  if (flags.edit === "1") {
    return "details";
  }

  if (flags.invoiceUploaded || flags.invoiceSent || flags.invoiceStatusUpdated) {
    return "invoices";
  }

  if (flags.contractUploaded || flags.contractWritten || flags.contractSent) {
    return "contracts";
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
    contractError?: string;
    invoiceUploaded?: string;
    invoiceSent?: string;
    invoiceStatusUpdated?: string;
    invoiceError?: string;
    edit?: string;
    projectCreated?: string;
    projectDeleted?: string;
    projectError?: string;
    projectStatusUpdated?: string;
    statusUpdated?: string;
    tab?: string;
    albumCreated?: string;
    albumDeleted?: string;
    albumMode?: string;
    albumUploaded?: string;
    albumError?: string;
    albumDesignCreated?: string;
    albumDesignDeleted?: string;
    albumDesignExported?: string;
    albumSpreadAutoCreated?: string;
    albumSpreadCreated?: string;
    albumSpreadRegenerated?: string;
    albumSpreadUpdated?: string;
    albumSpreadSlotUpdated?: string;
    albumSpreadDeleted?: string;
    albumDesignError?: string;
  }>;
}) {
  const admin = await requireAdmin();
  const [{ id }, flags] = await Promise.all([params, searchParams]);
  const activeTab = getActiveTab(flags);
  const albumMode = getAlbumMode(flags);
  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, id),
    include: {
      contracts: {
        orderBy: { createdAt: "desc" }
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
      }
    }
  });

  if (!customer) {
    notFound();
  }

  const [albumReviews, albumFavoriteLists, albumDesigns, unassignedAlbumReviewCount, unassignedAlbumDesignCount] =
    await Promise.all([
      prisma.albumReview.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        include: {
          spreads: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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
  const typeLabel = customerTypeLabel(customer.customerType);
  const nextAction = getCustomerWorkflowSummary(customer);
  const customerTasks = createCustomerTasks(customer, nextAction);
  const timelineEvents = createCustomerTimeline(customer);
  const communicationEvents = createCommunicationEvents(customer);
  const proofingGalleries = customer.galleries.filter((gallery) => gallery.galleryMode === GALLERY_MODE_PROOFING);
  const today = startOfToday();
  const projectsByDate = sortProjectsForOverview(customer.projects, today);
  const nextProject = getNextProject(customer.projects, today);

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.24em] text-brass">Ügyfél</p>
        <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-4xl font-semibold text-ink">{customer.coupleName}</h1>
            <p className="mt-3 text-sm text-graphite/70">
              {typeLabel} · {customerStatusLabel(customer.status)} · {formatDate(customer.weddingDate)}
            </p>
          </div>
          <form action={updateCustomerStatusAction.bind(null, customer.id)} className="rounded-lg border border-ink/10 bg-white p-3 shadow-soft">
            <label className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <span className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">Fő státusz</span>
                <select
                  name="status"
                  defaultValue={normalizeCustomerStatus(customer.status)}
                  className="h-10 w-full min-w-56 rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                >
                  {CUSTOMER_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </span>
              <button className="h-10 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite">
                Mentés
              </button>
            </label>
          </form>
        </div>
      </div>

      <div className="mb-5 space-y-3">
        {flags.created ? <Alert title="Ügyfél létrehozva." variant="success" /> : null}
        {flags.updated ? <Alert title="Ügyfél mentve." variant="success" /> : null}
        {flags.projectCreated ? <Alert title="Projekt létrehozva." variant="success" /> : null}
        {flags.projectDeleted ? <Alert title="Projekt törölve." variant="success" /> : null}
        {flags.projectStatusUpdated ? <Alert title="Projekt státusz mentve." variant="success" /> : null}
        {flags.projectError === "missing" ? <Alert title="A projekt nem található vagy hiányzik a neve." variant="error" /> : null}
        {flags.contractUploaded ? <Alert title="Szerződés feltöltve." variant="success" /> : null}
        {flags.contractWritten ? <Alert title="Saját szerződés létrehozva." variant="success" /> : null}
        {flags.contractSent ? <Alert title="Szerződés elküldve emailben." variant="success" /> : null}
        {flags.invoiceUploaded ? <Alert title="Számla feltöltve." variant="success" /> : null}
        {flags.invoiceSent ? <Alert title="Számla elküldve emailben." variant="success" /> : null}
        {flags.invoiceStatusUpdated ? <Alert title="Számla státusz frissítve." variant="success" /> : null}
        {flags.statusUpdated ? <Alert title="Ügyfél státusz frissítve." variant="success" /> : null}
        {flags.albumCreated ? <Alert title="Album ellenőrző létrehozva." variant="success" /> : null}
        {flags.albumDeleted ? <Alert title="Album ellenőrző törölve." variant="success" /> : null}
        {flags.albumUploaded ? <Alert title={`${flags.albumUploaded} album oldalpár feltöltve.`} variant="success" /> : null}
        {flags.albumDesignCreated ? <Alert title="Albumterv létrehozva." variant="success" /> : null}
        {flags.albumDesignDeleted ? <Alert title="Albumterv törölve." variant="success" /> : null}
        {flags.albumDesignExported ? <Alert title={`${flags.albumDesignExported} albumterv oldalpár bekerült az album ellenőrzőbe.`} variant="success" /> : null}
        {flags.albumSpreadAutoCreated ? <Alert title="Automatikus album oldalpár létrehozva." variant="success" /> : null}
        {flags.albumSpreadCreated ? <Alert title="Album oldalpár létrehozva." variant="success" /> : null}
        {flags.albumSpreadRegenerated ? <Alert title="Album oldalpár újragenerálva." variant="success" /> : null}
        {flags.albumSpreadUpdated ? <Alert title="Album oldalpár frissítve." variant="success" /> : null}
        {flags.albumSpreadSlotUpdated ? <Alert title="Album oldalpár képe frissítve." variant="success" /> : null}
        {flags.albumSpreadDeleted ? <Alert title="Album oldalpár törölve." variant="success" /> : null}
        {flags.albumError === "no-files" ? <Alert title="Nem választottál ki album oldalpár képet." variant="error" /> : null}
        {flags.albumError === "missing" ? <Alert title="Az album ellenőrző nem található." variant="error" /> : null}
        {flags.albumDesignError === "favorite-list" ? <Alert title="Válassz favorite listát az albumtervhez." variant="error" /> : null}
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

      <CustomerTabController tabs={customerTabs} initialTab={activeTab} />

      <div data-customer-tab-panel="overview" hidden={activeTab !== "overview"}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              <div className="flex flex-col justify-between gap-3 border-b border-ink/10 pb-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
                    <CheckCircle2 size={15} />
                    Teendők
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-ink">Leadás előtti checklist</h2>
                  <p className="mt-1 text-sm leading-6 text-graphite/70">
                    A rendszer a galéria, válogatás, kész képek és szerződés állapotából számolja.
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
                  {nextAction.laneLabel}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {customerTasks.map((task) => {
                  const styles = taskStyles(task.state);
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

            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              <div className="flex flex-col justify-between gap-3 border-b border-ink/10 pb-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
                    <FolderKanban size={15} />
                    Projekt naptár
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-ink">Következő projektek</h2>
                  <p className="mt-1 text-sm leading-6 text-graphite/70">
                    Ügyfélhez tartozó fotózások és munkák dátum szerint rendezve.
                  </p>
                </div>
                <Link
                  href={`/admin/clients/${customer.id}?tab=projects`}
                  data-customer-tab-target="projects"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition hover:border-ink/30"
                >
                  Projektek kezelése
                </Link>
              </div>

              {projectsByDate.length === 0 ? (
                <div className="mt-4 rounded-md bg-paper px-4 py-4">
                  <p className="text-sm font-medium text-ink">Még nincs projekt létrehozva</p>
                  <p className="mt-1 text-sm text-graphite/70">Hozz létre projektet, hogy az áttekintésben lásd a következő fotózást vagy album munkát.</p>
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
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">Következő projekt</p>
                          <h3 className="mt-2 text-lg font-semibold text-ink">{nextProject.title}</h3>
                          <p className="mt-1 text-sm text-graphite/75">
                            {customerProjectTypeLabel(nextProject.projectType)} · {formatDate(nextProject.eventDate)}
                            {nextProject.venue ? ` · ${nextProject.venue}` : ""}
                          </p>
                        </div>
                        <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-brass">
                          {customerProjectStatusLabel(nextProject.status)}
                        </span>
                      </div>
                    </Link>
                  ) : null}

                  <div className="divide-y divide-ink/10 rounded-md border border-ink/10">
                    {projectsByDate.slice(0, 5).map((project) => (
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
                                Következő
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-graphite/70">
                            {customerProjectTypeLabel(project.projectType)} · {project.venue || "nincs helyszín"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                            {formatDate(project.eventDate)}
                          </span>
                          <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                            {project._count.galleries} galéria
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <div className="border-b border-ink/10 pb-4">
              <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
                <CalendarClock size={15} />
                Timeline
              </div>
              <h2 className="mt-2 text-xl font-semibold text-ink">Legutóbbi események</h2>
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
                      <p className="mt-1 text-xs text-graphite/55">{formatDateTime(event.date)}</p>
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

      <div data-customer-tab-panel="projects" hidden={activeTab !== "projects"}>
        <CustomerProjectManager
          customerId={customer.id}
          projects={customer.projects}
          unassignedCounts={unassignedProjectCounts}
          defaultEventDate={customer.weddingDate}
          defaultVenue={customer.venue}
        />
      </div>

      <div data-customer-tab-panel="galleries" hidden={activeTab !== "galleries"}>
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
                <Camera size={15} />
                Galériák
              </div>
              <h2 className="mt-2 text-xl font-semibold text-ink">Ügyfélhez tartozó galériák</h2>
              <p className="mt-1 text-sm leading-6 text-graphite/70">
                Innen induljon az új feltöltés. Így a galéria, a válogatás, az átadás és a szerződések egy ügyfél alatt maradnak.
              </p>
            </div>
            <ButtonLink href={`/admin/galleries/new?customerId=${customer.id}`}>
              <Plus size={16} />
              Új galéria
            </ButtonLink>
          </div>

          {customer.galleries.length === 0 ? (
            <div className="mt-5 rounded-md bg-paper px-4 py-4">
              <p className="text-sm font-medium text-ink">Még nincs galéria ehhez az ügyfélhez</p>
              <p className="mt-1 text-sm text-graphite/70">Hozd létre az első galériát, majd ott tudod feltölteni a képeket.</p>
            </div>
          ) : (
            <div className="mt-5 divide-y divide-ink/10 rounded-md border border-ink/10">
              {customer.galleries.map((gallery) => (
                <div key={gallery.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <Link href={`/admin/galleries/${gallery.id}`} className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{gallery.title}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${gallery.isActive ? "bg-sage/15 text-sage" : "bg-ink/5 text-graphite"}`}>
                        {gallery.isActive ? "Aktív" : "Archivált"}
                      </span>
                      <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                        {gallery.galleryMode === GALLERY_MODE_PROOFING ? "Nyers válogatás" : "Teljes galéria"}
                      </span>
                      {gallery.project ? (
                        <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                          {gallery.project.title}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-graphite/70">/g/{gallery.slug} · {gallery._count.photos} média</p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <ButtonLink href={`/admin/galleries/${gallery.id}`} variant="secondary" className="h-10">
                      Kezelés
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
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
            <Heart size={15} />
            Válogatás
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">Nyers képes workflow</h2>
          <p className="mt-1 text-sm leading-6 text-graphite/70">
            Itt látod az ügyfél válogató galériáit, leadott listáit és a kész képek átadási pontját.
          </p>

          {proofingGalleries.length === 0 ? (
            <div className="mt-5 rounded-md bg-paper px-4 py-4">
              <p className="text-sm font-medium text-ink">Nincs nyers válogatás ehhez az ügyfélhez</p>
              <p className="mt-1 text-sm text-graphite/70">Ha ilyen workflow kell, hozz létre nyers képes válogatás típusú galériát.</p>
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
                          {proofingStatusLabel(gallery.proofingStatus)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-graphite/70">
                        {gallery.favoriteLists.length} leadott lista · {gallery.photos.length > 0 ? "van kész kép feltöltve" : "nincs kész kép feltöltve"}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                      Kezelés
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
              designs={albumDesigns}
            />
          }
          uploadContent={<AlbumReviewManager customerId={customer.id} reviews={albumReviews} />}
        />
      </div>

      <div data-customer-tab-panel="contracts" hidden={activeTab !== "contracts"}>
        <ContractManager customerId={customer.id} contracts={customer.contracts} />
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
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
            <MessageSquare size={15} />
            Kommunikáció
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">Kiküldött email események</h2>
          <p className="mt-1 text-sm leading-6 text-graphite/70">
            Szerződés, válogató link és kész galéria email állapotok egy helyen.
          </p>

          {communicationEvents.length === 0 ? (
            <div className="mt-5 rounded-md bg-paper px-4 py-4">
              <p className="text-sm font-medium text-ink">Még nincs kiküldött email esemény</p>
              <p className="mt-1 text-sm text-graphite/70">Itt fog megjelenni a szerződés, válogató és kész galéria kiküldése.</p>
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
                    <p className="text-sm text-graphite/60">{formatDateTime(event.date)}</p>
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

      <div data-customer-tab-panel="details" hidden={activeTab !== "details"}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div>{isEditing ? <CustomerForm customer={customer} /> : <CustomerProfileCard customer={customer} />}</div>
          <aside className="space-y-6">
            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              <h2 className="text-lg font-semibold text-ink">Gyors adatok</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-graphite/60">Típus</dt>
                  <dd className="font-medium text-ink">{typeLabel}</dd>
                </div>
                <div>
                  <dt className="text-graphite/60">Elsődleges email</dt>
                  <dd className="font-medium text-ink">{customer.primaryEmail}</dd>
                </div>
                <div>
                  <dt className="text-graphite/60">Másodlagos email</dt>
                  <dd className="font-medium text-ink">{customer.secondaryEmail || "Nincs megadva"}</dd>
                </div>
                <div>
                  <dt className="text-graphite/60">Telefon</dt>
                  <dd className="font-medium text-ink">{customer.phone || "Nincs megadva"}</dd>
                </div>
                <div>
                  <dt className="text-graphite/60">Helyszín</dt>
                  <dd className="font-medium text-ink">{customer.venue || "Nincs megadva"}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border border-red-200 bg-white p-5 shadow-soft">
              <h2 className="text-lg font-semibold text-ink">Veszélyzóna</h2>
              <p className="mt-2 text-sm leading-6 text-graphite/70">
                Az ügyfél törlése eltávolítja az adatlapot és a hozzá tartozó szerződés rekordokat. A galériák megmaradnak,
                de ügyfél nélküli régi galériaként folytatják. A művelet nem vonható vissza.
              </p>
              <form action={deleteCustomerAction.bind(null, customer.id)} className="mt-4">
                <ConfirmSubmitButton
                  variant="danger"
                  message={`Biztosan törlöd ezt az ügyfelet: ${customer.coupleName}? Ez nem vonható vissza.`}
                  className="w-full"
                >
                  <Trash2 size={16} />
                  Ügyfél törlése
                </ConfirmSubmitButton>
              </form>
            </section>
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}
