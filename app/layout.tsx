import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpportunityNG — Verified opportunities, original sources",
  description: "Discover verified grants, training, scholarships, jobs and funding opportunities—and apply directly with the programme owner.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
