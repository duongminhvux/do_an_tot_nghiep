import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Be_Vietnam_Pro } from 'next/font/google';
import AppProviders from '@/providers';
import './globals.css';

const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-be-vietnam',
  display: 'swap',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Daily English - Learning Platform',
  description: 'Learn English vocabulary and grammar effectively',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning className="h-full antialiased">
      <body
        suppressHydrationWarning
        className={`${beVietnam.variable} ${geistMono.variable} min-h-full flex flex-col bg-background font-sans text-slate-900`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
