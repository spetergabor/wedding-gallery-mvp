import Link from "next/link";

const updatedAt = "July 8, 2026";

const sections = [
  {
    title: "1. Who we are",
    body: [
      "Spetly is a web application for photographers to manage client galleries, bookings, customer projects, contracts, invoices and related communication.",
      "For privacy questions, contact the app owner at spetergabor@gmail.com."
    ]
  },
  {
    title: "2. Information processed in Spetly",
    body: [
      "Spetly may process account information, client names, email addresses, phone numbers, booking details, project dates, gallery metadata, uploaded media, contract data, invoice data and technical logs required to operate the service.",
      "Photographers decide what client and project information they add to their workspace."
    ]
  },
  {
    title: "3. Google Calendar data",
    body: [
      "If a photographer connects Google Calendar, Spetly requests access only after the photographer explicitly grants permission through Google's OAuth consent flow.",
      "Spetly uses Google Calendar access to show available calendars, create, update and delete calendar events for confirmed bookings, dated customer projects, meetings and tasks with due dates, and read free/busy availability when the photographer enables availability blocking.",
      "Spetly stores the selected calendar ID, Google account email, encrypted OAuth tokens, Google event IDs, sync timestamps and sync errors needed to provide calendar sync."
    ]
  },
  {
    title: "4. Google API Limited Use disclosure",
    body: [
      "Spetly's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.",
      "Google user data is not sold, used for advertising, transferred to advertising platforms or data brokers, or used to train generalized AI models.",
      "Google Calendar data is used only to provide user-facing calendar synchronization and availability features requested by the connected photographer."
    ]
  },
  {
    title: "5. How data is protected",
    body: [
      "Spetly uses access controls, HTTPS, encrypted token storage and operational safeguards to reduce unauthorized access.",
      "No internet service can be guaranteed to be perfectly secure, but Spetly is designed to limit access to the photographers and workspace users who need the data."
    ]
  },
  {
    title: "6. Sharing of data",
    body: [
      "Spetly does not sell personal data.",
      "Data may be processed by infrastructure and service providers required to operate the application, such as hosting, email delivery, storage and database providers.",
      "Client-facing pages may show gallery, booking, contract or portal information when the photographer intentionally shares a public or private link."
    ]
  },
  {
    title: "7. Data retention and deletion",
    body: [
      "Workspace data is retained while the photographer uses the service or as required for legitimate operational, legal or accounting needs.",
      "Photographers can delete client data, projects, bookings and galleries from the admin interface where supported.",
      "Google Calendar access can be disconnected in Spetly settings or revoked from the user's Google Account permissions page."
    ]
  },
  {
    title: "8. Your rights",
    body: [
      "Depending on your location, you may have rights to access, correct, delete or restrict processing of your personal data.",
      "To exercise these rights, contact the photographer who manages your data in Spetly or email spetergabor@gmail.com."
    ]
  },
  {
    title: "9. Changes",
    body: ["This policy may be updated as Spetly evolves. The latest version will be published on this page."]
  }
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f4] px-6 py-10 text-ink">
      <article className="mx-auto max-w-4xl rounded-lg border border-ink/10 bg-white p-6 shadow-soft md:p-10">
        <header className="border-b border-ink/10 pb-6">
          <Link href="/" className="text-xs font-semibold uppercase tracking-[0.32em] text-brass">
            Spetly
          </Link>
          <h1 className="mt-5 text-4xl font-semibold tracking-normal text-ink md:text-5xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-graphite/70">Last updated: {updatedAt}</p>
        </header>
        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-ink">{section.title}</h2>
              <div className="mt-3 space-y-3 text-base leading-7 text-graphite/78">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <footer className="mt-10 flex flex-wrap gap-4 border-t border-ink/10 pt-5 text-sm font-medium text-graphite">
          <Link href="/" className="transition hover:text-ink">
            Home
          </Link>
          <Link href="/terms" className="transition hover:text-ink">
            Terms of Service
          </Link>
          <Link href="/admin/dashboard" className="transition hover:text-ink">
            Admin sign in
          </Link>
        </footer>
      </article>
    </main>
  );
}
