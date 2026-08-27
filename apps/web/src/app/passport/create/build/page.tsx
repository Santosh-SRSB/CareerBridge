"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy URL — without-resume now opens the same first form as the shared flow. */
export default function BuildWithoutResumeRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/passport/create/form?source=manual");
  }, [router]);

  return <main className="cb-app text-muted">Opening your Career Passport form...</main>;
}
