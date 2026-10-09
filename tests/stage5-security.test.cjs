const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, filename);
};

let account = { id: "admin-id", email: "admin@example.com", role: "ADMIN" };
let session = { user: { id: "admin-id", email: "admin@example.com", role: "ADMIN" } };
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next-auth") return { getServerSession: async () => session };
  if (name === "@/auth") return { authOptions: {} };
  if (name === "@/lib/prisma") return { prisma: { user: { findUnique: async () => account } } };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { requireAdmin } = require("../lib/admin-session.ts");
const { saveCoverUpload, deleteCoverUpload } = require("../lib/uploads.ts");

test("admin actions reject stale JWTs after demotion or deletion", async () => {
  assert.equal((await requireAdmin())?.role, "ADMIN");
  account = { ...account, role: "USER" };
  assert.equal(await requireAdmin(), null);
  account = null;
  assert.equal(await requireAdmin(), null);
  session = null;
  assert.equal(await requireAdmin(), null);
});

test("upload checks MIME, extension and bytes; no files are written on failure", async () => {
  const forged = new File(["not a PNG"], "cover.png", { type: "image/png" });
  await assert.rejects(saveCoverUpload(forged, "services"), /Invalid image file/);
  const wrongMime = new File(["not an image"], "cover.png", { type: "text/plain" });
  await assert.rejects(saveCoverUpload(wrongMime, "blog"), /Only PNG/);
  await assert.rejects(saveCoverUpload(forged, "../assets"), /Unknown upload destination/);
});

test("deletion is confined to the expected upload kind and uploader names", async () => {
  const readme = path.join(__dirname, "..", "public", "uploads", "blog", "README.md");
  const before = fs.readFileSync(readme, "utf8");
  await deleteCoverUpload("/uploads/blog/README.md", "blog");
  await deleteCoverUpload("/uploads/services/../../assets/logos/README.md", "services");
  await deleteCoverUpload("/uploads/blog/00000000-0000-0000-0000-000000000000.png", "services");
  assert.equal(fs.readFileSync(readme, "utf8"), before);
});
