import type { Metadata } from "next";
import { DashboardShell } from "@/dashboard/components/layout/DashboardShell";

export const metadata: Metadata = {
  // "Decipher Ranker" everywhere — the sidebar, the landing page, and the
  // cockpit all use the title-case form.
  title: {
    default: "Decipher Ranker — x402 merchant intelligence",
    template: "%s — Decipher Ranker",
  },
  description:
    "Analytics, rankings, and competitive intelligence for the x402 micropayment ecosystem.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
