import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TEMPLATE,
  buildFilename,
  getUnknownTokens,
  sanitizeFilename,
  templateFromLegacyPrefix,
} from "../lib/filename.js";

const metadata = {
  title: "Attention Is All You Need",
  authors: ["Ashish Vaswani", "Noam Shazeer"],
  year: "2017",
  month: "06",
  arxivId: "1706.03762",
  category: "cs.CL",
};

test("builds the default filename", () => {
  assert.equal(
    buildFilename(metadata, DEFAULT_TEMPLATE),
    "[2017.06] Attention Is All You Need.pdf"
  );
});

test("renders all supported metadata tokens", () => {
  assert.equal(
    buildFilename(
      metadata,
      "{year2}-{month} {firstAuthor} - {title} [{arxivId}] {category}"
    ),
    "17-06 Ashish Vaswani - Attention Is All You Need [1706.03762] cs.CL.pdf"
  );
  assert.match(buildFilename(metadata, "{authors}"), /Noam Shazeer/);
});

test("sanitizes forbidden filename characters and trailing dots", () => {
  assert.equal(sanitizeFilename('A: "Paper" / Draft...'), "A Paper Draft");
});

test("reports unknown tokens", () => {
  assert.deepEqual(getUnknownTokens("{title}-{doi}-{doi}"), ["doi"]);
  assert.throws(() => buildFilename(metadata, "{doi}"), /Unknown token/);
});

test("migrates the legacy prefix setting", () => {
  assert.equal(templateFromLegacyPrefix("YYYY.MM"), "[{year}.{month}] {title}");
  assert.equal(templateFromLegacyPrefix("YY.MM"), "[{year2}.{month}] {title}");
  assert.equal(templateFromLegacyPrefix("none"), "{title}");
});
