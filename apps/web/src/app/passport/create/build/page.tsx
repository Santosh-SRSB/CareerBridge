import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { BuildResumeArrow } from "@/features/candidate/passport/BuildResumeArrow";

export default function BuildPassportPage() {
  return (
    <div className="min-h-full overflow-hidden bg-fog">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-deep">
          Create without resume
        </p>
        <h1 className="font-display mt-3 text-3xl font-extrabold text-navy">
          Build your Career Passport
        </h1>
        <BuildResumeArrow />
      </main>
      <Footer />
    </div>
  );
}
