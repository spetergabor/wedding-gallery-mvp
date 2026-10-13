"use client";

import type { FormEventHandler, ReactNode } from "react";
import { prepareMiniSessionConfirmationPopup } from "@/components/mini-session-embed-confirmation-popup";

export function MiniSessionEmbedBookingForm({
  action,
  language,
  children
}: {
  action: (formData: FormData) => void | Promise<void>;
  language: "hu" | "de";
  children: ReactNode;
}) {
  const handleSubmit: FormEventHandler<HTMLFormElement> = () => {
    prepareMiniSessionConfirmationPopup(language);
  };

  return (
    <form action={action} onSubmit={handleSubmit}>
      {children}
    </form>
  );
}
