import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { resolveSiteOrigin } from "@/lib/site";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const TITLE = "Linear Wrapped 2026";
const DESCRIPTION = "Your year in Linear, wrapped. Sign in with read-only access to see what you closed, your work archetype, your peak month and more.";

// Sets the base for relative metadata URLs. Configure `SITE_URL` (see README) for a custom domain.
export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteOrigin()),
  title: { default: TITLE, template: "%s · Linear Wrapped" },
  description: DESCRIPTION,
  applicationName: "Linear Wrapped",
  openGraph: { type: "website", siteName: "Linear Wrapped", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#07080b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
