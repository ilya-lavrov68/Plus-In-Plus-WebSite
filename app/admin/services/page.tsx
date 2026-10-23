import { getRequestTranslations } from "@/lib/server-i18n";

import { AdminServiceTable } from "@/components/admin/service-table";
import { getAllServicesWithActiveOrders } from "@/lib/admin-data";

export default async function AdminServicesPage() {
  const [services, t] = await Promise.all([
    getAllServicesWithActiveOrders(),
    getRequestTranslations("admin"),
  ]);

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
    </div>
  );
}
