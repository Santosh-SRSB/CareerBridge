import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { ResumeCreateFlow } from "@/features/candidate/passport/ResumeCreateFlow";

export default function ResumePassportPage() {
  return (
    <div className="min-h-full bg-fog">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <ResumeCreateFlow />
      </main>
      <Footer />
    </div>
  );
}
