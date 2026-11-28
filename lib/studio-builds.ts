/**
 * Сборки продукта: разбор файлов релиза и архивов кода.
 *
 * Модуль без импортов, чтобы его можно было проверять тестами напрямую.
 *
 * У продукта три вида загрузки, и это разные вещи:
 *
 * - `source` — архив с кодом. GitHub отдаёт его сам для любого тега или ветки,
 *   поэтому он есть всегда, ещё до первого релиза;
 * - `file` — один файл (например `.jar` плагина или мода);
 * - `installer` — установщик под платформу (`.msi`/`.exe` для Windows,
 *   `.AppImage`/`.deb` для Linux, `.dmg` для macOS).
 *
 * Одна ссылка это не описывает: файлов несколько, и посетителю нужно видеть,
 * что именно он скачивает.
 */

export type StudioDownloadKind = "source" | "file" | "installer";

export interface StudioBuild {
  kind: StudioDownloadKind;
  /** Пусто у архива кода и одиночного файла: платформа у них не одна. */
  platform: string;
  format: string;
  url: string;
}

interface ReleaseAssetLike {
  name: string;
  browser_download_url: string;
}

interface ReleaseLike {
  tag_name?: string;
  assets?: ReleaseAssetLike[];
}

interface Rule {
  test: RegExp;
  kind: StudioDownloadKind;
  platform: string;
  format: string;
}

const RULES: Rule[] = [
  { test: /\.msi$/, kind: "installer", platform: "Windows", format: ".msi" },
  { test: /\.exe$/, kind: "installer", platform: "Windows", format: ".exe" },
  { test: /\.appimage$/, kind: "installer", platform: "Linux", format: ".AppImage" },
  { test: /\.deb$/, kind: "installer", platform: "Linux", format: ".deb" },
  { test: /\.rpm$/, kind: "installer", platform: "Linux", format: ".rpm" },
  { test: /\.dmg$/, kind: "installer", platform: "macOS", format: ".dmg" },
  { test: /\.jar$/, kind: "file", platform: "", format: ".jar" },
  { test: /\.war$/, kind: "file", platform: "", format: ".war" },
  { test: /\.jar\.zip$/, kind: "file", platform: "", format: ".jar.zip" },
];

/** Подписи, контрольные суммы и служебные файлы релиза посетителю не нужны. */
const SERVICE_FILE = /\.(sig|json|txt|sha256|sha512|blockmap)$/;

export function buildFromAsset(name: string, url: string): StudioBuild | null {
  const lower = name.toLowerCase();
  if (SERVICE_FILE.test(lower)) return null;

  const rule = RULES.find((candidate) => candidate.test.test(lower));
  if (!rule) return null;

  return { kind: rule.kind, platform: rule.platform, format: rule.format, url };
}

/**
 * Архив с кодом.
 *
 * GitHub собирает его сам: `/{repo}/archive/refs/tags/{tag}.zip`. Поэтому архив
 * доступен сразу, даже когда ни одного релиза ещё не опубликовано, — ровно то,
 * что нужно продукту, который поставляется в разобранном виде.
 */
export function sourceArchives(repository: string, ref: string): StudioBuild[] {
  const clean = repository.trim().replace(/^\/+|\/+$/g, "");
  if (!clean) return [];
  const base = `https://github.com/${clean}/archive/refs/${ref}`;
  return [
    { kind: "source", platform: "", format: ".zip", url: `${base}.zip` },
    { kind: "source", platform: "", format: ".tar.gz", url: `${base}.tar.gz` },
  ];
}

/** Реф для архива кода: тег последней версии, иначе ветка. */
export function sourceRef(latestVersion: string | null, defaultBranch: string | null): string | null {
  if (latestVersion) return `tags/v${latestVersion.replace(/^v/, "")}`;
  if (defaultBranch) return `heads/${defaultBranch}`;
  return null;
}

/**
 * Сборки последнего релиза: установщики и одиночные файлы.
 *
 * Старые релизы в панель загрузки не попадают: у посетителя должен быть выбор
 * платформы и формата, а не история версий.
 */
export function buildsFromReleases(
  releases: ReleaseLike[],
  latestVersion: string | null,
): StudioBuild[] {
  const target =
    releases.find(
      (release) =>
        release.assets?.length &&
        (!latestVersion || (release.tag_name ?? "").replace(/^v/, "") === latestVersion),
    ) ?? releases.find((release) => release.assets?.length);

  if (!target?.assets?.length) return [];

  const seen = new Set<string>();
  const builds: StudioBuild[] = [];
  for (const asset of target.assets) {
    const build = buildFromAsset(asset.name, asset.browser_download_url);
    if (!build) continue;
    const key = `${build.kind}|${build.platform}|${build.format}`;
    if (seen.has(key)) continue;
    seen.add(key);
    builds.push(build);
  }
  return builds;
}
