import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ManagerNav } from "@/components/manager/manager-nav";
import { BrandMark } from "@/components/site/logo";
import { StaffBreadcrumbs } from "@/components/staff/staff-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { requireStaff } from "@/lib/admin-session";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("metadata");
  return { title: t("manager"), robots: { index: false, follow: false } };
}

/**
 * Рабочее место менеджера: только заявки, в единой палитре Hero 138.
 */
export default async function ManagerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [staff, t] = await Promise.all([
    requireStaff(),
    getRequestTranslations("admin"),
  ]);
  if (!staff) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:gap-8 lg:px-8 lg:py-10">
      <aside className="w-full shrink-0 lg:w-64">
        <div className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-24">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/manager/orders"
              className="inline-flex items-center rounded-md p-1 transition-opacity duration-200 hover:opacity-80 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <BrandMark className="h-7" label="Plus In Plus" />
            </Link>
            <Badge variant="secondary" className="text-[11px] font-medium">
              {staff.isFounder
                ? t("roleFounder")
                : staff.isAdmin
                  ? t("roleAdmin")
                  : t("roleManager")}
            </Badge>
          </div>
          <p className="mt-3 truncate text-xs text-muted-foreground" title={staff.email}>
            {staff.email}
          </p>
          <Separator className="my-4" />
          <ManagerNav canEditSite={staff.isAdmin} />
        </div>
      </aside>
      <section className="min-w-0 flex-1" aria-label={t("content")}>
        <StaffBreadcrumbs />
        {children}
      </section>
    </div>
  );
}
