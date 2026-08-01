import {
  fetchPaperMetadata,
  getPdfUrl,
  parseArxivUrl,
} from "./lib/arxiv.js";
import {
  DEFAULT_TEMPLATE,
  buildFilename,
  templateFromLegacyPrefix,
} from "./lib/filename.js";

const PAGE_MENU_ID = "download-arxiv-page";
const LINK_MENU_ID = "download-arxiv-link";
const TEMPLATE_KEY = "arxiv_renamer_template";
const LEGACY_PREF_KEY = "arxiv_renamer_prefix";

async function getStoredTemplate() {
  const saved = await chrome.storage.local.get([
    TEMPLATE_KEY,
    LEGACY_PREF_KEY,
  ]);
  return (
    saved[TEMPLATE_KEY] ||
    templateFromLegacyPrefix(saved[LEGACY_PREF_KEY]) ||
    DEFAULT_TEMPLATE
  );
}

async function startDownload(url, filename) {
  return chrome.downloads.download({
    url,
    filename,
    saveAs: true,
    conflictAction: "uniquify",
  });
}

async function downloadArxivUrl(url) {
  const parsed = parseArxivUrl(url);
  if (!parsed) throw new Error("This is not a supported ArXiv paper URL.");

  const metadata = await fetchPaperMetadata(parsed.id);
  const template = await getStoredTemplate();
  return startDownload(getPdfUrl(parsed.id), buildFilename(metadata, template));
}

async function showActionStatus(text, color, title) {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  await chrome.action.setTitle({ title });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setTitle({ title: "ArXiv PDF Renamer" });
  }, 3000);
}

async function runQuickDownload(url) {
  try {
    await downloadArxivUrl(url);
    await showActionStatus("OK", "#188038", "Download started");
  } catch (error) {
    await showActionStatus("!", "#b31b1b", error.message || "Download failed");
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: PAGE_MENU_ID,
      title: "Download this ArXiv paper",
      contexts: ["page"],
      documentUrlPatterns: [
        "https://arxiv.org/abs/*",
        "https://arxiv.org/pdf/*",
      ],
    });
    chrome.contextMenus.create({
      id: LINK_MENU_ID,
      title: "Download linked ArXiv paper",
      contexts: ["link"],
      targetUrlPatterns: [
        "https://arxiv.org/abs/*",
        "https://arxiv.org/pdf/*",
      ],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === PAGE_MENU_ID) {
    runQuickDownload(tab?.url || "");
  } else if (info.menuItemId === LINK_MENU_ID) {
    runQuickDownload(info.linkUrl || "");
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "download-paper") {
    runQuickDownload(tab?.url || "");
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== "download") return false;

  startDownload(message.url, message.filename)
    .then((downloadId) => sendResponse({ success: true, downloadId }))
    .catch((error) =>
      sendResponse({ success: false, error: error.message || "Download failed" })
    );
  return true;
});
