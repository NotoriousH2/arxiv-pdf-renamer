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

function textFromXml(value) {
  return decodeHtmlEntities(String(value).replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseMetadataFromAtom(xml, arxivId) {
  const entry = String(xml).match(/<entry\b[^>]*>([\s\S]*?)<\/entry>/i)?.[1];
  if (!entry) throw new Error("ArXiv API returned no matching paper.");

  const title = textFromXml(
    entry.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""
  );
  const authors = [...entry.matchAll(/<author\b[^>]*>([\s\S]*?)<\/author>/gi)]
    .map((author) =>
      textFromXml(
        author[1].match(/<name\b[^>]*>([\s\S]*?)<\/name>/i)?.[1] || ""
      )
    )
    .filter(Boolean);
  const category =
    entry.match(/<category\b[^>]*\bterm=["']([^"']+)["']/i)?.[1] || "";
  const published =
    entry.match(/<published\b[^>]*>([^<]+)<\/published>/i)?.[1] || "";
  const publishedMatch = published.match(/^(\d{4})-(\d{2})/);
  const idDate = extractDateFromId(arxivId);

  if (!title) throw new Error("ArXiv API response did not include a title.");

  return {
    title,
    authors,
    category: decodeHtmlEntities(category),
    year: publishedMatch?.[1] || idDate?.year || "",
    month: publishedMatch?.[2] || idDate?.month || "",
    arxivId,
  };
}

export function getPdfUrl(arxivId, versionMode = "latest") {
  const resolvedId =
    versionMode === "current" ? arxivId : arxivId.replace(/v\d+$/, "");
  return `https://arxiv.org/pdf/${resolvedId}.pdf`;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchWithRetry(
  url,
  {
    fetchImpl = fetch,
    attempts = 2,
    timeoutMs = 8000,
    retryDelayMs = 300,
  } = {}
) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError =
        error.name === "AbortError"
          ? new Error(`Request timed out after ${timeoutMs}ms.`)
          : error;
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < attempts - 1) {
      await delay(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError || new Error(`Request failed: ${url}`);
}

let lastApiRequestAt = 0;

async function waitForApiSlot(minimumIntervalMs) {
  const waitTime = lastApiRequestAt + minimumIntervalMs - Date.now();
  if (waitTime > 0) await delay(waitTime);
  lastApiRequestAt = Date.now();
}

export async function fetchPaperMetadata(
  arxivId,
  {
    fetchImpl = fetch,
    attempts = 2,
    timeoutMs = 8000,
    retryDelayMs = 300,
    apiDelayMs = 3000,
  } = {}
) {
  const requestOptions = {
    fetchImpl,
    attempts,
    timeoutMs,
    retryDelayMs,
  };
  let htmlError;

  try {
    const htmlResponse = await fetchWithRetry(
      `https://arxiv.org/abs/${arxivId}`,
      requestOptions
    );
    return parseMetadataFromHtml(await htmlResponse.text(), arxivId);
  } catch (error) {
    htmlError = error;
  }

  try {
    await waitForApiSlot(apiDelayMs);
    const apiUrl =
      "https://export.arxiv.org/api/query?" +
      `id_list=${encodeURIComponent(arxivId)}&max_results=1`;
    const apiResponse = await fetchWithRetry(apiUrl, requestOptions);
    return parseMetadataFromAtom(await apiResponse.text(), arxivId);
  } catch (apiError) {
    throw new Error(
      `Could not load ArXiv metadata. HTML: ${htmlError.message}; ` +
        `API: ${apiError.message}`
    );
  }
}
