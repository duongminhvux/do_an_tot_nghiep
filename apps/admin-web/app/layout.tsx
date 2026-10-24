import { getServerSiteSettings } from "@/lib/site-settings-server";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppProviders from "@/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getServerSiteSettings();
  return {
    title: `${settings.siteName} | Admin`,
    description: settings.siteDescription,
    icons: { icon: settings.faviconUrl || "/favicon.ico" },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteSettings = await getServerSiteSettings();
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-slate-50 text-slate-900"
      >
        <AppProviders siteSettings={siteSettings}>{children}</AppProviders>
      </body>
    </html>
  );
}
