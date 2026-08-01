import test from "node:test";
import assert from "node:assert/strict";

import {
  extractDateFromId,
  fetchPaperMetadata,
  getPdfUrl,
  parseArxivUrl,
  parseMetadataFromAtom,
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
  assert.equal(
    getPdfUrl("2301.07041v2", "current"),
    "https://arxiv.org/pdf/2301.07041v2.pdf"
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
  const metadata = await fetchPaperMetadata("2301.07041", {
    fetchImpl: async (url) => ({
      ok: url.endsWith("/2301.07041"),
      text: async () =>
        '<meta name="citation_title" content="A Test Paper">',
    }),
    retryDelayMs: 0,
  });
  assert.equal(metadata.title, "A Test Paper");
});

test("parses metadata returned by the ArXiv Atom API", () => {
  const xml = `
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>API &amp; Fallback</title>
        <published>2024-07-03T00:00:00Z</published>
        <author><name>Grace Hopper</name></author>
        <author><name>Donald Knuth</name></author>
        <category term="cs.SE"/>
      </entry>
    </feed>
  `;
  assert.deepEqual(parseMetadataFromAtom(xml, "2407.00001"), {
    title: "API & Fallback",
    authors: ["Grace Hopper", "Donald Knuth"],
    category: "cs.SE",
    year: "2024",
    month: "07",
    arxivId: "2407.00001",
  });
});

test("falls back to the Atom API when the abstract page fails", async () => {
  const requestedUrls = [];
  const metadata = await fetchPaperMetadata("2407.00001", {
    attempts: 1,
    apiDelayMs: 0,
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      if (url.includes("/abs/")) return { ok: false, status: 503 };
      return {
        ok: true,
        text: async () => `
          <feed><entry><title>Fallback Paper</title>
          <published>2024-07-01</published></entry></feed>
        `,
      };
    },
  });

  assert.equal(metadata.title, "Fallback Paper");
  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[1], /export\.arxiv\.org/);
});

test("retries a transient abstract page failure", async () => {
  let attempts = 0;
  const metadata = await fetchPaperMetadata("2407.00001", {
    attempts: 2,
    retryDelayMs: 0,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) return { ok: false, status: 500 };
      return {
        ok: true,
        text: async () =>
          '<meta name="citation_title" content="Recovered Paper">',
      };
    },
  });

  assert.equal(metadata.title, "Recovered Paper");
  assert.equal(attempts, 2);
});
