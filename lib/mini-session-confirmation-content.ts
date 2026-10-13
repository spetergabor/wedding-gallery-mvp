export type MiniSessionConfirmationLanguageContent = {
  eyebrow: string;
  title: string;
  intro: string;
  saved: string;
  appointment: string;
  date: string;
  location: string;
  name: string;
  attendees: string;
  saveTitle: string;
  saveText: string;
  emailTitle: string;
  emailText: string;
  spamText: string;
  manage: string;
  manageText: string;
  keepPage: string;
  contact: string;
  googleCalendar: string;
  calendarFile: string;
  copyDetails: string;
  copied: string;
};

export type MiniSessionConfirmationContent = {
  hu: MiniSessionConfirmationLanguageContent;
  de: MiniSessionConfirmationLanguageContent;
};

export const DEFAULT_MINI_SESSION_CONFIRMATION_CONTENT: MiniSessionConfirmationContent = {
  hu: {
    eyebrow: "Sikeres foglalás",
    title: "Az időpontod biztosan le van foglalva",
    intro: "Mentsd el most a naptáradba, így akkor is kéznél lesz, ha a visszaigazoló e-mail a spam mappába kerül.",
    saved: "A foglalás rögzítve és érvényes.",
    appointment: "A foglalásod",
    date: "Időpont",
    location: "Helyszín",
    name: "Név",
    attendees: "Létszám",
    saveTitle: "Mentsd el az időpontot",
    saveText: "Válaszd ki a telefonodon vagy számítógépeden használt naptárt.",
    emailTitle: "E-mailt is küldtünk",
    emailText: "A visszaigazolást erre a címre küldtük:",
    spamText: "Ha néhány percen belül nem találod, nézd meg a spam vagy promóciók mappát is.",
    manage: "Foglalás kezelése",
    manageText: "Ezen a személyes oldalon később módosíthatod vagy lemondhatod az időpontot.",
    keepPage: "Ezt az oldalt is elmentheted a könyvjelzőid közé vagy készíthetsz róla képernyőképet.",
    contact: "Kérdésed van?",
    googleCalendar: "Mentés Google Naptárba",
    calendarFile: "Apple / Outlook naptár",
    copyDetails: "Időpont adatainak másolása",
    copied: "Az időpont adatai másolva"
  },
  de: {
    eyebrow: "Buchung erfolgreich",
    title: "Dein Termin ist sicher gebucht",
    intro: "Speichere ihn jetzt in deinem Kalender. So hast du alle Angaben auch dann griffbereit, wenn die Bestätigungs-E-Mail im Spamordner landet.",
    saved: "Deine Buchung ist gespeichert und verbindlich.",
    appointment: "Deine Buchung",
    date: "Termin",
    location: "Ort",
    name: "Name",
    attendees: "Personen",
    saveTitle: "Termin jetzt speichern",
    saveText: "Wähle den Kalender, den du auf deinem Smartphone oder Computer verwendest.",
    emailTitle: "Wir haben dir auch eine E-Mail geschickt",
    emailText: "Die Bestätigung wurde an diese Adresse gesendet:",
    spamText: "Falls du sie nach einigen Minuten nicht findest, prüfe bitte auch deinen Spam- oder Werbeordner.",
    manage: "Buchung verwalten",
    manageText: "Über diese persönliche Seite kannst du deinen Termin später ändern oder stornieren.",
    keepPage: "Du kannst diese Seite zusätzlich als Lesezeichen oder Screenshot speichern.",
    contact: "Noch eine Frage?",
    googleCalendar: "In Google Kalender speichern",
    calendarFile: "Apple- / Outlook-Kalender",
    copyDetails: "Termindaten kopieren",
    copied: "Termindaten kopiert"
  }
};

const CONTENT_KEYS = Object.keys(
  DEFAULT_MINI_SESSION_CONFIRMATION_CONTENT.hu
) as Array<keyof MiniSessionConfirmationLanguageContent>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resolveMiniSessionConfirmationContent(value: unknown): MiniSessionConfirmationContent {
  const root = isRecord(value) ? value : {};

  return {
    hu: resolveLanguageContent(root.hu, "hu"),
    de: resolveLanguageContent(root.de, "de")
  };
}

function resolveLanguageContent(value: unknown, language: "hu" | "de") {
  const source = isRecord(value) ? value : {};
  const defaults = DEFAULT_MINI_SESSION_CONFIRMATION_CONTENT[language];
  const content = { ...defaults };

  for (const key of CONTENT_KEYS) {
    const candidate = source[key];

    if (typeof candidate === "string" && candidate.trim()) {
      content[key] = candidate.trim();
    }
  }

  return content;
}
