export const ADMIN_PAGE_SIZE = 50;

export function normalizePage(value: unknown): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = typeof candidate === "number" ? candidate : Number(candidate ?? 1);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function totalPages(total: number, pageSize = ADMIN_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

export function clampPage(requested: unknown, total: number, pageSize = ADMIN_PAGE_SIZE): number {
  return Math.min(normalizePage(requested), totalPages(total, pageSize));
}

export function paginationOffset(page: number, pageSize = ADMIN_PAGE_SIZE): number {
  return (normalizePage(page) - 1) * pageSize;
}
