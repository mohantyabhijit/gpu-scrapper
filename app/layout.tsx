import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "HackRadar — Your next build, ranked";
const description = "Worldwide prize-ranked hackathons with focused views for the USA, India, UK, and Singapore.";

export const metadata: Metadata = {
  metadataBase: new URL("https://abhijitmohanty.com/scrapper/"),
  title,
  description,
  manifest: "/scrapper/manifest.webmanifest",
  icons: { icon: "/scrapper/favicon.svg" },
  openGraph: { title, description, type: "website", images: ["/scrapper/og-hackradar.svg"] },
  twitter: { card: "summary_large_image", title, description, images: ["/scrapper/og-hackradar.svg"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
