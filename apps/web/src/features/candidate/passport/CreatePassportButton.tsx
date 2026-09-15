"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/session";
import { rememberReturnTo } from "@/lib/nav-return";

/** Opens the single Autofill / Build ATS page (no card chooser). */
export function CreatePassportButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (!getAccessToken()) {
          router.push("/register?role=candidate");
          return;
        }
        rememberReturnTo("/dashboard");
        router.push("/onboarding/complete");
      }}
    >
      {children}
    </button>
  );
}
