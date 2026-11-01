import type { Metadata, Viewport } from "next";
import { VT323 } from "next/font/google";
import { SoundProvider } from "@/components/retro/Sound";
import { resolveSiteOrigin } from "@/lib/site";
import "./globals.css";

// The one typeface: a bitmap-style terminal face, used on the screen and on the case.
const vt323 = VT323({ variable: "--font-vt323", subsets: ["latin"], weight: "400" });

const TITLE = "Linear Wrapped 2026";
const DESCRIPTION = "Your year in Linear, wrapped. Drag the cassette onto the computer, sign in with read-only access and see what you closed, your work archetype, your peak month and more.";

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
  themeColor: "#0e0c09",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${vt323.variable} font-term antialiased`}>
        <SoundProvider>{children}</SoundProvider>
      </body>
    </html>
  );
}
