"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy URL — resume create options live only on /onboarding/complete. */
export default function BuildWithoutResumeRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/onboarding/complete");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf8f4] text-sm text-slate-500">
      Opening resume options…
    </main>
  );
}
