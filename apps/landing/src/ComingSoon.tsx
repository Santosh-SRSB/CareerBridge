import Link from "next/link";
import { Footer } from "@/components/landing/Footer";
import { Navbar } from "@/components/landing/Navbar";

export function ComingSoon({ title }: { title: string }) {
  return (
    <div id="top" className="min-h-full bg-fog">
      <Navbar />
      <main className="mx-auto max-w-xl px-5 py-24 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">SRSB CareerBridge</p>
        <h1 className="mt-3 text-3xl font-extrabold text-navy">{title}</h1>
        <p className="mt-4 text-muted">
          The full app is launching next. The landing page is live today — check back soon to create your Career
          Passport.
        </p>
        <Link href="/" className="mt-8 inline-flex rounded-full bg-navy px-6 py-3 text-sm font-bold text-white">
          Back to home
        </Link>
      </main>
      <Footer />
    </div>
  );
}
