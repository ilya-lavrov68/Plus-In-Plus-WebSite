import Link from "next/link";
import { ArrowRight, BookOpen, ExternalLink, Image as ImageIcon, Plus, Settings, Users, Eye } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminStats, getFeaturedCandidates, getRecentActivity } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [stats, activity, featuredPosts] = await Promise.all([getAdminStats(), getRecentActivity(), getFeaturedCandidates()]);
  const cards = [
    { title: "Services", icon: ImageIcon, value: stats.services, detail: `${stats.publishedServices} published`, href: "/admin/services" },
    { title: "Blog posts", icon: BookOpen, value: stats.posts, detail: `${stats.publishedPosts} published`, href: "/admin/blog" },
    { title: "Users", icon: Users, value: stats.users, detail: `${stats.admins} admin(s)`, href: "/admin/users" },
    { title: "Views · 7 days", icon: Eye, value: stats.views7d, detail: `${stats.views30d} in 30 days`, href: "/admin/settings" },
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
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/admin/services/new" className="inline-flex items-center gap-2 rounded-xl bg-[#00C56D] px-4 py-2.5 text-sm font-medium text-[#052B42] transition-colors duration-200 ease-out hover:bg-[#00B361]"><Plus className="h-4 w-4" />Create service</Link>
        <Link href="/admin/blog/new" className="inline-flex items-center gap-2 rounded-xl border border-[#052B42] px-4 py-2.5 text-sm font-medium text-[#052B42] transition-colors duration-200 ease-out hover:bg-[#052B42]/[0.05]"><Plus className="h-4 w-4" />Create post</Link>
        <Link href="/" target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors duration-200 ease-out hover:bg-accent"><ExternalLink className="h-4 w-4" />View site</Link>
        <Link href="/admin/settings" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors duration-200 ease-out hover:bg-accent"><Settings className="h-4 w-4" />Settings</Link>
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <Card>
          <CardHeader><CardTitle className="text-lg">Activity · last 7 days</CardTitle><p className="text-sm text-muted-foreground">Page views collected by the lightweight site metric.</p></CardHeader>
          <CardContent><div className="flex h-40 items-end gap-2 sm:gap-4">{stats.activityByDay.map((day) => { const max = Math.max(1, ...stats.activityByDay.map((item) => item.value)); return <div key={day.label} className="flex min-w-0 flex-1 flex-col items-center gap-2"><div className="flex h-32 w-full items-end rounded-lg bg-muted/40"><div className="w-full rounded-lg bg-[#00C56D] transition-[height] duration-200 ease-out" style={{ height: `${Math.max(6, (day.value / max) * 100)}%` }} title={`${day.value} views`} /></div><span className="text-xs text-muted-foreground">{day.label}</span></div>; })}</div></CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-lg">Featured post</CardTitle></CardHeader><CardContent>{featuredPosts[0] ? <div><p className="font-medium">{featuredPosts[0].title}</p><p className="mt-1 text-sm text-muted-foreground">{featuredPosts[0].isFeatured ? "Selected featured post" : "Fallback latest post"}</p><Link href="/admin/settings" className="mt-4 inline-flex text-sm font-medium underline-offset-4 hover:underline">Change featured post</Link></div> : <p className="text-sm text-muted-foreground">No published posts yet.</p>}</CardContent></Card>
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
