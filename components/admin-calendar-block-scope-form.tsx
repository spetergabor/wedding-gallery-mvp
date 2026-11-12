"use client";

import { useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  ADMIN_CALENDAR_BLOCK_SCOPE_ALL,
  ADMIN_CALENDAR_BLOCK_SCOPE_RECURRING,
  ADMIN_CALENDAR_BLOCK_SCOPE_SELECTED,
  normalizeAdminCalendarBlockScope,
  type AdminCalendarBlockScope
} from "@/lib/admin-calendar-blocks";
import { updateAdminCalendarBlockScopeAction } from "@/lib/mini-session-actions";
import { MINI_SESSION_BOOKING_MODE_RECURRING } from "@/lib/mini-sessions";

type CalendarBlockSession = {
  id: string;
  title: string;
  bookingMode: string;
};

export function AdminCalendarBlockScopeForm({
  blockId,
  currentScope,
  currentTargetIds,
  sessions
}: {
  blockId: string;
  currentScope: string;
  currentTargetIds: string[];
  sessions: CalendarBlockSession[];
}) {
  const [scope, setScope] = useState<AdminCalendarBlockScope>(normalizeAdminCalendarBlockScope(currentScope));
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set(currentTargetIds));
  const valid = scope !== ADMIN_CALENDAR_BLOCK_SCOPE_SELECTED || targetIds.size > 0;

  function toggleTarget(id: string) {
    setTargetIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={updateAdminCalendarBlockScopeAction.bind(null, blockId)} className="mt-3 rounded-md border border-ink/10 bg-paper p-3">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.1em] text-graphite/55">Tiltás hatóköre</span>
        <select
          name="blockScope"
          value={scope}
          onChange={(event) => setScope(event.target.value as AdminCalendarBlockScope)}
          className="h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none focus:border-ink/50"
        >
          <option value={ADMIN_CALENDAR_BLOCK_SCOPE_RECURRING}>Csak állandó szolgáltatások</option>
          <option value={ADMIN_CALENDAR_BLOCK_SCOPE_SELECTED}>Kiválasztott foglalók</option>
          <option value={ADMIN_CALENDAR_BLOCK_SCOPE_ALL}>Minden foglaló</option>
        </select>
      </label>

      {scope === ADMIN_CALENDAR_BLOCK_SCOPE_SELECTED ? (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {sessions.map((session) => (
            <label key={session.id} className="flex cursor-pointer items-start gap-2 rounded-md bg-white px-2.5 py-2 text-xs text-ink">
              <input
                type="checkbox"
                name="targetSessionIds"
                value={session.id}
                checked={targetIds.has(session.id)}
                onChange={() => toggleTarget(session.id)}
                className="mt-0.5 size-4 rounded border-ink/20"
              />
              <span className="min-w-0">
                <span className="block truncate font-medium">{session.title}</span>
                <span className="block text-[10px] text-graphite/50">
                  {session.bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING ? "Állandó" : "Mini session"}
                </span>
              </span>
            </label>
          ))}
        </div>
      ) : null}

      <FormSubmitButton disabled={!valid} pendingLabel="Mentés..." className="mt-2 h-9 px-3 text-xs">
        Hatókör mentése
      </FormSubmitButton>
    </form>
  );
}
