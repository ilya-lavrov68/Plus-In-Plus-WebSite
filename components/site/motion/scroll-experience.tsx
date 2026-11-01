"use client";

import type Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setReduced(false);
      return;
    }

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

function revealImmediately() {
  document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
    element.dataset.reveal = "visible";
  });
}

/**
 * Site-wide progressive motion enhancement.
 *
 * Lenis is loaded only for precise desktop pointers. Reveal markup is visible
 * by default, so SSR, no-JS and reduced-motion users never depend on JavaScript.
 */
export function ScrollExperience() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotionPreference();

  useEffect(() => {
    if (reducedMotion !== false) return;
    if (
      typeof window.matchMedia !== "function" ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ) {
      return;
    }

    let disposed = false;
    let lenis: Lenis | null = null;

    // Keep the smooth-scroll engine out of the initial bundle on touch devices
    // and on pages where the user has requested reduced motion.
    void import("lenis").then(({ default: LenisConstructor }) => {
      if (disposed) return;
      lenis = new LenisConstructor({
        autoRaf: true,
        autoToggle: true,
        anchors: true,
        smoothWheel: true,
        syncTouch: false,
        stopInertiaOnNavigate: true,
        duration: 1.05,
        wheelMultiplier: 0.9,
        easing: (time) => Math.min(1, 1.001 - Math.pow(2, -10 * time)),
        prevent: (node) =>
          Boolean(
            node.closest(
              '[data-lenis-prevent], [role="dialog"], [data-radix-popper-content-wrapper]',
            ),
          ),
      });
    }).catch(() => {
      // Native scrolling remains fully functional if the optional chunk fails.
    });

    return () => {
      disposed = true;
      lenis?.destroy();
    };
  }, [reducedMotion]);

  useIsomorphicLayoutEffect(() => {
    if (reducedMotion === null) return;
    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      revealImmediately();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.dataset.reveal = "visible";
          observer.unobserve(element);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );

    // A route change or a filtered list can add many nodes in one commit.
    // Register each element once, read all bounds first, and only then write
    // classes/data attributes. This avoids forced-layout read/write ping-pong.
    const registered = new WeakSet<HTMLElement>();
    const scheduledRoots = new Set<ParentNode>();
    let flushQueued = false;
    let disposed = false;

    const register = (roots: Iterable<ParentNode>) => {
      if (disposed) return;
      const candidates = new Set<HTMLElement>();
      for (const root of roots) {
        if (root instanceof HTMLElement && root.hasAttribute("data-reveal")) {
          candidates.add(root);
        }
        root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
          candidates.add(element);
        });
      }

      const elements = Array.from(candidates).filter((element) => {
        if (registered.has(element) || element.dataset.reveal === "visible") return false;
        return true;
      });
      if (!elements.length) return;

      // Layout reads are deliberately completed before any writes below.
      const initiallyVisible = elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.bottom >= 0 && bounds.top <= window.innerHeight * 0.94;
      });

      elements.forEach((element, index) => {
        registered.add(element);
        if (element.dataset.reveal === "pending") {
          observer.observe(element);
          return;
        }

        const requestedDelay = Number(element.dataset.revealDelay ?? 0);
        const delay = Number.isFinite(requestedDelay)
          ? Math.min(300, Math.max(0, requestedDelay))
          : 0;
        element.style.setProperty("--reveal-delay", `${delay}ms`);

        if (initiallyVisible[index]) {
          element.dataset.reveal = "visible";
        } else {
          element.dataset.reveal = "pending";
          observer.observe(element);
        }
      });
    };

    const flush = () => {
      flushQueued = false;
      if (disposed) return;
      const roots = Array.from(scheduledRoots);
      scheduledRoots.clear();
      register(roots);
    };

    const schedule = (root: ParentNode) => {
      if (disposed) return;
      scheduledRoots.add(root);
      if (flushQueued) return;
      flushQueued = true;
      // MutationObserver already runs after a DOM commit. One more microtask
      // coalesces nested added nodes without doing work once per mutation.
      queueMicrotask(flush);
    };

    register([document]);

    const mutations =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver((records) => {
            for (const record of records) {
              record.addedNodes.forEach((node) => {
                if (node instanceof HTMLElement) schedule(node);
              });
            }
          });
    mutations?.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      scheduledRoots.clear();
      observer.disconnect();
      mutations?.disconnect();
    };
  }, [pathname, reducedMotion]);

  return null;
}
