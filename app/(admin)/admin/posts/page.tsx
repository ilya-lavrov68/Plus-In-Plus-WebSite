import Link from "next/link";

import { adminLabels } from "@/components/admin/labels";
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">{t.posts.title}</h1>
          <p className="text-sm text-muted-foreground">{t.posts.subtitle}</p>
        </div>
        {staff?.isAdmin ? (
          <Link
            href="/admin/posts/new"
            className="inline-flex h-10 items-center border border-brand-signal bg-brand-signal px-4 text-sm font-medium text-[#12131B] transition-colors hover:bg-brand-signal-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
          >
            {t.post.create}
          </Link>
        ) : null}
      </header>
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
              <TableCell colSpan={5} className="text-muted-foreground">
                {t.table.empty}
              </TableCell>
            </TableRow>
          ) : (
            posts.map((post) => (
              <TableRow key={post.id}>
                <TableCell className="max-w-[420px] truncate font-medium">{post.title}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {post.date ? date.format(new Date(post.date)) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{post.source}</TableCell>
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
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
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
