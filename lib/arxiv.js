export function parseArxivUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.endsWith("arxiv.org")) return null;

    const modern = parsedUrl.pathname.match(
      /^\/(abs|pdf)\/(\d{4}\.\d{4,5})(v\d+)?(\.pdf)?$/
    );
    if (modern) {
      return {
        id: modern[2] + (modern[3] || ""),
        type: modern[1],
      };
    }

    const legacy = parsedUrl.pathname.match(
      /^\/(abs|pdf)\/([\w-]+\/\d{7})(v\d+)?(\.pdf)?$/
    );
    if (legacy) {
      return {
        id: legacy[2] + (legacy[3] || ""),
        type: legacy[1],
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function extractDateFromId(id) {
  const modern = id.match(/^(\d{2})(\d{2})\.\d{4,5}/);
  if (modern) {
    const yearPrefix = parseInt(modern[1], 10) >= 90 ? "19" : "20";
    return { year: yearPrefix + modern[1], month: modern[2] };
  }

  const legacy = id.match(/[\w-]+\/(\d{2})(\d{2})\d{3}/);
  if (legacy) {
    const yearPrefix = parseInt(legacy[1], 10) >= 90 ? "19" : "20";
    return { year: yearPrefix + legacy[1], month: legacy[2] };
  }

  return null;
}

export function decodeHtmlEntities(value) {
  const entities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };

  return String(value).replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (match, entity) => {
      if (entity[0] !== "#") return entities[entity.toLowerCase()] || match;
      const isHex = entity[1].toLowerCase() === "x";
      const codePoint = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
  );
}

function parseMetaTags(html) {
  return [...String(html).matchAll(/<meta\b[^>]*>/gi)].map((tagMatch) => {
    const attributes = {};
    for (const attribute of tagMatch[0].matchAll(
      /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
    )) {
      attributes[attribute[1].toLowerCase()] =
        attribute[2] ?? attribute[3] ?? "";
    }
    return attributes;
  });
}

export function parseMetadataFromHtml(html, arxivId) {
  const metaTags = parseMetaTags(html);
  const findContents = (attribute, value) =>
    metaTags
      .filter((meta) => meta[attribute]?.toLowerCase() === value)
      .map((meta) => decodeHtmlEntities(meta.content || "").trim())
      .filter(Boolean);

  const title =
    findContents("name", "citation_title")[0] ||
    findContents("property", "og:title")[0] ||
    "";
  const authors = findContents("name", "citation_author");
  const metaCategory =
    findContents("name", "citation_primary_category")[0] || "";
  const primarySubjectMatch = String(html).match(
    /class=["'][^"']*\bprimary-subject\b[^"']*["'][^>]*>[\s\S]*?\(([^)]+)\)/
  );
  const date = extractDateFromId(arxivId);

  if (!title) {
    throw new Error("Could not find paper title in abstract page.");
  }

  return {
    title: title.replace(/\s+/g, " "),
    authors,
    category: metaCategory || primarySubjectMatch?.[1] || "",
    year: date?.year || "",
    month: date?.month || "",
    arxivId,
  };
}

export function getPdfUrl(arxivId) {
  const baseId = arxivId.replace(/v\d+$/, "");
  return `https://arxiv.org/pdf/${baseId}.pdf`;
}

export async function fetchPaperMetadata(arxivId, fetchImpl = fetch) {
  const response = await fetchImpl(`https://arxiv.org/abs/${arxivId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch abstract page (HTTP ${response.status}).`);
  }
  return parseMetadataFromHtml(await response.text(), arxivId);
}
