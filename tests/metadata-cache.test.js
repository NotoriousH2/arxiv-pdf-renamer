import test from "node:test";
import assert from "node:assert/strict";

import {
  METADATA_CACHE_KEY,
  METADATA_CACHE_TTL_MS,
  getPaperMetadata,
  readCachedMetadata,
  updateMetadataCache,
} from "../lib/metadata-cache.js";

function createStorageArea() {
  const state = {};
  return {
    state,
    async get(key) {
      return { [key]: state[key] };
    },
    async set(values) {
      Object.assign(state, values);
    },
  };
}

test("reads fresh cache entries and rejects expired entries", () => {
  const metadata = { title: "Cached Paper" };
  const now = 100000;
  const cache = updateMetadataCache({}, "2407.00001", metadata, now);

  assert.equal(readCachedMetadata(cache, "2407.00001", now), metadata);
  assert.equal(
    readCachedMetadata(
      cache,
      "2407.00001",
      now + METADATA_CACHE_TTL_MS
    ),
    null
  );
});

test("uses storage cache instead of fetching metadata twice", async () => {
  const storageArea = createStorageArea();
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    return {
      ok: true,
      text: async () =>
        '<meta name="citation_title" content="Cached Paper">',
    };
  };
  const options = {
    storageArea,
    fetchImpl,
    now: 100000,
    fetchOptions: { retryDelayMs: 0 },
  };

  const first = await getPaperMetadata("2407.00001", options);
  const second = await getPaperMetadata("2407.00001", options);

  assert.equal(first.title, "Cached Paper");
  assert.deepEqual(second, first);
  assert.equal(fetchCount, 1);
  assert.ok(storageArea.state[METADATA_CACHE_KEY]["2407.00001"]);
});
