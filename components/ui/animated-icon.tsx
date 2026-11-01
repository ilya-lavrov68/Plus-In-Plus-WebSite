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

interface AnimatedIconProps {
  icon: AnimatedIconComponent;
  size?: number;
  className?: string;
}

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Единый interaction-wrapper для lucide-animated.
 *
 * Библиотека по умолчанию слушает только собственный div. Здесь короткий отклик
 * запускается от фактической button/link, поэтому иконка реагирует и на подпись,
 * и на клавиатурный focus, и на tap. Ближайший `data-pip-icon-trigger` нужен
 * только когда между иконкой и control есть дополнительный wrapper.
 */
export function AnimatedIcon({
  icon: Icon,
  size = 20,
  className,
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

    let tapTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (tapTimer) clearTimeout(tapTimer);
      tapTimer = undefined;
      iconRef.current?.stopAnimation();
    };
    const start = () => {
      if (tapTimer) clearTimeout(tapTimer);
      tapTimer = undefined;
      iconRef.current?.startAnimation();
    };
    const onPointerDown = (event: PointerEvent) => {
      start();
      if (event.pointerType === "touch" || event.pointerType === "pen") {
        tapTimer = setTimeout(stop, 500);
      }
    };

    if (reducedMotion) {
      stop();
      return;
    }

    trigger.addEventListener("pointerenter", start);
    trigger.addEventListener("pointerleave", stop);
    trigger.addEventListener("focusin", start);
    trigger.addEventListener("focusout", stop);
    trigger.addEventListener("pointerdown", onPointerDown);
    trigger.addEventListener("pointercancel", stop);

    return () => {
      if (tapTimer) clearTimeout(tapTimer);
      trigger.removeEventListener("pointerenter", start);
      trigger.removeEventListener("pointerleave", stop);
      trigger.removeEventListener("focusin", start);
      trigger.removeEventListener("focusout", stop);
      trigger.removeEventListener("pointerdown", onPointerDown);
      trigger.removeEventListener("pointercancel", stop);
    };
  }, [reducedMotion]);

  return (
    <span
      ref={hostRef}
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center leading-none [&>div]:inline-flex [&>div]:items-center [&>div]:justify-center",
        className,
      )}
      data-pip-animated-icon=""
      data-motion={mounted && reducedMotion ? "reduced" : "full"}
    >
      <Icon ref={iconRef} size={size} animateOnHover={false} />
    </span>
  );
}
