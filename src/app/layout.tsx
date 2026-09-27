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

const SITE_URL = "https://satark.world";
const SITE_NAME = "Satark";
const SITE_DESCRIPTION =
  "Satark is a disaster risk mapping and early-warning platform for flash floods and landslides across NER, India, built for the National Disaster Response Force (NDRF) use case. A Smart India Hackathon (SIH) prototype by team AlphaCraft.";

const TEAM_MEMBERS = [
  "Atharva Kaplay",
  "Dhruv Chourey",
  "Jeenal Shah",
  "Om Waghale",
  "Sanyam Patel",
  "Shalvi Sharma",
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — NDRF Disaster Risk Hub`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Satark",
    "Satark World",
    "AlphaCraft",
    "Smart India Hackathon",
    "SIH",
    "NDRF",
    "disaster risk mapping",
    "flash flood monitoring",
    "landslide monitoring",
    "Uttarakhand disaster management",
    "early warning system",
  ],
  applicationName: SITE_NAME,
  authors: TEAM_MEMBERS.map((name) => ({ name })),
  creator: "AlphaCraft",
  publisher: "AlphaCraft",
  category: "technology",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — NDRF Disaster Risk Hub`,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — NDRF Disaster Risk Hub`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      alternateName: "Satark World",
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#webapp`,
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "Disaster Management",
      operatingSystem: "Web",
      description:
        "A Mapbox-based disaster response console for visualizing flash flood and landslide risk, live monitoring stations, and district risk grids across Uttarakhand, India.",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      creator: { "@id": `${SITE_URL}/#organization` },
      keywords:
        "Satark, disaster risk mapping, flash flood monitoring, landslide monitoring, NDRF, Smart India Hackathon, SIH",
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "AlphaCraft",
      url: SITE_URL,
      description:
        "AlphaCraft is the team behind Satark, a Smart India Hackathon (SIH) prototype.",
      member: TEAM_MEMBERS.map((name) => ({ "@type": "Person", name })),
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
