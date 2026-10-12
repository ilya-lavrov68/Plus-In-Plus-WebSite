"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, TouchEvent } from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";

import { NewsCard } from "@/components/site/news-card";
import type { NewsSource } from "@/components/site/news-card";

export const AUTOPLAY_INTERVAL = 7000;
const SWIPE_THRESHOLD = 50;

export interface NewsItem {
  id: string;
  title: string;
  href: string;
  imageSrc?: string;
  excerpt?: string;
  description?: string;
  source?: NewsSource;
}

export interface NewsCarouselProps {
  items: readonly NewsItem[];
  /** Accessible region name; content and empty-state copy belong to the caller. */
  label: string;
}

function getCardsPerPage() {
  if (window.matchMedia("(min-width: 1536px)").matches) return 5;
  if (window.matchMedia("(min-width: 1280px)").matches) return 4;
  if (window.matchMedia("(min-width: 768px)").matches) return 3;
  if (window.matchMedia("(min-width: 480px)").matches) return 2;
  return 1;
}

export function NewsCarousel({ items, label }: NewsCarouselProps) {
  const [cardsPerPage, setCardsPerPage] = useState(5);
  const [activePage, setActivePage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const elapsed = useRef(0);
  const previousTick = useRef(0);
  const progress = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const viewportId = useId();
  const count = items.length;

  const pages = useMemo(() => {
    const groups: NewsItem[][] = [];
    for (let start = 0; start < count; start += cardsPerPage) {
      groups.push(items.slice(start, start + cardsPerPage));
    }
    return groups;
  }, [items, count, cardsPerPage]);
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
    [pageCount, resetTimer],
  );

  const move = useCallback((direction: number) => goToPage(activePage + direction), [activePage, goToPage]);

  useEffect(() => {
    const updateCardsPerPage = () => {
      const nextCount = getCardsPerPage();
      setCardsPerPage((current) => (current === nextCount ? current : nextCount));
    };
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

      if (elapsed.current >= AUTOPLAY_INTERVAL) {
        elapsed.current %= AUTOPLAY_INTERVAL;
        setActivePage((current) => (current + 1) % pageCount);
      }
      if (progress.current) {
        progress.current.style.transform = `scaleX(${Math.min(1, elapsed.current / AUTOPLAY_INTERVAL)})`;
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

  if (!count) return null;

  return (
    <section aria-label={label} className="w-full">
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
        aria-label={`${label} articles`}
        className="overflow-hidden rounded-[1.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-4 focus-visible:ring-offset-[#CFE0FF]"
        style={{ touchAction: "pan-y pinch-zoom" }}
      >
        <div
          className="flex items-start transition-transform duration-400 ease-in-out motion-reduce:transition-none"
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
              <ul className="grid grid-cols-1 items-start gap-4 min-[480px]:grid-cols-2 sm:gap-5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 2xl:gap-7">
                {page.map((item) => (
                  <li key={item.id} className="min-w-0">
                    <NewsCard
                      title={item.title}
                      excerpt={item.excerpt ?? item.description ?? ""}
                      imageSrc={item.imageSrc}
                      source={item.source}
                      href={item.href}
                      isActive={pageIndex === activePage}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {pageCount > 1 ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10 lg:mt-[120px]">
          <div
            role="group"
            className="flex h-8 w-[min(357px,78vw)] max-w-full items-center justify-between gap-1 overflow-x-auto rounded-full bg-white px-3"
            aria-label="News pages"
          >
            {pages.map((page, pageIndex) => (
              <button
                key={page[0]?.id ?? pageIndex}
                type="button"
                aria-label={`Go to news page ${pageIndex + 1}`}
                aria-current={pageIndex === activePage ? "page" : undefined}
                aria-controls={viewportId}
                onClick={() => goToPage(pageIndex)}
                className="group inline-flex h-7 min-w-4 items-center justify-center rounded-full px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]"
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out ${
                    pageIndex === activePage ? "w-7 bg-[#052B42]" : "w-1.5 bg-[#052B42]/25 group-hover:bg-[#052B42]/55"
                  }`}
                />
              </button>
            ))}
            <div aria-hidden="true" className="ml-1 h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-[#052B42]/15 sm:w-16">
              <div
                ref={progress}
                className="h-full origin-left rounded-full bg-[#052B42]"
                style={{ transform: "scaleX(0)" }}
              />
            </div>
          </div>

          <button
            type="button"
            aria-label={isPlaying ? "Pause autoplay" : "Start autoplay"}
            aria-pressed={isPlaying}
            aria-controls={viewportId}
            onClick={() => setIsPlaying((playing) => !playing)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#052B42] transition-colors duration-200 ease-out hover:bg-[#052B42] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]"
          >
            {isPlaying ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4 fill-current" />}
          </button>
          <button type="button" aria-label="Previous slide" aria-controls={viewportId} onClick={() => move(-1)} className="sr-only">
            <ArrowLeft aria-hidden="true" />
          </button>
          <button type="button" aria-label="Next slide" aria-controls={viewportId} onClick={() => move(1)} className="sr-only">
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
