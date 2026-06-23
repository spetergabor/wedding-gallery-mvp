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
import { StatCard } from "@/components/stat-card";
import { ViewLocationMap } from "@/components/view-location-map";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createViewLocationPoints } from "@/lib/view-location-points";
import { notificationWhere } from "@/lib/admin-scope";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { customerProjectStatusLabel, customerProjectTypeLabel } from "@/lib/customer-project-options";
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

function formatStorageSize(bytes: number) {
  if (bytes <= 0) {
    return "0 MB";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function formatDate(date: Date | null) {
  if (!date) {
    return "Nincs dátum";
  }

  return date.toLocaleDateString("hu-HU", {
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

function isSupersededDownloadPackageMessage(message: string | null | undefined) {
  return message?.toLowerCase().includes("superseded by") ?? false;
}

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const galleryWhere = admin.role === "super_admin" ? {} : { adminId: admin.id };
  const photoWhere = admin.role === "super_admin" ? {} : { gallery: { adminId: admin.id } };
  const projectWhere = admin.role === "super_admin" ? {} : { customer: { adminId: admin.id } };
  const adminNotificationWhere = notificationWhere(admin);
  const today = startOfToday();
  const staleZipCutoff = new Date(Date.now() - 15 * 60 * 1000);
  const contractWhere = admin.role === "super_admin" ? {} : { customer: { adminId: admin.id } };
  const invoiceWhere = admin.role === "super_admin" ? {} : { customer: { adminId: admin.id } };
  const albumCommentWhere = admin.role === "super_admin" ? {} : { spread: { review: { customer: { adminId: admin.id } } } };
  const downloadPackageWhere = admin.role === "super_admin" ? {} : { gallery: { adminId: admin.id } };

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
    viewLocations
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
      where: admin.role === "super_admin" ? {} : { gallery: { adminId: admin.id } },
      select: {
        city: true,
        country: true,
        latitude: true,
        longitude: true
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
        title: hasFinalPhotos ? "Kész képek átadása" : "Kész képek feltöltése",
        detail: hasFinalPhotos
          ? `${customerName}: van kész anyag, az átadás email vár kiküldésre.`
          : `${customerName}: ${proofingStatusLabel(gallery.proofingStatus).toLowerCase()}, a kidolgozott képek még hiányoznak.`,
        href: `/admin/galleries/${gallery.id}?tab=client`,
        label: hasFinalPhotos ? "Átadásra vár" : "Feldolgozás",
        priority: "high",
        icon: hasFinalPhotos ? CheckCircle2 : ImagePlus,
        createdAt: gallery.proofingStatusUpdatedAt ?? gallery.updatedAt
      };
    }),
    ...finishedProofingGalleries.map((gallery): DashboardTask => {
      const customerName = gallery.customer?.coupleName ?? gallery.title;

      return {
        key: `finished-proofing-${gallery.id}`,
        title: "Átadás email kiküldése",
        detail: `${customerName}: a kész képek átadva státuszban vannak, de az email még nincs kiküldve.`,
        href: `/admin/galleries/${gallery.id}?tab=client`,
        label: "Email hiányzik",
        priority: "high",
        icon: Mail,
        createdAt: gallery.proofingStatusUpdatedAt ?? gallery.updatedAt
      };
    }),
    ...proofingInviteGalleries.map((gallery): DashboardTask => {
      const customerName = gallery.customer?.coupleName ?? gallery.title;
      const emailText = gallery.customer?.primaryEmail ?? gallery.clientEmail ?? "nincs ügyfél email";

      return {
        key: `invite-${gallery.id}`,
        title: "Válogató link kiküldése",
        detail: `${customerName}: ${gallery._count.photos} kép feltöltve, címzett: ${emailText}.`,
        href: `/admin/galleries/${gallery.id}?tab=client`,
        label: "Küldésre vár",
        priority: "medium",
        icon: Heart,
        createdAt: gallery.createdAt
      };
    }),
    ...waitingContracts.map((contract): DashboardTask => ({
      key: `contract-${contract.id}`,
      title: "Szerződés aláírásra vár",
      detail: `${contract.customer.coupleName}: ${contract.title}`,
      href: `/admin/clients/${contract.customer.id}?tab=contracts`,
      label: "Ügyfélre vár",
      priority: "medium",
      icon: FileText,
      createdAt: contract.sentAt ?? contract.createdAt
    })),
    ...openInvoices.map((invoice): DashboardTask => {
      const isOverdue = Boolean(invoice.dueDate && invoice.dueDate.getTime() < today.getTime());
      const isUnsent = !invoice.sentAt;
      const title = isUnsent ? "Számla kiküldése" : isOverdue ? "Lejárt nyitott számla" : "Nyitott számla követése";
      const label = isUnsent ? "Küldésre vár" : isOverdue ? "Lejárt" : "Nyitott";
      const projectText = invoice.project ? ` · ${invoice.project.title}` : "";
      const dueText = invoice.dueDate ? ` · határidő: ${formatDate(invoice.dueDate)}` : "";

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
      title: "Album megjegyzés megválaszolása",
      detail: `${comment.spread.review.customer.coupleName}: ${comment.text}`,
      href: `/admin/clients/${comment.spread.review.customer.id}?tab=album`,
      label: "Album ellenőrző",
      priority: "medium",
      icon: MessageSquare,
      createdAt: comment.createdAt
    })),
    ...failedProcessingPhotos.map((photo): DashboardTask => ({
      key: `processing-${photo.id}`,
      title: "Előnézet feldolgozás javítása",
      detail: `${photo.gallery.title}: ${photo.filename}`,
      href: `/admin/galleries/${photo.gallery.id}?tab=photos`,
      label: "Hibás előnézet",
      priority: "high",
      icon: AlertCircle,
      createdAt: photo.createdAt
    })),
    ...actionableZipPackages.map((downloadPackage): DashboardTask => ({
      key: `zip-${downloadPackage.id}`,
      title: "ZIP előkészítés javítása",
      detail: `${downloadPackage.gallery.title}: ${downloadPackage.errorMessage ?? "a letöltési csomag beragadt vagy hibás."}`,
      href: `/admin/galleries/${downloadPackage.gallery.id}?tab=downloads`,
      label: downloadPackage.status === "processing" ? "Beragadt" : "Hibás ZIP",
      priority: "high",
      icon: AlertCircle,
      createdAt: downloadPackage.updatedAt
    }))
  ]).slice(0, 8);
  const urgentTaskCount = dashboardTasks.filter((task) => task.priority === "high").length;

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-brass">Admin</p>
          <h1 className="mt-2 text-4xl font-semibold text-ink">Dashboard</h1>
        </div>
        <ButtonLink href="/admin/galleries/new">Új galéria</ButtonLink>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Galériák" value={galleryCount} detail="Összes létrehozott galéria" />
        <StatCard label="Aktív" value={activeCount} detail="Publikusan elérhető galériák" />
        <StatCard label="Médiák" value={photoCount} detail="Adatbázisban rögzített képek és videók" />
        <StatCard label="R2 tárhely" value={formatStorageSize(totalStorageBytes)} detail="Feltöltött médiák összmérete" />
        <StatCard label="Új értesítések" value={unreadNotifications} detail="Olvasatlan admin jelzések" />
      </div>

      <section className="mt-8 rounded-lg border border-ink/10 bg-white shadow-soft">
        <div className="flex flex-col justify-between gap-3 border-b border-ink/10 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
              <ListChecks size={15} />
              Mai fókusz
            </div>
            <h2 className="mt-2 text-lg font-semibold text-ink">Teendőközpont</h2>
            <p className="mt-1 text-sm text-graphite/70">
              A legfontosabb ügyfél-, galéria- és háttérfolyamatok egy gyors listában.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-sm font-medium text-graphite">
            <Clock3 size={15} />
            {urgentTaskCount} sürgős
          </span>
        </div>

        {dashboardTasks.length === 0 ? (
          <div className="flex flex-col gap-2 px-5 py-8 text-sm text-graphite/70 sm:flex-row sm:items-center">
            <CheckCircle2 size={18} className="text-brass" />
            Nincs sürgős admin teendő. A problémás feldolgozások, leadott válogatások és várakozó ügyfélfolyamatok itt jelennek meg.
          </div>
        ) : (
          <div className="divide-y divide-ink/10">
            {dashboardTasks.map((task) => {
              const Icon = task.icon;

              return (
                <Link
                  key={task.key}
                  href={task.href}
                  className="group flex items-start gap-4 px-5 py-4 transition hover:bg-ink/[0.03]"
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
                  <ArrowRight size={18} className="mt-2 shrink-0 text-graphite/35 transition group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-ink/10 bg-white shadow-soft">
        <div className="flex flex-col justify-between gap-3 border-b border-ink/10 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
              <FolderKanban size={15} />
              Projektek
            </div>
            <h2 className="mt-2 text-lg font-semibold text-ink">Következő projektek</h2>
          </div>
          <ButtonLink href="/admin/clients" variant="secondary" className="h-10">
            Ügyfelek megnyitása
          </ButtonLink>
        </div>

        {upcomingProjects.length === 0 ? (
          <div className="px-5 py-8 text-sm text-graphite/70">
            Nincs dátummal ellátott közelgő projekt. Az ügyfél adatlapján létrehozott projektek itt jelennek meg időrendben.
          </div>
        ) : (
          <div className="grid gap-3 p-5 lg:grid-cols-2 2xl:grid-cols-3">
            {upcomingProjects.map((project) => (
              <Link
                key={project.id}
                href={`/admin/clients/${project.customer.id}?tab=projects`}
                className="rounded-md border border-ink/10 bg-paper p-4 transition hover:border-ink/20 hover:bg-ink/[0.03]"
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

                <div className="mt-4 grid gap-2 text-sm text-graphite/75 sm:grid-cols-2">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock size={14} />
                    {formatDate(project.eventDate)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Camera size={14} />
                    {project._count.galleries} galéria
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

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-white shadow-soft">
          <div className="flex items-center justify-between gap-4 border-b border-ink/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-ink">Értesítések</h2>
            <Link href="/admin/notifications" className="text-sm font-medium text-ink hover:underline">
              Összes
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
                    {notification.createdAt.toLocaleString("hu-HU", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: APP_TIME_ZONE
                    })}
                  </span>
                </span>
              </Link>
            ))}
            {latestNotifications.length === 0 ? (
              <div className="px-5 py-10 text-sm text-graphite/70">Még nincs értesítés.</div>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-ink/10 bg-white shadow-soft">
          <div className="border-b border-ink/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-ink">Legutóbbi galériák</h2>
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
                          <Image src={cover.thumbnailUrl} alt={cover.filename} fill unoptimized className="object-cover" sizes="56px" />
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
                  <p>{gallery._count.photos} média</p>
                  <p>{gallery.isActive ? "Aktív" : "Inaktív"}</p>
                </div>
              </a>
            ))}
            {latestGalleries.length === 0 ? (
              <div className="px-5 py-10 text-sm text-graphite/70">Még nincs galéria.</div>
            ) : null}
          </div>
        </section>
      </div>

      <ViewLocationMap points={locationPoints} />
    </AdminShell>
  );
}
