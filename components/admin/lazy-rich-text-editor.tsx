"use client";

import dynamic from "next/dynamic";

/**
 * Редактор грузится отдельной порцией.
 *
 * Tiptap вместе с StarterKit весит около 170 кБ — это больше всей остальной
 * формы поста. Подключать его сразу значит заставлять ждать каждого, кто
 * открыл пост, даже чтобы просто поправить заголовок.
 *
 * Редактор всё равно работает только в браузере, поэтому серверный рендер
 * ему не нужен. Пока он едет, показываем заглушку той же высоты, чтобы
 * страница не дёргалась.
 */
export const LazyRichTextEditor = dynamic(
  () => import("@/components/admin/rich-text-editor").then((module) => module.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-label="Загрузка редактора"
        className="min-h-[18rem] w-full animate-pulse rounded-md border border-input bg-muted/40"
      />
    ),
  },
);
