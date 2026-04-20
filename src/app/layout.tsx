import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AppSessionProvider } from "@/components/AppSessionProvider";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Moneda",
  description: "Track expenses, detect patterns, and gain financial intelligence.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Moneda",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.className} ${GeistSans.variable}`}>
      <body className="antialiased bg-[#f5f5f0] dark:bg-zinc-950">
        <ThemeProvider>
          <AppSessionProvider>
            <AppShell>{children}</AppShell>
          </AppSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
