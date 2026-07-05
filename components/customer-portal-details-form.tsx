"use client";

import { LockKeyhole, Pencil, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { updateCustomerPortalDetailsAction } from "@/lib/customer-portal-actions";

type CustomerPortalDetailsCopy = {
  wifeName: string;
  wifeEmail: string;
  wifePhone: string;
  husbandName: string;
  husbandEmail: string;
  husbandPhone: string;
  weddingDate: string;
  locations: string;
  mainLocation: string;
  weddingAddress: string;
  gettingReady: string;
  churchCeremony: string;
  civilCeremony: string;
  schedule: string;
  styleNotes: string;
  importantPeople: string;
  notes: string;
  save: string;
  saving: string;
  edit: string;
  editing: string;
  editingHint: string;
  cancel: string;
  locked: string;
  lockedHint: string;
};

type CustomerPortalDetailsValue = {
  wifeName: string | null;
  wifeEmail: string | null;
  wifePhone: string | null;
  husbandName: string | null;
  husbandEmail: string | null;
  husbandPhone: string | null;
  partnerName: string | null;
  partnerEmail: string | null;
  partnerPhone: string | null;
  primaryEmail: string;
  secondaryEmail: string | null;
  phone: string | null;
  weddingDateValue: string;
  venue: string | null;
  weddingLocation: string | null;
  weddingAddress: string | null;
  gettingReadyLocation: string | null;
  churchCeremonyLocation: string | null;
  civilCeremonyLocation: string | null;
  mainLocation: string | null;
  ceremonyLocation: string | null;
  weddingSchedule: string | null;
  weddingStyleNotes: string | null;
  importantPeopleNotes: string | null;
  portalNotes: string | null;
};

const fieldBaseClass =
  "h-12 w-full min-w-0 rounded-md border px-3 outline-none transition placeholder:text-graphite/45 disabled:opacity-100";
const textAreaBaseClass =
  "min-h-28 w-full min-w-0 rounded-md border px-3 py-3 outline-none transition placeholder:text-graphite/45 disabled:opacity-100";

function fieldClass(isEditing: boolean) {
  return `${fieldBaseClass} ${
    isEditing
      ? "border-ink/15 bg-white text-ink focus:border-ink/50"
      : "cursor-default border-ink/10 bg-paper text-graphite/85 focus:border-ink/10"
  }`;
}

function textAreaClass(isEditing: boolean) {
  return `${textAreaBaseClass} ${
    isEditing
      ? "border-ink/15 bg-white text-ink focus:border-ink/50"
      : "cursor-default border-ink/10 bg-paper text-graphite/85 focus:border-ink/10"
  }`;
}

export function CustomerPortalDetailsForm({
  token,
  customer,
  copy
}: {
  token: string;
  customer: CustomerPortalDetailsValue;
  copy: CustomerPortalDetailsCopy;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function cancelEditing() {
    formRef.current?.reset();
    setIsEditing(false);
  }

  return (
    <form
      ref={formRef}
      action={updateCustomerPortalDetailsAction.bind(null, token)}
      onSubmit={(event) => {
        if (!isEditing) {
          event.preventDefault();
        }
      }}
      className="mt-6 space-y-7"
    >
      <div className="flex flex-col justify-between gap-3 rounded-md border border-ink/10 bg-paper px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-graphite">
            <LockKeyhole size={16} />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">{isEditing ? copy.editing : copy.locked}</p>
            <p className="mt-1 text-sm leading-5 text-graphite/70">{isEditing ? copy.editingHint : copy.lockedHint}</p>
          </div>
        </div>

        {isEditing ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="secondary" onClick={cancelEditing}>
              <X size={16} />
              {copy.cancel}
            </Button>
            <FormSubmitButton pendingLabel={copy.saving}>{copy.save}</FormSubmitButton>
          </div>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setIsEditing(true)}>
            <Pencil size={16} />
            {copy.edit}
          </Button>
        )}
      </div>

      <fieldset disabled={!isEditing} className="space-y-7 disabled:opacity-100">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-graphite">{copy.wifeName}</span>
            <input name="wifeName" defaultValue={customer.wifeName ?? ""} required readOnly={!isEditing} className={fieldClass(isEditing)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-graphite">{copy.husbandName}</span>
            <input name="husbandName" defaultValue={customer.husbandName ?? customer.partnerName ?? ""} required readOnly={!isEditing} className={fieldClass(isEditing)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-graphite">{copy.wifeEmail}</span>
            <input name="wifeEmail" type="email" defaultValue={customer.wifeEmail ?? customer.primaryEmail} required readOnly={!isEditing} className={fieldClass(isEditing)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-graphite">{copy.husbandEmail}</span>
            <input
              name="husbandEmail"
              type="email"
              defaultValue={customer.husbandEmail ?? customer.partnerEmail ?? customer.secondaryEmail ?? ""}
              required
              readOnly={!isEditing}
              className={fieldClass(isEditing)}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-graphite">{copy.wifePhone}</span>
            <input name="wifePhone" defaultValue={customer.wifePhone ?? customer.phone ?? ""} readOnly={!isEditing} className={fieldClass(isEditing)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-graphite">{copy.husbandPhone}</span>
            <input name="husbandPhone" defaultValue={customer.husbandPhone ?? customer.partnerPhone ?? ""} readOnly={!isEditing} className={fieldClass(isEditing)} />
          </label>
        </div>

        <div className="border-t border-ink/10 pt-6">
          <h3 className="text-base font-semibold text-ink">{copy.locations}</h3>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">{copy.weddingDate}</span>
              <input name="weddingDate" type="date" defaultValue={customer.weddingDateValue} className={fieldClass(isEditing)} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">{copy.gettingReady}</span>
              <input name="gettingReadyLocation" defaultValue={customer.gettingReadyLocation ?? ""} readOnly={!isEditing} className={fieldClass(isEditing)} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">{copy.churchCeremony}</span>
              <input
                name="churchCeremonyLocation"
                defaultValue={customer.churchCeremonyLocation ?? customer.ceremonyLocation ?? ""}
                readOnly={!isEditing}
                className={fieldClass(isEditing)}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">{copy.civilCeremony}</span>
              <input name="civilCeremonyLocation" defaultValue={customer.civilCeremonyLocation ?? ""} readOnly={!isEditing} className={fieldClass(isEditing)} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">{copy.mainLocation}</span>
              <input name="mainLocation" defaultValue={customer.mainLocation ?? customer.weddingLocation ?? customer.venue ?? ""} readOnly={!isEditing} className={fieldClass(isEditing)} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-graphite">{copy.weddingAddress}</span>
              <input name="weddingAddress" defaultValue={customer.weddingAddress ?? ""} readOnly={!isEditing} className={fieldClass(isEditing)} />
            </label>
          </div>
        </div>

        <div className="grid gap-5 border-t border-ink/10 pt-6">
          <label className="space-y-2">
            <span className="text-sm font-medium text-graphite">{copy.schedule}</span>
            <textarea name="weddingSchedule" defaultValue={customer.weddingSchedule ?? ""} readOnly={!isEditing} className={textAreaClass(isEditing)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-graphite">{copy.styleNotes}</span>
            <textarea name="weddingStyleNotes" defaultValue={customer.weddingStyleNotes ?? ""} readOnly={!isEditing} className={textAreaClass(isEditing)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-graphite">{copy.importantPeople}</span>
            <textarea name="importantPeopleNotes" defaultValue={customer.importantPeopleNotes ?? ""} readOnly={!isEditing} className={textAreaClass(isEditing)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-graphite">{copy.notes}</span>
            <textarea name="portalNotes" defaultValue={customer.portalNotes ?? ""} readOnly={!isEditing} className={textAreaClass(isEditing)} />
          </label>
        </div>
      </fieldset>
    </form>
  );
}
