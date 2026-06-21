import type { ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
};

export function PageShell({ title, description, eyebrow, children }: Props) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-weak">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl font-bold text-ink-strong leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-3xl text-sm text-ink-medium leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
