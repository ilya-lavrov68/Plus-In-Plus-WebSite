import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminServiceTable } from "@/components/admin/service-table";
import { getAdminServiceCount, getAllServicesWithActiveOrders } from "@/lib/admin-data";
import { clampPage, totalPages } from "@/lib/pagination";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

interface AdminServicesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminServicesPage({ searchParams }: AdminServicesPageProps) {
  const [query, total, t] = await Promise.all([
    searchParams,
    getAdminServiceCount(),
    getRequestTranslations("admin"),
  ]);
  const page = clampPage(query.page, total);
  const services = await getAllServicesWithActiveOrders(page);
  const pageCount = totalPages(total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("services")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("servicesSubtitle")}
        </p>
      </div>
      <AdminServiceTable services={services} />
      <AdminPagination
        basePath="/admin/services"
        page={page}
        pageCount={pageCount}
        navigationLabel={t("pagination")}
        previousLabel={t("previousPage")}
        nextLabel={t("nextPage")}
        statusLabel={t("pageStatus", { page, pageCount })}
      />
    </div>
  );
}
