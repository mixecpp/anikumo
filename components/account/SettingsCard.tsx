"use client";

import { motion } from "motion/react";

export function SettingsCard({
  id,
  title,
  description,
  children,
  footer,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-white/[0.07] bg-panel"
    >
      <div className="p-6">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="flex min-h-14 items-center justify-between gap-4 border-t border-white/[0.06] bg-white/[0.015] px-6 py-3">{footer}</div>}
    </motion.section>
  );
}

export function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-sm">{title}</div>
        {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
