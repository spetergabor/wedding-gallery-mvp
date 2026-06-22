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
  Heart,
  ImagePlus,
  Mail,
  MessageSquare,
  Plus,
  Settings,
  Trash2,
  Upload
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { AlbumReviewManager } from "@/components/album-review-manager";
import { Alert } from "@/components/alert";
import { ButtonLink } from "@/components/button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ContractManager } from "@/components/contract-manager";
import { CustomerForm, CustomerProfileCard } from "@/components/customer-form";
import { requireAdmin } from "@/lib/auth";
import { customerAccessWhere } from "@/lib/admin-scope";
import { CUSTOMER_STATUSES, customerStatusLabel, customerTypeLabel, normalizeCustomerStatus } from "@/lib/customer-options";
import { CustomerWorkflowIconKey, getCustomerWorkflowSummary } from "@/lib/customer-workflow";
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
    day: "numeric"
  });
}

function formatDateTime(date: Date | null) {
  if (!date) {
    return null;
  }

  return date.toLocaleString("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

const workflowIconMap: Record<CustomerWorkflowIconKey, typeof Camera> = {
  camera: Camera,
  check: CheckCircle2,
  heart: Heart,
  mail: Mail,
  plus: Plus,
  upload: Upload
};

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

type CustomerTab = "overview" | "galleries" | "proofing" | "album" | "contracts" | "communication" | "details";

const customerTabs: Array<{
  key: CustomerTab;
  label: string;
  icon: typeof Camera;
}> = [
  { key: "overview", label: "Áttekintés", icon: CheckCircle2 },
  { key: "galleries", label: "Galériák", icon: Camera },
  { key: "proofing", label: "Válogatás", icon: Heart },
  { key: "album", label: "Album", icon: ImagePlus },
  { key: "contracts", label: "Szerződések", icon: FileText },
  { key: "communication", label: "Kommunikáció", icon: MessageSquare },
  { key: "details", label: "Adatok", icon: Settings }
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

function getActiveTab(flags: { edit?: string; tab?: string; contractUploaded?: string; contractWritten?: string; contractSent?: string }): CustomerTab {
  if (flags.edit === "1") {
    return "details";
  }

  if (flags.contractUploaded || flags.contractWritten || flags.contractSent) {
    return "contracts";
  }

  if (customerTabs.some((tab) => tab.key === flags.tab)) {
    return flags.tab as CustomerTab;
  }

  return "overview";
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
    edit?: string;
    statusUpdated?: string;
    tab?: string;
    albumCreated?: string;
    albumUploaded?: string;
    albumError?: string;
  }>;
}) {
  const admin = await requireAdmin();
  const [{ id }, flags] = await Promise.all([params, searchParams]);
  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, id),
    include: {
      contracts: {
        orderBy: { createdAt: "desc" }
      },
      galleries: {
        orderBy: { createdAt: "desc" },
        include: {
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
      albumReviews: {
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
      }
    }
  });

  if (!customer) {
    notFound();
  }

  const isEditing = flags.edit === "1";
  const typeLabel = customerTypeLabel(customer.customerType);
  const nextAction = getCustomerWorkflowSummary(customer);
  const NextActionIcon = workflowIconMap[nextAction.iconKey];
  const customerTasks = createCustomerTasks(customer, nextAction);
  const timelineEvents = createCustomerTimeline(customer);
  const communicationEvents = createCommunicationEvents(customer);
  const activeTab = getActiveTab(flags);
  const proofingGalleries = customer.galleries.filter((gallery) => gallery.galleryMode === GALLERY_MODE_PROOFING);

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
        {flags.contractUploaded ? <Alert title="Szerződés feltöltve." variant="success" /> : null}
        {flags.contractWritten ? <Alert title="Saját szerződés létrehozva." variant="success" /> : null}
        {flags.contractSent ? <Alert title="Szerződés elküldve emailben." variant="success" /> : null}
        {flags.statusUpdated ? <Alert title="Ügyfél státusz frissítve." variant="success" /> : null}
        {flags.albumCreated ? <Alert title="Album ellenőrző létrehozva." variant="success" /> : null}
        {flags.albumUploaded ? <Alert title={`${flags.albumUploaded} album oldalpár feltöltve.`} variant="success" /> : null}
        {flags.albumError === "no-files" ? <Alert title="Nem választottál ki album oldalpár képet." variant="error" /> : null}
        {flags.albumError === "missing" ? <Alert title="Az album ellenőrző nem található." variant="error" /> : null}
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
      </div>

      <section className="mb-6 rounded-lg border border-brass/25 bg-brass/10 p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white text-brass shadow-sm">
              <NextActionIcon size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-brass">Következő teendő</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">{nextAction.title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-graphite/75">{nextAction.description}</p>
            </div>
          </div>
          <ButtonLink href={nextAction.href} className="shrink-0">
            {nextAction.buttonLabel}
            <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </section>

      <div className="mb-6 rounded-lg border border-ink/10 bg-white p-2 shadow-soft">
        <nav className="grid gap-2 md:grid-cols-2 xl:grid-cols-7" aria-label="Ügyfél munkaterületek">
          {customerTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;

            return (
              <Link
                key={tab.key}
                href={`/admin/clients/${customer.id}?tab=${tab.key}`}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
                  isActive ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {activeTab === "overview" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
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
      ) : null}

      {activeTab === "galleries" ? (
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
      ) : null}

      {activeTab === "proofing" ? (
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
      ) : null}

      {activeTab === "album" ? (
        <AlbumReviewManager customerId={customer.id} reviews={customer.albumReviews} />
      ) : null}

      {activeTab === "contracts" ? <ContractManager customerId={customer.id} contracts={customer.contracts} /> : null}

      {activeTab === "communication" ? (
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
      ) : null}

      {activeTab === "details" ? (
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
      ) : null}
    </AdminShell>
  );
}
