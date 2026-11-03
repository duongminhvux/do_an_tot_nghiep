import type { Metadata } from "next";
import { getServerSiteSettings } from "@/lib/site-settings-server";
import { getServerLandingPageSettings } from "@/lib/landing-page-server";
import { LandingPage } from "@/features/landing/landing-page";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getServerSiteSettings();
  return { title: settings.siteName, description: settings.siteDescription };
}

/** Public introduction page; signed-out visitors are sent here instead of the login form. */
export default async function WelcomePage() {
  const images = await getServerLandingPageSettings();
  return <LandingPage initialImages={images} />;
}
