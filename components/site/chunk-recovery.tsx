"use client";

import { useEffect } from "react";

const STORAGE_KEY = "pip-asset-reload-at";
/** Больше одного перезапуска за полминуты не делаем: иначе ошибка зациклится. */
const COOLDOWN_MS = 30_000;
/**
 * Признаки «клиент отстал от сервера»: чанк не загрузился, dynamic import не
 * разрешился или dev-сервер отдал внутреннюю ошибку Turbopack. Во всех случаях
 * страница собрана прошлой сборкой, и лечится это полной перезагрузкой.
 */
const PATTERN =
  /ChunkLoadError|Loading chunk [\w./-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|unexpected Turbopack error/i;

/**
 * Самовосстановление после перезапуска сервера.
 *
 * Dev-сервер и деплой меняют имена чанков: открытая вкладка продолжает
 * ссылаться на файлы прошлой сборки, получает 404 и показывает ошибку вместо
 * страницы. Компонент слушает такие сбои и один раз перезагружает документ —
 * пользователь видит рабочий сайт вместо экрана ошибки. Ничего не рендерит.
 */
export function ChunkRecovery() {
  useEffect(() => {
    const recover = (message: string) => {
      if (!PATTERN.test(message)) return;
      let last = 0;
      try {
        last = Number(window.sessionStorage.getItem(STORAGE_KEY) ?? "0");
      } catch {
        // Приватный режим без storage: перезагрузка всё равно безопаснее ошибки.
      }
      if (Number.isFinite(last) && Date.now() - last < COOLDOWN_MS) return;
      try {
        window.sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        // Ничего не делаем: без storage защита от цикла просто слабее.
      }
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      const name = event.error instanceof Error ? event.error.name : "";
      recover(`${name} ${event.message ?? ""}`);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string } | undefined;
      recover(`${reason?.name ?? ""} ${reason?.message ?? ""}`);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
