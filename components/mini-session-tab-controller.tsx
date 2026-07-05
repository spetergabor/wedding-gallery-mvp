"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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

function updatePanels(activeTab: MiniSessionTab) {
  document.querySelectorAll<HTMLElement>("[data-mini-session-tab-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.miniSessionTabPanel !== activeTab;
  });
}

function updateUrl(activeTab: MiniSessionTab) {
  const url = new URL(window.location.href);

  if (activeTab === "overview") {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", activeTab);
  }

  window.history.replaceState(null, "", url);
}

export function MiniSessionTabController({
  tabs,
  initialTab
}: {
  tabs: MiniSessionTabItem[];
  initialTab: MiniSessionTab;
}) {
  const validTabs = useMemo(() => new Set(tabs.map((tab) => tab.key)), [tabs]);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<MiniSessionTab>(initialTab);

  useEffect(() => {
    setActiveTab(tabParam && validTabs.has(tabParam as MiniSessionTab) ? (tabParam as MiniSessionTab) : "overview");
  }, [tabParam, validTabs]);

  useEffect(() => {
    updatePanels(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const handleTabClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-mini-session-tab-target]") : null;
      const tab = target?.dataset.miniSessionTabTarget as MiniSessionTab | undefined;

      if (!tab || !validTabs.has(tab)) {
        return;
      }

      event.preventDefault();
      setActiveTab(tab);
      updateUrl(tab);
    };

    document.addEventListener("click", handleTabClick, { capture: true });

    return () => document.removeEventListener("click", handleTabClick, { capture: true });
  }, [validTabs]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as MiniSessionTab | null;

      setActiveTab(tab && validTabs.has(tab) ? tab : "overview");
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [validTabs]);

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
            <button
              key={tab.key}
              type="button"
              data-mini-session-tab-target={tab.key}
              aria-current={isActive ? "page" : undefined}
              className={`flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-transparent px-3 text-sm font-medium transition md:min-h-11 md:rounded-none md:border-y-0 md:border-l-0 md:border-r md:border-ink/10 md:last:border-r-0 ${
                isActive
                  ? "border-ink/15 bg-paper text-ink md:border-b-2 md:border-b-ink/50"
                  : "text-graphite hover:bg-ink/[0.04] hover:text-ink"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
