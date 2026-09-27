import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Satark's live disaster risk dashboard: flash flood and landslide monitoring, sensor telemetry, and district risk grids across Uttarakhand, India.",
  alternates: {
    canonical: "/dashboard",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
