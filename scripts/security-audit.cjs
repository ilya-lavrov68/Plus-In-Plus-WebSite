#!/usr/bin/env node
/**
 * High-confidence repository policy checks, not a replacement for a full SAST
 * or an external penetration test. Findings never print the matched secret/value.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const findings = [];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".cjs", ".mjs", ".json", ".prisma", ".yml", ".yaml"]);
const files = [];

function walk(relativeDirectory) {
  const absolute = path.join(root, relativeDirectory);
  if (!fs.existsSync(absolute)) return;
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.posix.join(relativeDirectory, entry.name);
    if (relative.startsWith("lib/generated/")) continue;
    if (entry.isDirectory()) walk(relative);
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(relative);
  }
}

for (const directory of ["app", "components", "lib", "scripts", "prisma", "tests", ".github"]) walk(directory);
for (const filename of ["auth.ts", "auth.config.ts", "proxy.ts", "next.config.mjs"]) {
  if (fs.existsSync(path.join(root, filename))) files.push(filename);
}

function report(file, line, rule) {
  findings.push({ file, line, rule });
}

let scannedFiles = 0;
for (const file of files) {
  if (file === "scripts/security-audit.cjs") continue;
  scannedFiles += 1;
  const content = fs.readFileSync(path.join(root, file), "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((text, index) => {
    const line = index + 1;
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) report(file, line, "private-key-material");
    if (/\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,}|xox[baprs]-[A-Za-z0-9-]{20,})\b/.test(text)) {
      report(file, line, "high-confidence-token-pattern");
    }
    if (!file.startsWith("tests/") && !file.startsWith(".github/") && /(?:AUTH_SECRET|NEXTAUTH_SECRET|TURSO_AUTH_TOKEN|UPSTASH_REDIS_REST_TOKEN|ROBOKASSA_PASSWORD[12]|API_SECRET|CLIENT_SECRET)\s*[:=]\s*["'][^"']{8,}["']/.test(text)) {
      report(file, line, "hardcoded-secret-assignment");
    }
    if (!file.startsWith("tests/") && /Access-Control-Allow-Origin[^\n]*\*/.test(text)) report(file, line, "wildcard-cors");
    if ((file.startsWith("app/") || file.startsWith("components/") || file.startsWith("lib/")) && /(?:\beval\s*\(|\bnew\s+Function\s*\()/.test(text)) {
      report(file, line, "dynamic-code-execution");
    }
    if ((file.startsWith("app/") || file.startsWith("components/") || file.startsWith("lib/")) && /(?:node:)?child_process/.test(text)) {
      report(file, line, "runtime-child-process");
    }
    if (!file.startsWith("tests/") && text.includes("$queryRawUnsafe") && file !== "lib/admin-analytics.ts") report(file, line, "unreviewed-raw-sql");
    if (!file.startsWith("tests/") && text.includes("dangerouslySetInnerHTML") && file !== "components/blocks/blogpost11.tsx") report(file, line, "unreviewed-html-sink");
  });
}

const analytics = fs.readFileSync(path.join(root, "lib/admin-analytics.ts"), "utf8");
if (!analytics.includes("prisma.$queryRawUnsafe(sql, ...args)")) {
  report("lib/admin-analytics.ts", 1, "raw-sql-must-use-bound-parameters");
}
const postContent = fs.readFileSync(path.join(root, "lib/post-content.ts"), "utf8");
if (!postContent.includes("sanitizePostContent") || !postContent.includes("renderPostContent")) {
  report("lib/post-content.ts", 1, "html-sink-requires-central-sanitizer");
}

const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
for (const file of tracked) {
  const basename = path.posix.basename(file);
  if ((basename === ".env" || (basename.startsWith(".env.") && basename !== ".env.example")) && !file.endsWith(".env.example")) {
    report(file, 1, "tracked-environment-file");
  }
}

if (findings.length) {
  console.error("Repository security policy audit failed:");
  for (const finding of findings) console.error(`- ${finding.file}:${finding.line} [${finding.rule}]`);
  process.exitCode = 1;
} else {
  console.log(`Repository security policy audit passed: ${scannedFiles} source files, no high-confidence findings.`);
  console.log("This is a focused policy check, not a full SAST, secret-scanning guarantee or penetration test.");
}
