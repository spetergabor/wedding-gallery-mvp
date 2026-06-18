"use client";

import { useRef, useState, useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { signContractAction } from "@/lib/public-contract-actions";

function getPoint(canvas: HTMLCanvasElement, event: React.PointerEvent<HTMLCanvasElement>) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height
  };
}

export function ContractSignaturePad({
  token,
  disabled = false
}: {
  token: string;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureData, setSignatureData] = useState("");
  const [isPending, startTransition] = useTransition();

  function prepareCanvas(canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;

    if (canvas.width === Math.round(rect.width * scale) && canvas.height === Math.round(rect.height * scale)) {
      return;
    }

    canvas.width = Math.round(rect.width * scale);
    canvas.height = Math.round(rect.height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.scale(scale, scale);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.6;
    context.strokeStyle = "#171717";
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSignatureData("");
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || isPending) {
      return;
    }

    const canvas = event.currentTarget;
    prepareCanvas(canvas);
    canvas.setPointerCapture(event.pointerId);

    const context = canvas.getContext("2d");
    const point = getPoint(canvas, event);

    context?.beginPath();
    context?.moveTo(point.x / (window.devicePixelRatio || 1), point.y / (window.devicePixelRatio || 1));
    canvas.dataset.drawing = "true";
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || isPending || event.currentTarget.dataset.drawing !== "true") {
      return;
    }

    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    const point = getPoint(canvas, event);

    context?.lineTo(point.x / (window.devicePixelRatio || 1), point.y / (window.devicePixelRatio || 1));
    context?.stroke();
    setHasSignature(true);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;

    if (canvas.dataset.drawing !== "true") {
      return;
    }

    canvas.dataset.drawing = "false";
    setSignatureData(canvas.toDataURL("image/png"));
  }

  function handleSubmit(formData: FormData) {
    const canvas = canvasRef.current;
    const dataUrl = canvas?.toDataURL("image/png") ?? signatureData;

    formData.set("signatureData", dataUrl);
    startTransition(() => {
      void signContractAction(token, formData);
    });
  }

  if (disabled) {
    return (
      <div className="rounded-md bg-white px-4 py-3 text-sm text-sage">
        A szerződés már alá van írva. Az aláírt PDF letölthető a fenti gombbal.
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="mt-5 space-y-4">
      <input type="hidden" name="signatureData" value={signatureData} readOnly />
      <div className="overflow-hidden rounded-md border border-ink/15 bg-white">
        <canvas
          ref={canvasRef}
          aria-label="Aláírás mező"
          className="block h-44 w-full touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <div className="border-t border-ink/10 px-4 py-2 text-xs text-graphite/60">
          Írjatok alá ujjal vagy egérrel.
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={clearSignature}
          disabled={isPending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/10 px-4 text-sm font-medium text-graphite transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw size={16} />
          Újrakezdés
        </button>
        <button
          type="submit"
          disabled={!hasSignature || isPending}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Check size={16} />
          {isPending ? "Aláírás mentése..." : "Szerződés aláírása"}
        </button>
      </div>
    </form>
  );
}
