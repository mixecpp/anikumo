"use client";

export type ToastAction = { label: string; onClick: () => void };
export type Toast = { id: number; message: string; tone: "success" | "error" | "info"; action?: ToastAction; duration: number };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, tone: Toast["tone"] = "success", opts: { action?: ToastAction; duration?: number } = {}) {
  const id = nextId++;
  const duration = opts.duration ?? (opts.action ? 6000 : 3200);
  toasts = [...toasts, { id, message, tone, action: opts.action, duration }].slice(-4);
  emit();
  timers.set(id, setTimeout(() => dismiss(id), duration));
  return id;
}

export function dismiss(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/**
 * Optimistic delete with undo: `commit` runs when the toast expires (or the page is left);
 * clicking Undo calls `revert` instead and nothing is sent to the server.
 */
export function undoable(message: string, { commit, revert }: { commit: () => Promise<unknown> | void; revert: () => void }) {
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    window.removeEventListener("pagehide", finish);
    Promise.resolve(commit()).catch(() => {});
  };
  const id = toast(message, "info", {
    action: {
      label: "Undo",
      onClick: () => {
        if (settled) return;
        settled = true;
        window.removeEventListener("pagehide", finish);
        clearTimeout(timer);
        dismiss(id);
        revert();
      },
    },
    duration: 6000,
  });
  const timer = setTimeout(finish, 6000);
  window.addEventListener("pagehide", finish);
}

export const toastStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  get: () => toasts,
};
