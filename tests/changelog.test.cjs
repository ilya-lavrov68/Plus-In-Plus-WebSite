const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { act, create } = require("react-test-renderer");

// Клиентские компоненты написаны на TSX — транспилируем их тем же способом,
// что и остальные component-тесты.
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) =>
    module._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      filename,
    );
}

const rootDir = path.join(__dirname, "..");
const dataPath = path.join(rootDir, "content", "line-launcher-changelog.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

/** Текст всех узлов дерева — для проверок содержимого без разметки. */
function textOf(node) {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return textOf(node.children);
}

test("файл данных описывает только релизы из репозитория", () => {
  assert.ok(data.entries.length > 0, "история версий не должна быть пустой");
  assert.equal(data.repository, "ilya-lavrov68/Line-Launcher");
  assert.match(data.changelogUrl, /^https:\/\/github\.com\/ilya-lavrov68\/Line-Launcher\/blob\//);
  assert.match(data.changelogSha, /^[0-9a-f]{40}$/, "нужен commit sha файла CHANGELOG.md на момент синхронизации");

  const versions = data.entries.map((entry) => entry.version);
  assert.equal(new Set(versions).size, versions.length, "версии не должны дублироваться");
  assert.deepEqual(
    versions,
    [...versions].sort((a, b) => {
      const left = a.split(".").map(Number);
      const right = b.split(".").map(Number);
      for (let index = 0; index < 3; index += 1) {
        if (left[index] !== right[index]) return right[index] - left[index];
      }
      return 0;
    }),
    "релизы идут от свежего к старому",
  );
  assert.equal(data.latestVersion, versions[0]);

  for (const entry of data.entries) {
    assert.match(entry.version, /^\d+\.\d+\.\d+$/, `версия ${entry.version} не в формате SemVer`);
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/, `у версии ${entry.version} нет даты релиза`);
    assert.ok(
      entry.intro.length + entry.sections.length > 0,
      `у версии ${entry.version} нет ни описания, ни разделов`,
    );
    for (const section of entry.sections) {
      assert.ok(
        ["added", "changed", "fixed", "removed", "security", "note"].includes(section.kind),
        `неизвестный тип раздела: ${section.kind}`,
      );
      assert.ok(
        section.items.length + section.paragraphs.length > 0,
        `пустой раздел «${section.title}» в версии ${entry.version}`,
      );
    }
  }
});

test("последняя версия в данных совпадает с версией на страницах сайта", () => {
  const latest = data.latestVersion;
  const checks = [
    ["messages/ru.json", /"status": "В разработке · (\d+\.\d+\.\d+)"/],
    ["messages/en.json", /"status": "In development · (\d+\.\d+\.\d+)"/],
    ["lib/work-cases.ts", /value: "(\d+\.\d+\.\d+), в разработке"/],
  ];

  for (const [file, pattern] of checks) {
    const source = fs.readFileSync(path.join(rootDir, file), "utf8");
    const match = pattern.exec(source);
    assert.ok(match, `${file}: не нашёл версию рядом со статусом продукта`);
    assert.equal(
      match[1],
      latest,
      `${file}: версия ${match[1]} отстала от последнего релиза ${latest} — обновите статус`,
    );
  }
});

test("парсер CHANGELOG понимает заголовки версий, списки и пояснения", async () => {
  const { parseChangelog, applyGitHubData, compareVersions } = await import(
    "../scripts/lib/changelog-parse.mjs"
  );

  const markdown = [
    "# История версий",
    "",
    "## Как выбирается номер",
    "",
    "SemVer.",
    "",
    "## 0.2.0 — 2026-02-02",
    "",
    "Второй релиз: новая навигация.",
    "",
    "### Добавлено",
    "",
    "- **Новая навигация.** Пункты переехали влево,",
    "  чтобы освободить место под контент.",
    "- Ссылка на [документацию](docs/GUIDE.md).",
    "",
    "### Исправлено",
    "",
    "- Кнопка больше не прыгает.",
    "",
    "## 0.1.0 — 2026-01-01",
    "",
    "Первый релиз.",
    "",
    "### Зачем",
    "",
    "Нужен был номер, совпадающий с содержимым.",
    "",
  ].join("\n");

  const { entries, skipped } = parseChangelog(markdown);
  assert.deepEqual(skipped, ["Как выбирается номер"]);
  assert.deepEqual(entries.map((entry) => entry.version), ["0.2.0", "0.1.0"]);

  const [first, second] = entries;
  assert.deepEqual(first.intro, ["Второй релиз: новая навигация."]);
  assert.equal(first.sections[0].kind, "added");
  assert.deepEqual(first.sections[0].items, [
    "**Новая навигация.** Пункты переехали влево, чтобы освободить место под контент.",
    "Ссылка на [документацию](docs/GUIDE.md).",
  ]);
  assert.equal(first.sections[1].kind, "fixed");
  assert.equal(second.sections[0].kind, "note", "незнакомый заголовок остаётся пояснением с исходным названием");
  assert.equal(second.sections[0].title, "Зачем");
  assert.deepEqual(second.sections[0].paragraphs, ["Нужен был номер, совпадающий с содержимым."]);

  assert.deepEqual(
    ["0.10.0", "0.9.0", "0.10.1"].sort(compareVersions),
    ["0.10.1", "0.10.0", "0.9.0"],
    "версии сравниваются как числа, а не как строки",
  );

  const [withRelease] = applyGitHubData(
    entries,
    [{ name: "v0.2.0" }],
    [
      {
        tag_name: "v0.2.0",
        html_url: "https://github.com/ilya-lavrov68/Line-Launcher/releases/tag/v0.2.0",
        assets: [
          {
            name: "LineLauncher_0.2.0_x64.msi",
            browser_download_url: "https://example.test/app.msi",
            size: 2048,
            download_count: 3,
          },
        ],
      },
    ],
  );
  assert.equal(withRelease.release.tag, "v0.2.0");
  assert.equal(withRelease.release.assets[0].name, "LineLauncher_0.2.0_x64.msi");
});

test("страница истории версий доступна и связана с продуктом", () => {
  const route = path.join(rootDir, "app", "(site)", "line-launcher", "changelog", "page.tsx");
  assert.ok(fs.existsSync(route), "нет маршрута /line-launcher/changelog");
  const routeSource = fs.readFileSync(route, "utf8");
  assert.match(routeSource, /createPageMetadata/);
  assert.match(routeSource, /lineLauncherChangelog/);

  const product = fs.readFileSync(path.join(rootDir, "components/site/line-launcher-view.tsx"), "utf8");
  assert.match(product, /href="\/line-launcher\/changelog"/, "со страницы продукта нет ссылки на историю версий");

  const footer = fs.readFileSync(path.join(rootDir, "components/blocks/footer7.tsx"), "utf8");
  assert.match(footer, /"\/line-launcher\/changelog"/, "в подвале нет ссылки на историю версий");
  assert.match(
    footer,
    /"changelog": "Release history"/,
    "у ссылки подвала должен быть текст по умолчанию, а не технический ключ",
  );
  const footerLabels = fs.readFileSync(path.join(rootDir, "components/site/footer.tsx"), "utf8");
  assert.match(footerLabels, /"changelog"/, "подвал не берёт метку истории версий из словаря");

  const sitemap = fs.readFileSync(path.join(rootDir, "app", "(site)", "sitemap.ts"), "utf8");
  assert.match(sitemap, /"\/line-launcher\/changelog"/, "маршрут не попал в sitemap");
});

test("ChangelogExplorer фильтрует релизы по запросу и типу правки", async () => {
  const originalLoad = Module._load;
  Module._load = function (name, parent, isMain) {
    if (name === "next-intl") return require("./next-intl-stub.cjs");
    if (name === "next/link") {
      return ({ children, ...props }) => React.createElement("a", props, children);
    }
    if (name === "lucide-react") {
      return new Proxy({}, { get: () => () => null });
    }
    if (name.startsWith("@/")) {
      // Алиас из tsconfig.json: в тестах Next его не подставляет.
      const base = path.join(rootDir, name.slice(2));
      for (const candidate of [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return originalLoad.call(this, candidate, parent, isMain);
        }
      }
      throw new Error(`Не удалось разрешить алиас ${name}`);
    }
    return originalLoad.call(this, name, parent, isMain);
  };

  try {
    const { ChangelogExplorer } = require("../components/site/changelog-explorer.tsx");
    const entries = [
      {
        version: "0.2.0",
        date: "2026-02-02",
        intro: ["Новая навигация."],
        sections: [
          {
            kind: "added",
            title: "Добавлено",
            items: ["**Раздел логов.** Пишет `launcher_logs`."],
            paragraphs: [],
          },
          {
            kind: "fixed",
            title: "Исправлено",
            items: ["Кнопка больше не прыгает."],
            paragraphs: [],
          },
        ],
        release: { tag: "v0.2.0", url: null, assets: [] },
      },
      {
        version: "0.1.0",
        date: "2026-01-01",
        intro: ["Первый релиз."],
        sections: [
          { kind: "added", title: "Добавлено", items: ["Первый экран."], paragraphs: [] },
        ],
        release: { tag: null, url: null, assets: [] },
      },
    ];

    let view;
    act(() => {
      view = create(
        React.createElement(ChangelogExplorer, {
          entries,
          repositoryUrl: "https://github.com/ilya-lavrov68/Line-Launcher",
          branch: "main",
          changelogUrl: "https://github.com/ilya-lavrov68/Line-Launcher/blob/main/CHANGELOG.md",
          pagePath: "/line-launcher/changelog",
          latestVersion: "0.2.0",
          showRussianNotice: false,
        }),
      );
    });

    const fullText = textOf(view.root);
    assert.match(fullText, /0\.2\.0/);
    assert.match(fullText, /0\.1\.0/);
    assert.match(fullText, /Added/, "заголовок раздела берётся из словаря");
    assert.match(fullText, /Latest/, "у свежего релиза есть метка");
    assert.match(fullText, /Кнопка больше не прыгает/);

    // Жирный акцент и код разбираются в разметку, а не остаются звёздочками.
    const strong = view.root.findAllByType("strong").map(textOf);
    assert.deepEqual(strong, ["Раздел логов."]);
    assert.equal(view.root.findAllByType("code").map(textOf).join(""), "launcher_logs");

    // Фильтр «Исправлено» оставляет только исправления.
    const fixedChip = view.root
      .findAllByType("button")
      .find((button) => textOf(button).startsWith("Fixed"));
    assert.ok(fixedChip, "нет фильтра «Fixed»");
    act(() => fixedChip.props.onClick());
    const filteredText = textOf(view.root);
    assert.match(filteredText, /Кнопка больше не прыгает/);
    assert.doesNotMatch(filteredText, /Первый экран/);
    assert.doesNotMatch(filteredText, /0\.1\.0/, "версия без исправлений скрывается");

    // Поиск сужает пункты внутри релиза.
    const search = view.root.findByType("input");
    act(() => search.props.onChange({ target: { value: "навигац" } }));
    const searched = textOf(view.root);
    assert.match(
      searched,
      /Nothing matched/,
      "под фильтром «Fixed» запрос про навигацию ничего не находит",
    );

    // Сброс к «Все» возвращает релиз: поиск идёт по вступлению и пунктам.
    const resetButton = view.root
      .findAllByType("button")
      .find((button) => textOf(button) === "Reset filters");
    assert.ok(resetButton, "в пустом состоянии есть кнопка сброса");
    act(() => resetButton.props.onClick());
    const resetText = textOf(view.root);
    assert.match(resetText, /0\.2\.0/);
    assert.match(resetText, /0\.1\.0/, "сброс возвращает все релизы");

    // Поиск без фильтра оставляет только релиз, где встречается слово.
    act(() => view.root.findByType("input").props.onChange({ target: { value: "навигац" } }));
    const navigationOnly = textOf(view.root);
    assert.match(navigationOnly, /Новая навигация/);
    assert.doesNotMatch(navigationOnly, /Первый экран/);

    act(() => view.root.findByType("input").props.onChange({ target: { value: "экран" } }));
    const firstOnly = textOf(view.root);
    assert.match(firstOnly, /Первый экран/);
    assert.doesNotMatch(firstOnly, /Новая навигация/);

    act(() => view.unmount());
  } finally {
    Module._load = originalLoad;
  }
});
