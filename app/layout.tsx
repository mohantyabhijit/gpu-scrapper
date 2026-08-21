import type { Metadata } from "next";
import { headers } from "next/headers";
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

const title = "Raster — GPU prices without the tab circus";
const description = "A public-data GPU offer comparison across the US, UK, India, and Singapore, built for Into the Scrape-Verse.";
const basePath = "/scrapper";
const faviconVersion = "v3";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = new URL(`${basePath}/og.png`, `${protocol}://${host}`).toString();

  return {
    title,
    description,
    icons: {
      icon: [
        { url: `${basePath}/favicon.svg?${faviconVersion}`, type: "image/svg+xml" },
        { url: `${basePath}/favicon-32x32.png?${faviconVersion}`, sizes: "32x32", type: "image/png" },
      ],
      shortcut: `${basePath}/favicon.ico?${faviconVersion}`,
      apple: [{ url: `${basePath}/apple-touch-icon.png?${faviconVersion}`, sizes: "180x180", type: "image/png" }],
    },
    manifest: `${basePath}/manifest.webmanifest?${faviconVersion}`,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: "Raster GPU marketplace" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
