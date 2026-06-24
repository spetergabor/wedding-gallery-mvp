"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Download, Heart, MapPin, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type GalleryTab = "photos" | "client" | "views" | "downloads" | "settings";

type GalleryTabItem = {
  key: GalleryTab;
  label: string;
  icon: keyof typeof icons;
};

const icons = {
  Camera,
  Heart,
  MapPin,
  Download,
  Settings
} satisfies Record<string, LucideIcon>;

function updatePanels(activeTab: GalleryTab) {
  document.querySelectorAll<HTMLElement>("[data-gallery-tab-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.galleryTabPanel !== activeTab;
  });
}

function updateUrl(activeTab: GalleryTab) {
  const url = new URL(window.location.href);

  if (activeTab === "photos") {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", activeTab);
  }

  window.history.replaceState(null, "", url);
}

export function GalleryTabController({
  tabs,
  initialTab
}: {
  tabs: GalleryTabItem[];
  initialTab: GalleryTab;
}) {
  const validTabs = useMemo(() => new Set(tabs.map((tab) => tab.key)), [tabs]);
  const [activeTab, setActiveTab] = useState<GalleryTab>(initialTab);

  useEffect(() => {
    updatePanels(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const handleTabClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-gallery-tab-target]") : null;
      const tab = target?.dataset.galleryTabTarget as GalleryTab | undefined;

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
      const tab = params.get("tab") as GalleryTab | null;

      setActiveTab(tab && validTabs.has(tab) ? tab : "photos");
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [validTabs]);

  return (
    <div className="overflow-hidden rounded-md border border-ink/12 bg-white">
      <nav className="grid grid-cols-1 gap-0 border-b border-ink/10 bg-white md:grid-cols-5" aria-label="Galéria részletek">
        {tabs.map((tab) => {
          const Icon = icons[tab.icon];
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              data-gallery-tab-target={tab.key}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center gap-2 border-r border-ink/10 px-3 text-sm font-medium transition last:border-r-0 ${
                isActive
                  ? "bg-paper text-ink ring-1 ring-ink/5 border-b-2 border-b-ink/50"
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
