"use client";

import { ComponentPropsWithoutRef } from "react";
import { Button } from "@/components/button";

type ConfirmSubmitButtonProps = ComponentPropsWithoutRef<"button"> & {
  message: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function ConfirmSubmitButton({
  message,
  onClick,
  ...props
}: ConfirmSubmitButtonProps) {
  return (
    <Button
      {...props}
      type="submit"
      onClick={(event) => {
        onClick?.(event);

        if (!event.defaultPrevented && !window.confirm(message)) {
          event.preventDefault();
        }
      }}
    />
  );
}
