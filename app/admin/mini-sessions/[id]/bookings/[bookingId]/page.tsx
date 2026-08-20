import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  ExternalLink,
  Images,
  Mail,
  MapPin,
  PackageCheck,
  UploadCloud,
  UserRound
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { ButtonLink } from "@/components/button";
import { CopyLinkButton } from "@/components/copy-link-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { MiniSessionNotificationComposer } from "@/components/mini-session-notification-composer";
import { adminOwnedWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { miniSessionBookingManageUrl, publicGalleryUrl } from "@/lib/email";
import {
  createMiniSessionFinalGalleryAction,
  createMiniSessionProofingGalleryAction,
  markMiniSessionNoShowAction,
  markMiniSessionShootCompletedAction
} from "@/lib/mini-session-actions";
import {
  MINI_SESSION_WORKFLOW_CLIENT_SELECTION,
  MINI_SESSION_WORKFLOW_DELIVERED,
  MINI_SESSION_WORKFLOW_FINAL_UPLOAD,
  MINI_SESSION_WORKFLOW_RAW_UPLOAD,
  MINI_SESSION_WORKFLOW_SHOOT_SCHEDULED,
  MINI_SESSION_WORKFLOW_STAGES,
  deriveMiniSessionWorkflowStage,
  miniSessionWorkflowStageIndex
} from "@/lib/mini-session-workflow";
import { formatMiniSessionSlotWithDate, normalizeMiniSessionLanguage } from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

const cardClass = "rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6";

const NOTIFICATION_COPY = {
  hu: {
    shoot: {
      subject: "Köszönjük, hogy eljöttetek a fotózásra",
      message: "Szia!\n\nKöszönjük, hogy itt voltatok a mini fotózáson. Hamarosan elkészítem a válogatógalériát, és külön e-mailben jelzem, amikor kiválaszthatjátok a kedvenc képeiteket."
    },
    postProduction: {
      subject: "Megkaptam a képválogatásodat",
      message: "Szia!\n\nMegérkezett a képválogatásod. Most elkezdem a kiválasztott fotók kidolgozását, és e-mailben értesítelek, amikor elkészült a végleges galéria."
    },
    final: {
      subject: "Elkészült a mini fotózás galériája",
      message: "Szia!\n\nElkészültek a kidolgozott képek. A galériát az alábbi gombbal tudod megnyitni és a fotókat letölteni."
    }
  },
  de: {
    shoot: {
      subject: "Danke, dass ihr beim Shooting wart",
      message: "Hallo!\n\nVielen Dank, dass ihr beim Mini-Shooting dabei wart. Ich bereite jetzt die Auswahlgalerie vor und informiere euch per E-Mail, sobald ihr eure Lieblingsbilder auswählen könnt."
    },
    postProduction: {
      subject: "Deine Bildauswahl ist angekommen",
      message: "Hallo!\n\nDeine Bildauswahl ist bei mir angekommen. Ich beginne jetzt mit der Bearbeitung der ausgewählten Fotos und informiere dich per E-Mail, sobald die fertige Galerie bereit ist."
    },
    final: {
      subject: "Deine Mini-Shooting-Galerie ist fertig",
      message: "Hallo!\n\nDeine fertig bearbeiteten Bilder sind bereit. Über den folgenden Button kannst du die Galerie öffnen und die Fotos herunterladen."
    }
  }
} as const;

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "–";
  }

  return value.toLocaleString("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE
  });
}

function filenameWithoutExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

export default async function MiniSessionBookingWorkflowPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string; bookingId: string }>;
  searchParams: Promise<{
    shootCompleted?: string;
    noShow?: string;
    notify?: string;
    notificationSent?: string;
    delivered?: string;
    error?: string;
  }>;
}) {
  const admin = await requireAdmin();
  const { id, bookingId } = await params;
  const flags = await searchParams;
  const booking = await prisma.miniSessionBooking.findFirst({
    where: {
      id: bookingId,
      miniSessionId: id,
      miniSession: adminOwnedWhere(admin)
    },
    include: {
      miniSession: {
        select: {
          id: true,
          title: true,
          slug: true,
          location: true,
          language: true,
          postProductionWorkflowEnabled: true,
          admin: {
            select: { siteSettings: { select: { publicSubdomain: true } } }
          }
        }
      },
      proofingGallery: {
        include: {
          _count: { select: { photos: true } },
          favoriteLists: {
            orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
            include: {
              items: {
                orderBy: { createdAt: "asc" },
                select: {
                  photo: { select: { filename: true } }
                }
              }
            }
          }
        }
      },
      finalGallery: {
        include: {
          _count: { select: { photos: true } }
        }
      }
    }
  });

  if (!booking) {
    notFound();
  }

  if (!booking.miniSession.postProductionWorkflowEnabled) {
    redirect(`/admin/mini-sessions/${booking.miniSession.id}?tab=bookings`);
  }

  const stage = deriveMiniSessionWorkflowStage(booking);
  const stageIndex = miniSessionWorkflowStageIndex(stage);
  const proofingGallery = booking.proofingGallery;
  const finalGallery = booking.finalGallery;
  const submittedList = proofingGallery?.favoriteLists.find((list) => Boolean(list.submittedAt)) ?? null;
  const activeList = submittedList ?? proofingGallery?.favoriteLists[0] ?? null;
  const selectedFilenames = (activeList?.items ?? []).map((item) => filenameWithoutExtension(item.photo.filename));
  const lightroomFilenameList = selectedFilenames.join(",");
  const isClosedWithoutDelivery = booking.status === "cancelled" || booking.status === "no_show";
  const isShootTimeReached = booking.startsAt.getTime() <= Date.now();
  const customerLanguage = normalizeMiniSessionLanguage(booking.miniSession.language);
  const notificationCopy = NOTIFICATION_COPY[customerLanguage];
  const publicSubdomain = booking.miniSession.admin.siteSettings?.publicSubdomain ?? null;
  const customerWorkspaceUrl = miniSessionBookingManageUrl(booking.miniSession.slug, booking.cancelToken, publicSubdomain);
  const finalGalleryUrl = finalGallery ? publicGalleryUrl(finalGallery.slug, customerLanguage, publicSubdomain) : customerWorkspaceUrl;

  return (
    <AdminShell>
      <div className="mb-5">
        <Link
          href={`/admin/mini-sessions/${booking.miniSession.id}?tab=bookings`}
          className="inline-flex items-center gap-2 text-sm font-medium text-graphite hover:text-ink"
        >
          <ArrowLeft size={15} />
          Vissza a foglalókhoz
        </Link>
      </div>

      <div className="mb-5 space-y-3">
        {flags.shootCompleted ? <Alert title="A fotózás lezárva." variant="success">Most feltöltheted a válogatás képeit.</Alert> : null}
        {flags.noShow ? <Alert title="A foglalást no show állapotban lezártad." variant="success" /> : null}
        {flags.notificationSent ? <Alert title="Az ügyfélértesítő e-mail elküldve." variant="success" /> : null}
        {flags.delivered ? <Alert title="A kész galéria átadva." variant="success">Az ügyfél e-mailben megkapta a letöltési linket.</Alert> : null}
        {flags.error === "selection-required" ? <Alert title="Az ügyfél még nem zárta le a válogatást." variant="error" /> : null}
        {flags.error === "shoot-not-started" ? <Alert title="A fotózás még nem kezdődött el." variant="error" /> : null}
        {flags.error === "notification-content" ? <Alert title="Az e-mail tárgya és szövege nem lehet üres." variant="error" /> : null}
        {flags.error === "notification-email" ? <Alert title="Az ügyfélértesítő e-mail küldése nem sikerült." variant="error">Ellenőrizd a Resend beállítást, majd próbáld újra.</Alert> : null}
        {flags.error === "final-photos-required" ? <Alert title="A végleges galéria még üres." variant="error">Az átadás előtt töltsd fel a kidolgozott képeket.</Alert> : null}
        {flags.error === "client-email" ? <Alert title="Hiányzik vagy hibás az ügyfél e-mail címe." variant="error" /> : null}
        {flags.error === "delivery-email" ? <Alert title="A galéria elkészült, de az e-mail küldése nem sikerült." variant="error">Ellenőrizd a Resend beállítást, majd próbáld újra.</Alert> : null}
        {isClosedWithoutDelivery ? <Alert title="Ez a foglalás lezárt állapotban van." variant="error">A workflow folytatásához előbb állítsd vissza aktívra a foglalást.</Alert> : null}
      </div>

      <section className={cardClass}>
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">{booking.miniSession.title} · Mini shooting workflow</p>
            <h1 className="mt-2 text-2xl font-semibold text-ink">{booking.name}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-graphite/70">
              <span className="inline-flex items-center gap-1.5"><CalendarClock size={15} /> {formatMiniSessionSlotWithDate(booking.startsAt, booking.endsAt)}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin size={15} /> {booking.miniSession.location}</span>
              <a className="inline-flex items-center gap-1.5 hover:text-ink" href={`mailto:${booking.email}`}><Mail size={15} /> {booking.email}</a>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brass/10 px-3 py-2 text-sm font-semibold text-brass">
            <Clock3 size={15} />
            {MINI_SESSION_WORKFLOW_STAGES[stageIndex]?.label}
          </span>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-5">
          {MINI_SESSION_WORKFLOW_STAGES.map((item, index) => {
            const complete = index < stageIndex;
            const current = index === stageIndex;
            return (
              <div key={item.key} className="relative">
                <div className={`h-full rounded-md border px-3 py-3 ${current ? "border-brass/40 bg-brass/10" : complete ? "border-sage/25 bg-sage/10" : "border-ink/10 bg-paper"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${complete ? "bg-sage text-white" : current ? "bg-ink text-white" : "bg-white text-graphite/45"}`}>
                      {complete ? <Check size={15} /> : current ? <Circle size={11} fill="currentColor" /> : <span className="text-xs font-semibold">{index + 1}</span>}
                    </span>
                    <span className={`text-xs font-semibold ${current ? "text-ink" : complete ? "text-sage" : "text-graphite/50"}`}>{item.shortLabel}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-5 space-y-5">
        <section className={cardClass}>
          {stage === MINI_SESSION_WORKFLOW_SHOOT_SCHEDULED ? (
            <div>
              <div className="flex size-11 items-center justify-center rounded-full bg-ink text-white"><CalendarClock size={20} /></div>
              <h2 className="mt-4 text-xl font-semibold text-ink">A fotózás a következő lépés</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">A fotózás után zárd le ezt a lépést. Ezután megjelenik a külön válogatógaléria feltöltője.</p>
              {isShootTimeReached ? (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <form action={markMiniSessionShootCompletedAction.bind(null, booking.id)}>
                    <FormSubmitButton disabled={isClosedWithoutDelivery} pendingLabel="Továbblépés...">
                      <CheckCircle2 size={16} />
                      Fotózás megtörtént
                    </FormSubmitButton>
                  </form>
                  <form action={markMiniSessionNoShowAction.bind(null, booking.id)}>
                    <FormSubmitButton variant="danger" disabled={isClosedWithoutDelivery} pendingLabel="Lezárás...">
                      No show
                    </FormSubmitButton>
                  </form>
                </div>
              ) : (
                <p className="mt-6 rounded-md bg-paper px-4 py-3 text-sm text-graphite/70">A lezáró gombok a fotózás kezdetekor jelennek meg.</p>
              )}
            </div>
          ) : null}

          {stage === MINI_SESSION_WORKFLOW_RAW_UPLOAD ? (
            <div>
              <div className="flex size-11 items-center justify-center rounded-full bg-ink text-white"><UploadCloud size={20} /></div>
              <h2 className="mt-4 text-xl font-semibold text-ink">Készítsd elő a válogatást</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">A nyers előnézetek egy külön, letöltés nélküli galériába kerülnek. A végleges képek később nem keverednek ide.</p>

              {proofingGallery ? (
                <>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md bg-paper px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.15em] text-graphite/55">Feltöltött képek</p>
                      <p className="mt-2 text-2xl font-semibold text-ink">{proofingGallery._count.photos}</p>
                    </div>
                    <div className="rounded-md bg-paper px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.15em] text-graphite/55">Válogató e-mail</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{proofingGallery.proofingInviteSentAt ? "Elküldve" : "Még nincs elküldve"}</p>
                    </div>
                  </div>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <ButtonLink href={`/admin/galleries/${proofingGallery.id}?tab=photos`} variant="secondary">
                      <UploadCloud size={16} />
                      Képek feltöltése
                    </ButtonLink>
                    {proofingGallery._count.photos > 0 ? (
                      <ButtonLink href={`/admin/galleries/${proofingGallery.id}?tab=activity&proofingInvitePrompt=1`}>
                        <Mail size={16} />
                        E-mail szerkesztése és kiküldése
                      </ButtonLink>
                    ) : null}
                  </div>
                </>
              ) : (
                <form action={createMiniSessionProofingGalleryAction.bind(null, booking.id)} className="mt-6">
                  <FormSubmitButton disabled={isClosedWithoutDelivery} pendingLabel="Galéria létrehozása...">
                    <Images size={16} />
                    Válogatógaléria létrehozása
                  </FormSubmitButton>
                </form>
              )}
              <div className="mt-4">
                <MiniSessionNotificationComposer
                  bookingId={booking.id}
                  kind="shoot_completed"
                  recipient={booking.email}
                  previewUrl={customerWorkspaceUrl}
                  defaultSubject={notificationCopy.shoot.subject}
                  defaultMessage={notificationCopy.shoot.message}
                  triggerLabel="Ügyfél értesítése"
                  autoOpen={flags.notify === "shoot_completed"}
                />
              </div>
            </div>
          ) : null}

          {stage === MINI_SESSION_WORKFLOW_CLIENT_SELECTION ? (
            <div>
              <div className="flex size-11 items-center justify-center rounded-full bg-brass text-white"><UserRound size={20} /></div>
              <h2 className="mt-4 text-xl font-semibold text-ink">Az ügyfél válogat</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">
                {selectedFilenames.length > 0
                  ? "Az ügyfél már választott képeket. Ha befejezte, indítsd el a kész képek feltöltését; ezzel a workflow a következő szakaszba lép."
                  : "Itt most nincs teendőd. Amint az ügyfél képeket választ, innen indíthatod a kész képek feltöltését."}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-paper px-4 py-3"><p className="text-xs uppercase tracking-[0.15em] text-graphite/55">Nyers képek</p><p className="mt-2 text-2xl font-semibold text-ink">{proofingGallery?._count.photos ?? 0}</p></div>
                <div className="rounded-md bg-paper px-4 py-3"><p className="text-xs uppercase tracking-[0.15em] text-graphite/55">Kiválasztva</p><p className="mt-2 text-2xl font-semibold text-ink">{activeList?.items.length ?? 0}</p></div>
                <div className="rounded-md bg-paper px-4 py-3"><p className="text-xs uppercase tracking-[0.15em] text-graphite/55">Kiküldve</p><p className="mt-2 text-sm font-semibold text-ink">{formatDateTime(booking.selectionSentAt ?? proofingGallery?.proofingInviteSentAt)}</p></div>
              </div>
              {proofingGallery ? (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {selectedFilenames.length > 0 ? (
                    <form action={createMiniSessionFinalGalleryAction.bind(null, booking.id)}>
                      <FormSubmitButton disabled={isClosedWithoutDelivery} pendingLabel="Feltöltés előkészítése...">
                        <UploadCloud size={16} />
                        Képek feltöltése
                      </FormSubmitButton>
                    </form>
                  ) : null}
                  <ButtonLink href={`/admin/galleries/${proofingGallery.id}?tab=activity`} variant="secondary"><ExternalLink size={16} /> Válogatás megnyitása</ButtonLink>
                  <ButtonLink href={`/admin/galleries/${proofingGallery.id}?tab=activity&proofingInvitePrompt=1`} variant="secondary"><Mail size={16} /> Emlékeztető szerkesztése</ButtonLink>
                </div>
              ) : null}
            </div>
          ) : null}

          {stage === MINI_SESSION_WORKFLOW_FINAL_UPLOAD ? (
            <div>
              <div className="flex size-11 items-center justify-center rounded-full bg-ink text-white"><PackageCheck size={20} /></div>
              <h2 className="mt-4 text-xl font-semibold text-ink">Töltsd fel a kész képeket</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">A kidolgozott fájlok egy új, tiszta galériába kerülnek. Az ügyfél csak az explicit átadás után látja őket.</p>

              {selectedFilenames.length > 0 ? (
                <div className="mt-5 rounded-md border border-ink/10 bg-paper p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-graphite/55">Lightroom-kompatibilis lista</p>
                      <p className="mt-1 text-sm text-graphite/70">{selectedFilenames.length} kiválasztott fájlnév, kiterjesztés nélkül.</p>
                    </div>
                    <CopyLinkButton url={lightroomFilenameList} label="Fájlnevek másolása" />
                  </div>
                  <p className="mt-3 max-h-28 overflow-auto break-all rounded bg-white px-3 py-2 font-mono text-xs leading-6 text-ink">{lightroomFilenameList}</p>
                </div>
              ) : null}

              <div className="mt-5">
                <MiniSessionNotificationComposer
                  bookingId={booking.id}
                  kind="post_production"
                  recipient={booking.email}
                  previewUrl={customerWorkspaceUrl}
                  defaultSubject={notificationCopy.postProduction.subject}
                  defaultMessage={notificationCopy.postProduction.message}
                  triggerLabel="Ügyfél értesítése az utómunkáról"
                />
              </div>

              {finalGallery ? (
                <>
                  <div className="mt-5 rounded-md bg-paper px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-graphite/55">Kész képek</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{finalGallery._count.photos}</p>
                  </div>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <ButtonLink href={`/admin/galleries/${finalGallery.id}?tab=photos`} variant="secondary"><UploadCloud size={16} /> Kész képek feltöltése</ButtonLink>
                    {finalGallery._count.photos > 0 ? (
                      <MiniSessionNotificationComposer
                        bookingId={booking.id}
                        kind="final_delivery"
                        recipient={booking.email}
                        previewUrl={finalGalleryUrl}
                        defaultSubject={notificationCopy.final.subject}
                        defaultMessage={notificationCopy.final.message}
                        triggerLabel="Kész galéria átadása"
                      />
                    ) : null}
                  </div>
                </>
              ) : (
                <form action={createMiniSessionFinalGalleryAction.bind(null, booking.id)} className="mt-6">
                  <FormSubmitButton disabled={isClosedWithoutDelivery} pendingLabel="Galéria létrehozása...">
                    <Images size={16} />
                    Kész galéria létrehozása
                  </FormSubmitButton>
                </form>
              )}
            </div>
          ) : null}

          {stage === MINI_SESSION_WORKFLOW_DELIVERED ? (
            <div>
              <div className="flex size-11 items-center justify-center rounded-full bg-sage text-white"><CheckCircle2 size={20} /></div>
              <h2 className="mt-4 text-xl font-semibold text-ink">A kész galéria átadva</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">A végleges képek külön galériában érhetők el, a nyers válogatás pedig archiválható anélkül, hogy befolyásolná az átadott anyagot.</p>
              {finalGallery ? (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <ButtonLink href={`/admin/galleries/${finalGallery.id}`} variant="secondary"><Images size={16} /> Galéria kezelése</ButtonLink>
                  <ButtonLink href={`/g/${finalGallery.slug}`}><ExternalLink size={16} /> Ügyfélgaléria megnyitása</ButtonLink>
                  <MiniSessionNotificationComposer
                    bookingId={booking.id}
                    kind="final_delivery"
                    recipient={booking.email}
                    previewUrl={finalGalleryUrl}
                    defaultSubject={notificationCopy.final.subject}
                    defaultMessage={notificationCopy.final.message}
                    triggerLabel="Átadó e-mail újraküldése"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <details className="rounded-lg border border-ink/10 bg-white shadow-soft">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <span>Folyamatnapló</span>
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/50">Korábbi lépések</span>
          </summary>
          <div className="grid gap-4 border-t border-ink/10 p-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div><p className="text-graphite/55">Fotózás lezárva</p><p className="mt-1 font-medium text-ink">{formatDateTime(booking.shootCompletedAt)}</p></div>
            <div><p className="text-graphite/55">Válogató kiküldve</p><p className="mt-1 font-medium text-ink">{formatDateTime(booking.selectionSentAt ?? proofingGallery?.proofingInviteSentAt)}</p></div>
            <div><p className="text-graphite/55">Válogatás leadva</p><p className="mt-1 font-medium text-ink">{formatDateTime(booking.selectionSubmittedAt ?? submittedList?.submittedAt)}</p></div>
            <div><p className="text-graphite/55">Kész galéria átadva</p><p className="mt-1 font-medium text-ink">{formatDateTime(booking.finalDeliveredAt ?? finalGallery?.finalDeliveryEmailSentAt)}</p></div>
          </div>
        </details>
      </div>
    </AdminShell>
  );
}
