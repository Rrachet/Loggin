import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loggin — Your company, right now.",
  description: "Founder-first attendance for modern teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}