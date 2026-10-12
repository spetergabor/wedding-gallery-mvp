import { CircleDollarSign, Gift, Mail, MapPin, PackageCheck, Search, Store, Truck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { getAdminLanguage } from "@/lib/admin-language";
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
    recipient: "Megajándékozott",
    personSuffix: "fő",
    delivery: "Átvétel",
    address: "Szállítási cím",
    amount: "Összeg",
    invoice: "Számlaszám",
    message: "Megjegyzés",
    noEmail: "Nincs e-mail",
    noAddress: "Nincs megadva",
    noInvoice: "Nincs számla",
    noMessage: "Nincs megjegyzés",
    paid: "Fizetve",
    awaitingPayment: "Fizetésre vár",
    delivered: "Átadva / elküldve",
    awaitingDelivery: "Átadásra vár",
    photographed: "Fotózva",
    awaitingPhoto: "Fotózásra vár",
    imported: "Forrás",
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
    recipient: "Beschenkte Person",
    personSuffix: "Pers.",
    delivery: "Übergabe",
    address: "Lieferadresse",
    amount: "Betrag",
    invoice: "Rechnungsnummer",
    message: "Nachricht",
    noEmail: "Keine E-Mail",
    noAddress: "Nicht angegeben",
    noInvoice: "Keine Rechnung",
    noMessage: "Keine Nachricht",
    paid: "Bezahlt",
    awaitingPayment: "Zahlung ausstehend",
    delivered: "Übergeben / gesendet",
    awaitingDelivery: "Übergabe ausstehend",
    photographed: "Fotografiert",
    awaitingPhoto: "Fotoshooting ausstehend",
    imported: "Quelle",
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
    recipient: "Recipient",
    personSuffix: "people",
    delivery: "Delivery",
    address: "Delivery address",
    amount: "Amount",
    invoice: "Invoice number",
    message: "Message",
    noEmail: "No email",
    noAddress: "Not provided",
    noInvoice: "No invoice",
    noMessage: "No message",
    paid: "Paid",
    awaitingPayment: "Awaiting payment",
    delivered: "Delivered / sent",
    awaitingDelivery: "Awaiting delivery",
    photographed: "Photographed",
    awaitingPhoto: "Awaiting shoot",
    imported: "Source",
    emptyTitle: "No results",
    emptyText: "Adjust the search or wait for new orders from the form on irismoment.at."
  }
} as const;

function isPostalDelivery(value: string) {
  return value.toLocaleLowerCase("de").includes("post");
}

function formatAmount(amountCents: number | null, language: keyof typeof COPY) {
  if (amountCents === null) return "–";
  return new Intl.NumberFormat(language === "hu" ? "hu-HU" : language === "de" ? "de-AT" : "en-US", {
    style: "currency",
    currency: "EUR"
  }).format(amountCents / 100);
}

function StatusBadge({ active, positive, negative }: { active: boolean; positive: string; negative: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
      {active ? positive : negative}
    </span>
  );
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
            <p className="mt-1 text-sm text-graphite/60">{orders.length} {copy.results}</p>
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
          <div className="divide-y divide-ink/10">
            {orders.map((order) => {
              const postal = isPostalDelivery(order.deliveryMethod);
              return (
                <article id={`order-${order.id}`} key={order.id} className="scroll-mt-24 p-5 transition target:bg-brass/5 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-ink">{order.customerName}</h3>
                        <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                          {order.personCount} {copy.personSuffix}
                        </span>
                      </div>
                      {order.email ? (
                        <a href={`mailto:${order.email}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-graphite/70 hover:text-ink hover:underline">
                          <Mail size={14} />
                          {order.email}
                        </a>
                      ) : (
                        <p className="mt-1 text-sm text-graphite/55">{copy.noEmail}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <StatusBadge active={order.paid} positive={copy.paid} negative={copy.awaitingPayment} />
                      <StatusBadge active={order.delivered} positive={copy.delivered} negative={copy.awaitingDelivery} />
                      <StatusBadge active={order.photographed} positive={copy.photographed} negative={copy.awaitingPhoto} />
                    </div>
                  </div>

                  <dl className="mt-5 grid gap-4 rounded-md bg-canvas/60 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-graphite/55">{copy.recipient}</dt>
                      <dd className="mt-1 text-sm font-medium text-ink">{order.recipientName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-graphite/55">{copy.amount}</dt>
                      <dd className="mt-1 text-sm font-medium text-ink">{formatAmount(order.amountCents, language)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-graphite/55">{copy.invoice}</dt>
                      <dd className="mt-1 text-sm font-medium text-ink">{order.invoiceNumber || copy.noInvoice}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-graphite/55">{copy.delivery}</dt>
                      <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink">
                        {postal ? <Truck size={14} /> : <Store size={14} />}
                        {order.deliveryMethod}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-graphite/55">{copy.address}</dt>
                      <dd className="mt-1 flex items-start gap-1.5 text-sm font-medium text-ink">
                        <MapPin size={14} className="mt-0.5 shrink-0" />
                        <span>{order.deliveryAddress || copy.noAddress}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-graphite/55">{copy.imported}</dt>
                      <dd className="mt-1 text-sm font-medium text-ink">
                        {order.sourceOrder !== null
                          ? order.source
                          : order.createdAt.toLocaleString(language === "hu" ? "hu-HU" : language === "de" ? "de-AT" : "en-US", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: APP_TIME_ZONE
                            })}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-graphite/55">{copy.message}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-graphite/75">{order.message || copy.noMessage}</p>
                  </div>
                </article>
              );
            })}
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
