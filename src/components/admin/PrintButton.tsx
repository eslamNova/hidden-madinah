"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-paper"
    >
      <Printer aria-hidden="true" className="h-5 w-5" />
      {label}
    </button>
  );
}
