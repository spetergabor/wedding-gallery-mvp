"use client";

import { useEffect, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFPageProxy } from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export type PdfPreviewPage = {
  pageNumber: number;
  page: PDFPageProxy;
  width: number;
  height: number;
};

function previewUrl(fileUrl: string) {
  return `/api/pdf-preview?url=${encodeURIComponent(fileUrl)}`;
}

export function usePdfPreviewPages(fileUrl: string) {
  const [pages, setPages] = useState<PdfPreviewPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = pdfjs.getDocument({ url: previewUrl(fileUrl) });

    async function loadPdf() {
      setIsLoading(true);
      setError(null);
      setPages([]);

      try {
        const pdfDocument = await loadingTask.promise;
        const nextPages: PdfPreviewPage[] = [];

        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
          const page = await pdfDocument.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1 });

          nextPages.push({
            pageNumber,
            page,
            width: viewport.width,
            height: viewport.height
          });
        }

        if (!cancelled) {
          setPages(nextPages);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "A PDF előnézet nem tölthető be.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [fileUrl]);

  return { pages, isLoading, error };
}

export function PdfPreviewCanvas({ page, className = "" }: { page: PdfPreviewPage; className?: string }) {
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    setRenderKey((current) => current + 1);
  }, [page]);

  return <PdfPreviewCanvasInner key={renderKey} page={page} className={className} />;
}

function PdfPreviewCanvasInner({ page, className }: { page: PdfPreviewPage; className: string }) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const scale = 1.6;
    const viewport = page.page.getViewport({ scale });
    const outputScale = window.devicePixelRatio || 1;

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const renderTask = page.page.render({
      canvas,
      canvasContext: context,
      viewport,
      transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined
    });

    renderTask.promise.catch(() => undefined);

    return () => {
      renderTask.cancel();
    };
  }, [canvas, page]);

  return <canvas ref={setCanvas} className={className} aria-hidden="true" />;
}
