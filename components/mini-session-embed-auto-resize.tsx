"use client";

import { useEffect } from "react";

const EMBED_HEIGHT_MESSAGE = "spetly:embed-height";

export function MiniSessionEmbedAutoResize() {
  useEffect(() => {
    let animationFrame = 0;
    let lastHeight = 0;

    function reportHeight() {
      animationFrame = 0;

      const height = Math.ceil(
        Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
      );

      if (height === lastHeight) {
        return;
      }

      lastHeight = height;
      window.parent.postMessage(
        {
          type: EMBED_HEIGHT_MESSAGE,
          height
        },
        "*"
      );
    }

    function scheduleHeightReport() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(reportHeight);
    }

    function handleParentMessage(event: MessageEvent) {
      if (event.data?.type === "spetly:request-embed-height") {
        scheduleHeightReport();
      }
    }

    const resizeObserver = new ResizeObserver(scheduleHeightReport);
    resizeObserver.observe(document.documentElement);
    resizeObserver.observe(document.body);

    const mutationObserver = new MutationObserver(scheduleHeightReport);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    window.addEventListener("load", scheduleHeightReport);
    window.addEventListener("resize", scheduleHeightReport);
    window.addEventListener("message", handleParentMessage);
    document.fonts?.ready.then(scheduleHeightReport).catch(() => undefined);
    scheduleHeightReport();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("load", scheduleHeightReport);
      window.removeEventListener("resize", scheduleHeightReport);
      window.removeEventListener("message", handleParentMessage);
    };
  }, []);

  return null;
}
