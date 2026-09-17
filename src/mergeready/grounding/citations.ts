// SPDX-License-Identifier: Apache-2.0
import type { GroundingBundle } from "./tavily.js";

export interface CitationProps {
  title: string;
  url: string;
  snippet: string;
  index: number;
}

export function toCitationProps(bundle: GroundingBundle): CitationProps[] {
  if (!bundle || !Array.isArray(bundle.results) || bundle.results.length === 0) {
    return [{ title: "No grounding results", url: "", snippet: "Run continued without grounding.", index: 0 }];
  }
  return bundle.results.map((r, i) => ({ title: r.title, url: r.url, snippet: r.snippet, index: i }));
}

export function receiptLine(bundle: GroundingBundle): string {
  const results = Array.isArray(bundle.results) ? bundle.results : [];
  const urls = results.slice(0, 3).map((r) => r.url).join(",");
  return `grounding: tavily query="${bundle.query}" citations=${results.length} urls=${urls}`;
}
