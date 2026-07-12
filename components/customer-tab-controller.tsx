"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Camera,
  CalendarClock,
  CheckCircle2,
  FileText,
  FolderKanban,
  Globe2,
  Heart,
  ImagePlus,
  ListChecks,
  MessageSquare,
  ReceiptText,
  Settings
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AdminLanguage } from "@/lib/admin-language";

type CustomerTab = "overview" | "tasks" | "projects" | "meetings" | "galleries" | "proofing" | "album" | "contracts" | "invoices" | "communication" | "portal" | "details";

type CustomerTabItem = {
  key: CustomerTab;
  label: string;
  icon: keyof typeof icons;
};

type CustomerTabGroup = {
  key: "overview" | "work" | "business" | "portal";
  label: string;
  icon: keyof typeof icons;
  defaultTab: CustomerTab;
  tabs: CustomerTab[];
};

const icons = {
  CheckCircle2,
  FolderKanban,
  CalendarClock,
  Camera,
  Heart,
  ImagePlus,
  ListChecks,
  FileText,
  ReceiptText,
  MessageSquare,
  Globe2,
  Settings
} satisfies Record<string, LucideIcon>;

const tabGroups: CustomerTabGroup[] = [
  {
    key: "overview",
    label: "Áttekintés",
    icon: "CheckCircle2",
    defaultTab: "overview",
    tabs: ["overview"]
  },
  {
    key: "work",
    label: "Munka",
    icon: "FolderKanban",
    defaultTab: "tasks",
    tabs: ["tasks", "projects", "meetings", "galleries", "proofing", "album"]
  },
  {
    key: "business",
    label: "Üzlet",
    icon: "FileText",
    defaultTab: "contracts",
    tabs: ["contracts", "invoices"]
  },
  {
    key: "portal",
    label: "Ügyfélportál",
    icon: "Globe2",
    defaultTab: "portal",
    tabs: ["portal", "details", "communication"]
  }
];

const COPY: Record<AdminLanguage, {
  groupLabels: Record<CustomerTabGroup["key"], string>;
  mainAreaLabel: string;
  subAreaLabel: (label: string) => string;
  fallbackClient: string;
}> = {
  hu: {
    groupLabels: {
      overview: "Áttekintés",
      work: "Munka",
      business: "Üzlet",
      portal: "Ügyfélportál"
    },
    mainAreaLabel: "Ügyfél fő területek",
    subAreaLabel: (label) => `${label} alfülek`,
    fallbackClient: "Ügyfél"
  },
  de: {
    groupLabels: {
      overview: "Übersicht",
      work: "Arbeit",
      business: "Business",
      portal: "Kundenportal"
    },
    mainAreaLabel: "Kundenbereiche",
    subAreaLabel: (label) => `${label} Unterbereiche`,
    fallbackClient: "Kunde"
  },
  en: {
    groupLabels: {
      overview: "Overview",
      work: "Work",
      business: "Business",
      portal: "Client portal"
    },
    mainAreaLabel: "Client sections",
    subAreaLabel: (label) => `${label} subsections`,
    fallbackClient: "Client"
  }
};

function isCustomerTabItem(tab: CustomerTabItem | undefined): tab is CustomerTabItem {
  return Boolean(tab);
}

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
  initialTab,
  language = "hu"
}: {
  tabs: CustomerTabItem[];
  initialTab: CustomerTab;
  language?: AdminLanguage;
}) {
  const copy = COPY[language];
  const validTabs = useMemo(() => new Set(tabs.map((tab) => tab.key)), [tabs]);
  const tabsByKey = useMemo(() => new Map(tabs.map((tab) => [tab.key, tab])), [tabs]);
  const availableGroups = useMemo(
    () =>
      tabGroups
        .map((group) => ({
          ...group,
          label: copy.groupLabels[group.key],
          tabs: group.tabs.filter((tab) => validTabs.has(tab))
        }))
        .filter((group) => group.tabs.length > 0 && validTabs.has(group.defaultTab)),
    [copy.groupLabels, validTabs]
  );
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<CustomerTab>(initialTab);
  const activeGroup = availableGroups.find((group) => group.tabs.includes(activeTab)) ?? availableGroups[0];
  const activeGroupTabs = activeGroup?.tabs.map((tab) => tabsByKey.get(tab)).filter(isCustomerTabItem) ?? [];

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
        className="grid grid-cols-2 gap-1 border-b border-ink/10 bg-white p-1 sm:grid-cols-4"
        aria-label={copy.mainAreaLabel}
      >
        {availableGroups.map((group) => {
          const Icon = icons[group.icon];
          const isActive = activeGroup?.key === group.key;

          return (
            <button
              key={group.key}
              type="button"
              data-customer-tab-target={group.defaultTab}
              aria-current={isActive ? "page" : undefined}
              className={`flex h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${
                isActive
                  ? "border-ink bg-ink text-white shadow-sm"
                  : "border-transparent text-graphite hover:bg-ink/[0.04] hover:text-ink"
              }`}
            >
              <Icon size={16} />
              {group.label}
            </button>
          );
        })}
      </nav>
      {activeGroupTabs.length > 1 ? (
        <nav
          className="flex min-w-full gap-2 overflow-x-auto bg-paper/70 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={copy.subAreaLabel(activeGroup?.label ?? copy.fallbackClient)}
        >
          {activeGroupTabs.map((tab) => {
            const Icon = icons[tab.icon];
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                data-customer-tab-target={tab.key}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition ${
                  isActive
                    ? "border-ink/20 bg-white text-ink shadow-sm"
                    : "border-transparent text-graphite hover:bg-white hover:text-ink"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
