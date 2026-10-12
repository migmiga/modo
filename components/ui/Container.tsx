import { cn } from "@/lib/cn";

export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8", className)}>
      {children}
    </div>
  );
}
