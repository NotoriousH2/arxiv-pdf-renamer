import {
  getPdfUrl,
  parseArxivUrl,
} from "./lib/arxiv.js";
import { getPaperMetadata } from "./lib/metadata-cache.js";
import {
  DEFAULT_TEMPLATE,
  buildFilename,
  templateFromLegacyPrefix,
} from "./lib/filename.js";
import { MAX_BATCH_SIZE } from "./lib/batch.js";
import {
  CONFLICT_ACTION_KEY,
  DOWNLOAD_HISTORY_KEY,
  VERSION_MODE_KEY,
  addHistoryRecord,
  resolveDownloadId,
  updateHistoryRecord,
} from "./lib/history.js";

const PAGE_MENU_ID = "download-arxiv-page";
const LINK_MENU_ID = "download-arxiv-link";
const TEMPLATE_KEY = "arxiv_renamer_template";
const LEGACY_PREF_KEY = "arxiv_renamer_prefix";

async function getStoredPreferences() {
  const saved = await chrome.storage.local.get([
    TEMPLATE_KEY,
    LEGACY_PREF_KEY,
    VERSION_MODE_KEY,
    CONFLICT_ACTION_KEY,
  ]);
  return {
    template:
      saved[TEMPLATE_KEY] ||
      templateFromLegacyPrefix(saved[LEGACY_PREF_KEY]) ||
      DEFAULT_TEMPLATE,
    versionMode: saved[VERSION_MODE_KEY] || "latest",
    conflictAction: saved[CONFLICT_ACTION_KEY] || "uniquify",
  };
}

let historyWriteQueue = Promise.resolve();

function mutateHistory(mutator) {
  historyWriteQueue = historyWriteQueue.catch(() => {}).then(async () => {
    const saved = await chrome.storage.local.get(DOWNLOAD_HISTORY_KEY);
    const history = mutator(saved[DOWNLOAD_HISTORY_KEY] || []);
    await chrome.storage.local.set({ [DOWNLOAD_HISTORY_KEY]: history });
    return history;
  });
  return historyWriteQueue;
}

async function startDownload(
  url,
  filename,
  {
    saveAs = true,
    conflictAction = "uniquify",
    historyContext = null,
  } = {}
) {
  const downloadId = await chrome.downloads.download({
    url,
    filename,
    saveAs,
    conflictAction,
  });

  if (historyContext) {
    await mutateHistory((history) =>
      addHistoryRecord(history, {
        downloadId,
        filename,
        startedAt: Date.now(),
        state: "in_progress",
        ...historyContext,
      })
    ).catch(() => {});
  }
  return downloadId;
}

async function downloadArxivUrl(url, options = {}) {
  const parsed = parseArxivUrl(url);
  if (!parsed) throw new Error("This is not a supported ArXiv paper URL.");

  const metadata = await getPaperMetadata(parsed.id);
  const preferences = await getStoredPreferences();
  const arxivId = resolveDownloadId(parsed.id, preferences.versionMode);
  return startDownload(
    getPdfUrl(parsed.id, preferences.versionMode),
    buildFilename({ ...metadata, arxivId }, preferences.template),
    {
      ...options,
      conflictAction: preferences.conflictAction,
      historyContext: {
        arxivId,
        requestedId: parsed.id,
        versionMode: preferences.versionMode,
      },
    }
  );
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function downloadBatch(items) {
  const queue = items.slice(0, MAX_BATCH_SIZE);
  const failures = [];
  let completed = 0;

  for (const [index, item] of queue.entries()) {
    await chrome.runtime
      .sendMessage({
        action: "batchProgress",
        current: index + 1,
        total: queue.length,
        id: item.id,
      })
      .catch(() => {});

    try {
      await downloadArxivUrl(item.url, { saveAs: false });
      completed += 1;
    } catch (error) {
      failures.push({
        id: item.id,
        error: error.message || "Download failed",
      });
    }

    if (index < queue.length - 1) await delay(500);
  }

  return { success: true, completed, failures };
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

chrome.downloads.onChanged.addListener((delta) => {
  const state = delta.state?.current;
  if (state !== "complete" && state !== "interrupted") return;

  mutateHistory((history) =>
    updateHistoryRecord(history, delta.id, {
      state,
      completedAt: Date.now(),
      error: delta.error?.current || null,
    })
  ).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "download") {
    startDownload(message.url, message.filename, {
      conflictAction: message.conflictAction || "uniquify",
      historyContext: message.arxivId
        ? {
            arxivId: message.arxivId,
            requestedId: message.requestedId || message.arxivId,
            versionMode: message.versionMode || "latest",
          }
        : null,
    })
      .then((downloadId) => sendResponse({ success: true, downloadId }))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error.message || "Download failed",
        })
      );
    return true;
  }

  if (message.action === "downloadBatch") {
    downloadBatch(message.items || [])
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          success: false,
          error: error.message || "Batch download failed",
        })
      );
    return true;
  }

  return false;
});
