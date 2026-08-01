import test from "node:test";
import assert from "node:assert/strict";

import {
  addHistoryRecord,
  findLatestHistory,
  resolveDownloadId,
  splitArxivId,
  updateHistoryRecord,
} from "../lib/history.js";

test("splits ArXiv versions and resolves latest or current downloads", () => {
  assert.deepEqual(splitArxivId("2301.07041v3"), {
    baseId: "2301.07041",
    version: 3,
  });
  assert.equal(resolveDownloadId("2301.07041v3", "latest"), "2301.07041");
  assert.equal(resolveDownloadId("2301.07041v3", "current"), "2301.07041v3");
  assert.equal(
    resolveDownloadId("hep-th/9901001v2", "current"),
    "hep-th/9901001v2"
  );
});

test("adds, updates, and finds download history by base ID", () => {
  const first = {
    downloadId: 1,
    arxivId: "2301.07041v1",
    startedAt: 100,
    state: "in_progress",
  };
  const second = {
    downloadId: 2,
    arxivId: "2301.07041v2",
    startedAt: 200,
    state: "in_progress",
  };
  let history = addHistoryRecord([], first);
  history = addHistoryRecord(history, second);
  history = updateHistoryRecord(history, 2, { state: "complete" });

  assert.equal(findLatestHistory(history, "2301.07041").downloadId, 2);
  assert.equal(findLatestHistory(history, "2301.07041").state, "complete");
  assert.equal(findLatestHistory(history, "2401.00001"), null);
});
