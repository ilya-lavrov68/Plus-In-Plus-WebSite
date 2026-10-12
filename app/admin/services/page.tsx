import Link from "next/link";
import { PenTool, Plus } from "lucide-react";

import { ServicesTable } from "@/components/admin/services-table";
import { EmptyState } from "@/components/site/empty-state";
import { getAllServices } from "@/lib/admin-data";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const [services, t] = await Promise.all([getAllServices(), getRequestTranslations("admin")]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("services")}</h1>
          <p className="mt-2 text-muted-foreground">{t("servicesSubtitle")}</p>
        </div>
        <Link
          href="/admin/services/new"
          className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors duration-200 ease-out hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:h-4 [&_svg]:w-4"
          aria-label={t("createService")}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t("newService")}
        </Link>
      </div>

      {services.length ? (
        <ServicesTable services={services} />
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={PenTool}
            title={t("noServices")}
            description={t("noServicesHelp")}
          />
        </div>
      )}
    </div>
  );
}
