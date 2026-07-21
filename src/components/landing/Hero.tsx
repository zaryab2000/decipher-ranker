"use client";

import { useEffect, useState } from "react";
import { BarChart3, Lightbulb, AlertCircle, ExternalLink } from "lucide-react";

interface PreviewMerchant {
  name: string | null;
  category: string | null;
  score: number;
  grade: string;
  rank: number | null;
  total_in_category: number;
  resource_count: number;
  chain: string;
}

interface PreviewTeaser {
  has_tips: boolean;
  tip_count: number;
  available_reports: string[];
}

interface PreviewResult {
  found: boolean;
  origin: string;
  message?: string;
  merchant?: PreviewMerchant;
  teaser?: PreviewTeaser;
  links: Record<string, string>;
}

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; data: PreviewResult }
  | { status: "not_found"; data: PreviewResult }
  | { status: "error"; message: string };

function extractHostname(urlOrDomain: string): string {
  try {
    return new URL(
      urlOrDomain.startsWith("http") ? urlOrDomain : `https://${urlOrDomain}`,
    ).hostname;
  } catch {
    return urlOrDomain;
  }
}

function gradeBadgeClasses(score: number): string {
  if (score >= 70) return "bg-emerald-50 text-emerald-700";
  if (score >= 40) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

function scoreBarColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function ResultSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 bg-gray-200 rounded" />
        <div className="h-5 w-10 bg-gray-200 rounded" />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center space-y-2">
          <div className="h-7 w-12 bg-gray-200 rounded mx-auto" />
          <div className="h-3 w-16 bg-gray-100 rounded mx-auto" />
        </div>
        <div className="text-center space-y-2">
          <div className="h-7 w-12 bg-gray-200 rounded mx-auto" />
          <div className="h-3 w-16 bg-gray-100 rounded mx-auto" />
        </div>
        <div className="text-center space-y-2">
          <div className="h-7 w-12 bg-gray-200 rounded mx-auto" />
          <div className="h-3 w-16 bg-gray-100 rounded mx-auto" />
        </div>
      </div>
      <div className="h-2 bg-gray-200 rounded-full mb-4" />
      <div className="h-4 w-48 bg-gray-100 rounded mb-4" />
      <div className="flex gap-3">
        <div className="flex-1 h-10 bg-gray-200 rounded-lg" />
        <div className="flex-1 h-10 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

function ResultCard({ data }: { data: PreviewResult }) {
  const merchant = data.merchant;
  const tipCount = data.teaser?.tip_count ?? 0;
  const targetWidth = Math.max(merchant?.score ?? 0, 2);

  // Start the bar empty and grow to the score on mount so the fill animates.
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setBarWidth(targetWidth));
    return () => cancelAnimationFrame(id);
  }, [targetWidth]);

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl shadow-sm p-6"
      style={{ animation: "slideIn 0.3s ease-out" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {merchant?.name || extractHostname(data.origin)}
        </h2>
        <span
          className={`text-sm font-semibold px-2.5 py-0.5 rounded-md ${
            merchant ? gradeBadgeClasses(merchant.score) : ""
          }`}
        >
          {merchant?.grade}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {merchant?.rank ? `#${merchant.rank}` : "—"}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Category rank</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{merchant?.score ?? 0}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Score</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            / {merchant?.total_in_category ?? 0}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">
            {merchant?.category ? `In ${merchant.category}` : "Global"}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div
          className="h-2 rounded-full bg-gray-100 overflow-hidden"
          role="progressbar"
          aria-valuenow={merchant?.score ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Score: ${merchant?.score ?? 0} out of 100`}
        >
          <div
            className={`h-2 rounded-full transition-all duration-700 ease-out ${scoreBarColor(merchant?.score ?? 0)}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        <Lightbulb className="inline w-4 h-4 text-amber-500 mr-1.5 -mt-0.5" />
        {tipCount === 0
          ? "No improvement tips — your listing looks solid"
          : <>
              {tipCount} improvement tip{tipCount !== 1 ? "s" : ""} available
              {" — "}
              <span className="text-emerald-600">connect wallet to see them</span>
            </>
        }
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={data.links?.dashboard ?? "#"}
          className="flex-1 text-center px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors duration-150"
        >
          View full report →
        </a>
        <a
          href={data.links?.dashboard ?? "#"}
          className="flex-1 text-center px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors duration-150"
        >
          Competitive analysis ($0.03) ↗
        </a>
      </div>
    </div>
  );
}

function NotFoundCard(_data: { data: PreviewResult }) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 border-l-4 border-l-amber-400"
      style={{ animation: "slideIn 0.3s ease-out" }}
    >
      <p className="text-sm text-gray-600 leading-relaxed mb-3">
        <AlertCircle className="inline w-4 h-4 text-amber-500 mr-1.5 -mt-0.5" />
        This service isn&apos;t indexed yet. It may take up to 24 hours after registration on
        Coinbase Bazaar to appear.
      </p>
      <a
        href="https://bazaar.coinbase.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
      >
        Register on Coinbase Bazaar
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div
      className="bg-red-50 border border-red-200 rounded-xl p-4 text-center"
      style={{ animation: "slideIn 0.3s ease-out" }}
    >
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

export function Hero({ merchantCount }: { merchantCount: number }) {
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });
  const [inputValue, setInputValue] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const origin = inputValue.trim();
    if (!origin) return;

    setSearchState({ status: "loading" });

    try {
      const res = await fetch(`/api/preview?origin=${encodeURIComponent(origin)}`);

      if (res.status === 429) {
        setSearchState({
          status: "error",
          message: "Too many requests. Please wait a minute and try again.",
        });
        return;
      }

      if (!res.ok) {
        setSearchState({
          status: "error",
          message: "Something went wrong. Please try again.",
        });
        return;
      }

      const data: PreviewResult = await res.json();
      setSearchState(
        data.found
          ? { status: "found", data }
          : { status: "not_found", data },
      );
    } catch {
      setSearchState({
        status: "error",
        message: "Network error. Check your connection and try again.",
      });
    }
  }

  const merchantCountText =
    merchantCount > 0
      ? `The x402 ecosystem has ${merchantCount.toLocaleString()}+ merchant APIs. Where does yours rank? Enter your domain and find out in 2 seconds — free, no wallet needed.`
      : "The x402 ecosystem is growing. Enter your domain to check if you're indexed — free, no wallet needed.";

  return (
    <section id="search" className="pt-24 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 max-w-2xl mx-auto text-center">
          You can&apos;t sell to agents, if they can&apos;t discover You
        </h1>

        <p className="mt-3 text-xl sm:text-2xl font-semibold text-emerald-600 max-w-2xl mx-auto text-center">
          Rank Higher, Sell More
        </p>

        <p className="mt-4 text-base sm:text-lg text-gray-600 max-w-xl mx-auto text-center leading-relaxed">
          {merchantCountText}
        </p>

        <form onSubmit={handleSearch} className="mt-8 max-w-lg mx-auto">
          <div className="flex flex-col sm:flex-row gap-3">
            <label htmlFor="origin-input" className="sr-only">
              Merchant domain or URL
            </label>
            <input
              id="origin-input"
              type="text"
              name="origin"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter your domain (e.g. bitrefill.com)"
              className="flex-1 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 text-base hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors duration-150"
            />
            <button
              type="submit"
              disabled={searchState.status === "loading"}
              className="px-6 py-3 bg-emerald-600 text-white text-base font-medium rounded-lg hover:bg-emerald-700 active:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {searchState.status === "loading" ? "Checking..." : "Check rank"}
            </button>
          </div>
        </form>

        <p className="mt-3 text-xs text-gray-400 text-center">
          Try:{" "}
          <button
            type="button"
            onClick={() => setInputValue("bitrefill.com")}
            className="text-emerald-600 hover:text-emerald-700 underline decoration-emerald-600/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded"
          >
            bitrefill.com
          </button>
          ,{" "}
          <button
            type="button"
            onClick={() => setInputValue("mesh.heurist.xyz")}
            className="text-emerald-600 hover:text-emerald-700 underline decoration-emerald-600/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded"
          >
            mesh.heurist.xyz
          </button>
          ,{" "}
          <button
            type="button"
            onClick={() => setInputValue("exa.ai")}
            className="text-emerald-600 hover:text-emerald-700 underline decoration-emerald-600/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded"
          >
            exa.ai
          </button>
        </p>

        <div className="mt-8 max-w-lg mx-auto" role="status" aria-live="polite">
          {searchState.status === "loading" && <ResultSkeleton />}
          {searchState.status === "found" && <ResultCard data={searchState.data} />}
          {searchState.status === "not_found" && <NotFoundCard data={searchState.data} />}
          {searchState.status === "error" && <ErrorCard message={searchState.message} />}
        </div>

        {searchState.status === "idle" && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://www.x402scan.com/server/d683a3a0-e920-4ebb-9f5d-2f3e0fe25803"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 hover:bg-gray-100 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Listed on x402scan
            </a>
            <a
              href="https://mppscan.com/services/decipher-ranker"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 hover:bg-gray-100 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Listed on MPPscan
            </a>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
              <BarChart3 className="w-3 h-3" /> {merchantCount.toLocaleString()}+ merchants indexed
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
