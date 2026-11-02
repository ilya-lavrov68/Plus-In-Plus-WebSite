import {
  DotLattice,
  GridField,
  PixelMosaic,
  SignalBlocks,
} from "@/components/site/brand-geometry";

/**
 * Геометрия публичных маршрутов.
 *
 * Каждая страница получает собственную композицию, а не один и тот же блок
 * орнаментов: где-то сетка работает широкой полосой, где-то узкой колонкой,
 * где-то остаются только линии. Это принципиально — редизайн не должен
 * превращаться в шаблон, наложенный на все экраны одинаково.
 *
 * Все элементы декоративные: aria-hidden, pointer-events-none, нулевой вклад
 * в разметку контента. Родительский контейнер страницы должен быть
 * `relative isolate`, чтобы слой не выходил за границы секции.
 */

/** Каталог услуг: широкая смешанная сетка под шапкой. */
export function ServicesGridBand() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent)]"
    >
      <GridField
        className="absolute inset-0 opacity-70"
        cols={18}
        rows={10}
        blocks={7}
        seed={17}
        tone="mixed"
      />
      <span className="absolute top-24 right-6 hidden h-24 w-24 border border-foreground/10 lg:block" />
    </div>
  );
}

/** Магазин: узкая сетка-поле справа, без заливок под карточками. */
export function ShopSideGrid() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-40 overflow-hidden lg:block"
    >
      <GridField
        className="absolute inset-0 opacity-60"
        cols={4}
        rows={16}
        blocks={3}
        seed={41}
        tone="violet"
      />
      <PixelMosaic
        className="absolute right-0 bottom-0 h-32 w-24 opacity-70"
        cols={8}
        rows={12}
        seed={7}
        corner="bottom-right"
        tone="signal"
      />
    </div>
  );
}

/** Блог: решётка окружностей в правом верхнем углу шапки. */
export function BlogLatticeField() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-24 right-0 -z-10 hidden h-56 w-72 overflow-hidden opacity-80 md:block"
    >
      <DotLattice
        className="absolute inset-0"
        cols={16}
        rows={12}
        seed={29}
        corner="top-right"
        tone="mixed"
      />
    </div>
  );
}

/** Контакт: вертикальная линия сетки и сигнальная линейка слева от формы. */
export function ContactGridColumn() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 -z-10 hidden w-24 overflow-hidden xl:block"
    >
      <GridField
        className="absolute inset-0 opacity-70"
        cols={3}
        rows={12}
        blocks={4}
        seed={13}
        tone="mixed"
        linesOnly={false}
      />
      <SignalBlocks className="absolute top-28 left-6" count={6} tone="signal" />
    </div>
  );
}

/** Авторизация: мозаика в нижнем углу, жёлтая как главный сигнал входа. */
export function AuthMosaicField() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 left-0 -z-10 h-64 w-52 overflow-hidden opacity-70 sm:h-80 sm:w-72"
    >
      <PixelMosaic
        className="absolute inset-0"
        cols={14}
        rows={14}
        seed={31}
        corner="bottom-left"
        tone="signal"
      />
    </div>
  );
}

/** Правовые документы: только линии, чтобы текст оставался главным. */
export function LegalLineBand() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent)]"
    >
      <GridField
        className="absolute inset-0 opacity-60"
        cols={12}
        rows={8}
        seed={3}
        tone="violet"
        linesOnly
      />
    </div>
  );
}

/** Страницы ИИ: плотная крупная сетка с жёлтыми вкраплениями. */
export function AiGridBand() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent)]"
    >
      <GridField
        className="absolute inset-0 opacity-80"
        cols={16}
        rows={9}
        blocks={6}
        seed={53}
        tone="mixed"
      />
    </div>
  );
}

/** История студии: короткая сигнальная линейка вместо декоративной полосы. */
export function StorySignalRule() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-10 right-0 -z-10 hidden items-center gap-2 md:flex"
    >
      <SignalBlocks count={9} tone="violet" />
      <span className="h-px w-24 bg-border" />
      <SignalBlocks count={2} tone="signal" />
    </div>
  );
}
