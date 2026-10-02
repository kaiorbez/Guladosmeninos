"use client";

import { PrinterIcon } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary print:hidden">
      <PrinterIcon className="size-4" />
      Imprimir
    </button>
  );
}
