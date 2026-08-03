const STEPS = [
  {
    number: "01",
    title: "Check your rank",
    description:
      "Enter your domain above. We match it against {merchantCount}+ indexed x402 merchants and return your score instantly.",
  },
  {
    number: "02",
    title: "Get your report",
    description:
      "Connect your wallet for a free detailed report with improvement tips. Pay $0.03 for competitive intelligence with gap analysis.",
  },
  {
    number: "03",
    title: "Climb the leaderboard",
    description:
      "Follow the recommendations. Better listings, more transaction volume, diverse buyers — each one moves you up in agent discovery.",
  },
];

export function HowItWorks({ merchantCount }: { merchantCount: number }) {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <p className="text-sm font-medium text-brand-600 uppercase tracking-wide mb-2">
          How it works
        </p>
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
          Your rank is public. Here&apos;s how to improve it.
        </h2>
        <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-2xl">
          Decipher Ranker scores every x402 merchant on volume, buyer diversity, listing quality,
          and recency. A higher score means AI agents find you first.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="bg-white border border-gray-200 rounded-xl p-6"
            >
              <div className="text-sm font-semibold text-brand-600 mb-3">{step.number}</div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {step.description.replace("{merchantCount}", merchantCount.toLocaleString())}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
