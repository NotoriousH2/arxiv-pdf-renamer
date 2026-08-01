import test from "node:test";
import assert from "node:assert/strict";

import {
  extractDateFromId,
  fetchPaperMetadata,
  getPdfUrl,
  parseArxivUrl,
  parseMetadataFromHtml,
} from "../lib/arxiv.js";

test("parses modern, versioned, and legacy ArXiv URLs", () => {
  assert.deepEqual(parseArxivUrl("https://arxiv.org/abs/2301.07041"), {
    id: "2301.07041",
    type: "abs",
  });
  assert.deepEqual(parseArxivUrl("https://arxiv.org/pdf/2301.07041v2.pdf"), {
    id: "2301.07041v2",
    type: "pdf",
  });
  assert.deepEqual(parseArxivUrl("https://arxiv.org/abs/hep-th/9901001"), {
    id: "hep-th/9901001",
    type: "abs",
  });
  assert.equal(parseArxivUrl("https://example.com/abs/2301.07041"), null);
});

test("extracts dates and builds a clean PDF URL", () => {
  assert.deepEqual(extractDateFromId("2301.07041v2"), {
    year: "2023",
    month: "01",
  });
  assert.deepEqual(extractDateFromId("hep-th/9901001"), {
    year: "1999",
    month: "01",
  });
  assert.equal(
    getPdfUrl("2301.07041v2"),
    "https://arxiv.org/pdf/2301.07041.pdf"
  );
});

test("parses title, authors, category, and entities from HTML", () => {
  const html = `
    <meta content="Paper &amp; Results" name="citation_title">
    <meta name="citation_author" content="Ada Lovelace">
    <meta content="Alan Turing" name="citation_author">
    <span class="primary-subject">Machine Learning (cs.LG)</span>
  `;
  assert.deepEqual(parseMetadataFromHtml(html, "2301.07041"), {
    title: "Paper & Results",
    authors: ["Ada Lovelace", "Alan Turing"],
    category: "cs.LG",
    year: "2023",
    month: "01",
    arxivId: "2301.07041",
  });
});

test("fetches an abstract page through the supplied fetch function", async () => {
  const metadata = await fetchPaperMetadata("2301.07041", async (url) => ({
    ok: url.endsWith("/2301.07041"),
    text: async () =>
      '<meta name="citation_title" content="A Test Paper">',
  }));
  assert.equal(metadata.title, "A Test Paper");
});
