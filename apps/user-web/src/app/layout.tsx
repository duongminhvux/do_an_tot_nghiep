import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = { title: { default: "ListenUp — English listening practice", template: "%s | ListenUp" }, description: "Build confident English listening skills with dictation and TOEIC practice." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Providers>{children}</Providers></body></html>; }
