"use client";

export type RecentItem = { id: number; title: string; cover: string };

const KEY = "aw_recent";
const MAX = 8;

export function readRecent(): RecentItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((r) => Number.isInteger(r?.id) && typeof r.title === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(item: RecentItem) {
  try {
    const list = [item, ...readRecent().filter((r) => r.id !== item.id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
