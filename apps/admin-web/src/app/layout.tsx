import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
export const metadata: Metadata = { title:{ default:"ListenUp Admin",template:"%s | ListenUp Admin" },description:"Secure administration console for ListenUp.",robots:{ index:false,follow:false,nocache:true,googleBot:{ index:false,follow:false,noimageindex:true } } };
export default function RootLayout({ children }: Readonly<{children:React.ReactNode}>) { return <html lang="en"><body><Providers>{children}</Providers></body></html>; }
