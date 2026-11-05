"use client";

import * as React from "react";

/**
 * Общее поведение выпадающих панелей: меню открывается наведением и по клику.
 *
 * Пользователь не должен угадывать, что пункт со стрелкой раскрывается только
 * нажатием: указатель уже на нём — значит меню пора показать. Небольшая
 * задержка закрытия нужна, чтобы панель не захлопывалась по пути к её
 * содержимому, а клавиатура и клик продолжают работать как обычно.
 */
export function useHoverMenu({
  openDelay = 0,
  closeDelay = 160,
}: { openDelay?: number; closeDelay?: number } = {}) {
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = React.useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const openNow = React.useCallback(() => {
    clear();
    if (openDelay <= 0) {
      setOpen(true);
      return;
    }
    timer.current = setTimeout(() => {
      setOpen(true);
      timer.current = null;
    }, openDelay);
  }, [clear, openDelay]);

  const closeLater = React.useCallback(() => {
    clear();
    timer.current = setTimeout(() => {
      setOpen(false);
      timer.current = null;
    }, closeDelay);
  }, [clear, closeDelay]);

  const closeNow = React.useCallback(() => {
    clear();
    setOpen(false);
  }, [clear]);

  React.useEffect(() => clear, [clear]);

  return {
    open,
    setOpen,
    closeNow,
    /** Пропсы контейнера панели: и триггер, и меню живут внутри него. */
    hoverProps: { onPointerEnter: openNow, onPointerLeave: closeLater },
  };
}
