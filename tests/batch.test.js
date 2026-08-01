import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBatchCandidates,
  selectBatchItems,
} from "../lib/batch.js";

test("builds a unique batch list from abs and PDF links", () => {
  const candidates = buildBatchCandidates([
    {
      url: "https://arxiv.org/abs/2301.07041",
      title: "Title: First Paper",
    },
    {
      url: "https://arxiv.org/pdf/2301.07041.pdf",
      title: "[pdf]",
    },
    {
      url: "https://arxiv.org/abs/hep-th/9901001",
      title: "  Legacy   Paper ",
    },
    { url: "https://example.com/paper", title: "Ignored" },
  ]);

  assert.deepEqual(candidates, [
    {
      id: "2301.07041",
      title: "First Paper",
      url: "https://arxiv.org/abs/2301.07041",
    },
    {
      id: "hep-th/9901001",
      title: "Legacy Paper",
      url: "https://arxiv.org/abs/hep-th/9901001",
    },
  ]);
});

test("limits large pages and selects only checked IDs", () => {
  const links = Array.from({ length: 5 }, (_, index) => ({
    url: `https://arxiv.org/abs/2301.${String(index).padStart(4, "0")}`,
    title: `Paper ${index}`,
  }));
  const candidates = buildBatchCandidates(links, 3);

  assert.equal(candidates.length, 3);
  assert.deepEqual(
    selectBatchItems(candidates, ["2301.0001"]).map((item) => item.id),
    ["2301.0001"]
  );
});
