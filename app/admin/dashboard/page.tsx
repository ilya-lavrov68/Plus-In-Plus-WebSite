import Link from "next/link";
import { ArrowRight, BookOpen, Image as ImageIcon, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminStats, getRecentActivity } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [stats, activity] = await Promise.all([getAdminStats(), getRecentActivity()]);
  const cards = [
    { title: "Services", icon: ImageIcon, value: stats.services, detail: `${stats.publishedServices} published`, href: "/admin/services" },
    { title: "Blog posts", icon: BookOpen, value: stats.posts, detail: `${stats.publishedPosts} published`, href: "/admin/blog" },
    { title: "Users", icon: Users, value: stats.users, detail: `${stats.admins} admin(s)`, href: "/admin/users" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Overview of the Plus In Plus content and users.</p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ title, icon: Icon, value, detail, href }) => (
          <Link key={title} href={href} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors duration-200 ease-out hover:bg-accent">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">{title}</CardTitle>
                <Icon aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tracking-tight">{value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
                <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium">Manage<ArrowRight aria-hidden="true" className="h-4 w-4" /></p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Recent activity</CardTitle>
          <p className="text-sm text-muted-foreground">The latest 20 actions. Times are shown in UTC.</p>
        </CardHeader>
        <CardContent>
          {activity.length ? (
            <ol className="divide-y divide-border">
              {activity.map((entry) => (
                <li key={entry.id} className="flex flex-col justify-between gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:gap-6">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">
                      <span className="capitalize">{entry.action}</span>{entry.entityType !== "user" ? ` ${entry.entityType}` : ""}: {entry.title}
                    </p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{entry.actor?.email ?? "Deleted account"}</p>
                  </div>
                  <time dateTime={entry.createdAt.toISOString()} className="shrink-0 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(entry.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          ) : <p className="py-4 text-sm text-muted-foreground">No activity yet. Registrations, profile changes and content actions will appear here.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
