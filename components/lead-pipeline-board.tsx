"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { CalendarDays, GripVertical, Mail, Plus, Trash2, X } from "lucide-react";
import { createLeadAction, deleteLeadAction, moveLeadAction } from "@/lib/lead-actions";
import { LEAD_EVENT_TYPES, LEAD_STATUSES, leadEventTypeLabel, type LeadStatus } from "@/lib/leads";

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
};

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function AddLeadForm({
  status,
  onCancel,
  onCreated
}: {
  status: LeadStatus;
  onCancel: () => void;
  onCreated: (lead: LeadCard) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();

    if (!name) {
      setError("Adj meg nevet.");
      return;
    }

    startTransition(async () => {
      const result = await createLeadAction(formData);

      if (!result.ok || !result.leadId) {
        setError(result.message ?? "Nem sikerült menteni.");
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
    <form onSubmit={handleSubmit} className="rounded-md border border-ink/10 bg-white p-3 shadow-sm">
      <input type="hidden" name="status" value={status} />
      <div className="grid gap-2">
        <input
          name="name"
          autoFocus
          placeholder="Név"
          className="h-10 rounded-md border border-ink/15 bg-paper px-3 text-sm outline-none transition focus:border-ink/50"
        />
        <select name="eventType" className="h-10 rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50">
          {LEAD_EVENT_TYPES.map((type) => (
            <option key={type.key} value={type.key}>
              {type.label}
            </option>
          ))}
        </select>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <input
            name="email"
            type="email"
            placeholder="Email"
            className="h-10 rounded-md border border-ink/15 bg-paper px-3 text-sm outline-none transition focus:border-ink/50"
          />
          <input
            name="eventDate"
            type="date"
            className="h-10 rounded-md border border-ink/15 bg-paper px-3 text-sm outline-none transition focus:border-ink/50"
          />
        </div>
      </div>

      {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-ink px-3 text-sm font-medium text-white transition hover:bg-graphite disabled:opacity-60"
        >
          {isPending ? "Mentés..." : "Lead mentése"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex size-9 items-center justify-center rounded-md text-graphite hover:bg-ink/5"
          title="Mégse"
        >
          <X size={16} />
        </button>
      </div>
    </form>
  );
}

export function LeadPipelineBoard({ initialLeads }: LeadPipelineBoardProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [activeFormStatus, setActiveFormStatus] = useState<LeadStatus | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ status: LeadStatus; index: number } | null>(null);

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
    void deleteLeadAction(leadId);
  }

  return (
    <section className="mt-8 rounded-md border border-ink/12 bg-white">
      <div className="flex flex-col justify-between gap-3 border-b border-ink/10 px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-graphite/65">
            <GripVertical size={15} />
            Érdeklődők
          </div>
          <h2 className="mt-2 text-base font-semibold text-ink">Lead pipeline</h2>
          <p className="mt-1 max-w-2xl text-sm text-graphite/70">
            A kártyák még nem ügyfelek. Mozgasd őket oszlopok között, és csak a foglalásnál hozd létre manuálisan az ügyfelet.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto p-4">
        <div className="grid min-w-[1040px] grid-cols-6 gap-3">
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
                className={`min-h-80 rounded-md border border-ink/10 bg-paper/75 p-2 transition ${
                  isColumnTarget ? "border-ink/30 bg-brass/10" : ""
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <h3 className="text-sm font-semibold text-ink">{status.label}</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-graphite">{statusLeads.length}</span>
                </div>

                <div className="space-y-2">
                  {statusLeads.map((lead, index) => (
                    <div
                      key={lead.id}
                      draggable
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
                          <p className="mt-0.5 truncate text-xs font-medium text-brass">{leadEventTypeLabel(lead.eventType)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(lead.id)}
                          className="flex size-7 shrink-0 items-center justify-center rounded-md text-graphite/45 opacity-0 transition hover:bg-red-50 hover:text-red-700 group-hover:opacity-100"
                          title="Lead törlése"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-graphite/70">
                        {lead.eventDate ? (
                          <p className="flex items-center gap-1.5">
                            <CalendarDays size={13} />
                            {formatDate(lead.eventDate)}
                          </p>
                        ) : null}
                        {lead.email ? (
                          <p className="flex items-center gap-1.5 truncate">
                            <Mail size={13} />
                            {lead.email}
                          </p>
                        ) : null}
                        {lead.notes ? <p className="line-clamp-2 leading-5">{lead.notes}</p> : null}
                      </div>
                    </div>
                  ))}

                  {activeFormStatus === status.key ? (
                    <AddLeadForm
                      status={status.key}
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
                      Lead hozzáadása
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
