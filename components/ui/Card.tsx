import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  onClick,
  dataLd,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  /** TEMPORARY layout-debug hook — see lib/debugLayout.ts. */
  dataLd?: string;
}) {
  return (
    <div
      data-ld={dataLd}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-card border border-border bg-surface p-4 shadow-card",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}
