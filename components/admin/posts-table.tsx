"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { bulkUpdatePosts, duplicatePost } from "@/app/actions/posts";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import type { DataTableColumn } from "@/components/spectrumui/data-table";
import { SafeImage } from "@/components/site/safe-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AdminPostRow {
  id: string;
  title: string;
  slug: string;
  source: string;
  coverImage: string;
  readTime: number;
  isFeatured: boolean;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
}

export function PostsTable({ posts }: { posts: AdminPostRow[] }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [source, setSource] = useState("all");
  const [featured, setFeatured] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Status is handled by the table's quick-filter pills; the source and featured
  // dimensions are filtered here.
  const rows = useMemo(
    () =>
      posts
        .filter((post) => source === "all" || post.source.toLowerCase() === source)
        .filter((post) =>
          featured === "all" ? true : featured === "featured" ? post.isFeatured : !post.isFeatured
        ),
    [posts, source, featured]
  );

  const runBulk = async (action: "publish" | "unpublish" | "delete", clear: () => void) => {
    if (!selected.length || pending) return;
    if (action === "delete" && !window.confirm(t("confirmDeletePosts", { count: selected.length }))) return;
    setPending(true);
    setMessage(null);
    const result = await bulkUpdatePosts(selected, action);
    setPending(false);
    if (!result.ok) {
      setMessage(result.error ?? t("actionFailed"));
      return;
    }
    setSelected([]);
    clear();
    setMessage(action === "delete" ? t("postsDeleted") : t("postsUpdated"));
    window.location.reload();
  };

  const duplicate = async (id: string) => {
    setPending(true);
    setMessage(null);
    const result = await duplicatePost(id);
    setPending(false);
    setMessage(result.ok ? t("postDuplicated") : result.error ?? t("duplicateFailed"));
    if (result.ok) window.location.reload();
  };

  const columns: DataTableColumn<AdminPostRow>[] = [
    {
      id: "title",
      header: t("post"),
      sortable: true,
      cell: (post) => (
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-14 overflow-hidden rounded-md bg-muted">
            <SafeImage src={post.coverImage} alt="" fill sizes="56px" className="object-contain" />
          </div>
          <div>
            <span className="font-medium">{post.title}</span>
            <div className="font-mono text-xs text-muted-foreground">/{post.slug}</div>
          </div>
          {post.isFeatured ? (
            <Badge variant="default">{t("featured")}</Badge>
          ) : null}
        </div>
      ),
    },
    {
      id: "source",
      header: tc("source"),
      sortable: true,
      cell: (post) => <span className="capitalize">{post.source}</span>,
    },
    {
      id: "status",
      header: tc("status"),
      sortable: true,
      value: (post) => (post.isPublished ? "Published" : "Draft"),
      cell: (post) => (
        <Badge variant={post.isPublished ? "default" : "outline"}>
          {post.isPublished ? t("published") : t("draft")}
        </Badge>
      ),
    },
    {
      id: "publishedAt",
      header: t("publication"),
      sortable: true,
      value: (post) => post.publishedAt ?? post.createdAt,
      cell: (post) => (
        <span className="text-xs text-muted-foreground">
          {post.publishedAt ? new Date(post.publishedAt).toLocaleString("en-GB") : t("notScheduled")}
        </span>
      ),
    },
  ];

  return (
    <div className="mt-8 space-y-4">
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      <AdminDataTable
        data={rows}
        columns={columns}
        rowId={(post) => post.id}
        rowLabel={(post) => post.title}
        variant="bordered"
        searchable
        searchPlaceholder={t("searchTitleOrSlug")}
        searchText={(post) => `${post.title} ${post.slug}`}
        quickFilter={{
          columnId: "status",
          label: tc("status"),
          allLabel: t("allStatuses"),
          options: [
            { value: "Published", label: t("published") },
            { value: "Draft", label: t("draft") },
          ],
        }}
        defaultSort={{ columnId: "publishedAt", direction: "desc" }}
        selectable
        selectedIds={selected}
        onSelectedChange={setSelected}
        bulkActions={({ clear }) => (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => runBulk("publish", clear)}
              disabled={pending}
            >
              {t("publish")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => runBulk("unpublish", clear)}
              disabled={pending}
            >
              {t("unpublish")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => runBulk("delete", clear)}
              disabled={pending}
              className="border-red-500/35 bg-red-500/10 text-red-300 hover:border-red-400/50 hover:bg-red-500/20"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {tc("delete")}
            </Button>
          </>
        )}
        rowActions={(post) => (
          <div className="flex items-center gap-1">
            <Link
              href={`/admin/blog/${post.id}`}
              className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              {tc("edit")}
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => duplicate(post.id)}
              disabled={pending}
              title={tc("duplicate")}
            >
              <Copy className="h-4 w-4" />
            </Button>
            {post.isPublished ? (
              <Link
                href={`/blog/${post.slug}`}
                target="_blank"
                className="inline-flex items-center rounded-md p-2 hover:bg-accent"
                title={tc("preview")}
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        )}
        pageSize={pageSize}
        emptyState={
          <p className="p-8 text-center text-sm text-muted-foreground">{t("noPostsMatch")}</p>
        }
        toolbar={
          <div className="flex items-center gap-2">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="min-w-32">
                <SelectValue placeholder={t("allSources")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allSources")}</SelectItem>
                <SelectItem value="manual">{t("manual")}</SelectItem>
                <SelectItem value="vk">VK</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
              </SelectContent>
            </Select>
            <Select value={featured} onValueChange={setFeatured}>
              <SelectTrigger className="min-w-32">
                <SelectValue placeholder={t("featured")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allPosts")}</SelectItem>
                <SelectItem value="featured">{t("featured")}</SelectItem>
                <SelectItem value="standard">{t("standard")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger className="min-w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {t("rowsPerPage", { count: size })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
}
