import { Bell, Mail } from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import type { AdminLanguage } from "@/lib/admin-language";
import {
  ADMIN_NOTIFICATION_TOPICS,
  type AdminNotificationPreferences,
  type AdminNotificationTopic
} from "@/lib/admin-notification-preferences";
import { updateAdminNotificationPreferencesAction } from "@/lib/settings-actions";

const COPY = {
  hu: {
    eyebrow: "Értesítések",
    title: "Miről szeretnél értesítést kapni?",
    intro: "Külön beállíthatod, mi jelenjen meg a Spetly értesítési központjában, és miről érkezzen e-mail.",
    inApp: "Spetlyben",
    inAppHint: "A fejléc csengő ikonjánál jelenik meg.",
    email: "E-mailben",
    emailHint: (email: string) => `A levelek ide érkeznek: ${email}`,
    event: "Esemény",
    save: "Értesítések mentése",
    saving: "Mentés...",
    masterHint: "A felső kapcsoló az egész csatornát letiltja, az eseményenkénti választásaidat közben megőrizzük."
  },
  de: {
    eyebrow: "Benachrichtigungen",
    title: "Worüber möchtest du benachrichtigt werden?",
    intro: "Lege getrennt fest, was im Spetly-Benachrichtigungscenter erscheint und wofür du eine E-Mail erhältst.",
    inApp: "In Spetly",
    inAppHint: "Erscheint unter dem Glocken-Symbol in der Kopfzeile.",
    email: "Per E-Mail",
    emailHint: (email: string) => `Die Nachrichten gehen an: ${email}`,
    event: "Ereignis",
    save: "Benachrichtigungen speichern",
    saving: "Speichern...",
    masterHint: "Der obere Schalter deaktiviert den ganzen Kanal. Deine Auswahl pro Ereignis bleibt gespeichert."
  },
  en: {
    eyebrow: "Notifications",
    title: "What would you like to be notified about?",
    intro: "Choose separately what appears in Spetly's notification center and what should also be sent by email.",
    inApp: "In Spetly",
    inAppHint: "Appears under the bell icon in the header.",
    email: "By email",
    emailHint: (email: string) => `Messages are sent to: ${email}`,
    event: "Event",
    save: "Save notifications",
    saving: "Saving...",
    masterHint: "The master switch disables the entire channel while preserving your per-event choices."
  }
} as const;

const TOPIC_COPY: Record<AdminLanguage, Record<AdminNotificationTopic, { title: string; description: string }>> = {
  hu: {
    lead_created: { title: "Új megkeresés", description: "Új ajánlatkérés érkezik a weboldalról vagy a kontakt űrlapról." },
    mini_session_booking: { title: "Új mini shooting foglalás", description: "Valaki lefoglal egy szabad mini session időpontot." },
    mini_session_cancellation: { title: "Foglalás lemondása", description: "Egy mini shooting időpontot lemondanak." },
    favorite_list_started: { title: "Válogatás elkezdve", description: "Az ügyfél először jelöl kedvenc képet egy galériában." },
    favorite_list_submitted: { title: "Válogatás beküldve", description: "Az ügyfél lezárja és elküldi a végleges kedvenc listáját." },
    gallery_zip_ready: { title: "Galéria ZIP elkészült", description: "A háttérben generált teljes letöltési csomag elkészül." },
    contract_signed: { title: "Szerződés aláírva", description: "Az ügyfél elektronikusan aláír egy szerződést." },
    album_review_submitted: { title: "Album javítási javaslat beküldve", description: "Az ügyfél befejezi és elküldi az albumellenőrzést." }
  },
  de: {
    lead_created: { title: "Neue Anfrage", description: "Eine neue Anfrage kommt über die Website oder das Kontaktformular an." },
    mini_session_booking: { title: "Neue Mini-Shooting-Buchung", description: "Jemand bucht einen freien Termin für eine Mini Session." },
    mini_session_cancellation: { title: "Buchung storniert", description: "Ein Termin für ein Mini Shooting wird storniert." },
    favorite_list_started: { title: "Auswahl begonnen", description: "Der Kunde markiert zum ersten Mal ein Lieblingsbild in einer Galerie." },
    favorite_list_submitted: { title: "Auswahl abgeschickt", description: "Der Kunde schließt seine Favoritenliste ab und sendet sie." },
    gallery_zip_ready: { title: "Galerie-ZIP ist fertig", description: "Das im Hintergrund erstellte Download-Paket ist bereit." },
    contract_signed: { title: "Vertrag unterschrieben", description: "Der Kunde unterschreibt einen Vertrag elektronisch." },
    album_review_submitted: { title: "Albumkorrekturen abgeschickt", description: "Der Kunde beendet und sendet die Albumprüfung." }
  },
  en: {
    lead_created: { title: "New inquiry", description: "A new inquiry arrives from the website or contact form." },
    mini_session_booking: { title: "New mini-session booking", description: "Someone books an available mini-session slot." },
    mini_session_cancellation: { title: "Booking cancelled", description: "A mini-session appointment is cancelled." },
    favorite_list_started: { title: "Selection started", description: "A client marks their first favorite in a gallery." },
    favorite_list_submitted: { title: "Selection submitted", description: "A client finalizes and submits their favorites." },
    gallery_zip_ready: { title: "Gallery ZIP ready", description: "The full gallery download package is ready." },
    contract_signed: { title: "Contract signed", description: "A client electronically signs a contract." },
    album_review_submitted: { title: "Album feedback submitted", description: "A client finishes and submits the album review." }
  }
};

function ChannelSwitch({
  name,
  label,
  hint,
  defaultChecked,
  icon: Icon
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
  icon: typeof Bell;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-ink/10 bg-canvas/50 p-4 transition hover:border-ink/20">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="mt-1 size-4 accent-ink" />
      <Icon size={18} className="mt-0.5 shrink-0 text-brass" />
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-graphite/65">{hint}</span>
      </span>
    </label>
  );
}

export function AdminNotificationSettings({
  preferences,
  recipientEmail,
  language
}: {
  preferences: AdminNotificationPreferences;
  recipientEmail: string;
  language: AdminLanguage;
}) {
  const copy = COPY[language];
  const topicCopy = TOPIC_COPY[language];

  return (
    <form action={updateAdminNotificationPreferencesAction} className="overflow-hidden rounded-md border border-ink/10 bg-white shadow-[0_1px_0_rgba(23,23,23,0.03)]">
      <div className="border-b border-ink/10 p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-brass">
          <Bell size={15} />
          {copy.eyebrow}
        </div>
        <h2 className="mt-2 text-xl font-semibold text-ink">{copy.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite/70">{copy.intro}</p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ChannelSwitch name="inAppEnabled" label={copy.inApp} hint={copy.inAppHint} defaultChecked={preferences.inAppEnabled} icon={Bell} />
          <ChannelSwitch name="emailEnabled" label={copy.email} hint={copy.emailHint(recipientEmail)} defaultChecked={preferences.emailEnabled} icon={Mail} />
        </div>
        <p className="mt-3 text-xs leading-5 text-graphite/55">{copy.masterHint}</p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[minmax(0,1fr)_110px_110px] items-center border-b border-ink/10 bg-canvas/60 px-5 py-3 text-xs font-medium uppercase tracking-[0.12em] text-graphite/60 sm:px-6">
            <span>{copy.event}</span>
            <span className="text-center">{copy.inApp}</span>
            <span className="text-center">{copy.email}</span>
          </div>
          {ADMIN_NOTIFICATION_TOPICS.map((topic) => (
            <div key={topic.key} className="grid grid-cols-[minmax(0,1fr)_110px_110px] items-center border-b border-ink/10 px-5 py-4 last:border-b-0 sm:px-6">
              <div className="pr-5">
                <p className="text-sm font-semibold text-ink">{topicCopy[topic.key].title}</p>
                <p className="mt-1 text-xs leading-5 text-graphite/65">{topicCopy[topic.key].description}</p>
              </div>
              <label className="flex min-h-10 cursor-pointer items-center justify-center" aria-label={`${topicCopy[topic.key].title} – ${copy.inApp}`}>
                <input
                  name={`topic__${topic.key}__inApp`}
                  type="checkbox"
                  defaultChecked={preferences.topics[topic.key].inApp}
                  className="size-4 accent-ink"
                />
              </label>
              <label className="flex min-h-10 cursor-pointer items-center justify-center" aria-label={`${topicCopy[topic.key].title} – ${copy.email}`}>
                <input
                  name={`topic__${topic.key}__email`}
                  type="checkbox"
                  defaultChecked={preferences.topics[topic.key].email}
                  className="size-4 accent-ink"
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end border-t border-ink/10 bg-canvas/40 p-5 sm:p-6">
        <FormSubmitButton pendingLabel={copy.saving}>{copy.save}</FormSubmitButton>
      </div>
    </form>
  );
}
