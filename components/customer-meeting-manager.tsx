import {
  Calendar,
  CalendarPlus,
  Clock3,
  MapPin,
  MessageSquare,
  Plus,
  Trash2
} from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  CUSTOMER_MEETING_STATUSES,
  CUSTOMER_MEETING_TYPES,
  customerMeetingStatusLabel,
  customerMeetingTypeLabel
} from "@/lib/customer-meeting-options";
import {
  createCustomerMeetingAction,
  deleteCustomerMeetingAction,
  updateCustomerMeetingAction,
  updateCustomerMeetingStatusAction
} from "@/lib/customer-actions";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { googleCalendarUrl } from "@/lib/google-calendar";

type CustomerMeeting = {
  id: string;
  title: string;
  meetingType: string;
  status: string;
  eventDate: Date;
  startTime: string;
  endTime: string;
  location: string | null;
  notes: string | null;
  googleCalendarSyncedAt: Date | null;
  googleCalendarSyncError: string | null;
  createdAt: Date;
};

function dateInputValue(date: Date | null | undefined) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

function formatTimeRange(meeting: { startTime: string; endTime: string }) {
  return `${meeting.startTime} - ${meeting.endTime}`;
}

function statusClass(status: string) {
  if (status === "completed") {
    return "bg-sage/15 text-sage";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-700";
  }

  return "bg-brass/10 text-brass";
}

function meetingGoogleCalendarUrl(customerName: string, meeting: CustomerMeeting) {
  return googleCalendarUrl({
    title: `${customerName} - ${meeting.title}`,
    date: meeting.eventDate,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    location: meeting.location,
    details: [
      customerMeetingTypeLabel(meeting.meetingType),
      customerMeetingStatusLabel(meeting.status),
      meeting.notes ? `\n${meeting.notes}` : ""
    ].join("\n")
  });
}

export function CustomerMeetingManager({
  customerId,
  customerName,
  meetings,
  defaultLocation
}: {
  customerId: string;
  customerName: string;
  meetings: CustomerMeeting[];
  defaultLocation: string | null;
}) {
  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
              <MessageSquare size={15} />
              Meetingek
            </div>
            <h2 className="mt-2 text-xl font-semibold text-ink">Egyeztetések az ügyféllel</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
              Esküvői timeline, helyszínbejárás, konzultáció vagy átadó meeting. Ezek külön időpontként jelennek meg a dashboard naptárban és a következő munkák között.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
            {meetings.length} meeting
          </span>
        </div>

        <details className="group mt-4 rounded-md border border-ink/10 bg-paper">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink transition hover:bg-ink/[0.03] [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-white text-brass">
                <Plus size={15} />
              </span>
              Új meeting szervezése
            </span>
            <span className="text-xs text-graphite/60 group-open:hidden">Űrlap megnyitása</span>
            <span className="hidden text-xs text-graphite/60 group-open:inline">Űrlap bezárása</span>
          </summary>

          <form action={createCustomerMeetingAction.bind(null, customerId)} className="grid gap-4 border-t border-ink/10 p-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 xl:col-span-2">
              <span className="text-sm font-medium text-graphite">Meeting neve</span>
              <input
                name="title"
                required
                placeholder="pl. Esküvői timeline egyeztetés"
                className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Típus</span>
              <select
                name="meetingType"
                defaultValue="consultation"
                className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              >
                {CUSTOMER_MEETING_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Státusz</span>
              <select
                name="status"
                defaultValue="planned"
                className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              >
                {CUSTOMER_MEETING_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Dátum</span>
              <input
                name="eventDate"
                type="date"
                required
                className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Mettől</span>
              <input
                name="startTime"
                type="time"
                required
                className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Meddig</span>
              <input
                name="endTime"
                type="time"
                required
                className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">Helyszín / link</span>
              <input
                name="location"
                defaultValue={defaultLocation ?? ""}
                placeholder="pl. Studio, Zoom, helyszín"
                className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <label className="space-y-2 xl:col-span-4">
              <span className="text-sm font-medium text-graphite">Megjegyzés</span>
              <textarea
                name="notes"
                rows={3}
                placeholder="Miről kell beszélni, mire kell készülni..."
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <div className="xl:col-span-4">
              <FormSubmitButton pendingLabel="Meeting létrehozása...">
                <Plus size={16} />
                Meeting létrehozása
              </FormSubmitButton>
            </div>
          </form>
        </details>
      </div>

      {meetings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/15 bg-white p-6 text-sm text-graphite/70">
          Még nincs meeting ennél az ügyfélnél. Hozz létre egy konzultációt, timeline egyeztetést vagy helyszínbejárást.
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting) => {
            const calendarUrl = meetingGoogleCalendarUrl(customerName, meeting);

            return (
              <article key={meeting.id} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-4 lg:flex-row lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-ink">{meeting.title}</h3>
                      <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                        {customerMeetingTypeLabel(meeting.meetingType)}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(meeting.status)}`}>
                        {customerMeetingStatusLabel(meeting.status)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-graphite/70">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar size={14} />
                        {formatDate(meeting.eventDate)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={14} />
                        {formatTimeRange(meeting)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={14} />
                        {meeting.location || "Nincs helyszín"}
                      </span>
                    </div>
                    {meeting.notes ? <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-graphite/70">{meeting.notes}</p> : null}
                    {meeting.googleCalendarSyncError ? (
                      <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                        Google Calendar hiba: {meeting.googleCalendarSyncError}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    <form action={updateCustomerMeetingStatusAction.bind(null, customerId, meeting.id)} className="flex gap-2">
                      <select
                        name="status"
                        defaultValue={meeting.status}
                        className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      >
                        {CUSTOMER_MEETING_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                      <FormSubmitButton type="submit" variant="secondary" className="h-11" pendingLabel="Mentés...">
                        Mentés
                      </FormSubmitButton>
                    </form>
                    <a
                      href={calendarUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition hover:border-ink/30"
                    >
                      <CalendarPlus size={16} />
                      Google naptár
                    </a>
                    <form action={deleteCustomerMeetingAction.bind(null, customerId, meeting.id)}>
                      <ConfirmSubmitButton
                        message="Biztosan törlöd ezt a meetinget? A hozzá tartozó Google Calendar eseményt is megpróbáljuk törölni."
                        variant="danger"
                      >
                        <Trash2 size={16} />
                        Törlés
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>

                <details className="group mt-4 rounded-md bg-paper">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-medium text-ink transition hover:bg-ink/[0.03] [&::-webkit-details-marker]:hidden">
                    <span>Meeting adatok szerkesztése</span>
                    <span className="text-xs text-graphite/60 group-open:hidden">Megnyitás</span>
                    <span className="hidden text-xs text-graphite/60 group-open:inline">Bezárás</span>
                  </summary>
                  <form action={updateCustomerMeetingAction.bind(null, customerId, meeting.id)} className="grid gap-3 border-t border-ink/10 p-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-2 xl:col-span-2">
                      <span className="text-sm font-medium text-graphite">Meeting neve</span>
                      <input
                        name="title"
                        required
                        defaultValue={meeting.title}
                        className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-graphite">Típus</span>
                      <select
                        name="meetingType"
                        defaultValue={meeting.meetingType}
                        className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      >
                        {CUSTOMER_MEETING_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-graphite">Státusz</span>
                      <select
                        name="status"
                        defaultValue={meeting.status}
                        className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      >
                        {CUSTOMER_MEETING_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-graphite">Dátum</span>
                      <input
                        name="eventDate"
                        type="date"
                        required
                        defaultValue={dateInputValue(meeting.eventDate)}
                        className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-graphite">Mettől</span>
                      <input
                        name="startTime"
                        type="time"
                        required
                        defaultValue={meeting.startTime}
                        className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-graphite">Meddig</span>
                      <input
                        name="endTime"
                        type="time"
                        required
                        defaultValue={meeting.endTime}
                        className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-graphite">Helyszín / link</span>
                      <input
                        name="location"
                        defaultValue={meeting.location ?? ""}
                        className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      />
                    </label>
                    <label className="space-y-2 xl:col-span-4">
                      <span className="text-sm font-medium text-graphite">Megjegyzés</span>
                      <textarea
                        name="notes"
                        rows={3}
                        defaultValue={meeting.notes ?? ""}
                        className="w-full rounded-md border border-ink/15 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      />
                    </label>
                    <div className="xl:col-span-4">
                      <FormSubmitButton type="submit" variant="secondary" className="h-10" pendingLabel="Mentés...">
                        Meeting adatok mentése
                      </FormSubmitButton>
                    </div>
                  </form>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
