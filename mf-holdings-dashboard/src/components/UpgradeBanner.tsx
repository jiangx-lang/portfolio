"use client";

export function UpgradeBanner() {
  return (
    <div className="rounded-lg border border-white/10 bg-navy-card px-4 py-3 text-center text-sm text-white/70">
      Upgrade to Claude API for deeper analysis. Same interface — swap GROQ_API_KEY for ANTHROPIC_API_KEY in /api/analyze.
    </div>
  );
}
