"use client";

import { useEffect } from "react";

export function GalleryDesignLiveControls() {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>("[data-gallery-design-form]");

    if (!form) {
      return;
    }

    const updateDesignControls = () => {
      const selectedDesign = form.querySelector<HTMLInputElement>('input[name="galleryDesign"]:checked')?.value ?? "";

      form.querySelectorAll<HTMLElement>("[data-gallery-design-option]").forEach((element) => {
        const isActive = element.dataset.galleryDesignOption === selectedDesign;

        element.hidden = !isActive;
        element.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea").forEach((input) => {
          input.disabled = !isActive;
        });
      });

      form.querySelectorAll<HTMLInputElement>("[data-gallery-design-fallback]").forEach((input) => {
        input.disabled = input.dataset.galleryDesignFallback === selectedDesign;
      });
    };

    updateDesignControls();
    form.addEventListener("change", updateDesignControls);

    return () => form.removeEventListener("change", updateDesignControls);
  }, []);

  return null;
}
