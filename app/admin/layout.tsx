import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { StaffBreadcrumbs } from "@/components/staff/staff-breadcrumbs";
import { Separator } from "@/components/ui/separator";
import { requireAdmin } from "@/lib/admin-session";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("metadata");
  return { title: t("admin"), robots: { index: false, follow: false } };
}

/**
 * Admin shell: sidebar (Dashboard, Services, Blog, Users) + content.
 * The session and ADMIN role are verified both in middleware.ts and here.
 */
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [admin, t] = await Promise.all([requireAdmin(), getRequestTranslations("admin")]);
  if (!admin) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col gap-0 px-4 py-10 sm:px-8 lg:flex-row lg:gap-10">
      <aside className="w-full shrink-0 lg:w-60">
        <div className="lg:sticky lg:top-24">
          <Link
            href="/admin/dashboard"
            className="inline-block rounded-sm text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("brand")}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">{admin.email}</p>
          <Separator className="my-5" />
          <AdminNav />
        </div>
      </aside>
      <section className="min-w-0 flex-1" aria-label={t("content")}>
        <StaffBreadcrumbs />
        {children}
      </section>
    </div>
  );
}
