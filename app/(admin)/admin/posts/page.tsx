import Link from "next/link";

import { adminLabels } from "@/components/admin/labels";
import { AdminPageHeader, adminFilledButtonClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPosts } from "@/lib/admin-queries";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";

export default async function AdminPostsPage() {
  const staff = await requireStaff();
  const locale = await getRequestLocale();
  const t = adminLabels(locale);
  const posts = await getPosts();
  const date = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={t.posts.title}
        description={t.posts.subtitle}
        actions={
          staff?.isAdmin ? (
            <Link href="/admin/posts/new" className={adminFilledButtonClass}>
              {t.post.create}
            </Link>
          ) : null
        }
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.table.title}</TableHead>
            <TableHead>{t.table.date}</TableHead>
            <TableHead>{t.table.source}</TableHead>
            <TableHead>{t.table.published}</TableHead>
            <TableHead className="text-right">{t.table.open}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-on-surface-variant">
                {t.table.empty}
              </TableCell>
            </TableRow>
          ) : (
            posts.map((post) => (
              <TableRow key={post.id}>
                <TableCell className="max-w-[420px] truncate font-medium">{post.title}</TableCell>
                <TableCell className="whitespace-nowrap text-on-surface-variant">
                  {post.date ? date.format(new Date(post.date)) : "—"}
                </TableCell>
                <TableCell className="text-on-surface-variant">{post.source}</TableCell>
                <TableCell>
                  <Badge variant={post.published ? "default" : "outline"}>
                    {post.published ? t.table.yes : t.table.no}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-4">
                    {staff?.isAdmin ? (
                      <Link
                        href={`/admin/posts/${encodeURIComponent(post.id)}`}
                        className="text-xs underline-offset-4 hover:underline"
                      >
                        {t.table.editLink}
                      </Link>
                    ) : null}
                    <Link
                      href={`/blog/${post.slug}`}
                      className="text-xs text-on-surface-variant underline-offset-4 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t.table.open}
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
