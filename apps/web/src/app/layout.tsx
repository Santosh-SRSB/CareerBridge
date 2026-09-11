import type { Metadata } from "next";
import { Fraunces, Inter, Manrope, Poppins, Space_Mono } from "next/font/google";
import { AppLoader } from "@/components/landing/AppLoader";
import { AuthCookieSync } from "@/components/AuthCookieSync";
import { PushNotificationBootstrap } from "@/components/PushNotificationBootstrap";
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

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SRSB CareerBridge | Build your career. Build your future.",
  description:
    "Create your free Career Passport, improve your skills with AI, practice interviews, and find jobs. Free for candidates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable} ${fraunces.variable} ${manrope.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-fog font-sans text-ink">
        <AuthCookieSync />
        <PushNotificationBootstrap />
        <AppLoader />
        {children}
      </body>
    </html>
  );
}
