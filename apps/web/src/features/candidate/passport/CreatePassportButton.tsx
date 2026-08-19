"use client";

import { useState, type ReactNode } from "react";
import { CreatePassportModal } from "@/features/candidate/passport/CreatePassportModal";

export function CreatePassportButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <CreatePassportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
