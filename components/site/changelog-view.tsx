import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { ChangelogExplorer } from "@/components/site/changelog-explorer";
import { CtaSection } from "@/components/site/cta-section";
import { formatChangelogDate } from "@/lib/changelog-format";
import { getChangelog } from "@/lib/changelog";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";

/**
 * История версий Line Launcher.
 *
 * Источник — репозиторий продукта (`data/line-launcher-changelog.json`
 * обновляется командой `npm run changelog:sync`). Если файла нет, страница не
 * придумывает версии, а честно отправляет в репозиторий.
 */
export async function ChangelogView() {
  const [t, locale] = await Promise.all([
    getRequestTranslations("changelog"),
    getRequestLocale(),
  ]);
  const data = getChangelog();

  return (
    <div className="bg-background">
      <section className="container pt-12 pb-10 md:pt-16 md:pb-12">
        <Link
          href="/line-launcher"
          className="inline-flex items-center gap-2 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          {t("backToProduct")}
        </Link>

        <h1 className="mt-10 max-w-3xl text-4xl font-medium tracking-tight sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-[1.75] text-muted-foreground md:text-lg">
          {t("lead")}
        </p>

        {data ? (
          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-3 text-sm">
            {data.latestVersion ? (
              <span className="rounded-full bg-[var(--pip-accent-neutral)] px-3 py-1 font-medium text-[var(--pip-ink-light)]">
                {t("latestBadge", { version: data.latestVersion })}
              </span>
            ) : null}
            <span className="text-muted-foreground">
              {t("versionsCount", { count: data.entries.length })}
            </span>
            {data.latestDate ? (
              <span className="text-muted-foreground">
                {t("updated", { date: formatChangelogDate(data.latestDate, locale) })}
              </span>
            ) : null}
            <a
              href={data.changelogUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {t("sourceChangelog")}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
            <a
              href={data.tagsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {t("sourceTags")}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </div>
        ) : null}

        {data && data.publishedReleaseCount === 0 ? (
          <p className="mt-5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {t("releasesNote")}
          </p>
        ) : null}
      </section>

      <section className="container pb-20 md:pb-28">
        {data ? (
          <ChangelogExplorer
            entries={data.entries}
            repositoryUrl={data.repositoryUrl}
            branch={data.defaultBranch}
            changelogUrl={data.changelogUrl}
            pagePath="/line-launcher/changelog"
            latestVersion={data.latestVersion}
            showRussianNotice={locale !== "ru"}
          />
        ) : (
          <div className="rounded-2xl bg-white/[0.045] p-8 md:p-10">
            <h2 className="text-xl font-medium">{t("unavailable.title")}</h2>
            <p className="measure mt-3 text-sm leading-relaxed text-muted-foreground">
              {t("unavailable.description")}
            </p>
            <a
              href="https://github.com/ilya-lavrov68/Line-Launcher/blob/main/CHANGELOG.md"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm text-foreground underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white/70"
            >
              {t("sourceChangelog")}
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          </div>
        )}
      </section>

      <CtaSection />
    </div>
  );
}
