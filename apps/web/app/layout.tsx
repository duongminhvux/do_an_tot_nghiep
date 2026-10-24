import { getServerSiteSettings } from "@/lib/site-settings-server";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Be_Vietnam_Pro } from "next/font/google";
import AppProviders from "@/providers";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getServerSiteSettings();
  return {
    title: settings.siteName,
    description: settings.siteDescription,
    icons: { icon: settings.faviconUrl || "/favicon.ico" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteSettings = await getServerSiteSettings();
  return (
    <html lang="vi" suppressHydrationWarning className="h-full antialiased">
      <body
        suppressHydrationWarning
        className={`${beVietnam.variable} ${geistMono.variable} min-h-full flex flex-col bg-background font-sans text-slate-900`}
      >
        <AppProviders siteSettings={siteSettings}>{children}</AppProviders>
      </body>
    </html>
  );
}
