import Link from "next/link";
import {
  Archive,
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarPlus,
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  FolderKanban,
  Heart,
  ImagePlus,
  ListChecks,
  MapPin,
  MessageSquare,
  Plus,
  ReceiptText,
  Sparkles,
  Trash2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  CUSTOMER_PROJECT_TYPES,
  customerProjectTypeLabel
} from "@/lib/customer-project-options";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { googleCalendarUrl } from "@/lib/google-calendar";
import { deleteCustomerProjectAction, createCustomerProjectAction, updateCustomerProjectAction } from "@/lib/customer-actions";
import {
  getProjectWorkflowSummary,
  type ProjectWorkflowIconKey,
  type ProjectWorkflowState
} from "@/lib/project-workflow";
import { GALLERY_MODE_PROOFING } from "@/lib/proofing";

type ProjectGallery = {
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
};

type CustomerProject = {
  id: string;
  title: string;
  projectType: string;
  status: string;
  eventDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  notes: string | null;
  createdAt: Date;
  galleries: ProjectGallery[];
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

type UnassignedCounts = {
  galleries: number;
  contracts: number;
  invoices: number;
  albumReviews: number;
  albumDesigns: number;
};

function dateInputValue(date: Date | null | undefined) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function timeInputValue(time: string | null | undefined) {
  return time ?? "";
}

function formatDate(date: Date | null | undefined) {
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

function formatTimeRange(startTime: string | null | undefined, endTime: string | null | undefined) {
  if (!startTime || !endTime) {
    return "Nincs időpont";
  }

  return `${startTime} - ${endTime}`;
}

function CountPill({ icon: Icon, label, count }: { icon: LucideIcon; label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
      <Icon size={13} />
      {count} {label}
    </span>
  );
}

function projectGoogleCalendarUrl(project: CustomerProject) {
  if (!project.eventDate) {
    return null;
  }

  const details = [
    customerProjectTypeLabel(project.projectType),
    project.notes ? `\n${project.notes}` : ""
  ].join("");

  return googleCalendarUrl({
    title: project.title,
    date: project.eventDate,
    startTime: project.startTime,
    endTime: project.endTime,
    location: project.venue,
    details
  });
}

function projectCalendarIcsUrl(project: CustomerProject) {
  return project.eventDate ? `/admin/projects/${project.id}/calendar` : null;
}

const workflowIconMap: Record<ProjectWorkflowIconKey, LucideIcon> = {
  archive: Archive,
  arrow: ArrowRight,
  book: BookOpen,
  camera: Camera,
  check: CheckCircle2,
  clock: Clock3,
  file: FileText,
  heart: Heart,
  image: ImagePlus,
  invoice: ReceiptText,
  list: ListChecks,
  message: MessageSquare,
  sparkles: Sparkles
};

function stepStyle(state: ProjectWorkflowState) {
  if (state === "done") {
    return {
      className: "bg-sage/10 text-sage",
      label: "Rendben"
    };
  }

  if (state === "waiting") {
    return {
      className: "bg-brass/10 text-brass",
      label: "Várakozik"
    };
  }

  if (state === "action") {
    return {
      className: "bg-ink text-white",
      label: "Teendő"
    };
  }

  return {
    className: "bg-ink/5 text-graphite",
    label: "Figyelni"
  };
}

export function CustomerProjectManager({
  customerId,
  projects,
  unassignedCounts,
  defaultEventDate,
  defaultVenue
}: {
  customerId: string;
  projects: CustomerProject[];
  unassignedCounts: UnassignedCounts;
  defaultEventDate: Date | null;
  defaultVenue: string | null;
}) {
  const unassignedTotal =
    unassignedCounts.galleries +
    unassignedCounts.contracts +
    unassignedCounts.invoices +
    unassignedCounts.albumReviews +
    unassignedCounts.albumDesigns;

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
              <FolderKanban size={15} />
              Projektek
            </div>
            <h2 className="mt-2 text-xl font-semibold text-ink">Fotózások és munkák egy ügyfél alatt</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
              Itt látod az ügyfélhez tartozó külön munkákat. Új projektet csak akkor nyiss, ha tényleg külön folyamatot szeretnél vezetni.
            </p>
          </div>
          <ButtonLink href={`/admin/galleries/new?customerId=${customerId}`} variant="secondary">
            <Camera size={16} />
            Galéria projekt nélkül
          </ButtonLink>
        </div>

        <details className="group mt-4 rounded-md border border-ink/10 bg-paper">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink transition hover:bg-ink/[0.03] [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-white text-brass">
                <Plus size={15} />
              </span>
              Új projekt létrehozása
            </span>
            <span className="text-xs text-graphite/60 group-open:hidden">Űrlap megnyitása</span>
            <span className="hidden text-xs text-graphite/60 group-open:inline">Űrlap bezárása</span>
          </summary>

          <form action={createCustomerProjectAction.bind(null, customerId)} className="grid gap-4 border-t border-ink/10 p-4 md:grid-cols-2 xl:grid-cols-4">
            <input type="hidden" name="status" value="planned" />
            <label className="space-y-2 xl:col-span-2">
              <span className="text-sm font-medium text-graphite">Projekt neve</span>
              <input
                name="title"
                required
                placeholder="pl. Jegyesfotózás, Esküvő napja, Album v1"
                className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Típus</span>
              <select
                name="projectType"
                defaultValue="general"
                className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              >
                {CUSTOMER_PROJECT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Dátum</span>
              <input
                name="eventDate"
                type="date"
                defaultValue={dateInputValue(defaultEventDate)}
                className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Mettől</span>
              <input
                name="startTime"
                type="time"
                className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Meddig</span>
              <input
                name="endTime"
                type="time"
                className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Helyszín</span>
              <input
                name="venue"
                defaultValue={defaultVenue ?? ""}
                placeholder="pl. Graz, Studio, Schloss..."
                className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <label className="space-y-2 xl:col-span-4">
              <span className="text-sm font-medium text-graphite">Megjegyzés</span>
              <textarea
                name="notes"
                rows={3}
                placeholder="Belső megjegyzés ehhez a konkrét munkához..."
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <div className="xl:col-span-4">
              <FormSubmitButton pendingLabel="Projekt létrehozása...">
                <Plus size={16} />
                Projekt létrehozása
              </FormSubmitButton>
            </div>
          </form>
        </details>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/15 bg-white p-6 text-sm text-graphite/70">
          Még nincs külön projekt ennél az ügyfélnél. Hozd létre az elsőt, utána az új galériákat már ehhez tudod kötni.
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <article key={project.id} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              {(() => {
                const nextStep = getProjectWorkflowSummary(customerId, project);
                const StepIcon = workflowIconMap[nextStep.iconKey];
                const nextStepStyle = stepStyle(nextStep.state);
                const calendarUrl = projectGoogleCalendarUrl(project);
                const calendarIcsUrl = projectCalendarIcsUrl(project);
                const attachmentCounts = [
                  { icon: Camera, label: "galéria", count: project._count.galleries },
                  { icon: FileText, label: "szerződés", count: project._count.contracts },
                  { icon: FileText, label: "számla", count: project._count.invoices },
                  { icon: ImagePlus, label: "album ellenőrző", count: project._count.albumReviews },
                  { icon: BookOpen, label: "albumterv", count: project._count.albumDesigns }
                ].filter((item) => item.count > 0);

                return (
                  <>
              <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-4 lg:flex-row lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-ink">{project.title}</h3>
                    <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                      {customerProjectTypeLabel(project.projectType)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-graphite/70">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={14} />
                      {formatDate(project.eventDate)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 size={14} />
                      {formatTimeRange(project.startTime, project.endTime)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} />
                      {project.venue || "Nincs helyszín"}
                    </span>
                  </div>
                  {project.notes ? <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-graphite/70">{project.notes}</p> : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                  {calendarUrl ? (
                    <a
                      href={calendarUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition hover:border-ink/30"
                    >
                      <CalendarPlus size={16} />
                      Google naptár
                    </a>
                  ) : null}
                  {calendarIcsUrl ? (
                    <a
                      href={calendarIcsUrl}
                      download
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition hover:border-ink/30"
                    >
                      <Download size={16} />
                      Apple / Outlook
                    </a>
                  ) : null}
                  <form action={deleteCustomerProjectAction.bind(null, customerId, project.id)}>
                    <ConfirmSubmitButton
                      message="Biztosan törlöd ezt a projektet? A kapcsolt galériák és dokumentumok megmaradnak, csak projekt nélkül folytatják."
                      variant="danger"
                    >
                      <Trash2 size={16} />
                      Törlés
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>

              <div className="mt-4 rounded-md border border-brass/15 bg-paper p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`flex size-10 shrink-0 items-center justify-center rounded-md ${nextStepStyle.className}`}>
                      <StepIcon size={17} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-graphite/55">Következő lépés</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${nextStepStyle.className}`}>
                          {nextStep.stateLabel}
                        </span>
                      </div>
                      <h4 className="mt-1 text-base font-semibold text-ink">{nextStep.title}</h4>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-graphite/70">{nextStep.detail}</p>
                    </div>
                  </div>
                  <ButtonLink href={nextStep.href} className="h-10 shrink-0">
                    <ArrowRight size={16} />
                    {nextStep.buttonLabel}
                  </ButtonLink>
                </div>
              </div>

              {attachmentCounts.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {attachmentCounts.map((item) => (
                    <CountPill key={item.label} icon={item.icon} label={item.label} count={item.count} />
                  ))}
                </div>
              ) : null}

              <details className="group mt-4 rounded-md bg-paper">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-medium text-ink transition hover:bg-ink/[0.03] [&::-webkit-details-marker]:hidden">
                  <span>Projekt adatok szerkesztése</span>
                  <span className="text-xs text-graphite/60 group-open:hidden">Megnyitás</span>
                  <span className="hidden text-xs text-graphite/60 group-open:inline">Bezárás</span>
                </summary>
                <form action={updateCustomerProjectAction.bind(null, customerId, project.id)} className="grid gap-3 border-t border-ink/10 p-3 md:grid-cols-2 xl:grid-cols-4">
                  <input type="hidden" name="status" value={project.status} />
                  <label className="space-y-2 xl:col-span-2">
                    <span className="text-sm font-medium text-graphite">Projekt neve</span>
                    <input
                      name="title"
                      required
                      defaultValue={project.title}
                      className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-graphite">Típus</span>
                    <select
                      name="projectType"
                      defaultValue={project.projectType}
                      className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                    >
                      {CUSTOMER_PROJECT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-graphite">Dátum</span>
                    <input
                      name="eventDate"
                      type="date"
                      defaultValue={dateInputValue(project.eventDate)}
                      className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-graphite">Mettől</span>
                    <input
                      name="startTime"
                      type="time"
                      defaultValue={timeInputValue(project.startTime)}
                      className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-graphite">Meddig</span>
                    <input
                      name="endTime"
                      type="time"
                      defaultValue={timeInputValue(project.endTime)}
                      className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-graphite">Helyszín</span>
                    <input
                      name="venue"
                      defaultValue={project.venue ?? ""}
                      className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                    />
                  </label>
                  <label className="space-y-2 xl:col-span-4">
                    <span className="text-sm font-medium text-graphite">Megjegyzés</span>
                    <textarea
                      name="notes"
                      rows={3}
                      defaultValue={project.notes ?? ""}
                      className="w-full rounded-md border border-ink/15 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-ink/50"
                    />
                  </label>
                  <div className="xl:col-span-4">
                    <FormSubmitButton type="submit" variant="secondary" className="h-10" pendingLabel="Mentés...">
                      Projekt adatok mentése
                    </FormSubmitButton>
                  </div>
                </form>
              </details>

              {project.galleries.length > 0 ? (
                <div className="mt-4 divide-y divide-ink/10 rounded-md border border-ink/10">
                  {project.galleries.map((gallery) => (
                    <Link
                      key={gallery.id}
                      href={`/admin/galleries/${gallery.id}`}
                      className="grid gap-2 px-3 py-3 transition hover:bg-ink/[0.03] sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <div>
                        <p className="font-medium text-ink">{gallery.title}</p>
                        <p className="mt-1 text-sm text-graphite/70">
                          /g/{gallery.slug} · {gallery._count.photos} média
                        </p>
                      </div>
                      <span className="w-fit rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                        {gallery.galleryMode === GALLERY_MODE_PROOFING ? "Nyers válogatás" : "Teljes galéria"}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
                  </>
                );
              })()}
            </article>
          ))}
        </div>
      )}

      {unassignedTotal > 0 ? (
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
            <Archive size={15} />
            Korábbi anyagok
          </div>
          <h2 className="mt-2 text-lg font-semibold text-ink">Projekthez még nem rendelt tartalmak</h2>
          <p className="mt-1 text-sm leading-6 text-graphite/70">
            Ezek a régi ügyfélhez kapcsolt rekordok továbbra is elérhetők. Később külön átrendező felületet kaphatnak.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <CountPill icon={Camera} label="galéria" count={unassignedCounts.galleries} />
            <CountPill icon={FileText} label="szerződés" count={unassignedCounts.contracts} />
            <CountPill icon={FileText} label="számla" count={unassignedCounts.invoices} />
            <CountPill icon={ImagePlus} label="album ellenőrző" count={unassignedCounts.albumReviews} />
            <CountPill icon={Archive} label="albumterv" count={unassignedCounts.albumDesigns} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
