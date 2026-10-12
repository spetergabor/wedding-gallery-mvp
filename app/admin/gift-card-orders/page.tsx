import { Gift, Mail, MapPin, PackageCheck, Store, Truck } from "lucide-react";
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
    intro: "Az irismoment.at Geschenkkarte űrlapján leadott rendelések egy helyen.",
    all: "Összes rendelés",
    pickup: "Személyes átvétel",
    post: "Postai küldés",
    latest: "Legutóbbi rendelések",
    orderedBy: "Megrendelő",
    recipient: "Megajándékozott",
    people: "Létszám",
    personSuffix: "fő",
    delivery: "Átvétel",
    address: "Szállítási cím",
    message: "Megjegyzés",
    noAddress: "Nincs megadva",
    noMessage: "Nincs megjegyzés",
    emptyTitle: "Még nincs ajándékkártya-rendelés",
    emptyText: "Az irismoment.at űrlapjáról érkező új rendelések itt jelennek meg."
  },
  de: {
    eyebrow: "Geschenkkarten",
    title: "Geschenkkarten-Bestellungen",
    intro: "Alle Bestellungen aus dem Geschenkkartenformular auf irismoment.at an einem Ort.",
    all: "Alle Bestellungen",
    pickup: "Persönliche Abholung",
    post: "Postversand",
    latest: "Neueste Bestellungen",
    orderedBy: "Bestellt von",
    recipient: "Beschenkte Person",
    people: "Personen",
    personSuffix: "Pers.",
    delivery: "Übergabe",
    address: "Lieferadresse",
    message: "Nachricht",
    noAddress: "Nicht angegeben",
    noMessage: "Keine Nachricht",
    emptyTitle: "Noch keine Geschenkkarten-Bestellung",
    emptyText: "Neue Bestellungen vom Formular auf irismoment.at erscheinen hier."
  },
  en: {
    eyebrow: "Gift cards",
    title: "Gift card orders",
    intro: "Orders submitted through the gift card form on irismoment.at, all in one place.",
    all: "All orders",
    pickup: "Personal pickup",
    post: "Postal delivery",
    latest: "Latest orders",
    orderedBy: "Ordered by",
    recipient: "Recipient",
    people: "People",
    personSuffix: "people",
    delivery: "Delivery",
    address: "Delivery address",
    message: "Message",
    noAddress: "Not provided",
    noMessage: "No message",
    emptyTitle: "No gift card orders yet",
    emptyText: "New orders from the irismoment.at form will appear here."
  }
} as const;

function isPostalDelivery(value: string) {
  return value.toLocaleLowerCase("de").includes("post");
}

export default async function GiftCardOrdersPage() {
  const [session, language] = await Promise.all([requireAdmin(), getAdminLanguage()]);
  const copy = COPY[language];
  const orders = await prisma.giftCardOrder.findMany({
    where: { adminId: ownerAdminId(session) },
    orderBy: { createdAt: "desc" },
    take: 500
  });
  const postalCount = orders.filter((order) => isPostalDelivery(order.deliveryMethod)).length;
  const pickupCount = orders.length - postalCount;

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">{copy.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">{copy.title}</h1>
        <p className="mt-3 max-w-2xl text-sm text-graphite/70">{copy.intro}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Gift, value: orders.length, label: copy.all },
          { icon: Store, value: pickupCount, label: copy.pickup },
          { icon: Truck, value: postalCount, label: copy.post }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <item.icon size={19} className="text-brass" />
            <strong className="mt-4 block text-2xl text-ink">{item.value}</strong>
            <span className="mt-1 block text-xs uppercase tracking-[0.14em] text-graphite/55">{item.label}</span>
          </div>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
        <div className="border-b border-ink/10 p-5">
          <h2 className="text-xl font-semibold text-ink">{copy.latest}</h2>
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
                      <a href={`mailto:${order.email}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-graphite/70 hover:text-ink hover:underline">
                        <Mail size={14} />
                        {order.email}
                      </a>
                    </div>
                    <time className="shrink-0 text-sm text-graphite/60">
                      {order.createdAt.toLocaleString(language === "hu" ? "hu-HU" : language === "de" ? "de-AT" : "en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: APP_TIME_ZONE
                      })}
                    </time>
                  </div>

                  <dl className="mt-5 grid gap-4 rounded-md bg-canvas/60 p-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-graphite/55">{copy.recipient}</dt>
                      <dd className="mt-1 text-sm font-medium text-ink">{order.recipientName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-graphite/55">{copy.people}</dt>
                      <dd className="mt-1 text-sm font-medium text-ink">{order.personCount}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-graphite/55">{copy.delivery}</dt>
                      <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink">
                        {postal ? <Truck size={14} /> : <PackageCheck size={14} />}
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
