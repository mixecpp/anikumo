"use client";

import { useEffect } from "react";
import { pushRecent } from "@/lib/recent";

export default function TrackRecent({ id, title, cover }: { id: number; title: string; cover: string }) {
  useEffect(() => pushRecent({ id, title, cover }), [id, title, cover]);
  return null;
}
