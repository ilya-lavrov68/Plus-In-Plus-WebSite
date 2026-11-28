import { Download } from "lucide-react";

import { groupDownloads, type StudioProductDownload } from "@/lib/studio-products";

/**
 * Панель загрузки продукта.
 *
 * Три вида загрузки — три разных намерения посетителя:
 *
 * 1. **Архив с кодом** — продукт поставляется в разобранном виде, его собирают
 *    под свой проект. GitHub отдаёт архив сам, поэтому он есть всегда.
 * 2. **Файлы** — готовый файл вроде `.jar` плагина или мода.
 * 3. **Установщики** — сборка под платформу: Windows, Linux, macOS.
 *
 * Пустые виды не показываются: лучше один честный блок, чем три с заглушками.
 */

const KIND_LABELS: Record<string, { ru: string; en: string }> = {
  source: { ru: "Архив с кодом", en: "Source archive" },
  file: { ru: "Файлы", en: "Files" },
  installer: { ru: "Установщики", en: "Installers" },
};

const KIND_HINTS: Record<string, { ru: string; en: string }> = {
  source: {
    ru: "Соберите под свой проект — этим продукт и задуман.",
    en: "Build it for your project — that is the point of the product.",
  },
  file: {
    ru: "Один файл, если нужна только часть.",
    en: "A single file when you need just one part.",
  },
  installer: {
    ru: "Готовая сборка под платформу.",
    en: "Ready-made build for a platform.",
  },
};

export function ProductDownloads({
  downloads,
  title,
  version,
  locale,
}: {
  downloads: StudioProductDownload[];
  title: string;
  version?: string;
  locale: string;
}) {
  const groups = groupDownloads(downloads);
  if (groups.length === 0) return null;

  const ru = locale !== "en";

  return (
    <div className="bg-card px-6 py-8 md:px-10 md:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">{title}</h2>
        {version ? <p className="text-sm tabular-nums text-muted-foreground">{version}</p> : null}
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
        {groups.map((group) => (
          <section key={group.kind}>
            <h3 className="text-sm font-medium">{KIND_LABELS[group.kind]?.[ru ? "ru" : "en"]}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {KIND_HINTS[group.kind]?.[ru ? "ru" : "en"]}
            </p>

            <div className="mt-4 flex flex-col gap-4">
              {group.platforms.map((platform) => (
                <div key={`${group.kind}-${platform.platform}`}>
                  {/* Платформу подписываем только у установщиков: у архива кода
                      и одиночного файла платформа одна — «любая». */}
                  {group.kind === "installer" ? (
                    <p className="text-xs text-muted-foreground">{platform.platform}</p>
                  ) : null}
                  <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
                    {platform.items.map((item) => (
                      <li key={`${item.format}-${item.url}`}>
                        <a
                          href={item.url}
                          className="inline-flex items-center gap-1.5 text-sm underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white/70"
                        >
                          <Download aria-hidden="true" className="size-3.5" />
                          {item.format}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
