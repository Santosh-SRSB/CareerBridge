import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { ResumeCreateFlow } from "@/features/candidate/passport/ResumeCreateFlow";

export default function ResumePassportPage() {
  return (
    <div className="min-h-full bg-fog">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-deep">
          Create with resume
        </p>
        <h1 className="font-display mt-3 text-3xl font-extrabold text-navy">
          Drop your resume
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted">
          SRSB fetches education, skills and about. Anything missing stays empty for you to fill.
        </p>
        <div className="mt-10">
          <ResumeCreateFlow />
        </div>
      </main>
      <Footer />
    </div>
  );
}
