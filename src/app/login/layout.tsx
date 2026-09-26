import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sign in · Disaster Hub",
  description: "Secure access to the NDRF Disaster Hub command console.",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
