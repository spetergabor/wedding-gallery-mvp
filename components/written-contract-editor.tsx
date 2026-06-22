"use client";

import { useRef, useState } from "react";
import { PenLine, Plus } from "lucide-react";
import { Button } from "@/components/button";
import {
  CONTRACT_FIELD_OPTIONS,
  contractFieldToken,
  type ContractFieldDefinition
} from "@/lib/contract-fields";
import { createWrittenContractAction } from "@/lib/contract-actions";

const defaultFieldKeys = ["coupleName", "primaryEmail", "phone", "weddingDate", "venue"];

export function WrittenContractEditor({ customerId }: { customerId: string }) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CONTRACT_FIELD_OPTIONS.map((field) => [field.key, defaultFieldKeys.includes(field.key)]))
  );

  function insertField(field: ContractFieldDefinition) {
    const textarea = textareaRef.current;
    const token = contractFieldToken(field.key);

    setSelectedFields((current) => ({ ...current, [field.key]: true }));

    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const prefix = before && !before.endsWith(" ") && !before.endsWith("\n") ? " " : "";
    const suffix = after && !after.startsWith(" ") && !after.startsWith("\n") ? " " : "";
    const inserted = `${prefix}${token}${suffix}`;

    textarea.value = `${before}${inserted}${after}`;
    textarea.focus();
    textarea.selectionStart = start + inserted.length;
    textarea.selectionEnd = start + inserted.length;
  }

  return (
    <form
      action={createWrittenContractAction.bind(null, customerId)}
      className="space-y-4 rounded-md border border-ink/10 bg-paper p-5"
    >
      <div>
        <div className="flex items-center gap-2 text-base font-semibold text-ink">
          <PenLine size={18} />
          Saját szerződés írása
        </div>
        <p className="mt-1 text-sm text-graphite/70">
          Írás közben szúrd be a kitöltendő mezőket a szövegbe. Az ügyfél pontosan ott fogja kitölteni őket.
        </p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-graphite">Szerződés címe</span>
        <input
          name="title"
          required
          placeholder="pl. Fotózás szerződés"
          className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
        />
      </label>

      <div className="rounded-md border border-ink/10 bg-white p-3">
        <p className="text-sm font-medium text-graphite">Mező beszúrása a kurzorhoz</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CONTRACT_FIELD_OPTIONS.map((field) => (
            <button
              key={field.key}
              type="button"
              onClick={() => insertField(field)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-ink/10 bg-paper px-3 text-sm font-medium text-graphite transition hover:border-ink/25 hover:bg-ink/5"
            >
              <Plus size={14} />
              {field.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-graphite">Szerződés szövege</span>
        <textarea
          ref={textareaRef}
          name="bodyText"
          required
          rows={12}
          placeholder="Írd ide a szerződés szövegét, majd szúrd be például ezt: {{coupleName}} vagy {{weddingDate}}."
          className="w-full rounded-md border border-ink/15 bg-white px-3 py-3 font-mono text-sm leading-6 text-ink outline-none transition focus:border-ink/50"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-graphite">Az ügyfél által kitöltendő mezők</legend>
        <p className="text-xs leading-5 text-graphite/60">
          A beszúrt mezőket automatikusan hozzáadjuk. Itt külön is jelölhetsz mezőket, ha a szöveg végén szeretnéd
          őket bekérni.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CONTRACT_FIELD_OPTIONS.map((field) => (
            <label
              key={field.key}
              className="flex items-center gap-2 rounded-md border border-ink/10 bg-white px-3 py-2 text-sm text-graphite"
            >
              <input
                type="checkbox"
                name="clientFields"
                value={field.key}
                checked={Boolean(selectedFields[field.key])}
                onChange={(event) =>
                  setSelectedFields((current) => ({ ...current, [field.key]: event.target.checked }))
                }
                className="size-4 accent-ink"
              />
              {field.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" className="w-full">
        <PenLine size={16} />
        Szerződés létrehozása
      </Button>
    </form>
  );
}
