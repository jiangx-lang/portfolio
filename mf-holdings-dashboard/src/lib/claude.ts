/**
 * Claude API client — stub for upgrade path.
 * TODO: Switch to Claude when ready:
 * 1. npm install @anthropic-ai/sdk (already in package.json)
 * 2. Change model to claude-sonnet-4-20250514
 * 3. Update ANTHROPIC_API_KEY in .env.local
 * 4. Qwen (OpenAI-compatible) and Claude share same message shape where applicable
 *    so migration is just swapping the client + model name in /api/analyze/route.ts
 */

import type { AISignal } from "@/types";

export interface AnalyzeInput {
  ticker: string;
  context?: string;
  analysisType: "stock" | "options" | "portfolio" | "risk" | "scenario";
}

export async function analyzeWithClaude(
  _input: AnalyzeInput,
  _apiKey: string
): Promise<AISignal> {
  return {
    signal: "hold",
    confidence: 50,
    thesis: "Claude not configured. Using Qwen in /api/analyze.",
    keyRisks: [],
    catalysts: [],
  };
}
