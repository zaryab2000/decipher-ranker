import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "decipher-ranker — x402 Merchant Intelligence",
  description:
    "Rankings, competitive analysis, and actionable insights for x402 API providers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
