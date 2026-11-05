"use client";

import { SessionProvider } from "next-auth/react";

import { PageViewTracker } from "@/components/site/page-view-tracker";
import { ScrollExperience } from "@/components/site/motion/scroll-experience";
import { SessionRefresh } from "@/components/site/session-refresh";
import { Toaster } from "@/components/ui/toast";

/**
 * Корневые клиентские провайдеры.
 *
 * Здесь намеренно нет `MotionConfig`: он тянул `motion/react` (~130 КБ) в общий
 * bundle каждой страницы. Политика анимаций живёт в `MotionPreference` рядом с
 * самими анимированными блоками.
 *
 * `SessionProvider` не опрашивает `/api/auth/session` по таймеру: токен доступа
 * (15 минут) обновляет `SessionRefresh`, сессия перепроверяется при возврате
 * фокуса на вкладку, а лишний запрос каждые 5 минут только грел сеть.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus refetchInterval={0} refetchWhenOffline={false}>
      <ScrollExperience />
      <PageViewTracker />
      <SessionRefresh />
      {children}
      <Toaster />
    </SessionProvider>
  );
}
