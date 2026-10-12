import Link from "next/link";

export function ArchiveEmptyState({
  title,
  description,
  showCta = false,
}: {
  title: string;
  description: string;
  showCta?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-border bg-surface py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted">{description}</p>
      {showCta && (
        <Link
          href="/"
          className="mt-4 inline-flex items-center justify-center rounded-btn bg-accent-strong px-4 py-3 text-sm font-medium text-accent-foreground transition hover:brightness-95 active:brightness-90"
        >
          + 새 계획
        </Link>
      )}
    </div>
  );
}
