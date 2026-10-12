"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { bulkUpdatePosts, duplicatePost } from "@/app/actions/posts";
import { SafeImage } from "@/components/site/safe-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [featured, setFeatured] = useState("all");
  const [status, setStatus] = useState("all");
  const [pageSize, setPageSize] = useState("10");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return posts
      .filter((post) => !normalized || post.title.toLowerCase().includes(normalized) || post.slug.toLowerCase().includes(normalized))
      .filter((post) => source === "all" || post.source.toLowerCase() === source)
      .filter((post) => featured === "all" || (featured === "featured" ? post.isFeatured : !post.isFeatured))
      .filter((post) => status === "all" || (status === "published" ? post.isPublished : !post.isPublished));
  }, [posts, query, source, featured, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / Number(pageSize)));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * Number(pageSize), currentPage * Number(pageSize));
  const allVisibleSelected = visible.length > 0 && visible.every((post) => selected.includes(post.id));

  const runBulk = async (action: "publish" | "unpublish" | "delete") => {
    if (!selected.length || pending) return;
    if (action === "delete" && !window.confirm(t("confirmDeletePosts", { count: selected.length }))) return;
    setPending(true);
    setMessage(null);
    const result = await bulkUpdatePosts(selected, action);
    setPending(false);
    if (!result.ok) { setMessage(result.error ?? t("actionFailed")); return; }
    setSelected([]);
    setMessage(action === "delete" ? t("postsDeleted") : t("postsUpdated"));
    window.location.reload();
  };

  const duplicate = async (id: string) => {
    setPending(true);
    const result = await duplicatePost(id);
    setPending(false);
    setMessage(result.ok ? t("postDuplicated") : result.error ?? t("duplicateFailed"));
    if (result.ok) window.location.reload();
  };
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const toggleAll = () => setSelected((current) => allVisibleSelected ? current.filter((id) => !visible.some((post) => post.id === id)) : [...new Set([...current, ...visible.map((post) => post.id)])]);

  return (
    <div className="mt-8 space-y-4">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem_7rem]">
        <label className="relative block"><span className="sr-only">{t("searchPosts")}</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t("searchTitleOrSlug")} className="pl-9" /></label>
        <Select value={source} onValueChange={(value) => { setSource(value); setPage(1); }}><SelectTrigger><SelectValue placeholder={tc("source")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("allSources")}</SelectItem><SelectItem value="manual">{t("manual")}</SelectItem><SelectItem value="vk">VK</SelectItem><SelectItem value="telegram">Telegram</SelectItem><SelectItem value="youtube">YouTube</SelectItem></SelectContent></Select>
        <Select value={featured} onValueChange={(value) => { setFeatured(value); setPage(1); }}><SelectTrigger><SelectValue placeholder={t("featured")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("allPosts")}</SelectItem><SelectItem value="featured">{t("featured")}</SelectItem><SelectItem value="standard">{t("standard")}</SelectItem></SelectContent></Select>
        <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger><SelectValue placeholder={tc("status")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("allStatuses")}</SelectItem><SelectItem value="published">{t("published")}</SelectItem><SelectItem value="draft">{t("draft")}</SelectItem></SelectContent></Select>
        <Select value={pageSize} onValueChange={(value) => { setPageSize(value); setPage(1); }}><SelectTrigger><SelectValue placeholder={t("rows")} /></SelectTrigger><SelectContent><SelectItem value="10">{t("rowsPerPage", { count: 10 })}</SelectItem><SelectItem value="20">{t("rowsPerPage", { count: 20 })}</SelectItem><SelectItem value="50">{t("rowsPerPage", { count: 50 })}</SelectItem></SelectContent></Select>
      </div>
      {selected.length ? <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#052B42] p-3 text-white"><span className="mr-2 text-sm font-medium">{tc("selected", { count: selected.length })}</span><Button type="button" size="sm" onClick={() => runBulk("publish")} disabled={pending} className="bg-[#00C56D] text-[#052B42] hover:bg-[#00B361]">{t("publish")}</Button><Button type="button" size="sm" variant="outline" onClick={() => runBulk("unpublish")} disabled={pending} className="border-white/40 bg-transparent text-white hover:bg-white/10">{t("unpublish")}</Button><Button type="button" size="sm" variant="outline" onClick={() => runBulk("delete")} disabled={pending} className="border-white/40 bg-transparent text-white hover:bg-white/10"><Trash2 className="mr-1 h-4 w-4" />{tc("delete")}</Button></div> : null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[850px] text-sm"><thead className="bg-muted/40 text-left"><tr className="border-b border-border"><th className="w-10 px-4 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label={t("selectVisiblePosts")} /></th><th className="px-4 py-3">{t("post")}</th><th className="px-4 py-3">{tc("source")}</th><th className="px-4 py-3">{tc("status")}</th><th className="px-4 py-3">{t("publication")}</th><th className="px-4 py-3 text-right">{tc("actions")}</th></tr></thead><tbody>
        {visible.map((post) => <tr key={post.id} className="border-b border-border last:border-0"><td className="px-4 py-3"><input type="checkbox" checked={selected.includes(post.id)} onChange={() => toggle(post.id)} aria-label={t("selectItem", { title: post.title })} /></td><td className="px-4 py-3"><div className="flex items-center gap-3"><div className="relative h-10 w-14 overflow-hidden rounded-md bg-muted"><SafeImage src={post.coverImage} alt="" fill sizes="56px" className="object-contain" /></div><div><span className="font-medium">{post.title}</span><div className="font-mono text-xs text-muted-foreground">/{post.slug}</div></div>{post.isFeatured ? <Badge className="bg-[#00C56D] text-[#052B42]">{t("featured")}</Badge> : null}</div></td><td className="px-4 py-3 capitalize">{post.source}</td><td className="px-4 py-3"><Badge variant={post.isPublished ? "default" : "outline"}>{post.isPublished ? t("published") : t("draft")}</Badge></td><td className="px-4 py-3 text-xs text-muted-foreground">{post.publishedAt ? new Date(post.publishedAt).toLocaleString("en-GB") : t("notScheduled")}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Link href={`/admin/blog/${post.id}`} className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent">{tc("edit")}</Link><Button type="button" variant="ghost" size="sm" onClick={() => duplicate(post.id)} disabled={pending} title={tc("duplicate")}><Copy className="h-4 w-4" /></Button>{post.isPublished ? <Link href={`/blog/${post.slug}`} target="_blank" className="inline-flex items-center rounded-md p-2 hover:bg-accent" title={tc("preview")}><ExternalLink className="h-4 w-4" /></Link> : null}</div></td></tr>)}
      </tbody></table>{!visible.length ? <p className="p-8 text-center text-sm text-muted-foreground">{t("noPostsMatch")}</p> : null}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span>{tc("results", { count: filtered.length })}</span><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>{tc("previous")}</Button><span>{tc("page", { current: currentPage, total: pages })}</span><Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={currentPage === pages}>{tc("next")}</Button></div></div>
    </div>
  );
}
