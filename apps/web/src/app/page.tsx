import { DayOrbitJourney } from "@/components/landing/DayOrbitJourney";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { Navbar } from "@/components/landing/Navbar";
import { SignedInHomeRedirect } from "@/components/landing/SignedInHomeRedirect";
import { SkillMarquee } from "@/components/landing/SkillMarquee";
import { SupportFab } from "@/components/landing/SupportFab";

export default function Home() {
  return (
    <div id="top" className="min-h-full bg-fog">
      <SignedInHomeRedirect />
      <Navbar />
      <main>
        <Hero />
        <SkillMarquee />
        <DayOrbitJourney />
      </main>
      <Footer />
      <SupportFab />
    </div>
  );
}
