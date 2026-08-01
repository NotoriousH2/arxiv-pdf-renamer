import {
  DEFAULT_TEMPLATE,
  TEMPLATE_PRESETS,
  buildFilename,
  getUnknownTokens,
  templateFromLegacyPrefix,
} from "./lib/filename.js";
import {
  extractDateFromId,
  parseArxivUrl,
  parseMetadataFromHtml,
} from "./lib/arxiv.js";

(async function () {
  const loadingEl = document.getElementById("loading");
  const resultEl = document.getElementById("result");
  const errorEl = document.getElementById("error");
  const errorMsg = document.getElementById("error-msg");
  const titleInput = document.getElementById("title-input");
  const downloadBtn = document.getElementById("download-btn");
  const templateSelect = document.getElementById("template-select");
  const customTemplateRow = document.getElementById("custom-template-row");
  const customTemplateInput = document.getElementById("custom-template");
  const templateError = document.getElementById("template-error");
  const filenamePreview = document.getElementById("filename-preview");

  const LEGACY_PREF_KEY = "arxiv_renamer_prefix";
  const TEMPLATE_KEY = "arxiv_renamer_template";
  const CUSTOM_TEMPLATE_KEY = "arxiv_renamer_custom_template";

  let pdfUrl = "";
  let paperMetadata = null;

  function showError(message) {
    loadingEl.classList.add("hidden");
    resultEl.classList.add("hidden");
    errorEl.classList.remove("hidden");
    errorMsg.textContent = message;
  }

  function showResult(title) {
    loadingEl.classList.add("hidden");
    errorEl.classList.add("hidden");
    resultEl.classList.remove("hidden");
    titleInput.value = title;
  }

  function decodeHtmlEntities(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  function selectedTemplate() {
    if (templateSelect.value === "custom") {
      return customTemplateInput.value;
    }
    return TEMPLATE_PRESETS[templateSelect.value] || DEFAULT_TEMPLATE;
  }

  function updatePreview() {
    if (!paperMetadata) return;

    const template = selectedTemplate();
    const unknownTokens = getUnknownTokens(template);
    const hasError = unknownTokens.length > 0 || !template.trim();
    templateError.classList.toggle("hidden", !hasError);
    templateError.textContent = unknownTokens.length
      ? `Unsupported token: {${unknownTokens[0]}}`
      : "Enter a filename template.";
    downloadBtn.disabled = hasError;

    if (hasError) {
      filenamePreview.textContent = templateError.textContent;
      return;
    }

    filenamePreview.textContent = buildFilename(paperMetadata, template);
  }

  async function extractMetadataFromAbsPage(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const citation = document.querySelector('meta[name="citation_title"]');
        const og = document.querySelector('meta[property="og:title"]');
        let title = citation?.content || og?.content || "";

        if (!title) {
          const heading = document.querySelector("h1.title");
          if (heading) {
            const clone = heading.cloneNode(true);
            clone.querySelector(".descriptor")?.remove();
            title = clone.textContent.trim();
          }
        }

        const authors = Array.from(
          document.querySelectorAll('meta[name="citation_author"]')
        ).map((meta) => meta.content);
        const primarySubject = document.querySelector(".primary-subject");
        const categoryMatch = primarySubject?.textContent.match(/\(([^)]+)\)/);

        return {
          title,
          authors,
          category: categoryMatch?.[1] || "",
        };
      },
    });

    const metadata = results?.[0]?.result;
    if (!metadata?.title) {
      throw new Error("Could not extract title from this page.");
    }
    return {
      ...metadata,
      title: decodeHtmlEntities(metadata.title),
    };
  }

  async function fetchMetadataFromAbsPage(absUrl) {
    const response = await fetch(absUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch abstract page (HTTP ${response.status}).`);
    }
    const html = await response.text();
    const parsed = parseArxivUrl(absUrl);
    return parseMetadataFromHtml(html, parsed.id);
  }

  templateSelect.addEventListener("change", () => {
    customTemplateRow.classList.toggle(
      "hidden",
      templateSelect.value !== "custom"
    );
    chrome.storage.local.set({ [TEMPLATE_KEY]: selectedTemplate() });
    updatePreview();
  });

  customTemplateInput.addEventListener("input", () => {
    chrome.storage.local.set({
      [TEMPLATE_KEY]: customTemplateInput.value,
      [CUSTOM_TEMPLATE_KEY]: customTemplateInput.value,
    });
    updatePreview();
  });

  downloadBtn.addEventListener("click", () => {
    if (!pdfUrl || !paperMetadata || downloadBtn.disabled) return;

    const filename = buildFilename(paperMetadata, selectedTemplate());
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

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      showError("Cannot access the current tab URL.");
      return;
    }

    const parsed = parseArxivUrl(tab.url);
    if (!parsed) {
      showError("This is not an ArXiv paper page.");
      return;
    }

    const baseId = parsed.id.replace(/v\d+$/, "");
    pdfUrl = `https://arxiv.org/pdf/${baseId}.pdf`;
    const paperDate = extractDateFromId(parsed.id);
    const extractedMetadata =
      parsed.type === "abs"
        ? await extractMetadataFromAbsPage(tab.id)
        : await fetchMetadataFromAbsPage(
            `https://arxiv.org/abs/${parsed.id}`
          );

    paperMetadata = {
      ...extractedMetadata,
      year: paperDate?.year || "",
      month: paperDate?.month || "",
      arxivId: parsed.id,
    };

    const saved = await chrome.storage.local.get([
      TEMPLATE_KEY,
      CUSTOM_TEMPLATE_KEY,
      LEGACY_PREF_KEY,
    ]);
    const storedTemplate =
      saved[TEMPLATE_KEY] ||
      templateFromLegacyPrefix(saved[LEGACY_PREF_KEY]);
    const preset = Object.entries(TEMPLATE_PRESETS).find(
      ([, value]) => value === storedTemplate
    );
    templateSelect.value = preset?.[0] || "custom";
    customTemplateInput.value =
      saved[CUSTOM_TEMPLATE_KEY] ||
      (preset ? DEFAULT_TEMPLATE : storedTemplate);
    customTemplateRow.classList.toggle(
      "hidden",
      templateSelect.value !== "custom"
    );

    showResult(paperMetadata.title);
    updatePreview();
  } catch (error) {
    showError(error.message || "An unexpected error occurred.");
  }
})();
