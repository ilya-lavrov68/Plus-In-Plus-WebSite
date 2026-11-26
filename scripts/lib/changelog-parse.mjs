/**
 * Разбор CHANGELOG.md репозитория Line Launcher.
 *
 * Файл в репозитории — единственный источник фактов: здесь нет ни строки,
 * придуманной для сайта. Парсер переводит markdown в структуру, которую
 * страница `/line-launcher/changelog` умеет фильтровать и показывать.
 *
 * Формат релиза в файле:
 *
 *     ## 0.15.4 — 2026-11-17
 *
 *     Одна строка о смысле релиза.
 *
 *     ### Добавлено
 *
 *     - **Что-то.** Подробности в двух-трёх строках.
 */

/** Заголовки разделов, которые получают известный «вид» для фильтров. */
const SECTION_KINDS = new Map([
  ["добавлено", "added"],
  ["изменено", "changed"],
  ["исправлено", "fixed"],
  ["удалено", "removed"],
  ["безопасность", "security"],
]);

/** `## 0.15.4 — 2026-11-17` (допускаем дефис и короткое тире). */
const VERSION_HEADING = /^(\d+\.\d+\.\d+)\s*[—–-]\s*(\d{4}-\d{2}-\d{2})$/;

/**
 * @typedef {object} ChangelogSection
 * @property {"added"|"changed"|"fixed"|"removed"|"security"|"note"} kind
 * @property {string} title
 * @property {string[]} items
 * @property {string[]} paragraphs
 */

/**
 * @typedef {object} ChangelogEntry
 * @property {string} version
 * @property {string} date
 * @property {string[]} intro
 * @property {ChangelogSection[]} sections
 * @property {{tag: string|null, url: string|null, assets: Array<{name: string, url: string, size: number, downloads: number}>}} release
 */

/**
 * Свести строки одного абзаца в текст: markdown переносит строки по 72–80
 * символам, и такие переносы не должны становиться пробелами внутри слова.
 * @param {string[]} lines
 */
function joinParagraph(lines) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Разобрать тело релиза на вступление и разделы.
 * @param {string[]} lines
 */
function parseBody(lines) {
  /** @type {string[]} */
  const intro = [];
  /** @type {ChangelogSection[]} */
  const sections = [];

  let blockKind = "intro";
  /** @type {string[]} */
  let paragraph = [];
  /** @type {string[]} */
  let item = [];
  /** @type {ChangelogSection|null} */
  let section = null;

  const flushParagraph = () => {
    const text = joinParagraph(paragraph);
    paragraph = [];
    if (!text) return;
    if (blockKind === "intro") intro.push(text);
    else if (section) section.paragraphs.push(text);
  };

  const flushItem = () => {
    const text = joinParagraph(item);
    item = [];
    if (!text || !section) return;
    // Продолжение пункта, отделённое пустой строкой, склеиваем с ним:
    // иначе одна мысль выглядит двумя пунктами списка.
    const last = section.items.length - 1;
    if (last >= 0 && blockKind === "item-continued") {
      section.items[last] = `${section.items[last]} ${text}`;
    } else {
      section.items.push(text);
    }
  };

  const flushAll = () => {
    flushItem();
    flushParagraph();
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (line.startsWith("### ")) {
      flushAll();
      const title = line.slice(4).trim();
      const kind = SECTION_KINDS.get(title.toLowerCase()) ?? "note";
      section = { kind, title, items: [], paragraphs: [] };
      sections.push(section);
      blockKind = "section";
      continue;
    }

    if (!section) {
      // Вступление: абзацы до первого раздела.
      if (!line.trim()) flushParagraph();
      else paragraph.push(line);
      continue;
    }

    if (!line.trim()) {
      // Пустая строка закрывает элемент списка и абзац, но не сам раздел.
      if (blockKind === "item") {
        flushItem();
        blockKind = "item-spacer";
      } else if (blockKind === "item-continued") {
        // Пункт уже склеен; следующая строка списка начнётся с «- ».
        blockKind = "section";
      } else {
        flushParagraph();
        blockKind = "section";
      }
      continue;
    }

    if (/^-\s+/.test(line)) {
      flushItem();
      flushParagraph();
      item = [line.replace(/^-\s+/, "")];
      blockKind = "item";
      continue;
    }

    if (blockKind === "item") {
      item.push(line);
      continue;
    }

    if (blockKind === "item-spacer") {
      item = [line];
      blockKind = "item-continued";
      continue;
    }

    paragraph.push(line);
    blockKind = "paragraph";
  }

  flushAll();

  return { intro, sections: sections.filter((s) => s.items.length || s.paragraphs.length) };
}

/**
 * @param {string} markdown
 * @returns {{entries: ChangelogEntry[], skipped: string[]}}
 */
export function parseChangelog(markdown) {
  /** @type {ChangelogEntry[]} */
  const entries = [];
  /** @type {string[]} */
  const skipped = [];
  /** @type {string[]|null} */
  let body = null;
  /** @type {ChangelogEntry|null} */
  let entry = null;

  const finish = () => {
    if (!entry || !body) {
      body = null;
      entry = null;
      return;
    }
    const parsed = parseBody(body);
    entries.push({ ...entry, ...parsed });
    body = null;
    entry = null;
  };

  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      finish();
      const heading = line.slice(3).trim();
      const match = VERSION_HEADING.exec(heading);
      if (!match) {
        // «## Как выбирается номер» — методичка, а не релиз.
        skipped.push(heading);
        continue;
      }
      entry = {
        version: match[1],
        date: match[2],
        intro: [],
        sections: [],
        release: { tag: null, url: null, assets: [] },
      };
      body = [];
      continue;
    }
    if (body && entry) body.push(line);
  }
  finish();

  const seen = new Set();
  const unique = entries.filter((item) => {
    if (seen.has(item.version)) return false;
    seen.add(item.version);
    return true;
  });

  return { entries: unique, skipped };
}

/**
 * Сравнение версий по SemVer: свежие сверху.
 * @param {string} a
 * @param {string} b
 */
export function compareVersions(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return right[index] - left[index];
  }
  return 0;
}

/**
 * Дополнить записи данными GitHub: тег и, если релиз опубликован, ассеты.
 * @param {ChangelogEntry[]} entries
 * @param {{name: string}[]} tags
 * @param {Array<{tag_name: string, html_url: string, assets?: Array<{name: string, browser_download_url: string, size: number, download_count: number}>}>} releases
 */
export function applyGitHubData(entries, tags, releases) {
  const tagNames = new Set(tags.map((tag) => tag.name));
  const releasesByVersion = new Map(
    releases.map((release) => [release.tag_name.replace(/^v/, ""), release]),
  );

  return entries.map((entry) => {
    const release = releasesByVersion.get(entry.version);
    const tag = tagNames.has(`v${entry.version}`) ? `v${entry.version}` : null;
    return {
      ...entry,
      release: {
        tag,
        url: release?.html_url ?? null,
        assets: (release?.assets ?? []).map((asset) => ({
          name: asset.name,
          url: asset.browser_download_url,
          size: asset.size,
          downloads: asset.download_count,
        })),
      },
    };
  });
}
