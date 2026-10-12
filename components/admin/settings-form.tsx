"use client";

import { useState } from "react";
import { setFeaturedPost, updateSiteSettings } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SettingsForm({
  initial,
  posts,
}: {
  initial: Record<string, string>;
  posts: { id: string; title: string; isFeatured: boolean }[];
}) {
  const [values, setValues] = useState({
    studioName: initial.studioName ?? "Plus In Plus",
    studioDescription: initial.studioDescription ?? "",
    contactEmail: initial.contactEmail ?? "",
    contactPhone: initial.contactPhone ?? "",
    vkUrl: initial.vkUrl ?? "",
    telegramUrl: initial.telegramUrl ?? "",
    youtubeUrl: initial.youtubeUrl ?? "",
    metaTitle: initial.metaTitle ?? "",
    metaDescription: initial.metaDescription ?? "",
    metaKeywords: initial.metaKeywords ?? "",
    vkApiKey: initial.vkApiKey ?? "",
    telegramApiKey: initial.telegramApiKey ?? "",
    youtubeApiKey: initial.youtubeApiKey ?? "",
    parserInterval: initial.parserInterval ?? "60",
  });
  const [featured, setFeatured] = useState(posts.find((post) => post.isFeatured)?.id ?? "none");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const update = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true); setMessage(null);
    const settingsResult = await updateSiteSettings(values);
    const featuredResult = await setFeaturedPost(featured === "none" ? null : featured);
    setPending(false);
    setMessage(settingsResult.ok && featuredResult.ok ? "Settings saved." : settingsResult.error ?? featuredResult.error ?? "Settings could not be saved.");
  };

  return (
    <form onSubmit={save} className="space-y-8">
      <section className="rounded-xl border border-border p-5"><h2 className="text-lg font-semibold">Studio information</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="studioName">Studio name</Label><Input id="studioName" value={values.studioName} onChange={(e) => update("studioName", e.target.value)} /></div><div className="space-y-2"><Label htmlFor="contactEmail">Contact email</Label><Input id="contactEmail" type="email" value={values.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="studioDescription">Description</Label><Textarea id="studioDescription" value={values.studioDescription} onChange={(e) => update("studioDescription", e.target.value)} rows={3} /></div><div className="space-y-2"><Label htmlFor="contactPhone">Phone</Label><Input id="contactPhone" value={values.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} /></div></div></section>
      <section className="rounded-xl border border-border p-5"><h2 className="text-lg font-semibold">Social networks</h2><div className="mt-4 grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label htmlFor="vkUrl">VK URL</Label><Input id="vkUrl" type="url" value={values.vkUrl} onChange={(e) => update("vkUrl", e.target.value)} /></div><div className="space-y-2"><Label htmlFor="telegramUrl">Telegram URL</Label><Input id="telegramUrl" type="url" value={values.telegramUrl} onChange={(e) => update("telegramUrl", e.target.value)} /></div><div className="space-y-2"><Label htmlFor="youtubeUrl">YouTube URL</Label><Input id="youtubeUrl" type="url" value={values.youtubeUrl} onChange={(e) => update("youtubeUrl", e.target.value)} /></div></div></section>
      <section className="rounded-xl border border-border p-5"><h2 className="text-lg font-semibold">SEO</h2><div className="mt-4 space-y-4"><div className="space-y-2"><Label htmlFor="metaTitle">Meta title</Label><Input id="metaTitle" value={values.metaTitle} onChange={(e) => update("metaTitle", e.target.value)} /></div><div className="space-y-2"><Label htmlFor="metaDescription">Meta description</Label><Textarea id="metaDescription" value={values.metaDescription} onChange={(e) => update("metaDescription", e.target.value)} rows={3} /></div><div className="space-y-2"><Label htmlFor="metaKeywords">Keywords</Label><Input id="metaKeywords" value={values.metaKeywords} onChange={(e) => update("metaKeywords", e.target.value)} /></div></div></section>
      <section className="rounded-xl border border-border p-5"><h2 className="text-lg font-semibold">Featured post</h2><p className="mt-1 text-sm text-muted-foreground">Choose the post shown in the header and dashboard.</p><select value={featured} onChange={(e) => setFeatured(e.target.value)} className="mt-4 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm sm:max-w-xl"><option value="none">No featured post</option>{posts.map((post) => <option key={post.id} value={post.id}>{post.title}</option>)}</select></section>
      <section className="rounded-xl border border-border p-5"><h2 className="text-lg font-semibold">Parser settings</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="vkApiKey">VK API key</Label><Input id="vkApiKey" type="password" value={values.vkApiKey} onChange={(e) => update("vkApiKey", e.target.value)} /></div><div className="space-y-2"><Label htmlFor="telegramApiKey">Telegram API key</Label><Input id="telegramApiKey" type="password" value={values.telegramApiKey} onChange={(e) => update("telegramApiKey", e.target.value)} /></div><div className="space-y-2"><Label htmlFor="youtubeApiKey">YouTube API key</Label><Input id="youtubeApiKey" type="password" value={values.youtubeApiKey} onChange={(e) => update("youtubeApiKey", e.target.value)} /></div><div className="space-y-2"><Label htmlFor="parserInterval">Refresh interval (minutes)</Label><Input id="parserInterval" type="number" min={5} value={values.parserInterval} onChange={(e) => update("parserInterval", e.target.value)} /></div></div></section>
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}<Button type="submit" disabled={pending} className="bg-[#00C56D] text-[#052B42] hover:bg-[#00B361]">{pending ? "Saving…" : "Save settings"}</Button>
    </form>
  );
}
