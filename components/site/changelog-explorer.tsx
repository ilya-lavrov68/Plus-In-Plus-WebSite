"use client";

import { useLocale, useTranslations } from "next-intl";
import { Check, Copy, ExternalLink, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { InlineMarkdown } from "@/components/site/inline-markdown";
import { Input } from "@/components/ui/input";
import {
  formatChangelogDate,
  versionAnchor,
  type ChangelogEntry,
  type ChangelogSectionKind,
} from "@/lib/changelog-format";
import { cn } from "@/lib/utils";

/**
 * Интерактивная часть страницы истории версий: поиск по изменениям, фильтр по
 * типу правки, якоря на релиз и копирование ссылки на версию.
 *
 * Вся работа — фильтрация уже загруженных записей, поэтому ни одного запроса
 * на сервер при вводе нет.
 */

type FilterKind = "all" | "added" | "changed" | "fixed";

const FILTERS: FilterKind[] = ["all", "added", "changed", "fixed"];

interface ChangelogExplorerProps {
  entries: ChangelogEntry[];
  repositoryUrl: string;
  branch: string;
  changelogUrl: string;
  /** Адрес страницы без якоря — для кнопки «скопировать ссылку на версию». */
  pagePath: string;
  latestVersion: string | null;
  showRussianNotice: boolean;
}

const KNOWN_KINDS = new Set<ChangelogSectionKind>(["added", "changed", "fixed", "removed", "security"]);

function matches(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase("ru").includes(needle);
}

export function ChangelogExplorer({
  entries,
  repositoryUrl,
  branch,
  changelogUrl,
  pagePath,
  latestVersion,
  showRussianNotice,
}: ChangelogExplorerProps) {
  const t = useTranslations("changelog");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<FilterKind>("all");
  const [copied, setCopied] = useState<string | null>(null);
  /** Версия, которая сейчас на экране: её подсвечиваем в списке слева. */
  const [activeVersion, setActiveVersion] = useState<string | null>(latestVersion);

  useEffect(() => {
    if (typeof document === "undefined" || typeof IntersectionObserver === "undefined") return;
    const nodes = entries
      .map((entry) => document.getElementById(versionAnchor(entry.version)))
      .filter((node): node is HTMLElement => Boolean(node));
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((record) => record.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveVersion(visible[0].target.id);
      },
      { rootMargin: "-140px 0px -65% 0px" },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [entries]);

  const needle = query.trim().toLocaleLowerCase("ru");

  /** Сколько пунктов каждого типа есть всего — цифры на фильтрах. */
  const counts = useMemo(() => {
    const result: Record<FilterKind, number> = { all: 0, added: 0, changed: 0, fixed: 0 };
    for (const entry of entries) {
      for (const section of entry.sections) {
        const size = section.items.length + section.paragraphs.length;
        result.all += size;
        if (section.kind === "added" || section.kind === "changed" || section.kind === "fixed") {
          result[section.kind] += size;
        }
      }
    }
    return result;
  }, [entries]);

  const visible = useMemo(() => {
    return entries
      .map((entry) => {
        const entryText = [entry.version, entry.date, ...entry.intro].join(" ");
        const entryMatches = needle === "" || matches(entryText, needle);

        const sections = entry.sections
          .filter((section) => kind === "all" || section.kind === kind)
          .map((section) => {
            if (needle === "") return section;
            const items = section.items.filter((item) => matches(item, needle));
            const paragraphs = section.paragraphs.filter((paragraph) => matches(paragraph, needle));
            return { ...section, items, paragraphs };
          })
          .filter((section) => needle === "" || section.items.length + section.paragraphs.length > 0);

        const hasContent = sections.some(
          (section) => section.items.length + section.paragraphs.length > 0,
        );
        const keep = kind === "all" ? entryMatches || hasContent : hasContent;

        return keep ? { ...entry, sections } : null;
      })
      .filter((entry): entry is ChangelogEntry => entry !== null);
  }, [entries, kind, needle]);

  const visibleCount = visible.length;

  async function copyLink(version: string) {
    const anchor = versionAnchor(version);
    const url = `${window.location.origin}${pagePath}#${anchor}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Без Clipboard API (или без разрешения) остаётся адресная строка:
      // подсветим саму ссылку, чтобы её можно было скопировать вручную.
      window.history.replaceState(null, "", `#${anchor}`);
    }
    setCopied(version);
    window.setTimeout(() => setCopied((current) => (current === version ? null : current)), 2000);
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
      <nav aria-label={t("indexLabel")} className="hidden lg:block">
        <div className="sticky top-28">
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {t("indexLabel")}
          </p>
          <ol className="mt-4 space-y-1">
            {visible.map((entry) => (
              <li key={entry.version}>
                <a
                  href={`#${versionAnchor(entry.version)}`}
                  aria-current={activeVersion === versionAnchor(entry.version) ? "true" : undefined}
                  className={cn(
                    "group flex flex-col gap-0.5 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.06]",
                    "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    activeVersion === versionAnchor(entry.version) && "bg-white/[0.06]",
                  )}
                >
                  <span className="flex items-center gap-2 font-mono text-sm text-foreground">
                    {entry.version}
                    {entry.version === latestVersion ? (
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-[var(--pip-accent-neutral)]"
                      />
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatChangelogDate(entry.date, locale)}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      <div className="min-w-0">
        <div className="z-20 -mx-4 bg-background px-4 pt-3 pb-4 md:-mx-6 md:px-6 lg:sticky lg:top-16">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <label htmlFor="changelog-search" className="sr-only">
                {t("searchLabel")}
              </label>
              <Input
                id="changelog-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-11 pr-10 pl-9"
                autoComplete="off"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("clearSearch")}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((filter) => {
                const active = kind === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setKind(filter)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      active
                        ? "bg-[var(--pip-accent-neutral)] text-[var(--pip-ink-light)]"
                        : "bg-white/[0.06] text-muted-foreground hover:bg-white/[0.1] hover:text-foreground",
                    )}
                  >
                    {t(`filter.${filter}`)}
                    <span
                      className={cn(
                        "hidden tabular-nums sm:inline",
                        active ? "text-[var(--pip-ink-light)]/60" : "text-muted-foreground/70",
                      )}
                    >
                      {counts[filter]}
                    </span>
                  </button>
                );
              })}
              <span aria-live="polite" className="ml-auto text-xs text-muted-foreground">
                {t("found", { count: visibleCount })}
              </span>
            </div>
          </div>
        </div>

        {showRussianNotice ? (
          <p className="mt-4 rounded-lg bg-white/[0.045] px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {t("russianNotice")}
          </p>
        ) : null}

        {visible.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white/[0.045] p-8 text-center">
            <p className="text-lg font-medium">{t("empty.title")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("empty.description")}</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setKind("all");
              }}
              className="mt-5 rounded-md px-3 py-2 text-sm text-foreground underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white/70 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t("empty.reset")}
            </button>
          </div>
        ) : (
          <ol className="mt-8 space-y-5">
            {visible.map((entry) => {
              const anchor = versionAnchor(entry.version);
              const isLatest = entry.version === latestVersion;
              const isCopied = copied === entry.version;
              return (
                <li key={entry.version}>
                  <article
                    id={anchor}
                    aria-labelledby={`${anchor}-title`}
                    className="scroll-mt-40 rounded-2xl bg-white/[0.045] p-6 md:p-8"
                  >
                    <header className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <h2
                            id={`${anchor}-title`}
                            className="font-mono text-2xl font-medium tracking-tight md:text-3xl"
                          >
                            {entry.version}
                          </h2>
                          {isLatest ? (
                            <span className="rounded-full bg-[var(--pip-accent-neutral)] px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-[var(--pip-ink-light)] uppercase">
                              {t("latest")}
                            </span>
                          ) : null}
                          {entry.release.url ? (
                            <a
                              href={entry.release.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                            >
                              {t("githubRelease")}
                            </a>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          <time dateTime={entry.date}>{formatChangelogDate(entry.date, locale)}</time>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void copyLink(entry.version)}
                        className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {isCopied ? (
                          <Check aria-hidden="true" className="size-3.5" />
                        ) : (
                          <Copy aria-hidden="true" className="size-3.5" />
                        )}
                        {isCopied ? t("copied") : t("copyLink")}
                      </button>
                    </header>

                    {entry.intro.length > 0 ? (
                      <p className="mt-5 max-w-[64ch] text-base leading-[1.7] text-foreground/90">
                        {entry.intro.map((paragraph, index) => (
                          <span key={index} className={index > 0 ? "mt-3 block" : undefined}>
                            <InlineMarkdown text={paragraph} repositoryUrl={repositoryUrl} branch={branch} />
                          </span>
                        ))}
                      </p>
                    ) : null}

                    <div className="mt-6 max-w-[64ch] space-y-6">
                      {entry.sections.map((section) => (
                        <section key={section.title}>
                          <h3 className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                            {section.kind === "note" ? null : (
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "size-1.5 rounded-full",
                                  section.kind === "added" && "bg-[var(--pip-accent-neutral)]",
                                  section.kind === "changed" && "bg-white/50",
                                  section.kind === "fixed" && "bg-[var(--pip-signal)]",
                                  section.kind === "removed" && "bg-white/30",
                                  section.kind === "security" && "bg-[var(--pip-signal)]",
                                )}
                              />
                            )}
                            {KNOWN_KINDS.has(section.kind) ? t(`kind.${section.kind}`) : section.title}
                          </h3>

                          {section.items.length > 0 ? (
                            <ul className="mt-3 space-y-3">
                              {section.items.map((item, index) => (
                                <li key={index} className="flex gap-3">
                                  <span
                                    aria-hidden="true"
                                    className="mt-[0.6em] h-px w-3 shrink-0 bg-white/25"
                                  />
                                  <span className="min-w-0 text-sm leading-[1.75] text-muted-foreground">
                                    <InlineMarkdown text={item} repositoryUrl={repositoryUrl} branch={branch} />
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : null}

                          {section.paragraphs.map((paragraph, index) => (
                            <p
                              key={index}
                              className="mt-3 text-sm leading-[1.75] text-muted-foreground"
                            >
                              <InlineMarkdown text={paragraph} repositoryUrl={repositoryUrl} branch={branch} />
                            </p>
                          ))}
                        </section>
                      ))}
                    </div>

                    <footer className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <a
                        href={changelogUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                      >
                        {t("openInRepository")}
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                      </a>
                      {entry.release.tag ? (
                        <span className="font-mono text-xs text-muted-foreground/70">{entry.release.tag}</span>
                      ) : null}
                      {entry.release.assets.length > 0 ? (
                        <ul className="flex flex-wrap gap-x-4 gap-y-1">
                          {entry.release.assets.map((asset) => (
                            <li key={asset.url}>
                              <a
                                href={asset.url}
                                className="inline-flex items-center gap-1.5 text-xs text-foreground underline-offset-4 hover:underline"
                              >
                                {asset.name}
                                <ExternalLink aria-hidden="true" className="size-3.5" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </footer>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
