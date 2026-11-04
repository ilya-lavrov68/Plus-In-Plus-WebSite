"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, GripVertical, RotateCcw, Search } from "lucide-react";

import { adminInputClass } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export interface DataTableRow {
  id: string;
  order: string;
  customer: string;
  email: string;
  status: string;
  statusLabel: string;
  /** Сумма уже отформатирована на сервере: клиент не знает локаль запроса. */
  total: string;
  date: string;
}

export type DataTableColumnKey = "order" | "customer" | "status" | "total" | "date";

export interface DataTableLabels {
  title: string;
  description: string;
  tabs: { all: string; queued: string; done: string };
  search: string;
  columns: string;
  selected: string;
  empty: string;
  drag: string;
  prev: string;
  next: string;
  page: string;
  of: string;
  rows: string;
  reset: string;
  open: string;
  statusFilter: string;
  columnLabels: Record<DataTableColumnKey, string>;
}

const COLUMNS: DataTableColumnKey[] = ["order", "customer", "status", "total", "date"];
const PAGE_SIZE = 8;
const FINISHED = new Set(["completed", "cancelled", "refunded"]);

type SortState = { key: DataTableColumnKey; direction: "asc" | "desc" } | null;

/**
 * Таблица заказов в духе `dashboard-01`: фильтр по статусу табами, поиск,
 * сортировка по столбцам, выбор строк, скрытие столбцов, пагинация и
 * перестановка строк перетаскиванием. Всё состояние живёт на клиенте —
 * сервер отдаёт готовый срез последних заказов.
 */
export function DataTable({ rows, labels, moneyColumnHint }: { rows: DataTableRow[]; labels: DataTableLabels; moneyColumnHint: string }) {
  const [tab, setTab] = React.useState<"all" | "queued" | "done">("all");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortState>({ key: "date", direction: "desc" });
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [hidden, setHidden] = React.useState<ReadonlySet<DataTableColumnKey>>(new Set());
  const [order, setOrder] = React.useState<string[] | null>(null);
  const [page, setPage] = React.useState(0);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = React.useState(false);
  const columnsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!columnsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!columnsRef.current?.contains(event.target as Node)) setColumnsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setColumnsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [columnsOpen]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const byTab = rows.filter((row) => {
      if (tab === "all") return true;
      const finished = FINISHED.has(row.status);
      return tab === "done" ? finished : !finished;
    });
    if (!needle) return byTab;
    return byTab.filter((row) =>
      [row.order, row.customer, row.email, row.statusLabel].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [rows, tab, query]);

  const sorted = React.useMemo(() => {
    const byOrder = order ? [...order] : null;
    const base = [...filtered];

    if (byOrder) {
      const rank = new Map(byOrder.map((id, index) => [id, index]));
      base.sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
      return base;
    }

    if (!sort) return base;
    const factor = sort.direction === "asc" ? 1 : -1;
    base.sort((a, b) => {
      if (sort.key === "total") {
        const left = Number(a.total.replace(/[^\d.-]/g, "")) || 0;
        const right = Number(b.total.replace(/[^\d.-]/g, "")) || 0;
        return (left - right) * factor;
      }
      return a[sort.key].localeCompare(b[sort.key], "ru") * factor;
    });
    return base;
  }, [filtered, sort, order]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const visibleColumnCount = COLUMNS.filter((column) => !hidden.has(column)).length + 2;
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selected.has(row.id));

  const toggleSort = (key: DataTableColumnKey) => {
    setOrder(null);
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const toggleRow = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleRows.forEach((row) => next.delete(row.id));
      else visibleRows.forEach((row) => next.add(row.id));
      return next;
    });
  };

  const toggleColumn = (key: DataTableColumnKey) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else if (next.size < COLUMNS.length - 1) next.add(key);
      return next;
    });
  };

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const base = order ?? sorted.map((row) => row.id);
    const from = base.indexOf(draggingId);
    const to = base.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const next = [...base];
    next.splice(from, 1);
    next.splice(to, 0, draggingId);
    setOrder(next);
    setSort(null);
    setDraggingId(null);
  };

  const tabs: { key: "all" | "queued" | "done"; label: string; count: number }[] = [
    { key: "all", label: labels.tabs.all, count: rows.length },
    { key: "queued", label: labels.tabs.queued, count: rows.filter((row) => !FINISHED.has(row.status)).length },
    { key: "done", label: labels.tabs.done, count: rows.filter((row) => FINISHED.has(row.status)).length },
  ];

  return (
    <section aria-label={labels.title} className="flex flex-col gap-4 rounded-2xl bg-surface-container-low p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-medium text-on-surface">{labels.title}</h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-on-surface-variant">{labels.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {order ? (
            <button
              type="button"
              onClick={() => {
                setOrder(null);
                setSort({ key: "date", direction: "desc" });
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs text-on-surface-variant transition-colors duration-200 hover:bg-on-surface/8 hover:text-on-surface focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {labels.reset}
            </button>
          ) : null}
          <div ref={columnsRef} className="relative">
            <button
              type="button"
              aria-expanded={columnsOpen}
              aria-haspopup="menu"
              onClick={() => setColumnsOpen((value) => !value)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 text-xs text-on-surface transition-colors duration-200 hover:bg-surface-container-highest focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Columns3 className="size-3.5" aria-hidden="true" />
              {labels.columns}
            </button>
            {columnsOpen ? (
              <div
                role="menu"
                aria-label={labels.columns}
                className="absolute top-[calc(100%+0.375rem)] right-0 z-40 w-56 rounded-xl bg-popover/85 p-1.5 text-popover-foreground backdrop-blur-2xl"
              >
                {COLUMNS.map((column) => (
                  <label
                    key={column}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-on-surface-variant transition-colors duration-200 hover:bg-on-surface/8 hover:text-on-surface"
                  >
                    <input
                      type="checkbox"
                      checked={!hidden.has(column)}
                      onChange={() => toggleColumn(column)}
                      className="size-4 accent-[var(--md-primary)]"
                    />
                    {labels.columnLabels[column]}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={labels.statusFilter} className="inline-flex items-center gap-1 rounded-lg bg-surface-container p-1">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={tab === item.key}
              onClick={() => {
                setTab(item.key);
                setPage(0);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200",
                "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                tab === item.key
                  ? "bg-surface-container-highest text-on-surface"
                  : "text-on-surface-variant hover:bg-on-surface/8 hover:text-on-surface",
              )}
            >
              {item.label}
              <span className="text-on-surface-variant tabular-nums">{item.count}</span>
            </button>
          ))}
        </div>
        <label className="relative ml-auto flex min-w-52 flex-1 items-center sm:max-w-72">
          <Search className="pointer-events-none absolute left-3 size-4 text-on-surface-variant" aria-hidden="true" />
          <span className="sr-only">{labels.search}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder={labels.search}
            className={cn(adminInputClass, "h-9 pl-9 text-xs")}
          />
        </label>
      </div>

      {selected.size > 0 ? (
        <p className="text-xs text-on-surface-variant">
          {selected.size} {labels.selected}
        </p>
      ) : null}

      <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        <table className="w-full min-w-[46rem] text-sm">
          <caption className="sr-only">{labels.title}</caption>
          <thead>
            <tr className="text-left text-[11px] font-medium tracking-[0.12em] text-on-surface-variant uppercase">
              <th scope="col" className="w-8 pb-2 pl-1">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label={labels.selected}
                  className="size-4 accent-[var(--md-primary)]"
                />
              </th>
              {!hidden.has("order") ? (
                <th scope="col" className="pb-2" aria-sort={sort?.key === "order" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <SortButton label={labels.columnLabels.order} active={sort?.key === "order"} direction={sort?.key === "order" ? sort.direction : null} onClick={() => toggleSort("order")} />
                </th>
              ) : null}
              {!hidden.has("customer") ? (
                <th scope="col" className="pb-2" aria-sort={sort?.key === "customer" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <SortButton label={labels.columnLabels.customer} active={sort?.key === "customer"} direction={sort?.key === "customer" ? sort.direction : null} onClick={() => toggleSort("customer")} />
                </th>
              ) : null}
              {!hidden.has("status") ? (
                <th scope="col" className="pb-2" aria-sort={sort?.key === "status" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <SortButton label={labels.columnLabels.status} active={sort?.key === "status"} direction={sort?.key === "status" ? sort.direction : null} onClick={() => toggleSort("status")} />
                </th>
              ) : null}
              {!hidden.has("total") ? (
                <th scope="col" className="pb-2 text-right" aria-sort={sort?.key === "total" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <span className="inline-flex justify-end">
                    <SortButton label={labels.columnLabels.total} active={sort?.key === "total"} direction={sort?.key === "total" ? sort.direction : null} onClick={() => toggleSort("total")} />
                  </span>
                </th>
              ) : null}
              {!hidden.has("date") ? (
                <th scope="col" className="pb-2 text-right" aria-sort={sort?.key === "date" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <span className="inline-flex justify-end">
                    <SortButton label={labels.columnLabels.date} active={sort?.key === "date"} direction={sort?.key === "date" ? sort.direction : null} onClick={() => toggleSort("date")} />
                  </span>
                </th>
              ) : null}
              <th scope="col" className="w-16 pb-2">
                <span className="sr-only">{labels.open}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnCount} className="py-8 text-center text-sm text-on-surface-variant">
                  {labels.empty}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={row.id}
                  draggable
                  onDragStart={() => setDraggingId(row.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(row.id)}
                  data-selected={selected.has(row.id)}
                  className={cn(
                    "align-middle transition-colors duration-200 data-[selected=true]:bg-surface-container",
                    draggingId === row.id ? "opacity-50" : "hover:bg-surface-container/70",
                  )}
                >
                  <td className="py-2.5 pl-1">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                      aria-label={`${labels.selected}: ${row.order}`}
                      className="size-4 accent-[var(--md-primary)]"
                    />
                  </td>
                  {!hidden.has("order") ? (
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-1.5">
                        <GripVertical className="size-3.5 cursor-grab text-on-surface-variant/60" aria-hidden="true" />
                        <span className="font-medium text-on-surface tabular-nums" title={labels.drag}>
                          #{row.order}
                        </span>
                      </span>
                    </td>
                  ) : null}
                  {!hidden.has("customer") ? (
                    <td className="max-w-[16rem] truncate py-2.5 pr-3 text-on-surface" title={row.email || row.customer}>
                      {row.customer || row.email || "—"}
                    </td>
                  ) : null}
                  {!hidden.has("status") ? (
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex rounded-full bg-surface-container-high px-2.5 py-1 text-[11px] text-on-surface-variant">
                        {row.statusLabel}
                      </span>
                    </td>
                  ) : null}
                  {!hidden.has("total") ? (
                    <td className="py-2.5 pr-3 text-right text-on-surface tabular-nums" title={moneyColumnHint}>
                      {row.total}
                    </td>
                  ) : null}
                  {!hidden.has("date") ? (
                    <td className="py-2.5 pr-3 text-right text-xs text-on-surface-variant tabular-nums">{row.date}</td>
                  ) : null}
                  <td className="py-2.5 text-right">
                    <Link
                      href={`/admin/orders?order=${encodeURIComponent(row.id)}`}
                      className="rounded-md px-1.5 py-1 text-xs text-on-surface-variant transition-colors duration-200 hover:bg-on-surface/8 hover:text-on-surface focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {labels.open}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-on-surface-variant">
        <p>
          {labels.page} {safePage + 1} {labels.of} {pageCount} · {sorted.length} {labels.rows}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            disabled={safePage === 0}
            className="inline-flex h-8 items-center rounded-lg px-2.5 transition-colors duration-200 hover:bg-on-surface/8 hover:text-on-surface focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40"
          >
            {labels.prev}
          </button>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            disabled={safePage >= pageCount - 1}
            className="inline-flex h-8 items-center rounded-lg px-2.5 transition-colors duration-200 hover:bg-on-surface/8 hover:text-on-surface focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40"
          >
            {labels.next}
          </button>
        </div>
      </div>
    </section>
  );
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc" | null;
  onClick: () => void;
}) {
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1 py-1 tracking-[0.12em] uppercase transition-colors duration-200 hover:text-on-surface focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        active ? "text-on-surface" : "text-on-surface-variant",
      )}
    >
      {label}
      <Icon className="size-3" aria-hidden="true" />
    </button>
  );
}
