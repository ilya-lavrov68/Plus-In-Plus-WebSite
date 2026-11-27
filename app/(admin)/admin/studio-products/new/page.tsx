import { redirect } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import { StudioProductForm } from "@/components/admin/studio-product-form";
import { AdminPageHeader, AdminStatus } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";

import { createStudioProductAction } from "../actions";

export default async function NewStudioProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff?.isAdmin) redirect("/admin/studio-products");

  const [query, locale] = await Promise.all([searchParams, getRequestLocale()]);
  const t = adminLabels(locale);
  const error = typeof query.error === "string" && query.error ? query.error : null;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <AdminPageHeader
        back={{ href: "/admin/studio-products", label: t.studioProducts.title }}
        title={t.studioProduct.create}
        description={t.studioProducts.subtitle}
      />

      {error ? <AdminStatus tone="error">{error}</AdminStatus> : null}

      <StudioProductForm t={t} action={createStudioProductAction} />
    </div>
  );
}
