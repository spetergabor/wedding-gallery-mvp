"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  CheckCircle2,
  FileText,
  FolderKanban,
  Heart,
  ImagePlus,
  MessageSquare,
  Settings
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type CustomerTab = "overview" | "projects" | "galleries" | "proofing" | "album" | "contracts" | "communication" | "details";

type CustomerTabItem = {
  key: CustomerTab;
  label: string;
  icon: keyof typeof icons;
};

const icons = {
  CheckCircle2,
  FolderKanban,
  Camera,
  Heart,
  ImagePlus,
  FileText,
  MessageSquare,
  Settings
} satisfies Record<string, LucideIcon>;

function updatePanels(activeTab: CustomerTab) {
  document.querySelectorAll<HTMLElement>("[data-customer-tab-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.customerTabPanel !== activeTab;
  });
}

function updateUrl(activeTab: CustomerTab) {
  const url = new URL(window.location.href);

  if (activeTab === "overview") {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", activeTab);
  }

  window.history.replaceState(null, "", url);
}

export function CustomerTabController({
  tabs,
  initialTab
}: {
  tabs: CustomerTabItem[];
  initialTab: CustomerTab;
}) {
  const validTabs = useMemo(() => new Set(tabs.map((tab) => tab.key)), [tabs]);
  const [activeTab, setActiveTab] = useState<CustomerTab>(initialTab);

  useEffect(() => {
    updatePanels(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const handleTabClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-customer-tab-target]") : null;
      const tab = target?.dataset.customerTabTarget as CustomerTab | undefined;

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
      const tab = params.get("tab") as CustomerTab | null;

      setActiveTab(tab && validTabs.has(tab) ? tab : "overview");
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [validTabs]);

  return (
    <div className="mb-6 rounded-lg border border-ink/10 bg-white p-2 shadow-soft">
      <nav className="grid gap-2 md:grid-cols-2 xl:grid-cols-8" aria-label="Ügyfél munkaterületek">
        {tabs.map((tab) => {
          const Icon = icons[tab.icon];
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              data-customer-tab-target={tab.key}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
                isActive ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
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
