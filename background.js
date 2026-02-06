chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== "download") return;

  chrome.downloads.download(
    {
      url: message.url,
      filename: message.filename,
      saveAs: true,
      conflictAction: "uniquify",
    },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId });
      }
    }
  );

  // Keep the message channel open for the async response
  return true;
});
