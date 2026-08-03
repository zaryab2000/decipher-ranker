"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ_ITEMS = [
  {
    q: "What is Decipher Ranker?",
    a: "Decipher Ranker is a merchant-analytics service for the x402 micropayment ecosystem. It indexes every x402 merchant from the Coinbase Bazaar catalog, scores and ranks them by discoverability, and exposes those rankings as reports — free previews plus paid competitive intelligence — so merchants can see where they stand and AI agents can find the best services.",
  },
  {
    q: "What is the Decipher score?",
    a: "A 0–100 composite score based on 30-day transaction volume (40%), buyer diversity (25%), listing quality (15%), recency (15%), and reliability (5%). Updated daily from Coinbase Bazaar data.",
  },
  {
    q: "How do I get indexed?",
    a: "Register your x402-enabled API on Coinbase Bazaar. Decipher Ranker automatically indexes new merchants within 24 hours of their Bazaar listing.",
  },
  {
    q: "What payment methods are accepted?",
    a: "Paid reports accept x402 micropayments (USDC on Base) and MPP (USDC on Tempo). The preview and origin reports are free — preview needs no auth at all, origin needs a wallet signature (SIWX).",
  },
  {
    q: "How often is data refreshed?",
    a: "The full catalog is re-ingested daily from Coinbase Bazaar. Scores, ranks, and category assignments update with each refresh. Trend snapshots are appended daily for historical tracking.",
  },
  {
    q: "Can AI agents use this service?",
    a: "Yes. Decipher Ranker exposes llms.txt and an OpenAPI spec for agent discovery. Agents can query free endpoints directly and pay for premium reports via x402 payment headers — no human in the loop.",
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left py-5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-gray-900">{question}</span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 shrink-0 ml-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="-mt-1 pb-5 text-sm text-gray-600 leading-relaxed">{answer}</p>
      )}
    </div>
  );
}

export function Faq() {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm font-medium text-brand-600 uppercase tracking-wide mb-2">FAQ</p>
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-8">
          Frequently asked questions
        </h2>
        <div className="divide-y divide-gray-200">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
