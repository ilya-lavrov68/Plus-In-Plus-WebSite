"use client";

import Lenis from "lenis";
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
 * Lenis smooths desktop wheel and anchor scrolling only; touch remains native.
 * Reveal markup is visible by default, so SSR, no-JS and reduced-motion users
 * never depend on JavaScript to read the page.
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

    const lenis = new Lenis({
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

    return () => lenis.destroy();
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

    const register = (element: HTMLElement) => {
      if (element.dataset.reveal === "visible") return;
      if (element.dataset.reveal === "pending") {
        observer.observe(element);
        return;
      }

      const requestedDelay = Number(element.dataset.revealDelay ?? 0);
      const delay = Number.isFinite(requestedDelay)
        ? Math.min(300, Math.max(0, requestedDelay))
        : 0;
      element.style.setProperty("--reveal-delay", `${delay}ms`);

      const bounds = element.getBoundingClientRect();
      const initiallyVisible =
        bounds.bottom >= 0 && bounds.top <= window.innerHeight * 0.94;

      if (initiallyVisible) {
        element.dataset.reveal = "visible";
      } else {
        element.dataset.reveal = "pending";
        observer.observe(element);
      }
    };

    const scan = (root: ParentNode = document) => {
      if (root instanceof HTMLElement && root.hasAttribute("data-reveal")) {
        register(root);
      }
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach(register);
    };

    scan();

    const mutations =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver((records) => {
            for (const record of records) {
              record.addedNodes.forEach((node) => {
                if (node instanceof HTMLElement) scan(node);
              });
            }
          });
    mutations?.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations?.disconnect();
    };
  }, [pathname, reducedMotion]);

  return null;
}
