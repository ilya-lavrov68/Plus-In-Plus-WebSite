/**
 * Сборки продукта: разбор файлов релиза в «платформу и формат».
 *
 * Модуль без импортов, чтобы его можно было проверять тестами напрямую.
 *
 * Имена сборок у Tauri предсказуемые: `…_x64-setup.exe`, `…_x64_en-US.msi`,
 * `…_amd64.AppImage`, `…_amd64.deb`. Подписи и служебные файлы (`*.sig`,
 * `latest.json`, контрольные суммы) в панель загрузки не попадают — посетителю
 * они не нужны.
 */

export interface StudioBuild {
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

const RULES: Array<{ test: RegExp; platform: string; format: string }> = [
  { test: /\.msi$/, platform: "Windows", format: ".msi" },
  { test: /\.exe$/, platform: "Windows", format: ".exe" },
  { test: /\.appimage$/, platform: "Linux", format: ".AppImage" },
  { test: /\.deb$/, platform: "Linux", format: ".deb" },
  { test: /\.rpm$/, platform: "Linux", format: ".rpm" },
  { test: /\.dmg$/, platform: "macOS", format: ".dmg" },
];

const SERVICE_FILE = /\.(sig|json|txt|sha256|sha512|blockmap)$/;

export function buildFromAsset(name: string, url: string): StudioBuild | null {
  const lower = name.toLowerCase();
  if (SERVICE_FILE.test(lower)) return null;

  const rule = RULES.find((candidate) => candidate.test.test(lower));
  if (!rule) return null;

  return { platform: rule.platform, format: rule.format, url };
}

/**
 * Сборки последнего релиза.
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
    const key = `${build.platform}|${build.format}`;
    if (seen.has(key)) continue;
    seen.add(key);
    builds.push(build);
  }
  return builds;
}
