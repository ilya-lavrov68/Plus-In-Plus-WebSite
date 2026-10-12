import { notFound } from "next/navigation";

import { ServiceForm } from "@/components/admin/service-form";
import { getAdminService } from "@/lib/admin-data";
import { parseJsonArray } from "@/lib/db-helpers";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [service, t] = await Promise.all([getAdminService(id), getRequestTranslations("admin")]);
  if (!service) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{t("editService")}</h1>
      <p className="mt-2 text-muted-foreground">{t("form.editServiceSubtitle")}</p>
      <div className="mt-8">
        <ServiceForm
          mode="edit"
          serviceId={service.id}
          initial={{
            title: service.title,
            slug: service.slug,
            category: service.category,
            shortDesc: service.shortDesc,
            fullDesc: service.fullDesc,
            // JSON-encoded in SQLite; the helper tolerates legacy array values too.
            includes: parseJsonArray(service.includes),
            shapes: parseJsonArray(service.shapes),
            resultText: service.resultText,
            coverImage: service.coverImage,
            isPublished: service.isPublished,
          }}
        />
      </div>
    </div>
  );
}
