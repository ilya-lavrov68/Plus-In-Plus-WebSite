"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import { cn } from "@/lib/utils";

const DEFAULT_GLYPHS = "#%&@$?!*+=/{}[]<>~^";
const CYCLE_SPREAD = 35;

interface DecryptCharacter {
  char: string;
  index: number;
}

export interface DecryptTextProps {
  text: string;
  className?: string;
  glyphs?: string;
  /** Milliseconds between glyph changes for unresolved characters. */
  speed?: number;
  /** Left-to-right delay between character lock-in times. */
  stagger?: number;
  startDelay?: number;
  /** Random-looking but deterministic spread around each lock-in time. */
  jitter?: number;
  /** A stable seed keeps the first server/client composition predictable. */
  seed?: number;
  trigger?: "mount" | "inview";
}

function createRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Resolves readable text out of a single-pass scramble.
 *
 * The original glyphs own the layout, while an absolutely positioned layer
 * changes only textContent and data attributes. This keeps line wrapping and
 * element dimensions stable. Screen readers receive one unscrambled string.
 */
export function DecryptText({
  text,
  className,
  glyphs = DEFAULT_GLYPHS,
  speed = 44,
  stagger = 32,
  startDelay = 140,
  jitter = 45,
  seed = 1,
  trigger = "inview",
}: DecryptTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const characterRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const frameRef = useRef<number | null>(null);
  const pool = glyphs.length > 0 ? glyphs : DEFAULT_GLYPHS;

  const words = useMemo(() => {
    let index = 0;
    return text.split(" ").map((word) =>
      Array.from(word).map<DecryptCharacter>((char) => ({
        char,
        index: index++,
      })),
    );
  }, [text]);

  const stop = useCallback(() => {
    if (frameRef.current !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = null;
  }, []);

  const resolveAll = useCallback(() => {
    stop();
    for (const element of characterRefs.current) {
      if (!element) continue;
      element.textContent = element.dataset.character ?? "";
      element.dataset.state = "plain";
    }
    if (rootRef.current) {
      rootRef.current.dataset.decryptState = "complete";
    }
  }, [stop]);

  const play = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    if (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      typeof requestAnimationFrame !== "function"
    ) {
      resolveAll();
      return;
    }

    const cells = characterRefs.current.filter(
      (element): element is HTMLSpanElement => element !== null,
    );
    if (cells.length === 0) {
      resolveAll();
      return;
    }

    stop();
    root.dataset.decryptState = "scrambling";
    const random = createRandom(seed);
    const lockAt = new Float64Array(cells.length);
    const nextCycleAt = new Float64Array(cells.length);
    const locked = new Uint8Array(cells.length);
    let remaining = cells.length;

    cells.forEach((element, index) => {
      lockAt[index] = Math.max(
        0,
        startDelay + index * stagger + (random() * 2 - 1) * jitter,
      );
      element.textContent = pool.charAt(Math.floor(random() * pool.length));
      element.dataset.state = "scramble";
    });

    const startedAt = performance.now();
    const draw = () => {
      const elapsed = performance.now() - startedAt;

      for (let index = 0; index < cells.length; index += 1) {
        if (locked[index]) continue;
        const element = cells[index];

        if (elapsed >= lockAt[index]) {
          element.textContent = element.dataset.character ?? "";
          element.dataset.state = "lock";
          locked[index] = 1;
          remaining -= 1;
        } else if (elapsed >= nextCycleAt[index]) {
          element.textContent = pool.charAt(Math.floor(random() * pool.length));
          nextCycleAt[index] = elapsed + speed + random() * CYCLE_SPREAD;
        }
      }

      if (remaining === 0) {
        frameRef.current = null;
        root.dataset.decryptState = "complete";
        return;
      }
      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
  }, [jitter, pool, resolveAll, seed, speed, stagger, startDelay, stop]);

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const motionPreference = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
    if (motionPreference?.matches) {
      resolveAll();
      return;
    }

    let observer: IntersectionObserver | undefined;
    if (trigger === "mount" || typeof IntersectionObserver === "undefined") {
      play();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          play();
        },
        { threshold: 0.18, rootMargin: "0px 0px -4% 0px" },
      );
      observer.observe(root);
    }

    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches) resolveAll();
    };
    motionPreference?.addEventListener?.("change", onMotionPreferenceChange);

    return () => {
      observer?.disconnect();
      motionPreference?.removeEventListener?.("change", onMotionPreferenceChange);
      stop();
    };
  }, [play, resolveAll, stop, trigger]);

  let cursor = -1;

  return (
    <span
      ref={rootRef}
      className={cn("decrypt-text", className)}
      data-decrypt-text=""
      data-decrypt-state="idle"
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="decrypt-text-visual">
        {words.map((word, wordIndex) => (
          <span key={`${wordIndex}-${text}`}>
            <span className="inline-block whitespace-nowrap">
              {word.map((item) => {
                cursor += 1;
                const refIndex = cursor;
                return (
                  <span
                    key={`${item.index}-${item.char}`}
                    className="relative inline-block"
                  >
                    <span className="invisible">{item.char}</span>
                    <span
                      ref={(element) => {
                        characterRefs.current[refIndex] = element;
                      }}
                      className="decrypt-text-glyph absolute inset-0"
                      data-character={item.char}
                      data-state="plain"
                    >
                      {item.char}
                    </span>
                  </span>
                );
              })}
            </span>
            {wordIndex < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </span>
  );
}
