import Link from "next/link";

const updatedAt = "July 8, 2026";

const sections = [
  {
    title: "1. Service overview",
    body: [
      "Spetly is a workflow platform for photographers. It provides tools for client galleries, bookings, customer projects, contracts, invoices, customer portals and optional Google Calendar synchronization.",
      "These Terms describe the basic conditions for using Spetly."
    ]
  },
  {
    title: "2. Accounts and access",
    body: [
      "Users are responsible for keeping login credentials secure and for all activity that happens in their account or team workspace.",
      "A photographer may invite team members and is responsible for granting access only to trusted people."
    ]
  },
  {
    title: "3. Customer and gallery content",
    body: [
      "Photographers are responsible for the images, videos, contracts, invoices and customer information they upload or create in Spetly.",
      "Photographers must have the required rights and permissions to upload, share and process their content and customer data."
    ]
  },
  {
    title: "4. Google Calendar integration",
    body: [
      "Google Calendar integration is optional. A photographer can connect their own Google account through Google's OAuth flow.",
      "When connected, Spetly may create, update or delete calendar events for bookings, projects, meetings and tasks with due dates, list calendars so the photographer can choose a target calendar, and read free/busy availability when enabled.",
      "The photographer can disconnect Google Calendar in Spetly settings or revoke access directly in their Google Account."
    ]
  },
  {
    title: "5. Acceptable use",
    body: [
      "Users may not use Spetly to upload unlawful content, infringe third-party rights, distribute malware, attempt unauthorized access, or interfere with the service.",
      "Spetly may restrict access where necessary to protect the service, other users or legal obligations."
    ]
  },
  {
    title: "6. Availability and changes",
    body: [
      "Spetly is provided as a web application and may change over time as features are improved or adjusted.",
      "Reasonable efforts are made to keep the service available, but uninterrupted access is not guaranteed."
    ]
  },
  {
    title: "7. Third-party services",
    body: [
      "Spetly depends on third-party services such as hosting, database, storage, email and Google APIs.",
      "Use of third-party services may also be subject to their own terms and policies."
    ]
  },
  {
    title: "8. Limitation of liability",
    body: [
      "To the maximum extent permitted by law, Spetly is provided without warranties of uninterrupted or error-free operation.",
      "Users are responsible for keeping appropriate backups of important content and for reviewing generated documents before sending or signing them."
    ]
  },
  {
    title: "9. Contact",
    body: ["Questions about these Terms can be sent to spetergabor@gmail.com."]
  }
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f4] px-6 py-10 text-ink">
      <article className="mx-auto max-w-4xl rounded-lg border border-ink/10 bg-white p-6 shadow-soft md:p-10">
        <header className="border-b border-ink/10 pb-6">
          <Link href="/" className="text-xs font-semibold uppercase tracking-[0.32em] text-brass">
            Spetly
          </Link>
          <h1 className="mt-5 text-4xl font-semibold tracking-normal text-ink md:text-5xl">Terms of Service</h1>
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
          <Link href="/privacy" className="transition hover:text-ink">
            Privacy Policy
          </Link>
          <Link href="/admin/dashboard" className="transition hover:text-ink">
            Admin sign in
          </Link>
        </footer>
      </article>
    </main>
  );
}
