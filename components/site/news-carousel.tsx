"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, TouchEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const AUTOPLAY_INTERVAL = 7000;
const SWIPE_THRESHOLD = 50;

export interface NewsItem {
  id: string;
  title: string;
  href: string;
  imageSrc?: string;
  description?: string;
}

export interface NewsCarouselProps {
  items: readonly NewsItem[];
  /** Accessible region name; content and empty-state copy belong to the caller. */
  label: string;
}

export function NewsCarousel({ items, label }: NewsCarouselProps) {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const elapsed = useRef(0);
  const previousTick = useRef(0);
  const progress = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const viewportId = useId();
  const count = items.length;
  const activeIndex = count ? index % count : 0;
  const running = isPlaying && isVisible && count > 1;

  const resetTimer = useCallback(() => {
    elapsed.current = 0;
    previousTick.current = performance.now();
    if (progress.current) progress.current.style.transform = "scaleX(0)";
  }, []);

  const move = useCallback((direction: number) => {
    if (count < 2) return;
    resetTimer();
    setIndex((current) => (current + direction + count) % count);
  }, [count, resetTimer]);

  useEffect(() => {
    setIndex(0);
    resetTimer();
  }, [count, resetTimer]);

  useEffect(() => {
    const onVisibilityChange = () => setIsVisible(!document.hidden);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Do not start automatic motion for users who request reduced motion.
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
    let frame: number;
    previousTick.current = performance.now();
    const tick = (now: number) => {
      elapsed.current += Math.max(0, now - previousTick.current);
      previousTick.current = now;
      if (elapsed.current >= AUTOPLAY_INTERVAL) move(1);
      if (progress.current) {
        progress.current.style.transform = `scaleX(${elapsed.current / AUTOPLAY_INTERVAL})`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, move]);

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    const end = event.changedTouches[0];
    if (!start || !end) return;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      move(dx < 0 ? 1 : -1);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowRight" ? 1 : -1);
  };

  // No fabricated news or empty-state copy: the page supplies EmptyState when needed.
  if (!count) return null;

  return (
    <section
      aria-label={label}
      aria-roledescription="carousel"
      className="space-y-4"
    >
      <div
        id={viewportId}
        className="overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={count > 1 ? 0 : undefined}
        onKeyDown={onKeyDown}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => { touchStart.current = null; }}
        style={{ touchAction: "pan-y pinch-zoom" }}
      >
        <div
          className="flex transition-transform duration-400 ease-in-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          aria-live={running ? "off" : "polite"}
          aria-atomic="false"
        >
          {items.map((item, slideIndex) => (
            <article
              key={item.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${slideIndex + 1} / ${count}`}
              aria-hidden={slideIndex !== activeIndex}
              className="min-w-0 basis-full shrink-0"
            >
              <Card className="h-full overflow-hidden">
                {item.imageSrc && (
                  <div className="relative aspect-[16/9] sm:aspect-[21/9]">
                    <Image src={item.imageSrc} alt="" fill sizes="(min-width: 1280px) 1280px, 100vw" className="object-cover" />
                  </div>
                )}
                <CardHeader>
                  <CardTitle>
                    <Link href={item.href} tabIndex={slideIndex === activeIndex ? 0 : -1} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {item.title}
                    </Link>
                  </CardTitle>
                </CardHeader>
                {item.description && <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p></CardContent>}
              </Card>
            </article>
          ))}
        </div>
      </div>
      {count > 1 && (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Previous slide" aria-controls={viewportId} onClick={() => move(-1)}>
            <ArrowLeft aria-hidden="true" />
          </Button>
          <div className="h-[2px] flex-1 overflow-hidden bg-muted" aria-hidden="true">
            <div ref={progress} className="h-full origin-left bg-primary" style={{ transform: "scaleX(0)" }} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={isPlaying ? "Pause autoplay" : "Start autoplay"}
            aria-pressed={isPlaying}
            aria-controls={viewportId}
            onClick={() => setIsPlaying((current) => !current)}
          >
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Next slide" aria-controls={viewportId} onClick={() => move(1)}>
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      )}
    </section>
  );
}
