import Link from "next/link";
import { ArrowRight, BookOpen, Image as ImageIcon, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminStats } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();

  const cards = [
    {
      title: "Services",
      icon: ImageIcon,
      value: stats.services,
      detail: `${stats.publishedServices} published`,
      href: "/admin/services",
    },
    {
      title: "Blog posts",
      icon: BookOpen,
      value: stats.posts,
      detail: `${stats.publishedPosts} published`,
      href: "/admin/blog",
    },
    {
      title: "Users",
      icon: Users,
      value: stats.users,
      detail: `${stats.admins} admin(s)`,
      href: "/admin/users",
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Overview of the Plus In Plus content and users.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ title, icon: Icon, value, detail, href }) => (
          <Link
            key={title}
            href={href}
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full transition-colors duration-200 ease-out hover:bg-accent">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">{title}</CardTitle>
                <Icon aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tracking-tight">{value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
                <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium">
                  Manage
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
