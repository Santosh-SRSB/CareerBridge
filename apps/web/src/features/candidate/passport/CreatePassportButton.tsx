"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CreatePassportModal } from "@/features/candidate/passport/CreatePassportModal";
import { getAccessToken } from "@/lib/session";

export function CreatePassportButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          if (!getAccessToken()) {
            router.push("/register?role=candidate");
            return;
          }
          setOpen(true);
        }}
      >
        {children}
      </button>
      <CreatePassportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
