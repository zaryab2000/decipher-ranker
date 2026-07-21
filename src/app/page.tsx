import { getDb } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { TopNav } from "@/components/landing/TopNav";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { AgentPrompt } from "@/components/landing/AgentPrompt";
import { ApiReference } from "@/components/landing/ApiReference";
import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";

export const metadata = {
  title: "Decipher Ranker — x402 merchant analytics",
  description:
    "Rank, benchmark, and improve your x402 merchant API. Free instant preview, competitive analysis, and AI-powered recommendations.",
};

export default async function Home() {
  const [{ count }] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(merchants);

  const merchantCount = Number(count);

  return (
    <>
      <TopNav />
      <main className="bg-white min-h-screen">
        <Hero merchantCount={merchantCount} />
        <HowItWorks merchantCount={merchantCount} />
        <AgentPrompt />
        <ApiReference />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
