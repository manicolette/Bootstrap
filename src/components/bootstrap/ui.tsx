import { useEffect, useState } from "react";

export function ProgressBar({ value, complete }: { value: number; complete?: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: complete
            ? "linear-gradient(90deg, #34d399, #10b981)"
            : "linear-gradient(90deg, #7c6aff, #a78bfa)",
        }}
      />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className={`card w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-b-none sm:rounded-b-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

const EMOJI_LIST = [
  "🐍","💻","📚","🧠","🚀","⚡","🔬","🧮","📐","📊","📈","🎯","🏆","🎓","✍️","🔧","🛠️","⚙️","🔐","🌐","☁️","🗄️","🐘","🐙","🦀","☕","🍎","🔥","💡","📱","🎨","🎬","🎵","🏋️","🧘","🌱","📖","📝","📓","🗓️"
];

export function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-2xl hover:border-[var(--color-accent)]"
      >
        {value || "📘"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-14 z-20 grid w-64 grid-cols-8 gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-xl">
            {EMOJI_LIST.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onChange(e);
                  setOpen(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded hover:bg-[var(--color-surface-2)]"
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Badge({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent" | "success" | "warning" | "danger" | "muted";
}) {
  const colors: Record<string, string> = {
    accent: "bg-[color-mix(in_oklab,var(--color-accent)_20%,transparent)] text-[var(--color-accent-2)]",
    success: "bg-[color-mix(in_oklab,var(--color-success)_18%,transparent)] text-[var(--color-success)]",
    warning: "bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]",
    danger: "bg-[color-mix(in_oklab,var(--color-danger)_20%,transparent)] text-[var(--color-danger)]",
    muted: "bg-[var(--color-surface-2)] text-[var(--color-muted-foreground)]",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[tone]}`}>
      {children}
    </span>
  );
}
