import Link from "next/link";

export default function RiskPage() {
  return (
    <div className="min-h-screen bg-navy">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="text-info hover:underline">
            ← Portfolio
          </Link>
          <h1 className="text-xl font-semibold text-white">Risk Metrics</h1>
          <span />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 pb-24 md:px-6 md:py-8 md:pb-10">
        <div className="rounded-xl border border-white/10 bg-navy-card p-8 text-center">
          <p className="text-white/80">
            Beta, 52W high, % from high, Sharpe, correlation heatmap, stress
            scenarios.
          </p>
          <p className="mt-2 text-sm text-white/50">
            Connect data + Claude for scenario analysis
          </p>
        </div>
      </main>
    </div>
  );
}
