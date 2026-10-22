"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { bulkUpdateServices, duplicateService } from "@/app/actions/services";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { InlinePriceEditor } from "@/components/admin/inline-price-editor";
import { InlinePriceType } from "@/components/admin/inline-price-type";
import type { DataTableColumn } from "@/components/spectrumui/data-table";
import { SafeImage } from "@/components/site/safe-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AdminServiceRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  isPublished: boolean;
  coverImage: string;
  updatedAt: Date;
  /** Копейки. */
  basePrice: number;
  priceType: string;
  isOrderable: boolean;
}

export function ServicesTable({ services }: { services: AdminServiceRow[] }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [category, setCategory] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Status is handled by the table's quick-filter pills, so only the category
  // dimension is filtered here.
  const rows = useMemo(
    () =>
      category === "all"
        ? services
        : services.filter((service) => service.category === category),
    [services, category]
  );

  const runBulk = async (action: "publish" | "unpublish" | "delete", clear: () => void) => {
    if (!selected.length || pending) return;
    if (action === "delete" && !window.confirm(t("confirmDeleteServices", { count: selected.length }))) return;
    setPending(true);
    setMessage(null);
    const result = await bulkUpdateServices(selected, action);
    setPending(false);
    if (!result.ok) {
      setMessage(result.error ?? t("actionFailed"));
      return;
    }
    setSelected([]);
    clear();
    setMessage(action === "delete" ? t("servicesDeleted") : t("servicesUpdated"));
    window.location.reload();
  };

  const duplicate = async (id: string) => {
    setPending(true);
    setMessage(null);
    const result = await duplicateService(id);
    setPending(false);
    setMessage(result.ok ? t("serviceDuplicated") : result.error ?? t("duplicateFailed"));
    if (result.ok) window.location.reload();
  };

  const columns: DataTableColumn<AdminServiceRow>[] = [
    {
      id: "title",
      header: t("service"),
      sortable: true,
      cell: (service) => (
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-14 overflow-hidden rounded-md bg-muted">
            <SafeImage src={service.coverImage} alt="" fill sizes="56px" className="object-contain" />
          </div>
          <span className="font-medium">{service.title}</span>
        </div>
      ),
    },
    {
      id: "basePrice",
      header: t("price"),
      sortable: true,
      numeric: true,
      cell: (service) => (
        <InlinePriceEditor
          serviceId={service.id}
          serviceTitle={service.title}
          basePrice={service.basePrice}
          emptyLabel={t("noPrice")}
        />
      ),
    },
    {
      id: "priceType",
      header: t("priceType"),
      sortable: true,
      cell: (service) => (
        <InlinePriceType
          serviceId={service.id}
          priceType={service.priceType}
          isOrderable={service.isOrderable}
        />
      ),
    },
    {
      id: "category",
      header: tc("category"),
      sortable: true,
      cell: (service) => <Badge variant="secondary">{service.category}</Badge>,
    },
    {
      id: "status",
      header: tc("status"),
      sortable: true,
      value: (service) => (service.isPublished ? "Published" : "Draft"),
      cell: (service) => (
        <Badge variant={service.isPublished ? "default" : "outline"}>
          {service.isPublished ? t("published") : t("draft")}
        </Badge>
      ),
    },
    {
      id: "updatedAt",
      header: t("updated"),
      sortable: true,
      value: (service) => service.updatedAt,
      cell: (service) => (
        <span className="text-muted-foreground">
          {new Date(service.updatedAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
  ];

  return (
    <div className="mt-8 space-y-4">
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      <AdminDataTable
        data={rows}
        columns={columns}
        rowId={(service) => service.id}
        rowLabel={(service) => service.title}
        variant="bordered"
        searchable
        searchPlaceholder={t("searchTitleOrSlug")}
        searchText={(service) => `${service.title} ${service.slug}`}
        quickFilter={{
          columnId: "status",
          label: tc("status"),
          allLabel: t("allStatuses"),
          options: [
            { value: "Published", label: t("published") },
            { value: "Draft", label: t("draft") },
          ],
        }}
        defaultSort={{ columnId: "updatedAt", direction: "desc" }}
        selectable
        selectedIds={selected}
        onSelectedChange={setSelected}
        bulkActions={({ clear }) => (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => runBulk("publish", clear)}
              disabled={pending}
            >
              {t("publish")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => runBulk("unpublish", clear)}
              disabled={pending}
            >
              {t("unpublish")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => runBulk("delete", clear)}
              disabled={pending}
              className="border-red-500/35 bg-red-500/10 text-red-300 hover:border-red-400/50 hover:bg-red-500/20"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {tc("delete")}
            </Button>
          </>
        )}
        rowActions={(service) => (
          <div className="flex items-center gap-1">
            <Link
              href={`/admin/services/${service.id}`}
              className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              {tc("edit")}
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => duplicate(service.id)}
              disabled={pending}
              title={tc("duplicate")}
            >
              <Copy className="h-4 w-4" />
            </Button>
            {service.isPublished ? (
              <Link
                href={`/shop/${service.slug}`}
                target="_blank"
                className="inline-flex items-center rounded-md p-2 hover:bg-accent"
                title={tc("preview")}
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        )}
        pageSize={pageSize}
        emptyState={
          <p className="p-8 text-center text-sm text-muted-foreground">{t("noServicesMatch")}</p>
        }
        toolbar={
          <div className="flex items-center gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="min-w-40">
                <SelectValue placeholder={t("allCategories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCategories")}</SelectItem>
                <SelectItem value="small">{t("form.smallDesign")}</SelectItem>
                <SelectItem value="large">{t("form.largeDesign")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger className="min-w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {t("rowsPerPage", { count: size })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
}
