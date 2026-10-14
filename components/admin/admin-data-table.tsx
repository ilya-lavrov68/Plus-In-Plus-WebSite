"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import { AdminTableSkeleton } from "@/components/admin/admin-skeletons";
import type { DataTableProps } from "@/components/spectrumui/data-table";

/**
 * Admin wrapper around Spectrum UI's DataTable.
 *
 * Spectrum's DataTable is the single heaviest component in the admin panel —
 * it pulls in `motion` for row reordering, the bulk bar and the sort carets.
 * Loading it on demand keeps that out of First Load JS (measured on
 * /admin/services: 174 kB static vs 222 kB without the lazy boundary), and the
 * panel already has `AdminTableSkeleton` for exactly this purpose.
 *
 * The cast restores the generic that `next/dynamic` erases; the component
 * itself is unchanged.
 */
const SpectrumDataTable = dynamic(
  () => import("@/components/spectrumui/data-table").then((m) => m.DataTable),
  { ssr: false, loading: () => <AdminTableSkeleton /> }
) as ComponentType<DataTableProps<unknown>>;

export function AdminDataTable<T>(props: DataTableProps<T>) {
  return <SpectrumDataTable {...(props as unknown as DataTableProps<unknown>)} />;
}

export type {
  DataTableColumn,
  DataTableSelectionContext,
  DataTableSort,
} from "@/components/spectrumui/data-table";
