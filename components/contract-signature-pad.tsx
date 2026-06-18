"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, RotateCcw } from "lucide-react";
import { signContractAction } from "@/lib/public-contract-actions";

function getPoint(canvas: HTMLCanvasElement, event: React.PointerEvent<HTMLCanvasElement>) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height
  };
}

function SubmitButton({ hasSignature }: { hasSignature: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={!hasSignature || pending}
      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Check size={16} />
      {pending ? "Aláírás mentése..." : "Szerződés aláírása"}
    </button>
  );
}

export function ContractSignaturePad({
  token,
  disabled = false,
  children
}: {
  token: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

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
    if (signatureInputRef.current) {
      signatureInputRef.current.value = "";
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) {
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
    if (disabled || event.currentTarget.dataset.drawing !== "true") {
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
    if (signatureInputRef.current) {
      signatureInputRef.current.value = canvas.toDataURL("image/png");
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const canvas = canvasRef.current;
    const dataUrl = canvas?.toDataURL("image/png") ?? "";

    if (!hasSignature || !dataUrl || !signatureInputRef.current) {
      event.preventDefault();
      return;
    }

    signatureInputRef.current.value = dataUrl;
  }

  if (disabled) {
    return (
      <div className="rounded-md bg-white px-4 py-3 text-sm text-sage">
        A szerződés már alá van írva. Az aláírt PDF letölthető a fenti gombbal.
      </div>
    );
  }

  return (
    <form action={signContractAction.bind(null, token)} onSubmit={handleSubmit} className="mt-5 space-y-4">
      <input ref={signatureInputRef} type="hidden" name="signatureData" />
      {children}
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
          disabled={false}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/10 px-4 text-sm font-medium text-graphite transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw size={16} />
          Újrakezdés
        </button>
        <SubmitButton hasSignature={hasSignature} />
      </div>
    </form>
  );
}
