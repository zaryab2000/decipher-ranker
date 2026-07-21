"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

const CODE_BLOCK_TEXT = `# Discovery — how agents find this service
GET /llms.txt
GET /openapi.json

# Free — no auth, no payment
GET /api/preview?origin=your-domain.com
GET /api/categories
GET /api/leaderboard?category=AI+%26+Agents&limit=10

# Free + wallet identity (SIWX)
POST /api/report/origin
  {"origin": "https://your-api.com"}

# Paid — $0.03 USDC on Base (x402) or Tempo (MPP)
POST /api/report/competitive
  {"origin": "https://your-api.com"}
POST /api/report/merchant
  {"address": "0x...", "chain": "base"}
`;

export function AgentPrompt() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(CODE_BLOCK_TEXT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section id="agents" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <p className="text-sm font-medium text-emerald-600 uppercase tracking-wide mb-2">
          For AI agents
        </p>
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
          Every ranking, available over HTTP
        </h2>
        <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-2xl">
          Decipher Ranker is itself an x402 service. AI agents can query rankings, pull competitive
          reports, and benchmark merchants — all with standard HTTP and micropayment headers.
        </p>

        <div className="relative bg-gray-900 rounded-xl p-6 overflow-x-auto">
          <button
            onClick={handleCopy}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <pre className="font-mono text-sm text-gray-300 leading-relaxed whitespace-pre">
            {CODE_BLOCK_TEXT}
          </pre>
        </div>
      </div>
    </section>
  );
}
