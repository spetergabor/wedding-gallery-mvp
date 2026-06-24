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
  ReceiptText,
  Settings
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type CustomerTab = "overview" | "projects" | "galleries" | "proofing" | "album" | "contracts" | "invoices" | "communication" | "details";

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
  ReceiptText,
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
    <div className="mb-6 overflow-hidden rounded-md border border-ink/12 bg-white">
      <nav className="grid grid-cols-1 gap-0 border-b border-ink/10 bg-white md:grid-cols-3 xl:grid-cols-9" aria-label="Ügyfél munkaterületek">
        {tabs.map((tab) => {
          const Icon = icons[tab.icon];
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              data-customer-tab-target={tab.key}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center gap-2 border-r border-ink/10 px-3 text-sm font-medium transition last:border-r-0 ${
                isActive ? "bg-paper text-ink border-b-2 border-b-ink/50" : "text-graphite hover:bg-ink/[0.04] hover:text-ink"
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
