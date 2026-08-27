"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EagleMascot } from "@/features/candidate/passport/EagleMascot";
import { dayGreeting } from "@/lib/greeting";

export function PassportStartChoices({
  onPicked,
  welcomeName,
}: {
  onPicked?: () => void;
  welcomeName?: string | null;
}) {
  const router = useRouter();
  const [pose, setPose] = useState<"fly" | "stand">("fly");
  const [greeting, setGreeting] = useState("Good evening");

  useEffect(() => {
    setGreeting(dayGreeting());
    setPose("fly");
    const id = window.setTimeout(() => setPose("stand"), 1150);
    return () => window.clearTimeout(id);
  }, []);

  function go(path: string) {
    onPicked?.();
    router.push(path);
  }

  const name = welcomeName?.trim();
  const displayName = name ? name.charAt(0).toUpperCase() + name.slice(1) : "";

  return (
    <>
      <h1 className="welcome-greeting">
        {greeting}
        {displayName ? `, ${displayName}` : ""}
      </h1>
      <EagleMascot pose={pose} />
      <div className="passport-modal-copy text-center">
        <p className="welcome-line">
          <span className="welcome-to">Welcome to</span>{" "}
          <span className="welcome-brand">CareerBridge</span>
        </p>
        <h2 id="passport-choice-title" className="welcome-how">
          How do you want to <span className="welcome-start">start?</span>
        </h2>
        <div className="passport-choice-row">
          <button type="button" className="passport-choice" onClick={() => go("/passport/create/resume")}>
            <span className="passport-choice-photo">
              <Image
                src="/mascots/passport-with-resume.png"
                alt=""
                fill
                className="object-cover"
                sizes="160px"
              />
            </span>
            <span className="passport-choice-title">Autofill with resume</span>
          </button>
          <button type="button" className="passport-choice" onClick={() => go("/passport/create/form?source=manual")}>
            <span className="passport-choice-photo">
              <Image
                src="/mascots/passport-without-resume.png"
                alt=""
                fill
                className="object-cover"
                sizes="160px"
              />
            </span>
            <span className="passport-choice-title">Without resume</span>
          </button>
        </div>
      </div>
    </>
  );
}
