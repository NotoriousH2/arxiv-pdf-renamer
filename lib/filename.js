export const DEFAULT_TEMPLATE = "[{year}.{month}] {title}";

export const TEMPLATE_PRESETS = {
  default: DEFAULT_TEMPLATE,
  short: "[{year2}.{month}] {title}",
  title: "{title}",
};

const SUPPORTED_TOKENS = new Set([
  "title",
  "authors",
  "firstAuthor",
  "year",
  "year2",
  "month",
  "arxivId",
  "category",
]);

export function templateFromLegacyPrefix(prefixFormat) {
  if (prefixFormat === "YY.MM") return TEMPLATE_PRESETS.short;
  if (prefixFormat === "none") return TEMPLATE_PRESETS.title;
  return TEMPLATE_PRESETS.default;
}

export function getUnknownTokens(template) {
  const tokens = [...String(template).matchAll(/\{([^{}]+)\}/g)].map(
    (match) => match[1]
  );
  return [...new Set(tokens.filter((token) => !SUPPORTED_TOKENS.has(token)))];
}

export function sanitizeFilename(value) {
  const cleaned = String(value)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/g, "");

  return cleaned.slice(0, 200).trim().replace(/[.\s]+$/g, "");
}

export function buildFilename(metadata, template = DEFAULT_TEMPLATE) {
  const unknownTokens = getUnknownTokens(template);
  if (unknownTokens.length) {
    throw new Error(`Unknown token: {${unknownTokens[0]}}`);
  }

  const authors = Array.isArray(metadata.authors) ? metadata.authors : [];
  const values = {
    title: metadata.title || "",
    authors: authors.join(", "),
    firstAuthor: authors[0] || "",
    year: metadata.year || "",
    year2: metadata.year ? String(metadata.year).slice(-2) : "",
    month: metadata.month || "",
    arxivId: metadata.arxivId || "",
    category: metadata.category || "",
  };

  const rendered = String(template).replace(
    /\{([^{}]+)\}/g,
    (_match, token) => values[token]
  );
  const basename = sanitizeFilename(rendered) || sanitizeFilename(metadata.title);
  return `${basename || "paper"}.pdf`;
}
