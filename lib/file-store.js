export const SAVE_MODE_KEY = "arxiv_renamer_save_mode";
export const SAVE_MODE_ASK = "ask";
export const SAVE_MODE_FOLDER = "folder";

const DATABASE_NAME = "arxiv-pdf-renamer";
const STORE_NAME = "handles";
const DIRECTORY_HANDLE_KEY = "download-directory";

function openDatabase(indexedDb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!indexedDb) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = indexedDb.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runStoreRequest(mode, operation, indexedDb) {
  const database = await openDatabase(indexedDb);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export function getDirectoryHandle(indexedDb) {
  return runStoreRequest(
    "readonly",
    (store) => store.get(DIRECTORY_HANDLE_KEY),
    indexedDb
  );
}

export function setDirectoryHandle(handle, indexedDb) {
  return runStoreRequest(
    "readwrite",
    (store) => store.put(handle, DIRECTORY_HANDLE_KEY),
    indexedDb
  );
}

export function clearDirectoryHandle(indexedDb) {
  return runStoreRequest(
    "readwrite",
    (store) => store.delete(DIRECTORY_HANDLE_KEY),
    indexedDb
  );
}

export async function verifyDirectoryPermission(
  handle,
  { request = false } = {}
) {
  if (!handle) return false;
  const options = { mode: "readwrite" };
  if ((await handle.queryPermission(options)) === "granted") return true;
  if (!request) return false;
  return (await handle.requestPermission(options)) === "granted";
}

async function fileExists(directoryHandle, filename) {
  try {
    await directoryHandle.getFileHandle(filename);
    return true;
  } catch (error) {
    if (error.name === "NotFoundError") return false;
    throw error;
  }
}

function splitFilename(filename) {
  const extensionIndex = filename.lastIndexOf(".");
  if (extensionIndex <= 0) return { basename: filename, extension: "" };
  return {
    basename: filename.slice(0, extensionIndex),
    extension: filename.slice(extensionIndex),
  };
}

export async function resolveDirectoryFilename(
  directoryHandle,
  filename,
  conflictAction = "uniquify"
) {
  if (!(await fileExists(directoryHandle, filename))) return filename;
  if (conflictAction === "overwrite") return filename;
  if (conflictAction === "prompt") {
    throw new Error(
      "The file already exists. Choose Keep both or Overwrite in settings."
    );
  }

  const { basename, extension } = splitFilename(filename);
  for (let counter = 1; counter <= 999; counter += 1) {
    const candidate = `${basename} (${counter})${extension}`;
    if (!(await fileExists(directoryHandle, candidate))) return candidate;
  }
  throw new Error("Could not find an available filename.");
}

export async function saveResponseToDirectory(
  directoryHandle,
  filename,
  response,
  conflictAction = "uniquify"
) {
  if (!response.ok) {
    throw new Error(`PDF download failed (HTTP ${response.status}).`);
  }

  const resolvedFilename = await resolveDirectoryFilename(
    directoryHandle,
    filename,
    conflictAction
  );
  const fileHandle = await directoryHandle.getFileHandle(resolvedFilename, {
    create: true,
  });
  const writable = await fileHandle.createWritable();

  try {
    if (response.body?.pipeTo) {
      await response.body.pipeTo(writable);
    } else {
      await writable.write(await response.blob());
      await writable.close();
    }
  } catch (error) {
    await writable.abort?.();
    throw error;
  }

  return resolvedFilename;
}
