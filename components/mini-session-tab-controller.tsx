"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarClock, CheckCircle2, Settings2, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type MiniSessionTab = "overview" | "bookings" | "slots" | "settings";

type MiniSessionTabItem = {
  key: MiniSessionTab;
  label: string;
  icon: keyof typeof icons;
};

const icons = {
  CalendarClock,
  Users,
  CheckCircle2,
  Settings2
} satisfies Record<string, LucideIcon>;

export function MiniSessionTabController({
  tabs,
  initialTab
}: {
  tabs: MiniSessionTabItem[];
  initialTab: MiniSessionTab;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") as MiniSessionTab | null;
  const activeTab = requestedTab && tabs.some((tab) => tab.key === requestedTab) ? requestedTab : initialTab;

  return (
    <div className="mb-6 overflow-hidden rounded-md border border-ink/12 bg-white">
      <nav
        className="flex min-w-full gap-1 overflow-x-auto border-b border-ink/10 bg-white p-1 [scrollbar-width:none] md:grid md:grid-cols-4 md:gap-0 md:overflow-visible md:p-0 [&::-webkit-scrollbar]:hidden"
        aria-label="Mini session munkaterületek"
      >
        {tabs.map((tab) => {
          const Icon = icons[tab.icon];
          const isActive = activeTab === tab.key;

          return (
            <Link
              key={tab.key}
              href={tab.key === "overview" ? pathname : `${pathname}?tab=${tab.key}`}
              prefetch={false}
              aria-current={isActive ? "page" : undefined}
              className={`flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-transparent px-3 text-sm font-medium transition md:min-h-11 md:rounded-none md:border-y-0 md:border-l-0 md:border-r md:border-ink/10 md:last:border-r-0 ${
                isActive
                  ? "border-ink/15 bg-paper text-ink md:border-b-2 md:border-b-ink/50"
                  : "text-graphite hover:bg-ink/[0.04] hover:text-ink"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
