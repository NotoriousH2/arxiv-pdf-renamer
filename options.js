import {
  SAVE_MODE_ASK,
  SAVE_MODE_FOLDER,
  SAVE_MODE_KEY,
  clearDirectoryHandle,
  getDirectoryHandle,
  setDirectoryHandle,
  verifyDirectoryPermission,
} from "./lib/file-store.js";

const saveMode = document.getElementById("save-mode");
const folderName = document.getElementById("folder-name");
const chooseFolder = document.getElementById("choose-folder");
const clearFolder = document.getElementById("clear-folder");
const status = document.getElementById("status");

async function refreshFolder() {
  const handle = await getDirectoryHandle();
  folderName.textContent = handle?.name || "No folder selected";
  clearFolder.disabled = !handle;
  return handle;
}

saveMode.addEventListener("change", async () => {
  await chrome.storage.local.set({ [SAVE_MODE_KEY]: saveMode.value });
  if (saveMode.value === SAVE_MODE_FOLDER && !(await refreshFolder())) {
    status.textContent = "Choose a folder to enable direct saving.";
  } else {
    status.textContent = "Save behavior updated.";
  }
});

chooseFolder.addEventListener("click", async () => {
  try {
    if (!window.showDirectoryPicker) {
      throw new Error("This Chrome version does not support folder access.");
    }
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    if (!(await verifyDirectoryPermission(handle, { request: true }))) {
      throw new Error("Write access to the folder was not granted.");
    }
    await setDirectoryHandle(handle);
    await chrome.storage.local.set({ [SAVE_MODE_KEY]: SAVE_MODE_FOLDER });
    saveMode.value = SAVE_MODE_FOLDER;
    await refreshFolder();
    status.textContent = `Papers will be saved to “${handle.name}”.`;
  } catch (error) {
    if (error.name !== "AbortError") status.textContent = error.message;
  }
});

clearFolder.addEventListener("click", async () => {
  await clearDirectoryHandle();
  await chrome.storage.local.set({ [SAVE_MODE_KEY]: SAVE_MODE_ASK });
  saveMode.value = SAVE_MODE_ASK;
  await refreshFolder();
  status.textContent = "Saved folder cleared.";
});

const saved = await chrome.storage.local.get(SAVE_MODE_KEY);
saveMode.value = saved[SAVE_MODE_KEY] || SAVE_MODE_ASK;
await refreshFolder();
