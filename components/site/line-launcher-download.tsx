"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type Platform = "windows" | "linux";

export interface DownloadCopy {
  title: string;
  versionLabel: string;
  platformLabel: string;
  formatLabel: string;
  versions: string[];
  platforms: Record<Platform, string>;
  formats: Record<Platform, string[]>;
  action: string;
  unavailable: string;
  requirementsLabel: string;
  requirements: string;
}

const PLATFORMS: Platform[] = ["windows", "linux"];

/**
 * Панель выбора сборки в духе JetBrains: версия × платформа × формат.
 *
 * Публичных сборок у проекта нет, поэтому все форматы помечены как неопубликованные,
 * а кнопка скачивания неактивна. Структура готова: как только владелец выложит
 * установщики, менять придётся только данные.
 */
export function LineLauncherDownload({ copy }: { copy: DownloadCopy }) {
  const [version, setVersion] = useState(copy.versions[0] ?? "");
  const [platform, setPlatform] = useState<Platform>("windows");
  const [format, setFormat] = useState(copy.formats.windows[0] ?? "");

  const choosePlatform = (next: Platform) => {
    setPlatform(next);
    setFormat(copy.formats[next][0] ?? "");
  };

  return (
    <div className="bg-card px-6 py-8 md:px-8 md:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
          {copy.title}
        </h2>
        <p className="text-xs text-muted-foreground">{copy.unavailable}</p>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[0.9fr_1.1fr_1fr] md:gap-10">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">
            {copy.versionLabel}
          </span>
          <select
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            className="w-full bg-transparent py-1.5 pr-6 text-base text-foreground [color-scheme:dark] focus-visible:outline-none"
          >
            {copy.versions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">
            {copy.platformLabel}
          </span>
          <div className="flex flex-wrap gap-x-5 gap-y-1" role="tablist">
            {PLATFORMS.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={platform === item}
                onClick={() => choosePlatform(item)}
                className={
                  platform === item
                    ? "py-1.5 text-base text-foreground [background-image:linear-gradient(to_right,#ff5f01,#ff5f01)] [background-position:bottom] [background-repeat:no-repeat] [background-size:100%_1px]"
                    : "py-1.5 text-base text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {copy.platforms[item]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">
            {copy.formatLabel}
          </span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value)}
            className="w-full bg-transparent py-1.5 pr-6 text-base text-foreground [color-scheme:dark] focus-visible:outline-none"
          >
            {copy.formats[platform].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="button" size="lg" variant="secondary" disabled>
          {copy.action}
        </Button>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {copy.requirementsLabel}: {copy.requirements}
        </p>
      </div>
    </div>
  );
}
