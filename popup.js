(async function () {
  const loadingEl = document.getElementById("loading");
  const resultEl = document.getElementById("result");
  const errorEl = document.getElementById("error");
  const errorMsg = document.getElementById("error-msg");
  const titleInput = document.getElementById("title-input");
  const downloadBtn = document.getElementById("download-btn");
  const prefixSelect = document.getElementById("prefix-select");
  const filenamePreview = document.getElementById("filename-preview");

  const PREF_KEY = "arxiv_renamer_prefix";

  let pdfUrl = "";
  let sanitizedTitle = "";
  let paperDate = null; // { year: "2023", month: "01" }

  function showError(msg) {
    loadingEl.classList.add("hidden");
    resultEl.classList.add("hidden");
    errorEl.classList.remove("hidden");
    errorMsg.textContent = msg;
  }

  function showResult(title) {
    loadingEl.classList.add("hidden");
    errorEl.classList.add("hidden");
    resultEl.classList.remove("hidden");
    titleInput.value = title;
  }

  // Parse ArXiv URL and return { id, type } or null
  function parseArxivUrl(url) {
    try {
      const u = new URL(url);
      if (!u.hostname.endsWith("arxiv.org")) return null;

      // Modern format: /abs/2301.07041 or /pdf/2301.07041v2 or /pdf/2301.07041.pdf
      const modern = u.pathname.match(/^\/(abs|pdf)\/(\d{4}\.\d{4,5})(v\d+)?(\.pdf)?$/);
      if (modern) {
        const type = modern[1];
        const id = modern[2] + (modern[3] || "");
        return { id, type };
      }

      // Legacy format: /abs/hep-th/9901001 or /pdf/hep-th/9901001
      const legacy = u.pathname.match(/^\/(abs|pdf)\/([\w-]+\/\d{7})(v\d+)?(\.pdf)?$/);
      if (legacy) {
        const type = legacy[1];
        const id = legacy[2] + (legacy[3] || "");
        return { id, type };
      }

      return null;
    } catch {
      return null;
    }
  }

  // Decode HTML entities
  function decodeHtmlEntities(str) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = str;
    return textarea.value;
  }

  // Remove characters forbidden in filenames, trim, limit to 200 chars
  function sanitizeFilename(title) {
    return title
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
  }

  // Extract year and month from ArXiv ID
  // Modern: "2301.07041" → { year: "2023", month: "01" }
  // Legacy: "hep-th/9901001" → { year: "1999", month: "01" }
  function extractDateFromId(id) {
    // Modern format: first 4 digits are YYMM
    const modern = id.match(/^(\d{2})(\d{2})\.\d{4,5}/);
    if (modern) {
      const yy = modern[1];
      const mm = modern[2];
      const year = (parseInt(yy, 10) >= 90 ? "19" : "20") + yy;
      return { year, month: mm };
    }
    // Legacy format: category/YYMM...
    const legacy = id.match(/[\w-]+\/(\d{2})(\d{2})\d{3}/);
    if (legacy) {
      const yy = legacy[1];
      const mm = legacy[2];
      const year = (parseInt(yy, 10) >= 90 ? "19" : "20") + yy;
      return { year, month: mm };
    }
    return null;
  }

  // Build filename with optional date prefix
  function buildFilename(title, date, prefixFormat) {
    if (!date || prefixFormat === "none") return title + ".pdf";
    if (prefixFormat === "YY.MM") {
      return `[${date.year.slice(2)}.${date.month}] ${title}.pdf`;
    }
    // Default: YYYY.MM
    return `[${date.year}.${date.month}] ${title}.pdf`;
  }

  function updatePreview() {
    if (!sanitizedTitle) return;
    const fmt = prefixSelect.value;
    filenamePreview.textContent = buildFilename(sanitizedTitle, paperDate, fmt);
  }

  // Extract title from an abs page by injecting a script into the tab
  async function extractTitleFromAbsPage(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const citation = document.querySelector('meta[name="citation_title"]');
        if (citation) return citation.content;

        const og = document.querySelector('meta[property="og:title"]');
        if (og) return og.content;

        const h1 = document.querySelector("h1.title");
        if (h1) {
          // The h1 contains a <span class="descriptor">Title:</span> prefix
          const clone = h1.cloneNode(true);
          const descriptor = clone.querySelector(".descriptor");
          if (descriptor) descriptor.remove();
          return clone.textContent.trim();
        }

        return null;
      },
    });

    const title = results?.[0]?.result;
    if (!title) throw new Error("Could not extract title from this page.");
    return decodeHtmlEntities(title);
  }

  // Fetch the abs page HTML and parse the title (used when on a pdf page)
  async function fetchTitleFromAbsPage(absUrl) {
    const resp = await fetch(absUrl);
    if (!resp.ok) throw new Error(`Failed to fetch abstract page (HTTP ${resp.status}).`);
    const html = await resp.text();

    // Try citation_title meta tag
    const citationMatch = html.match(
      /<meta\s+name="citation_title"\s+content="([^"]+)"/i
    );
    if (citationMatch) return decodeHtmlEntities(citationMatch[1]);

    // Try og:title meta tag
    const ogMatch = html.match(
      /<meta\s+property="og:title"\s+content="([^"]+)"/i
    );
    if (ogMatch) return decodeHtmlEntities(ogMatch[1]);

    throw new Error("Could not find paper title in abstract page.");
  }

  // --- Main flow ---
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      showError("Cannot access the current tab URL.");
      return;
    }

    const parsed = parseArxivUrl(tab.url);
    if (!parsed) {
      showError("This is not an ArXiv page.");
      return;
    }

    // Build the PDF download URL (always use the id without version for clean URL,
    // but the actual id may contain version info)
    const baseId = parsed.id.replace(/v\d+$/, "");
    pdfUrl = `https://arxiv.org/pdf/${baseId}.pdf`;

    // Extract date from ArXiv ID
    paperDate = extractDateFromId(parsed.id);

    let title;
    if (parsed.type === "abs") {
      title = await extractTitleFromAbsPage(tab.id);
    } else {
      // pdf page — fetch the corresponding abs page
      const absUrl = `https://arxiv.org/abs/${parsed.id}`;
      title = await fetchTitleFromAbsPage(absUrl);
    }

    sanitizedTitle = sanitizeFilename(title);
    if (!sanitizedTitle) {
      showError("Extracted title is empty after sanitization.");
      return;
    }

    // Restore saved prefix preference
    const saved = await chrome.storage.local.get(PREF_KEY);
    if (saved[PREF_KEY]) prefixSelect.value = saved[PREF_KEY];

    showResult(sanitizedTitle);
    updatePreview();
  } catch (err) {
    showError(err.message || "An unexpected error occurred.");
  }

  // Save preference and update preview when prefix format changes
  prefixSelect.addEventListener("change", () => {
    chrome.storage.local.set({ [PREF_KEY]: prefixSelect.value });
    updatePreview();
  });

  // Download button handler
  downloadBtn.addEventListener("click", () => {
    if (!pdfUrl || !sanitizedTitle) return;

    const filename = buildFilename(sanitizedTitle, paperDate, prefixSelect.value);

    downloadBtn.disabled = true;
    downloadBtn.textContent = "Starting download...";

    chrome.runtime.sendMessage(
      { action: "download", url: pdfUrl, filename },
      (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          downloadBtn.disabled = false;
          downloadBtn.textContent = "Download PDF";
          showError(response?.error || "Download failed.");
        } else {
          downloadBtn.textContent = "Download started!";
          setTimeout(() => window.close(), 1000);
        }
      }
    );
  });
})();
