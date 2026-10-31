import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-session";

import { ServiceForm } from "@/components/admin/service-form";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export default async function NewServicePage() {
  const [admin, t] = await Promise.all([requireAdmin(), getRequestTranslations("admin")]);
  if (!admin) redirect("/");
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{t("newService")}</h1>
      <p className="mt-2 text-muted-foreground">{t("form.newServiceSubtitle")}</p>
      <div className="mt-8">
        <ServiceForm mode="create" />
      </div>
    </div>
  );
}
