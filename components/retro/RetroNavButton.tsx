"use client";

import { cn } from "@/lib/cn";

export function RetroNavButton({
  children,
  variant = "primary",
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-[4px] px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary"
          ? "bg-accent-strong text-accent-foreground hover:brightness-95 active:brightness-90"
          : "border border-smoke bg-surface text-foreground hover:bg-paper-mist"
      )}
    >
      {children}
    </button>
  );
}
