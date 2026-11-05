"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Последний рубеж на случай ошибки в коренном layout (`app/(site)/layout.tsx`).
 *
 * Соседний `app/(site)/error.tsx` ловит ошибки только дочерних сегментов: если
 * падает сам layout — провайдеры, шапка, загрузка сообщений локали — Next
 * показывает служебную страницу «Application error: a server-side exception»
 * без навигации, без объяснения и без кода ошибки. Со стороны это выглядит так,
 * будто сайт выключился.
 *
 * Здесь нельзя опираться ни на провайдеры, ни на next-intl, ни на Tailwind из
 * корневого layout: этот компонент подменяет документ целиком. Поэтому стили
 * инлайновые, тексты двуязычные (RU + EN), а рядом с сообщением выводится
 * digest — короткий код, по которому ошибку можно найти в логах сервера.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  const isDevelopment = process.env.NODE_ENV !== "production";

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0c",
          color: "#f4f4f5",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          padding: "24px",
        }}
      >
        <main style={{ width: "100%", maxWidth: "34rem", textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.02em" }}>
            Сайт временно недоступен
          </h1>
          <p style={{ margin: "0.5rem 0 0", fontSize: "1rem", color: "#f4f4f5" }}>
            The site is temporarily unavailable
          </p>
          <p
            style={{
              margin: "1.25rem 0 0",
              fontSize: "0.9375rem",
              lineHeight: 1.6,
              color: "#a1a1aa",
            }}
          >
            Мы записали ошибку в журнал. Обновите страницу — если не помогло, напишите нам код
            ошибки ниже.
            <br />
            We logged this error. Reload the page — if that does not help, send us the error code
            below.
          </p>

          {error.digest ? (
            <p
              style={{
                margin: "1rem 0 0",
                fontSize: "0.8125rem",
                color: "#a1a1aa",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              Код ошибки / Error code: {error.digest}
            </p>
          ) : null}

          {isDevelopment && error.message ? (
            <p
              style={{
                margin: "1rem 0 0",
                fontSize: "0.8125rem",
                lineHeight: 1.5,
                color: "#a1a1aa",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                overflowWrap: "anywhere",
              }}
            >
              {error.message}
            </p>
          ) : null}

          <div
            style={{
              marginTop: "2rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                cursor: "pointer",
                padding: "0.75rem 1.5rem",
                borderRadius: "0.5rem",
                fontSize: "0.9375rem",
                fontWeight: 500,
                background: "#f4f4f5",
                color: "#18181b",
                outlineOffset: "2px",
              }}
            >
              Обновить / Reload
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                cursor: "pointer",
                padding: "0.75rem 1.5rem",
                borderRadius: "0.5rem",
                fontSize: "0.9375rem",
                fontWeight: 500,
                background: "transparent",
                color: "#f4f4f5",
                outlineOffset: "2px",
              }}
            >
              Повторить / Try again
            </button>
          </div>

          <p style={{ margin: "2rem 0 0" }}>
            <Link href="/" style={{ color: "#f4f4f5", fontSize: "0.9375rem" }}>
              На главную / Home
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
