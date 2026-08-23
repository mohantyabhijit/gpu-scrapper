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
const description = "Prize-ranked, effort-aware hackathons available from the USA, India, UK, and Singapore.";

export const metadata: Metadata = {
  metadataBase: new URL("https://abhijitmohanty.com/scrapper/"),
  title,
  description,
  openGraph: { title, description, type: "website", images: ["/scrapper/og.png"] },
  twitter: { card: "summary_large_image", title, description, images: ["/scrapper/og.png"] },
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
