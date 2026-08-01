import { parseArxivUrl } from "./arxiv.js";

export const MAX_BATCH_SIZE = 50;

export function buildBatchCandidates(links, limit = MAX_BATCH_SIZE) {
  const candidates = [];
  const seenIds = new Set();

  for (const link of links) {
    const parsed = parseArxivUrl(link.url);
    if (!parsed || seenIds.has(parsed.id)) continue;

    seenIds.add(parsed.id);
    const title = String(link.title || "")
      .replace(/^Title:\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
    candidates.push({
      id: parsed.id,
      title: title || parsed.id,
      url: `https://arxiv.org/abs/${parsed.id}`,
    });

    if (candidates.length >= limit) break;
  }

  return candidates;
}

export function selectBatchItems(candidates, selectedIds) {
  const selected = new Set(selectedIds);
  return candidates.filter((candidate) => selected.has(candidate.id));
}
