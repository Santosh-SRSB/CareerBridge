import { EmployerBand } from "@/components/landing/EmployerBand";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { JobsTeaser } from "@/components/landing/JobsTeaser";
import { Navbar } from "@/components/landing/Navbar";
import { SignedInHomeRedirect } from "@/components/landing/SignedInHomeRedirect";
import { SkillMarquee } from "@/components/landing/SkillMarquee";

export default function Home() {
  return (
    <div id="top" className="min-h-full bg-fog">
      <SignedInHomeRedirect />
      <Navbar />
      <main>
        <Hero />
        <SkillMarquee />
        <HowItWorks />
        <Features />
        <JobsTeaser />
        <EmployerBand />
      </main>
      <Footer />
    </div>
  );
}
