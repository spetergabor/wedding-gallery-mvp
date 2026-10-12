import { CircleDollarSign, Gift, Mail, PackageCheck, Search } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { GiftCardOrderActions } from "@/components/gift-card-order-actions";
import { GiftCardStatusToggle } from "@/components/gift-card-status-toggle";
import { ownerAdminId } from "@/lib/admin-scope";
import { getAdminLanguage } from "@/lib/admin-language";
import { requireAdmin } from "@/lib/auth";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { prisma } from "@/lib/prisma";

const COPY = {
  hu: {
    eyebrow: "Ajándékkártyák",
    title: "Kártyarendelők",
    intro: "Az irismoment.at Geschenkkarte űrlapján leadott és a korábbi listából importált rendelések egy helyen.",
    all: "Összes rendelés",
    unpaid: "Fizetésre vár",
    notPhotographed: "Fotózásra vár",
    latest: "Rendelések",
    searchPlaceholder: "Keresés név, e-mail, cím vagy számlaszám alapján",
    search: "Keresés",
    results: "találat",
    editHint: "Az állapotokat közvetlenül, a többi adatot a Szerkesztés gombbal módosíthatod.",
    customer: "Megrendelő neve",
    personCount: "Hány főre",
    recipient: "Megajándékozott neve",
    deliveredColumn: "Átadva / elküldve",
    paidColumn: "Fizetve?",
    amount: "Összeg",
    photographedColumn: "Fotózva?",
    message: "Komment",
    invoice: "Számlaszám",
    address: "Cím",
    actions: "Műveletek",
    edit: "Szerkesztés",
    editTitle: "Rendelés szerkesztése",
    close: "Bezárás",
    save: "Mentés",
    saving: "Mentés…",
    delete: "Rendelés törlése",
    deleteConfirm: "Igen, végleg törlöm",
    deleteWarning: "A rendelés végleg törlődik, és ez a művelet nem vonható vissza.",
    cancel: "Mégse",
    emailLabel: "E-mail",
    deliveryMethodLabel: "Átvétel módja",
    deleteError: "Nem sikerült törölni",
    personSuffix: "fő",
    noEmail: "Nincs e-mail",
    noAddress: "Nincs megadva",
    noInvoice: "Nincs számla",
    noMessage: "–",
    paid: "Fizetve",
    awaitingPayment: "Nincs fizetve",
    delivered: "Elküldve",
    awaitingDelivery: "Nincs elküldve",
    photographed: "Fotózva",
    awaitingPhoto: "Nincs fotózva",
    saveError: "Nem sikerült menteni",
    emptyTitle: "Nincs találat",
    emptyText: "Módosítsd a keresést, vagy várd meg az új rendeléseket az irismoment.at űrlapjáról."
  },
  de: {
    eyebrow: "Geschenkkarten",
    title: "Geschenkkarten-Bestellungen",
    intro: "Bestellungen aus dem Formular auf irismoment.at und aus der bisherigen Liste an einem Ort.",
    all: "Alle Bestellungen",
    unpaid: "Zahlung ausstehend",
    notPhotographed: "Fotoshooting ausstehend",
    latest: "Bestellungen",
    searchPlaceholder: "Nach Name, E-Mail, Adresse oder Rechnungsnummer suchen",
    search: "Suchen",
    results: "Treffer",
    editHint: "Status können direkt, weitere Daten über Bearbeiten geändert werden.",
    customer: "Name der bestellenden Person",
    personCount: "Personen",
    recipient: "Beschenkte Person",
    deliveredColumn: "Übergeben / gesendet",
    paidColumn: "Bezahlt?",
    amount: "Betrag",
    photographedColumn: "Fotografiert?",
    message: "Kommentar",
    invoice: "Rechnungsnummer",
    address: "Adresse",
    actions: "Aktionen",
    edit: "Bearbeiten",
    editTitle: "Bestellung bearbeiten",
    close: "Schließen",
    save: "Speichern",
    saving: "Speichern…",
    delete: "Bestellung löschen",
    deleteConfirm: "Ja, endgültig löschen",
    deleteWarning: "Die Bestellung wird endgültig gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.",
    cancel: "Abbrechen",
    emailLabel: "E-Mail",
    deliveryMethodLabel: "Übergabeart",
    deleteError: "Löschen fehlgeschlagen",
    personSuffix: "Pers.",
    noEmail: "Keine E-Mail",
    noAddress: "Nicht angegeben",
    noInvoice: "Keine Rechnung",
    noMessage: "–",
    paid: "Bezahlt",
    awaitingPayment: "Nicht bezahlt",
    delivered: "Gesendet",
    awaitingDelivery: "Nicht gesendet",
    photographed: "Fotografiert",
    awaitingPhoto: "Nicht fotografiert",
    saveError: "Speichern fehlgeschlagen",
    emptyTitle: "Keine Treffer",
    emptyText: "Passe die Suche an oder warte auf neue Bestellungen aus dem Formular auf irismoment.at."
  },
  en: {
    eyebrow: "Gift cards",
    title: "Gift card orders",
    intro: "Orders from the irismoment.at form and the previous tracking list, all in one place.",
    all: "All orders",
    unpaid: "Awaiting payment",
    notPhotographed: "Awaiting shoot",
    latest: "Orders",
    searchPlaceholder: "Search by name, email, address or invoice number",
    search: "Search",
    results: "results",
    editHint: "Update statuses directly or use Edit for the other details.",
    customer: "Customer name",
    personCount: "People",
    recipient: "Recipient name",
    deliveredColumn: "Delivered / sent",
    paidColumn: "Paid?",
    amount: "Amount",
    photographedColumn: "Photographed?",
    message: "Comment",
    invoice: "Invoice number",
    address: "Address",
    actions: "Actions",
    edit: "Edit",
    editTitle: "Edit order",
    close: "Close",
    save: "Save",
    saving: "Saving…",
    delete: "Delete order",
    deleteConfirm: "Yes, delete permanently",
    deleteWarning: "The order will be permanently deleted. This action cannot be undone.",
    cancel: "Cancel",
    emailLabel: "Email",
    deliveryMethodLabel: "Delivery method",
    deleteError: "Could not delete",
    personSuffix: "people",
    noEmail: "No email",
    noAddress: "Not provided",
    noInvoice: "No invoice",
    noMessage: "–",
    paid: "Paid",
    awaitingPayment: "Not paid",
    delivered: "Sent",
    awaitingDelivery: "Not sent",
    photographed: "Photographed",
    awaitingPhoto: "Not photographed",
    saveError: "Could not save",
    emptyTitle: "No results",
    emptyText: "Adjust the search or wait for new orders from the form on irismoment.at."
  }
} as const;

function formatAmount(amountCents: number | null, language: keyof typeof COPY) {
  if (amountCents === null) return "–";
  return new Intl.NumberFormat(language === "hu" ? "hu-HU" : language === "de" ? "de-AT" : "en-US", {
    style: "currency",
    currency: "EUR"
  }).format(amountCents / 100);
}

function formatOrderDate(date: Date, language: keyof typeof COPY) {
  return date.toLocaleDateString(language === "hu" ? "hu-HU" : language === "de" ? "de-AT" : "en-US", {
    dateStyle: "medium",
    timeZone: APP_TIME_ZONE
  });
}

export default async function GiftCardOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [session, language, params] = await Promise.all([requireAdmin(), getAdminLanguage(), searchParams]);
  const copy = COPY[language];
  const allOrders = await prisma.giftCardOrder.findMany({
    where: { adminId: ownerAdminId(session) },
    orderBy: [{ createdAt: "desc" }, { sourceOrder: "desc" }],
    take: 1000
  });
  const query = params.q?.trim().toLocaleLowerCase(language) ?? "";
  const orders = query
    ? allOrders.filter((order) =>
        [order.customerName, order.recipientName, order.email, order.deliveryAddress, order.invoiceNumber, order.message]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase(language).includes(query))
      )
    : allOrders;
  const unpaidCount = allOrders.filter((order) => !order.paid).length;
  const notPhotographedCount = allOrders.filter((order) => !order.photographed).length;

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">{copy.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">{copy.title}</h1>
        <p className="mt-3 max-w-2xl text-sm text-graphite/70">{copy.intro}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Gift, value: allOrders.length, label: copy.all },
          { icon: CircleDollarSign, value: unpaidCount, label: copy.unpaid },
          { icon: PackageCheck, value: notPhotographedCount, label: copy.notPhotographed }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <item.icon size={19} className="text-brass" />
            <strong className="mt-4 block text-2xl text-ink">{item.value}</strong>
            <span className="mt-1 block text-xs uppercase tracking-[0.14em] text-graphite/55">{item.label}</span>
          </div>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
        <div className="flex flex-col justify-between gap-4 border-b border-ink/10 p-5 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-xl font-semibold text-ink">{copy.latest}</h2>
            <p className="mt-1 text-sm text-graphite/60">
              {orders.length} {copy.results}. {copy.editHint}
            </p>
          </div>
          <form className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-3.5 text-graphite/45" size={16} />
              <input
                name="q"
                defaultValue={params.q}
                placeholder={copy.searchPlaceholder}
                className="h-11 w-full rounded-md border border-ink/15 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-ink/50"
              />
            </label>
            <button className="h-11 rounded-md bg-ink px-5 text-sm font-medium text-white transition hover:bg-graphite">{copy.search}</button>
          </form>
        </div>

        {orders.length ? (
          <div className="max-h-[68vh] overflow-auto">
            <table className="w-full min-w-[1480px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-20 bg-stone-100 text-[11px] uppercase tracking-[0.1em] text-graphite/65 shadow-[0_1px_0_rgba(24,24,27,0.12)]">
                <tr>
                  <th className="sticky left-0 z-30 min-w-56 border-r border-ink/10 bg-stone-100 px-4 py-3 font-semibold">{copy.customer}</th>
                  <th className="w-24 border-r border-ink/10 px-3 py-3 text-center font-semibold">{copy.personCount}</th>
                  <th className="min-w-52 border-r border-ink/10 px-4 py-3 font-semibold">{copy.recipient}</th>
                  <th className="min-w-40 border-r border-ink/10 px-3 py-3 font-semibold">{copy.deliveredColumn}</th>
                  <th className="min-w-36 border-r border-ink/10 px-3 py-3 font-semibold">{copy.paidColumn}</th>
                  <th className="w-28 border-r border-ink/10 px-3 py-3 text-right font-semibold">{copy.amount}</th>
                  <th className="min-w-40 border-r border-ink/10 px-3 py-3 font-semibold">{copy.photographedColumn}</th>
                  <th className="min-w-60 border-r border-ink/10 px-4 py-3 font-semibold">{copy.message}</th>
                  <th className="min-w-40 border-r border-ink/10 px-4 py-3 font-semibold">{copy.invoice}</th>
                  <th className="min-w-64 border-r border-ink/10 px-4 py-3 font-semibold">{copy.address}</th>
                  <th className="sticky right-0 z-30 w-32 bg-stone-100 px-3 py-3 text-center font-semibold">{copy.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {orders.map((order) => (
                  <tr key={order.id} className="group align-top transition hover:bg-brass/[0.035]">
                    <td className="sticky left-0 z-10 border-r border-ink/10 bg-white px-4 py-3 group-hover:bg-[#fdfbf7]">
                      <strong className="block font-semibold text-ink">{order.customerName}</strong>
                      {order.email ? (
                        <a href={`mailto:${order.email}`} className="mt-1 inline-flex items-center gap-1.5 text-xs text-graphite/65 hover:text-ink hover:underline">
                          <Mail size={12} />
                          {order.email}
                        </a>
                      ) : (
                        <span className="mt-1 block text-xs text-graphite/45">{copy.noEmail}</span>
                      )}
                      <span className="mt-1 block text-[11px] text-graphite/45">
                        {order.sourceOrder !== null ? order.source : formatOrderDate(order.createdAt, language)}
                      </span>
                    </td>
                    <td className="border-r border-ink/10 px-3 py-3 text-center font-medium text-ink">
                      {order.personCount} <span className="text-xs font-normal text-graphite/55">{copy.personSuffix}</span>
                    </td>
                    <td className="border-r border-ink/10 px-4 py-3 font-medium text-ink">{order.recipientName}</td>
                    <td className="border-r border-ink/10 bg-stone-50/50 px-3 py-3">
                      <GiftCardStatusToggle
                        orderId={order.id}
                        field="delivered"
                        checked={order.delivered}
                        activeLabel={copy.delivered}
                        inactiveLabel={copy.awaitingDelivery}
                        errorLabel={copy.saveError}
                      />
                    </td>
                    <td className="border-r border-ink/10 bg-stone-50/50 px-3 py-3">
                      <GiftCardStatusToggle
                        orderId={order.id}
                        field="paid"
                        checked={order.paid}
                        activeLabel={copy.paid}
                        inactiveLabel={copy.awaitingPayment}
                        errorLabel={copy.saveError}
                      />
                    </td>
                    <td className="whitespace-nowrap border-r border-ink/10 px-3 py-3 text-right font-semibold tabular-nums text-ink">
                      {formatAmount(order.amountCents, language)}
                    </td>
                    <td className="border-r border-ink/10 bg-stone-50/50 px-3 py-3">
                      <GiftCardStatusToggle
                        orderId={order.id}
                        field="photographed"
                        checked={order.photographed}
                        activeLabel={copy.photographed}
                        inactiveLabel={copy.awaitingPhoto}
                        errorLabel={copy.saveError}
                      />
                    </td>
                    <td className="max-w-72 whitespace-pre-wrap border-r border-ink/10 px-4 py-3 text-xs leading-5 text-graphite/75">
                      {order.message || copy.noMessage}
                    </td>
                    <td className="border-r border-ink/10 px-4 py-3 text-xs font-medium text-ink">{order.invoiceNumber || copy.noInvoice}</td>
                    <td className="border-r border-ink/10 px-4 py-3 text-xs leading-5 text-graphite/75">
                      <span className="block font-medium text-ink">{order.deliveryAddress || copy.noAddress}</span>
                      <span className="mt-1 block text-[11px] text-graphite/50">{order.deliveryMethod}</span>
                    </td>
                    <td className="sticky right-0 z-10 bg-white px-3 py-3 text-center group-hover:bg-[#fdfbf7]">
                      <GiftCardOrderActions
                        order={{
                          id: order.id,
                          customerName: order.customerName,
                          email: order.email,
                          recipientName: order.recipientName,
                          personCount: order.personCount,
                          deliveryMethod: order.deliveryMethod,
                          deliveryAddress: order.deliveryAddress,
                          amountCents: order.amountCents,
                          invoiceNumber: order.invoiceNumber,
                          message: order.message,
                          delivered: order.delivered,
                          paid: order.paid,
                          photographed: order.photographed
                        }}
                        labels={{
                          edit: copy.edit,
                          editTitle: copy.editTitle,
                          close: copy.close,
                          save: copy.save,
                          saving: copy.saving,
                          delete: copy.delete,
                          deleteConfirm: copy.deleteConfirm,
                          deleteWarning: copy.deleteWarning,
                          cancel: copy.cancel,
                          customer: copy.customer,
                          email: copy.emailLabel,
                          personCount: copy.personCount,
                          recipient: copy.recipient,
                          deliveryMethod: copy.deliveryMethodLabel,
                          address: copy.address,
                          amount: copy.amount,
                          invoice: copy.invoice,
                          message: copy.message,
                          delivered: copy.deliveredColumn,
                          paid: copy.paidColumn,
                          photographed: copy.photographedColumn,
                          saveError: copy.saveError,
                          deleteError: copy.deleteError
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Gift className="mx-auto text-graphite/35" size={36} />
            <h3 className="mt-4 font-semibold text-ink">{copy.emptyTitle}</h3>
            <p className="mt-2 text-sm text-graphite/65">{copy.emptyText}</p>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
