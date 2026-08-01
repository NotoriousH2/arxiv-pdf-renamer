import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(new URL("../manifest.json", import.meta.url), "utf8")
);

test("declares the Manifest V3 service worker and required entry points", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.background, {
    service_worker: "background.js",
    type: "module",
  });
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.equal(manifest.options_page, "options.html");
});

test("declares quick-download capabilities and scoped hosts", () => {
  assert.ok(manifest.permissions.includes("contextMenus"));
  assert.ok(manifest.permissions.includes("downloads"));
  assert.equal(
    manifest.commands["download-paper"].suggested_key.default,
    "Alt+Shift+D"
  );
  assert.deepEqual(manifest.host_permissions, [
    "https://arxiv.org/*",
    "https://export.arxiv.org/*",
  ]);
});
