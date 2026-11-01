// Checks a running deployment (local or hosted) from the outside.
//
//   npm run deploy:verify -- http://localhost:3000
//   npm run deploy:verify -- https://plus-in-plus.example
//
// It verifies what a user actually gets: the health endpoint reports a reachable
// database with every table, and the public pages answer 200. No credentials are
// needed and nothing is written.
const PUBLIC_PATHS = ["/", "/shop", "/blog", "/sitemap.xml"];

function normalizeBaseUrl(value) {
  const raw = (value || "").trim() || "http://127.0.0.1:3000";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.argv[2]);
  console.log(`[verify] Target: ${baseUrl}`);
  let failures = 0;

  try {
    const response = await fetch(`${baseUrl}/api/health`, { redirect: "follow" });
    const body = await response.text();
    console.log(`[verify] /api/health → ${response.status} ${body}`);
    if (!response.ok) {
      failures += 1;
      console.error(
        "[verify] The deployment is not healthy. Run `npm run payload:migrate` with the production\n" +
          "[verify] PAYLOAD_DATABASE_URL / PAYLOAD_DATABASE_AUTH_TOKEN, then check /api/health again.",
      );
    }
  } catch (error) {
    failures += 1;
    console.error(`[verify] /api/health is unreachable: ${error.message}`);
  }

  for (const path of PUBLIC_PATHS) {
    try {
      const response = await fetch(`${baseUrl}${path}`, { redirect: "follow" });
      console.log(`[verify] ${path.padEnd(12)} → ${response.status}`);
      if (!response.ok) failures += 1;
    } catch (error) {
      failures += 1;
      console.error(`[verify] ${path} is unreachable: ${error.message}`);
    }
  }

  if (failures > 0) {
    console.error(`[verify] ${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("[verify] All checks passed.");
}

main().catch((error) => {
  console.error(`[verify] Failed: ${error.message}`);
  process.exit(1);
});
