import Link from "next/link";

import { Button } from "@/components/ui/button";

export function AdminPagination({
  basePath,
  page,
  pageCount,
  navigationLabel,
  previousLabel,
  nextLabel,
  statusLabel,
}: {
  basePath: string;
  page: number;
  pageCount: number;
  navigationLabel: string;
  previousLabel: string;
  nextLabel: string;
  statusLabel: string;
}) {
  if (pageCount <= 1) return null;
  const href = (target: number) => `${basePath}?page=${target}`;

  return (
    <nav className="mt-6 flex items-center justify-between gap-4" aria-label={navigationLabel}>
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href(page - 1)}>{previousLabel}</Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>{previousLabel}</Button>
      )}
      <span className="text-sm text-muted-foreground">{statusLabel}</span>
      {page < pageCount ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href(page + 1)}>{nextLabel}</Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>{nextLabel}</Button>
      )}
    </nav>
  );
}
