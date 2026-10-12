"use client";

import { LoaderCircle, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { deleteGiftCardOrder, updateGiftCardOrderDetails } from "@/lib/gift-card-order-actions";

type Order = {
  id: string;
  customerName: string;
  email: string | null;
  recipientName: string;
  personCount: number;
  deliveryMethod: string;
  deliveryAddress: string | null;
  amountCents: number | null;
  invoiceNumber: string | null;
  message: string | null;
  delivered: boolean;
  paid: boolean;
  photographed: boolean;
};

type Labels = {
  edit: string;
  editTitle: string;
  close: string;
  save: string;
  saving: string;
  delete: string;
  deleteConfirm: string;
  deleteWarning: string;
  cancel: string;
  customer: string;
  email: string;
  personCount: string;
  recipient: string;
  deliveryMethod: string;
  address: string;
  amount: string;
  invoice: string;
  message: string;
  delivered: string;
  paid: string;
  photographed: string;
  saveError: string;
  deleteError: string;
};

type Props = {
  order: Order;
  labels: Labels;
};

const inputClass =
  "mt-1.5 h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50";
const textareaClass =
  "mt-1.5 min-h-24 w-full resize-y rounded-md border border-ink/15 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-ink/50";

export function GiftCardOrderActions({ order, labels }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(order.email ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setConfirmDelete(false);
    setError("");
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");

    startTransition(async () => {
      try {
        const result = await updateGiftCardOrderDetails({
          orderId: order.id,
          customerName: String(formData.get("customerName") ?? ""),
          email: String(formData.get("email") ?? ""),
          recipientName: String(formData.get("recipientName") ?? ""),
          personCount: String(formData.get("personCount") ?? ""),
          deliveryMethod: String(formData.get("deliveryMethod") ?? ""),
          deliveryAddress: String(formData.get("deliveryAddress") ?? ""),
          amount: String(formData.get("amount") ?? ""),
          invoiceNumber: String(formData.get("invoiceNumber") ?? ""),
          message: String(formData.get("message") ?? ""),
          delivered: formData.get("delivered") === "on",
          paid: formData.get("paid") === "on",
          photographed: formData.get("photographed") === "on"
        });

        if (!result.ok) {
          setError(labels.saveError);
          return;
        }

        setOpen(false);
        router.refresh();
      } catch {
        setError(labels.saveError);
      }
    });
  }

  function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setError("");
      return;
    }

    startTransition(async () => {
      try {
        const result = await deleteGiftCardOrder(order.id);
        if (!result.ok) {
          setError(labels.deleteError);
          return;
        }

        setOpen(false);
        router.refresh();
      } catch {
        setError(labels.deleteError);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setEmail(order.email ?? "");
          setOpen(true);
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-ink/15 bg-white px-2.5 text-xs font-medium text-ink transition hover:border-ink/30 hover:bg-canvas"
      >
        <Pencil size={13} />
        {labels.edit}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/45 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`gift-card-edit-${order.id}`}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/10 bg-white px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-graphite/55">{labels.edit}</p>
                <h2 id={`gift-card-edit-${order.id}`} className="mt-1 text-xl font-semibold text-ink">
                  {labels.editTitle}
                </h2>
              </div>
              <button type="button" onClick={close} disabled={pending} aria-label={labels.close} className="grid size-9 place-items-center rounded-md text-graphite/60 hover:bg-canvas hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={save} className="p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-medium text-graphite/70">
                  {labels.customer}
                  <input className={inputClass} name="customerName" defaultValue={order.customerName} required maxLength={200} />
                </label>
                <label className="text-xs font-medium text-graphite/70">
                  {labels.email}
                  <input
                    className={inputClass}
                    name="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    maxLength={320}
                  />
                </label>
                <label className="text-xs font-medium text-graphite/70">
                  {labels.recipient}
                  <input className={inputClass} name="recipientName" defaultValue={order.recipientName} required maxLength={200} />
                </label>
                <label className="text-xs font-medium text-graphite/70">
                  {labels.personCount}
                  <input className={inputClass} name="personCount" defaultValue={order.personCount} type="number" min={1} max={20} required />
                </label>
                <label className="text-xs font-medium text-graphite/70">
                  {labels.deliveryMethod}
                  <input className={inputClass} name="deliveryMethod" defaultValue={order.deliveryMethod} required maxLength={120} />
                </label>
                <label className="text-xs font-medium text-graphite/70">
                  {labels.amount}
                  <div className="relative">
                    <input
                      className={`${inputClass} pr-10`}
                      name="amount"
                      defaultValue={order.amountCents === null ? "" : String(order.amountCents / 100)}
                      inputMode="decimal"
                      placeholder="0,00"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-sm text-graphite/55">€</span>
                  </div>
                </label>
                <label className="text-xs font-medium text-graphite/70 sm:col-span-2">
                  {labels.address}
                  <textarea className={textareaClass} name="deliveryAddress" defaultValue={order.deliveryAddress ?? ""} maxLength={1000} />
                </label>
                <label className="text-xs font-medium text-graphite/70">
                  {labels.invoice}
                  <input className={inputClass} name="invoiceNumber" defaultValue={order.invoiceNumber ?? ""} maxLength={200} />
                </label>
                <label className="text-xs font-medium text-graphite/70 sm:col-span-2">
                  {labels.message}
                  <textarea className={textareaClass} name="message" defaultValue={order.message ?? ""} maxLength={4000} />
                </label>
              </div>

              <fieldset className="mt-5 grid gap-3 rounded-lg border border-ink/10 bg-canvas/50 p-4 sm:grid-cols-3">
                {[{ name: "delivered", label: labels.delivered, checked: order.delivered }, { name: "paid", label: labels.paid, checked: order.paid }, { name: "photographed", label: labels.photographed, checked: order.photographed }].map((status) => (
                  <label key={status.name} className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
                    <input name={status.name} type="checkbox" defaultChecked={status.checked} className="size-4 accent-emerald-600" />
                    {status.label}
                  </label>
                ))}
              </fieldset>

              {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

              {confirmDelete ? (
                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-800">{labels.deleteWarning}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={remove} disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-md bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60">
                      {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      {labels.deleteConfirm}
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(false)} disabled={pending} className="h-10 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink hover:bg-canvas">
                      {labels.cancel}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-col-reverse justify-between gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center">
                {!confirmDelete ? (
                  <button type="button" onClick={remove} disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60">
                    <Trash2 size={15} />
                    {labels.delete}
                  </button>
                ) : <span />}
                <div className="flex gap-2">
                  <button type="button" onClick={close} disabled={pending} className="h-10 flex-1 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink hover:bg-canvas sm:flex-none">
                    {labels.cancel}
                  </button>
                  <button type="submit" disabled={pending || confirmDelete} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-ink px-5 text-sm font-medium text-white hover:bg-graphite disabled:cursor-wait disabled:opacity-60 sm:flex-none">
                    {pending ? <LoaderCircle size={15} className="animate-spin" /> : null}
                    {pending ? labels.saving : labels.save}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
