"use client";

import type { FormEventHandler, ReactNode } from "react";
import { prepareMiniSessionConfirmationPopup } from "@/components/mini-session-embed-confirmation-popup";
import type { MiniSessionTheme } from "@/lib/mini-sessions";

export function MiniSessionEmbedBookingForm({
  action,
  language,
  theme,
  children
}: {
  action: (formData: FormData) => void | Promise<void>;
  language: "hu" | "de";
  theme: MiniSessionTheme;
  children: ReactNode;
}) {
  const handleSubmit: FormEventHandler<HTMLFormElement> = () => {
    prepareMiniSessionConfirmationPopup(language, theme);
  };

  return (
    <form action={action} onSubmit={handleSubmit}>
      {children}
    </form>
  );
}
