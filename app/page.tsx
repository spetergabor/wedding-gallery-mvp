import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSignature,
  GalleryVerticalEnd,
  Images,
  Layers3,
  Link2,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const coreFeatures: Feature[] = [
  {
    title: "Gallery management and download sharing",
    description:
      "Deliver polished galleries, organize media into sections, share private links and prepare full-resolution ZIP downloads without extra tools.",
    icon: GalleryVerticalEnd,
  },
  {
    title: "Contracts in two clicks",
    description:
      "Prepare, send and track contracts directly from the client record, with signature status visible where you already work.",
    icon: FileSignature,
  },
  {
    title: "Online album proofing",
    description:
      "Let clients review album spreads online, approve changes and keep feedback out of scattered email threads.",
    icon: BookOpenCheck,
  },
  {
    title: "Booking pages with Google Calendar sync",
    description:
      "Create mini sessions, always-bookable services and synced availability so every booking lands in the right calendar.",
    icon: CalendarDays,
  },
  {
    title: "Complete client management",
    description:
      "Clients, projects, meetings, contracts, galleries, tasks and timelines stay connected in one calm workspace.",
    icon: UsersRound,
  },
  {
    title: "One subscription instead of four",
    description:
      "Replace a gallery tool, contract tool, album proofing tool and booking tool with one platform made for photographers.",
    icon: Layers3,
  },
];

const workflowSteps = [
  "Client booked",
  "Contract sent",
  "Gallery delivered",
  "Album approved",
];

const previewRows = [
  {
    label: "Gallery",
    title: "Maria and Thomas",
    meta: "1,294 media · full-size ZIP ready",
    icon: Images,
  },
  {
    label: "Contract",
    title: "Wedding agreement",
    meta: "Signed · copy sent to both clients",
    icon: FileSignature,
  },
  {
    label: "Booking",
    title: "Spring mini sessions",
    meta: "12 slots booked · Google Calendar synced",
    icon: CalendarDays,
  },
];

const replacedTools = [
  "Gallery delivery",
  "Download sharing",
  "Contract signing",
  "Album proofing",
  "Booking calendar",
  "Client CRM",
];

function ProductPreview({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-md border border-ink/10 bg-white p-4 shadow-[0_24px_80px_rgba(23,23,23,0.12)] ${className}`}
    >
      <div className="flex items-center justify-between border-b border-ink/10 pb-4">
        <div>
          <p className="text-sm font-semibold text-ink">Today in Spetly</p>
          <p className="text-sm text-graphite/70">A connected workspace for client work</p>
        </div>
        <div className="rounded-md bg-sage/10 px-3 py-2 text-sm font-semibold text-sage">
          Live
        </div>
      </div>

      <div className="grid gap-3 py-4">
        {previewRows.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title} className="flex items-start gap-3 rounded-md bg-paper p-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white text-brass">
                <Icon size={20} strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-brass">{item.label}</p>
                  <CheckCircle2 className="text-sage" size={16} strokeWidth={2} />
                </div>
                <p className="mt-1 text-lg font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-sm text-graphite/70">{item.meta}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 border-t border-ink/10 pt-4 sm:grid-cols-3">
        <div className="rounded-md bg-ink p-4 text-white">
          <p className="text-2xl font-semibold">18</p>
          <p className="mt-1 text-sm text-white/70">Upcoming jobs</p>
        </div>
        <div className="rounded-md bg-mist p-4">
          <p className="text-2xl font-semibold text-ink">42</p>
          <p className="mt-1 text-sm text-graphite/70">Active clients</p>
        </div>
        <div className="rounded-md bg-mist p-4">
          <p className="text-2xl font-semibold text-ink">7</p>
          <p className="mt-1 text-sm text-graphite/70">Mini sessions</p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;

  return (
    <article className="rounded-md border border-ink/10 bg-white p-6 shadow-[0_14px_45px_rgba(23,23,23,0.05)]">
      <div className="flex size-12 items-center justify-center rounded-md bg-sage/10 text-sage">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-ink">{feature.title}</h3>
      <p className="mt-3 text-base leading-7 text-graphite/75">{feature.description}</p>
    </article>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="relative isolate overflow-hidden border-b border-ink/10 bg-[#f4f5f1]">
        <div className="absolute inset-y-0 right-0 hidden w-[46%] bg-white/55 lg:block" aria-hidden="true" />

        <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
          <header className="flex items-center justify-between gap-4 py-6">
            <Link href="/" className="text-2xl font-semibold text-ink">
              Spetly
            </Link>
            <nav className="hidden items-center gap-7 text-sm font-semibold text-graphite/75 md:flex">
              <a className="transition hover:text-ink" href="#features">
                Product
              </a>
              <a className="transition hover:text-ink" href="#workflow">
                Workflow
              </a>
              <a className="transition hover:text-ink" href="#one-subscription">
                Why Spetly
              </a>
            </nav>
            <Link
              href="/admin/dashboard"
              className="rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/90"
            >
              Sign in
            </Link>
          </header>

          <div className="relative py-14 lg:py-16 xl:grid xl:min-h-[680px] xl:grid-cols-[minmax(0,580px)_minmax(540px,1fr)] xl:items-center xl:gap-16 xl:py-20">
            <div className="max-w-[620px] xl:max-w-[580px]">
              <p className="text-sm font-semibold text-brass">Client workflow platform for photographers</p>
              <h1 className="font-playfair mt-5 text-6xl leading-none text-ink sm:text-7xl lg:text-8xl">
                Spetly
              </h1>
              <p className="mt-7 text-2xl font-semibold leading-tight text-ink sm:text-3xl">
                One workspace for galleries, contracts, albums, bookings and client management.
              </p>
              <p className="mt-6 max-w-xl text-lg leading-8 text-graphite/75">
                Built for photographers who want client delivery, mini sessions, Google Calendar bookings
                and daily admin to feel connected instead of scattered across separate subscriptions.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/admin/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-3 text-base font-semibold text-white transition hover:bg-ink/90"
                >
                  Open Spetly
                  <ArrowRight size={18} strokeWidth={2} />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-5 py-3 text-base font-semibold text-ink transition hover:border-ink/35"
                >
                  Explore features
                </a>
              </div>

              <div className="mt-10 grid max-w-xl gap-3 sm:grid-cols-3">
                {["Galleries", "Contracts", "Bookings"].map((item) => (
                  <div key={item} className="rounded-md border border-ink/10 bg-white/75 p-4">
                    <CheckCircle2 className="text-sage" size={18} strokeWidth={2} />
                    <p className="mt-3 text-sm font-semibold text-ink">{item}</p>
                    <p className="mt-1 text-sm text-graphite/65">inside one flow</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 xl:hidden">
              <ProductPreview />
            </div>

            <div className="pointer-events-none hidden xl:block">
              <ProductPreview />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-brass">What Spetly solves</p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            The important parts of a photography business, connected.
          </h2>
          <p className="mt-5 text-lg leading-8 text-graphite/75">
            Spetly keeps the full client journey in one place, from the first booking to the final
            gallery download and album approval.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {coreFeatures.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </section>

      <section id="workflow" className="border-y border-ink/10 bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-brass">Daily workflow</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-ink sm:text-5xl">
              From booking to delivery without losing context.
            </h2>
            <p className="mt-5 text-lg leading-8 text-graphite/75">
              Create a mini session, take bookings, sync them to Google Calendar, send the contract,
              deliver the gallery and track the client from the same place.
            </p>
          </div>

          <div className="rounded-md border border-ink/10 bg-paper p-5">
            <div className="grid gap-3">
              {workflowSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-4 rounded-md bg-white p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ink text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-ink">{step}</p>
                    <p className="text-sm text-graphite/65">Visible on the client timeline</p>
                  </div>
                  <ArrowRight className="hidden text-brass sm:block" size={20} strokeWidth={2} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="one-subscription" className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
        <div className="rounded-md border border-ink/10 bg-ink p-6 text-white sm:p-10">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <div className="flex size-12 items-center justify-center rounded-md bg-white/10 text-white">
                <ShieldCheck size={24} strokeWidth={1.8} />
              </div>
              <h2 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl">
                Four separate subscriptions, replaced by one photography workspace.
              </h2>
              <p className="mt-5 text-lg leading-8 text-white/72">
                Fewer logins, fewer broken handoffs, fewer places to check when a client asks what
                happens next.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {replacedTools.map((tool) => (
                <div key={tool} className="flex items-center gap-3 rounded-md bg-white/10 p-4">
                  <CheckCircle2 className="shrink-0 text-sage" size={19} strokeWidth={2} />
                  <span className="font-semibold text-white">{tool}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-md border border-ink/10 bg-white p-6">
            <Download className="text-brass" size={24} strokeWidth={1.8} />
            <h3 className="mt-4 text-xl font-semibold text-ink">Fast client delivery</h3>
            <p className="mt-3 leading-7 text-graphite/75">
              Galleries, favorites and download packages live together so delivery feels intentional.
            </p>
          </div>
          <div className="rounded-md border border-ink/10 bg-white p-6">
            <Link2 className="text-brass" size={24} strokeWidth={1.8} />
            <h3 className="mt-4 text-xl font-semibold text-ink">Shareable booking pages</h3>
            <p className="mt-3 leading-7 text-graphite/75">
              Public booking pages can be shared or embedded, while admin sees every booking in one hub.
            </p>
          </div>
          <div className="rounded-md border border-ink/10 bg-white p-6">
            <UsersRound className="text-brass" size={24} strokeWidth={1.8} />
            <h3 className="mt-4 text-xl font-semibold text-ink">A calmer back office</h3>
            <p className="mt-3 leading-7 text-graphite/75">
              Client records, projects, tasks and communication status stay connected to the real work.
            </p>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-6 border-t border-ink/10 pt-8 sm:flex-row sm:items-center">
          <div>
            <p className="text-2xl font-semibold text-ink">Ready to work in one place?</p>
            <p className="mt-2 text-graphite/70">Spetly keeps the client journey clear from first message to final delivery.</p>
          </div>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-3 text-base font-semibold text-white transition hover:bg-ink/90"
          >
            Sign in
            <ArrowRight size={18} strokeWidth={2} />
          </Link>
        </div>
      </section>
    </main>
  );
}
