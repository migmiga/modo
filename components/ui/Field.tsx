import { cn } from "@/lib/cn";

export function Field({
  label,
  hint,
  error,
  required,
  reserveErrorSpace = false,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Always renders the error line's slot, even with no error — so a field
   *  whose error can appear/disappear (e.g. a date-range check) doesn't
   *  grow/shrink and push the content below it around. Opt-in: every other
   *  Field keeps the old "no error = no space at all" behavior. */
  reserveErrorSpace?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
        {label}
        {required && (
          <>
            <span className="text-xs leading-none text-danger" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(필수)</span>
          </>
        )}
      </span>
      {children}
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {(error || reserveErrorSpace) && (
        // #DC2626 — a true red for error text, not `text-danger` (aliased
        // to Tangerine, this app's Accent color, app-wide). Scoped to this
        // literal rather than repointing that shared token.
        <span className={cn("text-xs text-[#DC2626]", !error && "invisible")}>{error || " "}</span>
      )}
    </label>
  );
}

// Border color is split out from the rest of the field chrome so a caller can
// override it (e.g. a lighter default border for one screen's inputs) via
// `borderClassName` without two conflicting `border-*` color utilities ending
// up in the same className — cn() is a plain string join, not tailwind-merge,
// so which one would "win" is undefined; this keeps there always being
// exactly one.
const fieldBaseClassName =
  "w-full rounded-input bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
const defaultFieldBorderClassName = "border border-input-border";

interface FieldBorderProps {
  borderClassName?: string;
}

export function Input({
  className,
  borderClassName,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & FieldBorderProps) {
  return (
    <input
      {...props}
      className={cn(fieldBaseClassName, borderClassName ?? defaultFieldBorderClassName, className)}
    />
  );
}

export function Textarea({
  className,
  borderClassName,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldBorderProps) {
  return (
    <textarea
      {...props}
      className={cn(
        fieldBaseClassName,
        "resize-none",
        borderClassName ?? defaultFieldBorderClassName,
        className
      )}
    />
  );
}

export function Select({
  className,
  borderClassName,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & FieldBorderProps) {
  return (
    <select
      {...props}
      className={cn(fieldBaseClassName, borderClassName ?? defaultFieldBorderClassName, className)}
    />
  );
}
