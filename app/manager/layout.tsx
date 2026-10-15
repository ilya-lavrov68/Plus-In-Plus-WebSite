import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StaffBreadcrumbs } from "@/components/staff/staff-breadcrumbs";
import { ManagerNav } from "@/components/manager/manager-nav";
import { Separator } from "@/components/ui/separator";
import { requireStaff } from "@/lib/admin-session";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("metadata");
  return { title: t("manager"), robots: { index: false, follow: false } };
}

/**
 * Рабочее место менеджера: только заявки.
 *
 * Сюда пускают и администратора — он может работать с заявками, не покидая
 * привычного вида. Управление сайтом остаётся в /admin.
 */
export default async function ManagerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [staff, t] = await Promise.all([requireStaff(), getRequestTranslations("admin")]);
  if (!staff) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col gap-0 px-4 py-10 sm:px-8 lg:flex-row lg:gap-10">
      <aside className="w-full shrink-0 lg:w-60">
        <div className="lg:sticky lg:top-24">
          <Link
            href="/manager/orders"
            className="inline-block rounded-sm text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("managerBrand")}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">{staff.email}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {staff.isAdmin ? t("roleAdmin") : t("roleManager")}
          </p>
          <Separator className="my-5" />
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
