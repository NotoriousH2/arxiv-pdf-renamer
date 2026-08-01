import { fetchPaperMetadata } from "./arxiv.js";

export const METADATA_CACHE_KEY = "arxiv_renamer_metadata_cache";
export const METADATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

export function readCachedMetadata(cache, arxivId, now = Date.now()) {
  const entry = cache?.[arxivId];
  if (!entry || now - entry.cachedAt >= METADATA_CACHE_TTL_MS) return null;
  return entry.metadata;
}

export function updateMetadataCache(
  cache,
  arxivId,
  metadata,
  now = Date.now()
) {
  const entries = Object.entries(cache || {})
    .filter(
      ([id, entry]) =>
        id !== arxivId && now - entry.cachedAt < METADATA_CACHE_TTL_MS
    )
    .sort(([, left], [, right]) => right.cachedAt - left.cachedAt)
    .slice(0, MAX_CACHE_ENTRIES - 1);

  return {
    [arxivId]: { cachedAt: now, metadata },
    ...Object.fromEntries(entries),
  };
}

export async function getPaperMetadata(
  arxivId,
  {
    storageArea = chrome.storage.local,
    fetchImpl = fetch,
    now = Date.now(),
    fetchOptions = {},
  } = {}
) {
  const saved = await storageArea.get(METADATA_CACHE_KEY);
  const cache = saved[METADATA_CACHE_KEY] || {};
  const cached = readCachedMetadata(cache, arxivId, now);
  if (cached) return cached;

  const metadata = await fetchPaperMetadata(arxivId, {
    ...fetchOptions,
    fetchImpl,
  });
  await storageArea.set({
    [METADATA_CACHE_KEY]: updateMetadataCache(
      cache,
      arxivId,
      metadata,
      now
    ),
  });
  return metadata;
}
