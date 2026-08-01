export const DOWNLOAD_HISTORY_KEY = "arxiv_renamer_download_history";
export const VERSION_MODE_KEY = "arxiv_renamer_version_mode";
export const CONFLICT_ACTION_KEY = "arxiv_renamer_conflict_action";
export const MAX_HISTORY_ENTRIES = 200;

export function splitArxivId(arxivId) {
  const match = String(arxivId).match(/^(.*?)(?:v(\d+))?$/);
  return {
    baseId: match?.[1] || arxivId,
    version: match?.[2] ? Number(match[2]) : null,
  };
}

export function resolveDownloadId(arxivId, versionMode = "latest") {
  const { baseId, version } = splitArxivId(arxivId);
  if (versionMode === "current" && version !== null) return `${baseId}v${version}`;
  return baseId;
}

export function addHistoryRecord(history, record) {
  return [
    record,
    ...history.filter((item) => item.downloadId !== record.downloadId),
  ].slice(0, MAX_HISTORY_ENTRIES);
}

export function updateHistoryRecord(history, downloadId, changes) {
  return history.map((record) =>
    record.downloadId === downloadId ? { ...record, ...changes } : record
  );
}

export function findLatestHistory(history, arxivId) {
  const { baseId } = splitArxivId(arxivId);
  return (
    history
      .filter((record) => splitArxivId(record.arxivId).baseId === baseId)
      .sort((left, right) => right.startedAt - left.startedAt)[0] || null
  );
}
