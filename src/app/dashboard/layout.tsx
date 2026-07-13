import type { Metadata } from "next";
import { DashboardShell } from "@/dashboard/components/layout/DashboardShell";

export const metadata: Metadata = {
  title: {
    default: "decipher-ranker — x402 Merchant Intelligence",
    template: "%s — decipher-ranker",
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
