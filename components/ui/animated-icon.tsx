"use client";

import { useReducedMotion } from "motion/react";
import {
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type RefAttributes,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import { cn } from "@/lib/utils";

export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export type AnimatedIconComponent = ForwardRefExoticComponent<
  HTMLAttributes<HTMLDivElement> & {
    animateOnHover?: boolean;
    size?: number;
  } & RefAttributes<AnimatedIconHandle>
>;

export type AnimatedIconInteraction = "hover" | "press";

interface AnimatedIconProps {
  icon: AnimatedIconComponent;
  size?: number;
  className?: string;
  interaction?: AnimatedIconInteraction;
}

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;
const PRESS_ANIMATION_MS = 500;

/**
 * Единый interaction-wrapper для lucide-animated.
 *
 * Библиотека по умолчанию слушает только собственный div. Здесь короткий отклик
 * запускается от фактической button/link, поэтому иконка реагирует и на подпись.
 * Режим `hover` сохраняет фирменные hover/focus/tap-отклики публичного сайта.
 * Режим `press` нужен админке: только pointer press или Enter/Space, без реакции
 * на наведение и простой keyboard focus. Ближайший `data-pip-icon-trigger` нужен
 * когда между иконкой и control есть дополнительный wrapper.
 */
export function AnimatedIcon({
  icon: Icon,
  size = 20,
  className,
  interaction = "hover",
}: AnimatedIconProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<AnimatedIconHandle>(null);
  const reducedMotion = useReducedMotion();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    const host = hostRef.current;
    const trigger = host?.closest<HTMLElement>("[data-pip-icon-trigger]") ?? host?.parentElement;
    if (!trigger) return;

    let pressTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = undefined;
      iconRef.current?.stopAnimation();
    };
    const start = () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = undefined;
      iconRef.current?.startAnimation();
    };
    const startPress = () => {
      start();
      pressTimer = setTimeout(stop, PRESS_ANIMATION_MS);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (typeof event.button === "number" && event.button !== 0) return;

      if (interaction === "press") {
        startPress();
        return;
      }

      start();
      if (event.pointerType === "touch" || event.pointerType === "pen") {
        pressTimer = setTimeout(stop, PRESS_ANIMATION_MS);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
      startPress();
    };

    if (reducedMotion) {
      stop();
      return;
    }

    if (interaction === "press") {
      trigger.addEventListener("pointerdown", onPointerDown);
      trigger.addEventListener("pointercancel", stop);
      trigger.addEventListener("keydown", onKeyDown);
    } else {
      trigger.addEventListener("pointerenter", start);
      trigger.addEventListener("pointerleave", stop);
      trigger.addEventListener("focusin", start);
      trigger.addEventListener("focusout", stop);
      trigger.addEventListener("pointerdown", onPointerDown);
      trigger.addEventListener("pointercancel", stop);
    }

    return () => {
      if (pressTimer) clearTimeout(pressTimer);
      trigger.removeEventListener("pointerdown", onPointerDown);
      trigger.removeEventListener("pointercancel", stop);
      trigger.removeEventListener("keydown", onKeyDown);
      trigger.removeEventListener("pointerenter", start);
      trigger.removeEventListener("pointerleave", stop);
      trigger.removeEventListener("focusin", start);
      trigger.removeEventListener("focusout", stop);
    };
  }, [interaction, reducedMotion]);

  return (
    <span
      ref={hostRef}
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center leading-none [&>div]:inline-flex [&>div]:items-center [&>div]:justify-center",
        className,
      )}
      data-pip-animated-icon=""
      data-interaction={interaction}
      data-motion={mounted && reducedMotion ? "reduced" : "full"}
    >
      <Icon ref={iconRef} size={size} animateOnHover={false} />
    </span>
  );
}
