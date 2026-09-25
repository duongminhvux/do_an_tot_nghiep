import type { Metadata } from 'next';
import localFont from 'next/font/local';
import AppProviders from '@/providers';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
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
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col bg-slate-50 text-slate-900`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
