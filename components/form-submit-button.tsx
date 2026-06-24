"use client";

import { useFormStatus } from "react-dom";
import { ComponentPropsWithoutRef } from "react";
import { Button } from "@/components/button";

type FormSubmitButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
  pendingLabel?: string;
};

export function FormSubmitButton({
  children,
  pendingLabel = "Mentés...",
  busy = false,
  disabled,
  ...buttonProps
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isPending = Boolean(pending || busy);

  return (
    <Button {...buttonProps} type="submit" disabled={disabled || isPending}>
      {isPending ? pendingLabel : children}
    </Button>
  );
}
