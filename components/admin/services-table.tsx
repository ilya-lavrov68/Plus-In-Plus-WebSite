"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, Search, Trash2 } from "lucide-react";

import { bulkUpdateServices, duplicateService } from "@/app/actions/services";
import { SafeImage } from "@/components/site/safe-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface AdminServiceRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  isPublished: boolean;
  coverImage: string;
  updatedAt: Date;
}

export function ServicesTable({ services }: { services: AdminServiceRow[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("date");
  const [pageSize, setPageSize] = useState("10");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return services
      .filter((service) => !normalized || service.title.toLowerCase().includes(normalized))
      .filter((service) => category === "all" || service.category === category)
      .filter((service) => status === "all" || (status === "published" ? service.isPublished : !service.isPublished))
      .sort((a, b) => {
        if (sort === "title") return a.title.localeCompare(b.title);
        if (sort === "category") return a.category.localeCompare(b.category) || a.title.localeCompare(b.title);
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [services, query, category, status, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / Number(pageSize)));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * Number(pageSize), currentPage * Number(pageSize));
  const allVisibleSelected = visible.length > 0 && visible.every((service) => selected.includes(service.id));

  const runBulk = async (action: "publish" | "unpublish" | "delete") => {
    if (!selected.length || pending) return;
    if (action === "delete" && !window.confirm(`Delete ${selected.length} selected service(s)?`)) return;
    setPending(true);
    setMessage(null);
    const result = await bulkUpdateServices(selected, action);
    setPending(false);
    if (!result.ok) {
      setMessage(result.error ?? "Action failed.");
      return;
    }
    setSelected([]);
    setMessage(action === "delete" ? "Services deleted." : "Services updated.");
    window.location.reload();
  };

  const duplicate = async (id: string) => {
    setPending(true);
    setMessage(null);
    const result = await duplicateService(id);
    setPending(false);
    setMessage(result.ok ? "Service duplicated as a draft." : result.error ?? "Duplicate failed.");
    if (result.ok) window.location.reload();
  };

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const toggleAll = () => setSelected((current) => allVisibleSelected ? current.filter((id) => !visible.some((service) => service.id === id)) : [...new Set([...current, ...visible.map((service) => service.id)])]);

  return (
    <div className="mt-8 space-y-4">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_9rem_7rem]">
        <label className="relative block">
          <span className="sr-only">Search services</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search by title…" className="pl-9" />
        </label>
        <Select value={category} onValueChange={(value) => { setCategory(value); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem><SelectItem value="small">Small</SelectItem><SelectItem value="large">Large</SelectItem></SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="draft">Draft</SelectItem></SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent><SelectItem value="date">Updated date</SelectItem><SelectItem value="title">Title</SelectItem><SelectItem value="category">Category</SelectItem></SelectContent>
        </Select>
        <Select value={pageSize} onValueChange={(value) => { setPageSize(value); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Rows" /></SelectTrigger>
          <SelectContent><SelectItem value="10">10 / page</SelectItem><SelectItem value="20">20 / page</SelectItem><SelectItem value="50">50 / page</SelectItem></SelectContent>
        </Select>
      </div>

      {selected.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#052B42] p-3 text-white">
          <span className="mr-2 text-sm font-medium">{selected.length} selected</span>
          <Button type="button" size="sm" onClick={() => runBulk("publish")} disabled={pending} className="bg-[#00C56D] text-[#052B42] hover:bg-[#00B361]">Publish</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => runBulk("unpublish")} disabled={pending} className="border-white/40 bg-transparent text-white hover:bg-white/10">Unpublish</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => runBulk("delete")} disabled={pending} className="border-white/40 bg-transparent text-white hover:bg-white/10"><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
        </div>
      ) : null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/40 text-left"><tr className="border-b border-border">
            <th className="w-10 px-4 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select visible services" /></th>
            <th className="px-4 py-3">Service</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3 text-right">Actions</th>
          </tr></thead>
          <tbody>
            {visible.map((service) => (
              <tr key={service.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(service.id)} onChange={() => toggle(service.id)} aria-label={`Select ${service.title}`} /></td>
                <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="relative h-10 w-14 overflow-hidden rounded-md bg-muted"><SafeImage src={service.coverImage} alt="" fill sizes="56px" className="object-contain" /></div><span className="font-medium">{service.title}</span></div></td>
                <td className="px-4 py-3"><Badge variant="secondary">{service.category}</Badge></td>
                <td className="px-4 py-3"><Badge variant={service.isPublished ? "default" : "outline"}>{service.isPublished ? "Published" : "Draft"}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(service.updatedAt).toLocaleDateString("en-GB")}</td>
                <td className="px-4 py-3"><div className="flex justify-end gap-1"><Link href={`/admin/services/${service.id}`} className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent">Edit</Link><Button type="button" variant="ghost" size="sm" onClick={() => duplicate(service.id)} disabled={pending} title="Duplicate"><Copy className="h-4 w-4" /></Button>{service.isPublished ? <Link href={`/shop/${service.slug}`} target="_blank" className="inline-flex items-center rounded-md p-2 hover:bg-accent" title="Preview"><ExternalLink className="h-4 w-4" /></Link> : null}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length ? <p className="p-8 text-center text-sm text-muted-foreground">No services match these filters.</p> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{filtered.length} result(s)</span>
        <div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>Previous</Button><span>Page {currentPage} of {pages}</span><Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={currentPage === pages}>Next</Button></div>
      </div>
    </div>
  );
}
