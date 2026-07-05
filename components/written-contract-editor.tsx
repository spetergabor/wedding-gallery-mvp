"use client";

import { type ClipboardEvent, useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, PenLine, Plus, Quote, Underline } from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  CONTRACT_FIELD_OPTIONS,
  contractFieldToken,
  type ContractFieldDefinition
} from "@/lib/contract-fields";
import { normalizeContractBodyHtml, plainTextToContractHtml } from "@/lib/contract-rich-text";
import { createWrittenContractAction } from "@/lib/contract-actions";

const defaultFieldKeys = ["coupleName", "primaryEmail", "phone", "weddingDate", "venue"];

export function WrittenContractEditor({ customerId }: { customerId: string }) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const [bodyHtml, setBodyHtml] = useState("");
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CONTRACT_FIELD_OPTIONS.map((field) => [field.key, defaultFieldKeys.includes(field.key)]))
  );

  function syncEditorValue() {
    const html = editorRef.current?.innerHTML ?? "";
    setBodyHtml(html);

    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = html;
    }
  }

  function saveSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0 || !selection.anchorNode || !editor.contains(selection.anchorNode)) {
      return;
    }

    selectionRef.current = selection.getRangeAt(0).cloneRange();
  }

  function placeCaretAtEnd(editor: HTMLDivElement) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function restoreSelection() {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    editor.focus();

    const selection = window.getSelection();
    const range = selectionRef.current;

    if (!selection || !range || !editor.contains(range.commonAncestorContainer)) {
      placeCaretAtEnd(editor);
      return;
    }

    selection.removeAllRanges();
    selection.addRange(range);
  }

  function runCommand(command: string, value?: string) {
    restoreSelection();
    document.execCommand(command, false, value);
    syncEditorValue();
    saveSelection();
  }

  function insertField(field: ContractFieldDefinition) {
    const token = contractFieldToken(field.key);

    setSelectedFields((current) => ({ ...current, [field.key]: true }));
    restoreSelection();
    document.execCommand("insertText", false, token);
    syncEditorValue();
    saveSelection();
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");

    if (!html && !text) {
      return;
    }

    event.preventDefault();
    restoreSelection();
    document.execCommand("insertHTML", false, html ? normalizeContractBodyHtml(html) : plainTextToContractHtml(text));
    syncEditorValue();
    saveSelection();
  }

  return (
    <form
      action={createWrittenContractAction.bind(null, customerId)}
      onSubmit={() => {
        const html = editorRef.current?.innerHTML ?? "";

        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = html;
        }
      }}
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
        <input
          ref={hiddenInputRef}
          type="hidden"
          name="bodyText"
          value={bodyHtml}
          readOnly
        />
        <div className="overflow-hidden rounded-md border border-ink/15 bg-white">
          <div className="flex flex-wrap gap-1 border-b border-ink/10 bg-paper px-2 py-2">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("bold")}
              className="inline-flex size-9 items-center justify-center rounded-md text-graphite transition hover:bg-ink/5"
              title="Félkövér"
            >
              <Bold size={16} />
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("italic")}
              className="inline-flex size-9 items-center justify-center rounded-md text-graphite transition hover:bg-ink/5"
              title="Dőlt"
            >
              <Italic size={16} />
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("underline")}
              className="inline-flex size-9 items-center justify-center rounded-md text-graphite transition hover:bg-ink/5"
              title="Aláhúzás"
            >
              <Underline size={16} />
            </button>
            <span className="mx-1 h-9 w-px bg-ink/10" />
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("formatBlock", "h2")}
              className="inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-semibold text-graphite transition hover:bg-ink/5"
              title="Címsor"
            >
              H2
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("formatBlock", "p")}
              className="inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-semibold text-graphite transition hover:bg-ink/5"
              title="Bekezdés"
            >
              P
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("insertUnorderedList")}
              className="inline-flex size-9 items-center justify-center rounded-md text-graphite transition hover:bg-ink/5"
              title="Felsorolás"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("insertOrderedList")}
              className="inline-flex size-9 items-center justify-center rounded-md text-graphite transition hover:bg-ink/5"
              title="Számozott lista"
            >
              <ListOrdered size={16} />
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("formatBlock", "blockquote")}
              className="inline-flex size-9 items-center justify-center rounded-md text-graphite transition hover:bg-ink/5"
              title="Idézet / kiemelt blokk"
            >
              <Quote size={16} />
            </button>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncEditorValue}
            onPaste={handlePaste}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onBlur={saveSelection}
            onFocus={saveSelection}
            data-placeholder="Írd vagy másold ide a szerződés szövegét, majd szúrd be például ezt: {{coupleName}} vagy {{weddingDate}}."
            className="contract-rich-editor min-h-80 w-full bg-white px-4 py-4 text-sm leading-7 text-ink outline-none"
          />
        </div>
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

      <FormSubmitButton className="w-full" pendingLabel="Mentés...">
        <PenLine size={16} />
        Szerződés létrehozása
      </FormSubmitButton>
    </form>
  );
}
