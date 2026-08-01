import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveDirectoryFilename,
  saveResponseToDirectory,
  verifyDirectoryPermission,
} from "../lib/file-store.js";

function createDirectory(existingNames = []) {
  const files = new Map(existingNames.map((name) => [name, "existing"]));
  return {
    files,
    async getFileHandle(name, options = {}) {
      if (!files.has(name) && !options.create) {
        const error = new Error("Not found");
        error.name = "NotFoundError";
        throw error;
      }
      if (!files.has(name)) files.set(name, null);
      return {
        async createWritable() {
          return {
            async write(value) {
              files.set(name, value);
            },
            async close() {},
            async abort() {},
          };
        },
      };
    },
  };
}

test("reuses, requests, or rejects directory permissions", async () => {
  const granted = {
    async queryPermission() {
      return "granted";
    },
  };
  assert.equal(await verifyDirectoryPermission(granted), true);

  const prompt = {
    async queryPermission() {
      return "prompt";
    },
    async requestPermission() {
      return "granted";
    },
  };
  assert.equal(await verifyDirectoryPermission(prompt), false);
  assert.equal(
    await verifyDirectoryPermission(prompt, { request: true }),
    true
  );
});

test("creates a unique name or overwrites based on conflict action", async () => {
  const directory = createDirectory(["paper.pdf", "paper (1).pdf"]);
  assert.equal(
    await resolveDirectoryFilename(directory, "paper.pdf", "uniquify"),
    "paper (2).pdf"
  );
  assert.equal(
    await resolveDirectoryFilename(directory, "paper.pdf", "overwrite"),
    "paper.pdf"
  );
  await assert.rejects(
    resolveDirectoryFilename(directory, "paper.pdf", "prompt"),
    /already exists/
  );
});

test("writes a PDF response to the chosen directory", async () => {
  const directory = createDirectory(["paper.pdf"]);
  const filename = await saveResponseToDirectory(
    directory,
    "paper.pdf",
    {
      ok: true,
      async blob() {
        return "pdf-data";
      },
    },
    "uniquify"
  );

  assert.equal(filename, "paper (1).pdf");
  assert.equal(directory.files.get(filename), "pdf-data");
});
