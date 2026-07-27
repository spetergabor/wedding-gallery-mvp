"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { CalendarDays, ClipboardList, GripVertical, Mail, MapPin, Phone, Plus, Trash2, X } from "lucide-react";
import { createLeadAction, deleteLeadAction, moveLeadAction } from "@/lib/lead-actions";
import { LEAD_EVENT_TYPES, LEAD_STATUSES, leadEventTypeLabel, leadStatusLabel, type LeadStatus } from "@/lib/leads";
import type { AdminLanguage } from "@/lib/admin-language";

type LeadCard = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  eventType: string;
  eventDate: string | null;
  venue: string | null;
  notes: string | null;
  status: LeadStatus;
  sortOrder: number;
};

type LeadPipelineBoardProps = {
  initialLeads: LeadCard[];
  language: AdminLanguage;
};

const LEAD_PIPELINE_COPY = {
  hu: {
    nameRequired: "Adj meg nevet.",
    saveError: "Nem sikerült menteni.",
    name: "Név",
    email: "Email",
    saving: "Mentés...",
    saveLead: "Lead mentése",
    cancel: "Mégse",
    close: "Bezárás",
    deleteLead: "Lead törlése",
    leadDetails: "Lead részletei",
    contact: "Kapcsolat",
    event: "Esemény",
    notes: "Jegyzet",
    noNotes: "Nincs megjegyzés.",
    noValue: "Nincs megadva",
    eyebrow: "Érdeklődők",
    title: "Megkeresések áttekintése",
    description: "Itt követheted, hol tartanak az érdeklődők a megkereséstől a foglalásig. Ügyfelet csak akkor hozz létre, amikor a foglalás már biztos.",
    addLead: "Lead hozzáadása",
    locale: "hu-HU"
  },
  de: {
    nameRequired: "Bitte einen Namen eingeben.",
    saveError: "Konnte nicht gespeichert werden.",
    name: "Name",
    email: "E-Mail",
    saving: "Speichern...",
    saveLead: "Lead speichern",
    cancel: "Abbrechen",
    close: "Schließen",
    deleteLead: "Lead löschen",
    leadDetails: "Lead-Details",
    contact: "Kontakt",
    event: "Event",
    notes: "Notiz",
    noNotes: "Keine Notiz vorhanden.",
    noValue: "Nicht angegeben",
    eyebrow: "Anfragen",
    title: "Anfragen im Überblick",
    description: "Hier siehst du, wo Anfragen vom ersten Kontakt bis zur Buchung stehen. Einen Kunden legst du erst an, wenn die Buchung sicher ist.",
    addLead: "Lead hinzufügen",
    locale: "de-AT"
  },
  en: {
    nameRequired: "Enter a name.",
    saveError: "Could not save.",
    name: "Name",
    email: "Email",
    saving: "Saving...",
    saveLead: "Save lead",
    cancel: "Cancel",
    close: "Close",
    deleteLead: "Delete lead",
    leadDetails: "Lead details",
    contact: "Contact",
    event: "Event",
    notes: "Notes",
    noNotes: "No notes yet.",
    noValue: "Not set",
    eyebrow: "Leads",
    title: "Lead overview",
    description: "Track where inquiries are from first contact to confirmed booking. Create a client only when the booking is secure.",
    addLead: "Add lead",
    locale: "en-US"
  }
} as const;

function formatDate(value: string | null, language: AdminLanguage) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(LEAD_PIPELINE_COPY[language].locale, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

const HIDDEN_RAW_NOTE_KEYS = new Set([
  "name_der_braut",
  "name_des_bräutigams",
  "name_des_braeutigams",
  "e_mail_adresse",
  "telefonnummer",
  "hochzeitsdatum",
  "ort_der_hochzeit",
  "anzahl_der_gäste_ca",
  "anzahl_der_gaeste_ca",
  "wie_habt_ihr_mich_gefunden",
  "message",
  "bride_name",
  "groom_name",
  "email",
  "phone",
  "wedding_date",
  "venue",
  "guest_count",
  "source"
]);

function normalizeNoteKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_äöüßáéíóöőúüű]/g, "");
}

function formatLeadNotes(notes: string | null) {
  if (!notes) {
    return "";
  }

  const seenValues = new Set<string>();

  return notes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return false;
      }

      const separatorIndex = line.indexOf(":");

      if (separatorIndex < 0) {
        return true;
      }

      const key = normalizeNoteKey(line.slice(0, separatorIndex));
      const value = line.slice(separatorIndex + 1).trim().toLowerCase();

      if (HIDDEN_RAW_NOTE_KEYS.has(key)) {
        return false;
      }

      if (value && seenValues.has(value)) {
        return false;
      }

      seenValues.add(value);
      return true;
    })
    .join("\n");
}

function AddLeadForm({
  status,
  language,
  onCancel,
  onCreated
}: {
  status: LeadStatus;
  language: AdminLanguage;
  onCancel: () => void;
  onCreated: (lead: LeadCard) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const copy = LEAD_PIPELINE_COPY[language];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();

    if (!name) {
      setError(copy.nameRequired);
      return;
    }

    startTransition(async () => {
      const result = await createLeadAction(formData);

      if (!result.ok || !result.leadId) {
        setError(result.message ?? copy.saveError);
        return;
      }

      onCreated({
        id: result.leadId,
        name,
        email: String(formData.get("email") ?? "").trim().toLowerCase() || null,
        phone: String(formData.get("phone") ?? "").trim() || null,
        eventType: String(formData.get("eventType") ?? "wedding"),
        eventDate: String(formData.get("eventDate") ?? "").trim() || null,
        venue: String(formData.get("venue") ?? "").trim() || null,
        notes: String(formData.get("notes") ?? "").trim() || null,
        status,
        sortOrder: Date.now()
      });
      form.reset();
      onCancel();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-full overflow-hidden rounded-md border border-ink/10 bg-white p-3 shadow-sm">
      <input type="hidden" name="status" value={status} />
      <div className="grid min-w-0 gap-2">
        <input
          name="name"
          autoFocus
          placeholder={copy.name}
          className="h-10 min-w-0 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm outline-none transition focus:border-ink/50"
        />
        <select name="eventType" className="h-10 min-w-0 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50">
          {LEAD_EVENT_TYPES.map((type) => (
            <option key={type.key} value={type.key}>
              {type.label[language]}
            </option>
          ))}
        </select>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <input
            name="email"
            type="email"
            placeholder={copy.email}
            className="h-10 min-w-0 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm outline-none transition focus:border-ink/50"
          />
          <input
            name="eventDate"
            type="date"
            className="h-10 min-w-0 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm outline-none transition focus:border-ink/50"
          />
        </div>
      </div>

      {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-9 flex-1 items-center justify-center rounded-md bg-ink px-3 py-2 text-center text-sm font-medium leading-tight text-white transition hover:bg-graphite disabled:opacity-60"
        >
          {isPending ? copy.saving : copy.saveLead}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex size-9 items-center justify-center rounded-md text-graphite hover:bg-ink/5"
          title={copy.cancel}
        >
          <X size={16} />
        </button>
      </div>
    </form>
  );
}

export function LeadPipelineBoard({ initialLeads, language }: LeadPipelineBoardProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [activeFormStatus, setActiveFormStatus] = useState<LeadStatus | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadCard | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ status: LeadStatus; index: number } | null>(null);
  const copy = LEAD_PIPELINE_COPY[language];
  const selectedLeadNotes = selectedLead ? formatLeadNotes(selectedLead.notes) : "";

  const groupedLeads = useMemo(() => {
    return LEAD_STATUSES.reduce<Record<LeadStatus, LeadCard[]>>((acc, status) => {
      acc[status.key] = leads
        .filter((lead) => lead.status === status.key)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
      return acc;
    }, {} as Record<LeadStatus, LeadCard[]>);
  }, [leads]);

  function moveLeadLocally(leadId: string, status: LeadStatus, index: number) {
    setLeads((current) => {
      const lead = current.find((item) => item.id === leadId);

      if (!lead) {
        return current;
      }

      const targetLeads = current
        .filter((item) => item.id !== leadId && item.status === status)
        .sort((left, right) => left.sortOrder - right.sortOrder);
      const insertIndex = Math.max(0, Math.min(index, targetLeads.length));
      const orderedTargetIds = [
        ...targetLeads.slice(0, insertIndex).map((item) => item.id),
        leadId,
        ...targetLeads.slice(insertIndex).map((item) => item.id)
      ];

      return current.map((item) => {
        const targetOrder = orderedTargetIds.indexOf(item.id);

        if (item.id === leadId) {
          return { ...item, status, sortOrder: targetOrder };
        }

        if (targetOrder >= 0) {
          return { ...item, sortOrder: targetOrder };
        }

        return item;
      });
    });
  }

  function handleDrop(status: LeadStatus, index: number) {
    if (!draggingLeadId) {
      return;
    }

    const leadId = draggingLeadId;
    moveLeadLocally(leadId, status, index);
    setDraggingLeadId(null);
    setDropTarget(null);
    void moveLeadAction(leadId, status, index);
  }

  function handleDelete(leadId: string) {
    setLeads((current) => current.filter((lead) => lead.id !== leadId));
    setSelectedLead((current) => (current?.id === leadId ? null : current));
    void deleteLeadAction(leadId);
  }

  return (
    <section id="lead-pipeline" className="mt-8 rounded-md border border-ink/12 bg-white">
      <div className="flex flex-col justify-between gap-3 border-b border-ink/10 px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-graphite/65">
            <GripVertical size={15} />
            {copy.eyebrow}
          </div>
          <h2 className="mt-2 text-base font-semibold text-ink">{copy.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-graphite/70">
            {copy.description}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto p-4">
        <div className="flex min-w-max gap-3">
          {LEAD_STATUSES.map((status) => {
            const statusLeads = groupedLeads[status.key];
            const isColumnTarget = dropTarget?.status === status.key;

            return (
              <div
                key={status.key}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropTarget({ status: status.key, index: statusLeads.length });
                }}
                onDrop={() => handleDrop(status.key, dropTarget?.status === status.key ? dropTarget.index : statusLeads.length)}
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setActiveFormStatus(status.key);
                  }
                }}
                className={`min-h-80 w-[260px] shrink-0 rounded-md border border-ink/10 bg-paper/75 p-2 transition sm:w-[280px] ${
                  isColumnTarget ? "border-ink/30 bg-brass/10" : ""
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <h3 className="text-sm font-semibold text-ink">{leadStatusLabel(status.key, language)}</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-graphite">{statusLeads.length}</span>
                </div>

                <div className="space-y-2">
                  {statusLeads.map((lead, index) => (
                    <div
                      key={lead.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onClick={() => setSelectedLead(lead)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedLead(lead);
                        }
                      }}
                      onDragStart={() => setDraggingLeadId(lead.id)}
                      onDragEnd={() => {
                        setDraggingLeadId(null);
                        setDropTarget(null);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDropTarget({ status: status.key, index });
                      }}
                      onDrop={(event) => {
                        event.stopPropagation();
                        handleDrop(status.key, index);
                      }}
                      className={`group rounded-md border border-ink/10 bg-white p-3 shadow-sm transition hover:border-ink/25 ${
                        draggingLeadId === lead.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{lead.name}</p>
                          <p className="mt-0.5 truncate text-xs font-medium text-brass">{leadEventTypeLabel(lead.eventType, language)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(lead.id);
                          }}
                          className="flex size-7 shrink-0 items-center justify-center rounded-md text-graphite/45 opacity-0 transition hover:bg-red-50 hover:text-red-700 group-hover:opacity-100"
                          title={copy.deleteLead}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-graphite/70">
                        {lead.eventDate ? (
                          <p className="flex items-center gap-1.5">
                            <CalendarDays size={13} />
                            {formatDate(lead.eventDate, language)}
                          </p>
                        ) : null}
                        {lead.email ? (
                          <p className="flex items-center gap-1.5 truncate">
                            <Mail size={13} />
                            {lead.email}
                          </p>
                        ) : null}
                        {lead.notes ? <p className="line-clamp-2 leading-5">{formatLeadNotes(lead.notes)}</p> : null}
                      </div>
                    </div>
                  ))}

                  {activeFormStatus === status.key ? (
                    <AddLeadForm
                      status={status.key}
                      language={language}
                      onCancel={() => setActiveFormStatus(null)}
                      onCreated={(lead) => setLeads((current) => [...current, lead])}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveFormStatus(status.key)}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-ink/15 bg-white/60 text-sm font-medium text-graphite transition hover:border-ink/30 hover:text-ink"
                    >
                      <Plus size={15} />
                      {copy.addLead}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedLead ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 px-3 py-4 backdrop-blur-sm sm:items-center"
          onClick={() => setSelectedLead(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-details-title"
            className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-md border border-ink/10 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-graphite/65">
                  <ClipboardList size={15} />
                  {copy.leadDetails}
                </div>
                <h3 id="lead-details-title" className="mt-2 break-words text-xl font-semibold text-ink">
                  {selectedLead.name}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                    {leadEventTypeLabel(selectedLead.eventType, language)}
                  </span>
                  <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                    {leadStatusLabel(selectedLead.status, language)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-graphite transition hover:bg-ink/5 hover:text-ink"
                title={copy.close}
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-ink/10 bg-paper/70 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/60">{copy.contact}</p>
                  <div className="mt-3 space-y-2 text-sm text-graphite">
                    <p className="flex items-center gap-2">
                      <Mail size={15} />
                      <span className="min-w-0 break-all">{selectedLead.email || copy.noValue}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone size={15} />
                      <span className="min-w-0 break-all">{selectedLead.phone || copy.noValue}</span>
                    </p>
                  </div>
                </div>

                <div className="rounded-md border border-ink/10 bg-paper/70 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/60">{copy.event}</p>
                  <div className="mt-3 space-y-2 text-sm text-graphite">
                    <p className="flex items-center gap-2">
                      <CalendarDays size={15} />
                      <span>{formatDate(selectedLead.eventDate, language) || copy.noValue}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin size={15} />
                      <span className="min-w-0 break-words">{selectedLead.venue || copy.noValue}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-ink/10 bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/60">{copy.notes}</p>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-graphite">
                  {selectedLeadNotes || copy.noNotes}
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t border-ink/10 pt-4">
                <button
                  type="button"
                  onClick={() => handleDelete(selectedLead.id)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                >
                  <Trash2 size={15} />
                  {copy.deleteLead}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
