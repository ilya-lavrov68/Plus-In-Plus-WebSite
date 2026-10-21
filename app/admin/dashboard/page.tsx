import Link from "next/link";
import { ArrowRight, BookOpen, ExternalLink, Image as ImageIcon, Plus, Settings, Users, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminStats, getFeaturedCandidates, getRecentActivity } from "@/lib/admin-data";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [stats, activity, featuredPosts, t] = await Promise.all([
    getAdminStats(),
    getRecentActivity(),
    getFeaturedCandidates(),
    getRequestTranslations("admin"),
  ]);
  const cards = [
    { title: t("services"), icon: ImageIcon, value: stats.services, detail: t("postsCount", { count: stats.publishedServices }), href: "/admin/services" },
    { title: t("blogPosts"), icon: BookOpen, value: stats.posts, detail: t("postsCount", { count: stats.publishedPosts }), href: "/admin/blog" },
    { title: t("users"), icon: Users, value: stats.users, detail: t("adminsCount", { count: stats.admins }), href: "/admin/users" },
    { title: t("views7d"), icon: Eye, value: stats.views7d, detail: t("views30d", { count: stats.views30d }), href: "/admin/analytics" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{t("dashboard")}</h1>
      <p className="mt-2 text-muted-foreground">{t("dashboardSubtitle")}</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, icon: Icon, value, detail, href }) => (
          <Link key={title} href={href} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors duration-200 ease-out group-hover:border-foreground/25 group-hover:bg-white/[0.04]">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground transition-colors duration-200 group-hover:text-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                  {t("manage")}
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/admin/services/new">
            <Plus className="h-4 w-4" />
            {t("createServiceButton")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/blog/new">
            <Plus className="h-4 w-4" />
            {t("createPostButton")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/" target="_blank">
            <ExternalLink className="h-4 w-4" />
            {t("viewSite")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/settings">
            <Settings className="h-4 w-4" />
            {t("settings")}
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("activityLast7Days")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("activitySubtitle")}</p>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-2 sm:gap-4">
              {stats.activityByDay.map((day) => {
                const max = Math.max(1, ...stats.activityByDay.map((item) => item.value));
                return (
                  <div key={day.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="flex h-32 w-full items-end rounded-lg bg-muted/50">
                      <div
                        className="w-full rounded-lg bg-primary transition-[height] duration-200 ease-out"
                        style={{ height: `${Math.max(6, (day.value / max) * 100)}%` }}
                        title={t("viewsTitle", { count: day.value })}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{day.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("featuredPost")}</CardTitle>
          </CardHeader>
          <CardContent>
            {featuredPosts[0] ? (
              <div>
                <p className="font-medium">{featuredPosts[0].title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {featuredPosts[0].isFeatured ? t("selectedFeaturedPost") : t("fallbackLatestPost")}
                </p>
                <Link
                  href="/admin/settings"
                  className="mt-4 inline-flex text-sm font-medium underline-offset-4 hover:underline"
                >
                  {t("changeFeaturedPost")}
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noPublishedPosts")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">{t("recentActivity")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("recentActivitySubtitle")}</p>
        </CardHeader>
        <CardContent>
          {activity.length ? (
            <ol className="divide-y divide-border">
              {activity.map((entry) => (
                <li key={entry.id} className="flex flex-col justify-between gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:gap-6">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">
                      <span className="capitalize">{entry.action}</span>
                      {entry.entityType !== "user" ? ` ${entry.entityType}` : ""}: {entry.title}
                    </p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {entry.actor?.email ?? t("deletedAccount")}
                    </p>
                  </div>
                  <time dateTime={entry.createdAt.toISOString()} className="shrink-0 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(entry.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">{t("noActivity")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
