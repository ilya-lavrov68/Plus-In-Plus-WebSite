import Link from "next/link";

import { adminLabels } from "@/components/admin/labels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPosts } from "@/lib/admin-queries";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";

export default async function AdminPostsPage() {
  await requireStaff();
  const locale = await getRequestLocale();
  const t = adminLabels(locale);
  const posts = await getPosts();
  const date = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { dateStyle: "medium" });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">{t.posts.title}</h1>
        <p className="text-sm text-muted-foreground">{t.posts.subtitle}</p>
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
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-xs underline-offset-4 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.table.open}
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
