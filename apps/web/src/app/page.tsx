import { CandidateFeatures } from "@/components/landing/home/CandidateFeatures";
import { ChoosePath } from "@/components/landing/home/ChoosePath";
import { EmployerFeatures } from "@/components/landing/home/EmployerFeatures";
import { HomeFooter } from "@/components/landing/home/HomeFooter";
import { HomeHero } from "@/components/landing/home/HomeHero";
import { HomeStats } from "@/components/landing/home/HomeStats";
import { SignedInHomeRedirect } from "@/components/landing/SignedInHomeRedirect";
import { SupportFab } from "@/components/landing/SupportFab";
import "@/components/landing/home/home-landing.css";

export default function Home() {
  return (
    <div id="top" className="hl-page">
      <SignedInHomeRedirect />
      <HomeHero />
      <main>
        <HomeStats />
        <ChoosePath />
        <CandidateFeatures />
        <EmployerFeatures />
      </main>
      <HomeFooter />
      <SupportFab />
    </div>
  );
}
