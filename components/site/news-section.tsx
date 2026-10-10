"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, TouchEvent } from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";

import { NewsCard } from "@/components/site/news-card";
import type { NewsSource } from "@/components/site/news-card";

export const NEWS_AUTOPLAY_INTERVAL = 7000;
const SWIPE_THRESHOLD = 50;

export interface NewsSectionItem {
  id: string;
  title: string;
  excerpt: string;
  imageSrc?: string;
  source: NewsSource;
  href: string;
}

function getCardsPerPage() {
  if (window.matchMedia("(min-width: 1024px)").matches) return 3;
  if (window.matchMedia("(min-width: 640px)").matches) return 2;
  return 1;
}

export function NewsSection({ items }: { items: readonly NewsSectionItem[] }) {
  const [cardsPerPage, setCardsPerPage] = useState(3);
  const [activePage, setActivePage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const elapsed = useRef(0);
  const previousTick = useRef(0);
  const progress = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const viewportId = useId();

  const pages = useMemo(() => {
    const groups: NewsSectionItem[][] = [];
    for (let start = 0; start < items.length; start += cardsPerPage) {
      groups.push(items.slice(start, start + cardsPerPage));
    }
    return groups;
  }, [items, cardsPerPage]);
  const pageCount = pages.length;
  const running = isPlaying && isVisible && pageCount > 1;

  const resetTimer = useCallback(() => {
    elapsed.current = 0;
    previousTick.current = performance.now();
    if (progress.current) progress.current.style.transform = "scaleX(0)";
  }, []);

  const goToPage = useCallback(
    (nextPage: number) => {
      if (pageCount < 2) return;
      resetTimer();
      setActivePage(((nextPage % pageCount) + pageCount) % pageCount);
    },
    [pageCount, resetTimer]
  );

  const move = useCallback(
    (direction: number) => goToPage(activePage + direction),
    [activePage, goToPage]
  );

  useEffect(() => {
    const updateCardsPerPage = () => setCardsPerPage(getCardsPerPage());
    updateCardsPerPage();
    window.addEventListener("resize", updateCardsPerPage, { passive: true });
    return () => window.removeEventListener("resize", updateCardsPerPage);
  }, []);

  useEffect(() => {
    setActivePage(0);
    resetTimer();
  }, [pageCount, resetTimer]);

  useEffect(() => {
    const onVisibilityChange = () => setIsVisible(!document.hidden);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      if (motion.matches) setIsPlaying(false);
    };

    onVisibilityChange();
    onMotionChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    motion.addEventListener("change", onMotionChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motion.removeEventListener("change", onMotionChange);
    };
  }, []);

  useEffect(() => {
    if (!running) return;

    let frame = 0;
    previousTick.current = performance.now();
    const tick = (now: number) => {
      elapsed.current += Math.max(0, now - previousTick.current);
      previousTick.current = now;

      if (elapsed.current >= NEWS_AUTOPLAY_INTERVAL) {
        elapsed.current %= NEWS_AUTOPLAY_INTERVAL;
        setActivePage((current) => (current + 1) % pageCount);
      }
      if (progress.current) {
        progress.current.style.transform = `scaleX(${Math.min(1, elapsed.current / NEWS_AUTOPLAY_INTERVAL)})`;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, pageCount]);

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    const end = event.changedTouches[0];
    if (!start || !end) return;

    const deltaX = end.clientX - start.x;
    const deltaY = end.clientY - start.y;
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
      move(deltaX < 0 ? 1 : -1);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowRight" ? 1 : -1);
  };

  return (
    <section id="news" aria-labelledby="news-heading" className="bg-[#e8f0fe]">
      <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <h2
          id="news-heading"
          className="text-center text-balance text-3xl font-semibold tracking-[-0.045em] text-[#0a2540] sm:text-4xl lg:text-[3.25rem]"
        >
          News from Plus In Plus
        </h2>

        {items.length ? (
          <div className="mt-9 sm:mt-12">
            <div
              id={viewportId}
              tabIndex={pageCount > 1 ? 0 : undefined}
              onKeyDown={onKeyDown}
              onTouchStart={(event) => {
                const touch = event.touches[0];
                touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
              }}
              onTouchEnd={onTouchEnd}
              onTouchCancel={() => {
                touchStart.current = null;
              }}
              role="region"
              aria-roledescription="carousel"
              aria-label="Latest news articles"
              className="overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540] focus-visible:ring-offset-4 focus-visible:ring-offset-[#e8f0fe]"
              style={{ touchAction: "pan-y pinch-zoom" }}
            >
              <div
                className="flex items-stretch transition-transform duration-400 ease-in-out motion-reduce:transition-none"
                style={{
                  width: `${pageCount * 100}%`,
                  transform: `translateX(-${(activePage * 100) / pageCount}%)`,
                }}
                aria-live={running ? "off" : "polite"}
                aria-atomic="false"
              >
                {pages.map((page, pageIndex) => (
                  <div
                    key={page[0]?.id ?? pageIndex}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${pageIndex + 1} of ${pageCount}`}
                    aria-hidden={pageIndex !== activePage}
                    className="shrink-0 px-0.5"
                    style={{ width: `${100 / pageCount}%` }}
                  >
                    <ul className="grid h-full grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
                      {page.map((item) => (
                        <li key={item.id} className="min-w-0">
                          <NewsCard
                            title={item.title}
                            excerpt={item.excerpt}
                            imageSrc={item.imageSrc}
                            source={item.source}
                            href={item.href}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-4 sm:mt-9 sm:gap-x-6">
              <div role="group" className="flex items-center justify-center gap-2" aria-label="News pages">
                {pages.map((page, pageIndex) => (
                  <button
                    key={page[0]?.id ?? pageIndex}
                    type="button"
                    aria-label={`Go to news page ${pageIndex + 1}`}
                    aria-current={pageIndex === activePage ? "page" : undefined}
                    aria-controls={viewportId}
                    onClick={() => goToPage(pageIndex)}
                    className="group inline-flex h-8 w-8 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2 rounded-full transition-[width,background-color] duration-200 ease-out ${
                        pageIndex === activePage ? "w-6 bg-[#0a2540]" : "w-2 bg-[#0a2540]/25 group-hover:bg-[#0a2540]/55"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous news page"
                  aria-controls={viewportId}
                  disabled={pageCount < 2}
                  onClick={() => move(-1)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-navy transition-colors duration-200 ease-out hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                >
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                </button>
                <div
                  aria-hidden="true"
                  className="h-1 w-24 overflow-hidden rounded-full bg-[#0a2540]/15 sm:w-32"
                >
                  <div
                    ref={progress}
                    aria-hidden="true"
                    className="h-full origin-left rounded-full bg-[#0a2540]"
                    style={{ transform: "scaleX(0)" }}
                  />
                </div>
                <button
                  type="button"
                  aria-label="Next news page"
                  aria-controls={viewportId}
                  disabled={pageCount < 2}
                  onClick={() => move(1)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-navy transition-colors duration-200 ease-out hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                >
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={isPlaying ? "Pause autoplay" : "Play autoplay"}
                  aria-pressed={isPlaying}
                  aria-controls={viewportId}
                  disabled={pageCount < 2}
                  onClick={() => setIsPlaying((playing) => !playing)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white transition-colors duration-200 ease-out hover:bg-[#153c5c] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-[#e8f0fe]"
                >
                  {isPlaying ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4 fill-current" />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-[#0a2540]/10 bg-white/60 px-6 py-10 text-center sm:mt-12">
            <h3 className="text-xl font-semibold tracking-[-0.025em] text-[#0a2540]">No news yet</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Check back later for updates.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
