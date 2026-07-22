/**
 * CartIQ — BM25 Relevance Trimmer
 *
 * Selects the most relevant lines from a large HTML/text blob before
 * passing to a parser or LLM — keeping context focused and reducing noise.
 *
 * Ported from changedetection.io's bm25_trim.py (pure functions, no side effects).
 *
 * Usage:
 *   const trimmed = bm25Trim(rawHtml, 'golf cart price year make model', 12000);
 */

const MAX_CONTEXT_CHARS = 12_000;

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(Boolean);
}

function computeIdf(tokenizedDocs: string[][], queryTokens: string[]): Record<string, number> {
  const N = tokenizedDocs.length;
  const idf: Record<string, number> = {};
  for (const qt of queryTokens) {
    const df = tokenizedDocs.filter(doc => doc.includes(qt)).length;
    idf[qt] = Math.log((N - df + 0.5) / (df + 0.5) + 1);
  }
  return idf;
}

function bm25Score(
  docTokens: string[],
  queryTokens: string[],
  avgDocLen: number,
  idf: Record<string, number>
): number {
  const k1 = 1.5, b = 0.75;
  const docLen = docTokens.length;
  const tf: Record<string, number> = {};
  for (const t of docTokens) tf[t] = (tf[t] || 0) + 1;

  return queryTokens.reduce((score, qt) => {
    if (!idf[qt]) return score;
    const f = tf[qt] || 0;
    const tfScore = (f * (k1 + 1)) / (f + k1 * (1 - b + b * docLen / avgDocLen));
    return score + idf[qt] * tfScore;
  }, 0);
}

/**
 * Return the lines from `text` most relevant to `query`, up to `maxChars`.
 * If text already fits within budget, returns it unchanged.
 * Preserves original document order of selected lines.
 */
export function bm25Trim(
  text: string,
  query: string,
  maxChars: number = MAX_CONTEXT_CHARS
): string {
  if (!text || !query) return text || '';
  if (text.length <= maxChars) return text;

  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return text.slice(0, maxChars);

  const queryTokens = tokenize(query);
  const tokenizedDocs = lines.map(tokenize);
  const avgDocLen = tokenizedDocs.reduce((s, d) => s + d.length, 0) / tokenizedDocs.length;
  const idf = computeIdf(tokenizedDocs, queryTokens);

  const scored = lines.map((line, i) => ({
    line,
    i,
    score: bm25Score(tokenizedDocs[i], queryTokens, avgDocLen, idf),
  }));

  // Sort by relevance descending, pick top lines up to maxChars
  scored.sort((a, b) => b.score - a.score);

  let charCount = 0;
  const selectedIndices: number[] = [];
  for (const { line, i } of scored) {
    if (charCount + line.length + 1 > maxChars) break;
    selectedIndices.push(i);
    charCount += line.length + 1;
  }

  // Re-order selected lines to preserve original document order
  selectedIndices.sort((a, b) => a - b);
  return selectedIndices.map(i => lines[i]).join('\n');
}

/** Golf cart inventory query — tuned for dealer HTML pages */
export const INVENTORY_QUERY =
  'golf cart price year make model passenger electric lithium lead acid warranty condition new used';
