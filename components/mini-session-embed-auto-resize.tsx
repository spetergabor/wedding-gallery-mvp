"use client";

import { useEffect } from "react";

const EMBED_HEIGHT_MESSAGE = "spetly:embed-height";
const EMBED_WHEEL_MESSAGE = "spetly:embed-wheel";

function canScrollInDirection(element: HTMLElement, deltaX: number, deltaY: number) {
  const style = window.getComputedStyle(element);
  const canScrollVertically = /(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
  const canScrollHorizontally = /(auto|scroll|overlay)/.test(style.overflowX) && element.scrollWidth > element.clientWidth;

  if (canScrollVertically) {
    if (deltaY < 0 && element.scrollTop > 0) return true;
    if (deltaY > 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 1) return true;
  }

  if (canScrollHorizontally) {
    if (deltaX < 0 && element.scrollLeft > 0) return true;
    if (deltaX > 0 && element.scrollLeft + element.clientWidth < element.scrollWidth - 1) return true;
  }

  return false;
}

function shouldKeepWheelInsideEmbed(target: EventTarget | null, deltaX: number, deltaY: number) {
  let element = target instanceof HTMLElement ? target : null;

  while (element && element !== document.body && element !== document.documentElement) {
    if (canScrollInDirection(element, deltaX, deltaY)) {
      return true;
    }

    element = element.parentElement;
  }

  return false;
}

export function MiniSessionEmbedAutoResize() {
  useEffect(() => {
    let animationFrame = 0;
    let lastHeight = 0;

    function reportHeight() {
      animationFrame = 0;

      const embedContent = document.querySelector("main");

      const height = Math.ceil(
        embedContent
          ? Math.max(embedContent.scrollHeight, embedContent.getBoundingClientRect().height)
          : Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
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

    function handleWheel(event: WheelEvent) {
      if (event.ctrlKey || shouldKeepWheelInsideEmbed(event.target, event.deltaX, event.deltaY)) {
        return;
      }

      event.preventDefault();
      window.parent.postMessage(
        {
          type: EMBED_WHEEL_MESSAGE,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaMode: event.deltaMode
        },
        "*"
      );
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
    window.addEventListener("wheel", handleWheel, { passive: false });
    document.fonts?.ready.then(scheduleHeightReport).catch(() => undefined);
    scheduleHeightReport();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("load", scheduleHeightReport);
      window.removeEventListener("resize", scheduleHeightReport);
      window.removeEventListener("message", handleParentMessage);
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return null;
}
