import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { AppLoader } from "@/components/landing/AppLoader";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SRSB CareerBridge | Build your career. Build your future.",
  description:
    "SRSB CareerBridge is a free Career Passport for youth in India. Improve skills with AI, practice interviews, and find jobs. Free for candidates.",
  keywords: [
    "SRSB CareerBridge",
    "SRSB Career Bridge",
    "CareerBridge",
    "Career Passport",
    "jobs for youth",
  ],
  metadataBase: new URL("https://www.srsbcareerbridge.com"),
  openGraph: {
    title: "SRSB CareerBridge",
    description: "Build your career. Build your future. Free Career Passport for candidates.",
    url: "https://www.srsbcareerbridge.com",
    siteName: "SRSB CareerBridge",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full bg-fog font-sans text-ink">
        <AppLoader />
        {children}
      </body>
    </html>
  );
}
