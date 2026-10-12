import { Settings } from "lucide-react";

import { SettingsForm } from "@/components/admin/settings-form";
import { EmptyState } from "@/components/site/empty-state";
import { getFeaturedCandidates, getSiteSettings } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [settings, posts] = await Promise.all([getSiteSettings(), getFeaturedCandidates()]);
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 text-muted-foreground">Manage studio details, SEO, social links, parsers, and the featured post.</p>
      <div className="mt-8"><SettingsForm initial={settings} posts={posts} /></div>
      {!posts.length ? <div className="mt-8"><EmptyState icon={Settings} title="No published posts" description="Publish a post to choose it as featured." /></div> : null}
    </div>
  );
}
