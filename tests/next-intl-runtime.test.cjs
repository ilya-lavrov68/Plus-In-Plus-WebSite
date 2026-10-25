const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { test } = require("node:test");

function runDevelopmentProbe() {
  const React = require("react");
  const { act, create } = require("react-test-renderer");
  const { NextIntlClientProvider, useTranslations } = require("next-intl");

  function SlugHelpProbe() {
    const t = useTranslations("admin.form");
    return React.createElement(
      React.Fragment,
      null,
      React.createElement("span", { id: "post" }, t("postSlugHelp")),
      React.createElement("span", { id: "service" }, t("slugHelp"))
    );
  }

  const errors = [];
  const rendered = [];

  for (const locale of ["en", "ru"]) {
    const messages = require(path.join(__dirname, "..", "messages", `${locale}.json`));
    let renderer;

    act(() => {
      renderer = create(
        React.createElement(
          NextIntlClientProvider,
          {
            locale,
            messages,
            timeZone: "UTC",
            onError: (error) => errors.push(`${locale}: ${error.message}`),
          },
          React.createElement(SlugHelpProbe)
        )
      );
    });

    rendered.push({
      locale,
      post: renderer.root.findByProps({ id: "post" }).children.join(""),
      service: renderer.root.findByProps({ id: "service" }).children.join(""),
    });
    act(() => renderer.unmount());
  }

  process.stdout.write(JSON.stringify({ errors, rendered }));
}

if (process.argv.includes("--development-probe")) {
  runDevelopmentProbe();
} else {
  test("next-intl development runtime renders blog and service slug help", () => {
    // Next.js enables next-intl's validating development export in dev mode.
    // Reproduce that public entrypoint instead of testing only the stub or the
    // production formatter, which can hide message-syntax errors.
    const result = spawnSync(
      process.execPath,
      ["--conditions=development", __filename, "--development-probe"],
      { encoding: "utf8" }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout || String(result.error));
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.errors, []);

    for (const { locale, post, service } of report.rendered) {
      assert.ok(post.endsWith("/blog/[slug]"), `${locale} blog slug help did not render`);
      assert.ok(service.includes("/shop/[slug]"), `${locale} service slug help did not render`);
    }
  });
}
