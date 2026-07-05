"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  FileText,
  FolderKanban,
  Globe2,
  Heart,
  ImagePlus,
  MessageSquare,
  ReceiptText,
  Settings
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type CustomerTab = "overview" | "projects" | "galleries" | "proofing" | "album" | "contracts" | "invoices" | "communication" | "portal" | "details";

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
  Globe2,
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
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<CustomerTab>(initialTab);

  useEffect(() => {
    setActiveTab(tabParam && validTabs.has(tabParam as CustomerTab) ? (tabParam as CustomerTab) : "overview");
  }, [tabParam, validTabs]);

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
      <nav
        className="flex min-w-full gap-1 overflow-x-auto border-b border-ink/10 bg-white p-1 [scrollbar-width:none] md:grid md:grid-cols-3 md:gap-0 md:overflow-visible md:p-0 xl:grid-cols-10 [&::-webkit-scrollbar]:hidden"
        aria-label="Ügyfél munkaterületek"
      >
        {tabs.map((tab) => {
          const Icon = icons[tab.icon];
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              data-customer-tab-target={tab.key}
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
