import type { Metadata } from "next";
import { Baloo_2, Fraunces, Inter, Manrope, Outfit, Poppins, Space_Grotesk, Space_Mono } from "next/font/google";
import { AuthCookieSync } from "@/components/AuthCookieSync";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { GoogleTag } from "@/components/GoogleTag";
import { MetaPixel } from "@/components/MetaPixel";
import { PushNotificationBootstrap } from "@/components/PushNotificationBootstrap";
import { PwaRegister } from "@/components/PwaRegister";
import { Toaster } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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

const baloo2 = Baloo_2({
  variable: "--font-baloo-2",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SRSB CareerBridge | Build your career. Build your future.",
  description:
    "Create your free Career Passport, improve your skills with AI, practice interviews, and find jobs. Free for candidates.",
  applicationName: "SRSB Career Bridge",
  manifest: "/manifest.json",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1522eb" },
    { media: "(prefers-color-scheme: dark)", color: "#1522eb" },
  ],
  appleWebApp: {
    capable: true,
    title: "SRSB Career Bridge",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/pwa-512.png", sizes: "512x512", type: "image/png" },
      { url: "/srsb-mark.png", type: "image/png" },
    ],
    shortcut: ["/icons/pwa-192.png"],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} ${spaceGrotesk.variable} ${poppins.variable} ${fraunces.variable} ${manrope.variable} ${spaceMono.variable} ${baloo2.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-fog font-sans text-ink">
        <GoogleTag />
        <MetaPixel />
        <AuthCookieSync />
        <PwaRegister />
        <PushNotificationBootstrap />
        {children}
        <Toaster />
        <CookieConsentBanner />
      </body>
    </html>
  );
}
