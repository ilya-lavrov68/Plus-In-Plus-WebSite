"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { createPost, updatePost } from "@/app/actions/posts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { SafeImage } from "@/components/site/safe-image";
import { CoverImageHelp } from "@/components/admin/cover-image-help";
import { ImageAlbumUploader } from "@/components/admin/image-album-uploader";
import { LazyRichTextEditor } from "@/components/admin/lazy-rich-text-editor";
import { IMAGE_ACCEPT, MAX_COVER_BYTES } from "@/lib/upload-policy";
import { parseJsonArray } from "@/lib/db-helpers";
import { slugify } from "@/lib/slug";

export interface PostFormProps {
  mode: "create" | "edit";
  postId?: string;
  initial?: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    readTime: number;
    coverImage: string;
    images?: string | null;
    isFeatured?: boolean;
    source?: string;
    sourceUrl?: string | null;
    publishedAt?: Date | string | null;
    isPublished: boolean;
  };
}

/**
 * CRUD form for blog posts. Cover images are uploaded to
 * /public/uploads/blog/ (strictly) via the createPost/updatePost server
 * actions; album images are uploaded to /public/uploads/blog/albums/.
 */
export function PostForm({ mode, postId, initial }: PostFormProps) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(mode === "edit" && Boolean(initial?.slug));
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false);
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const initialAlbumImages = initial?.images ? parseJsonArray(initial.images) : [];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    formData.set("isPublished", String(isPublished));
    formData.set("isFeatured", String(isFeatured));

    try {
      const result =
        mode === "create"
          ? await createPost(formData)
          : await updatePost(postId ?? "", formData);

      if (!result.ok) {
        const message = result.error ?? t("form.saveFailed");
        setError(message);
        toast({ title: t("form.couldNotSavePost"), description: message, variant: "destructive" });
        return;
      }

      toast({ title: mode === "create" ? t("form.postCreated") : t("form.postUpdated"), description: t("form.blogListRefreshed") });
      router.push("/admin/blog");
      router.refresh();
    } catch {
      setError(t("form.saveFailed"));
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-3xl space-y-6 rounded-2xl border border-border bg-card p-6 sm:p-8"
    >
      <div className="space-y-2">
        <Label htmlFor="post-title">{tc("title")}</Label>
        <Input
          id="post-title"
          name="title"
          maxLength={160}
          required
          value={title}
          onChange={(event) => {
            const nextTitle = event.target.value;
            setTitle(nextTitle);
            if (!slugEdited) setSlug(slugify(nextTitle, "post"));
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-slug">{t("slug")}</Label>
        <Input
          id="post-slug"
          name="slug"
          maxLength={120}
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          title={t("form.postSlugPattern")}
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value);
          }}
        />
        <p className="text-xs text-muted-foreground">{t("form.postSlugHelp")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-excerpt">{t("form.excerpt")}</Label>
        <Textarea id="post-excerpt" name="excerpt" maxLength={500} required rows={2} defaultValue={initial?.excerpt} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-content">{t("form.contentLabel")}</Label>
        <LazyRichTextEditor name="content" initialValue={initial?.content} />
        <p className="text-xs text-muted-foreground">
          {t("form.contentHelp")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="post-source">{tc("source")}</Label>
          <select
            id="post-source"
            name="source"
            defaultValue={initial?.source ?? "manual"}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&_option]:bg-card [&_option]:text-foreground"
          >
            <option value="manual">{t("form.sourceManual")}</option>
            <option value="telegram">Telegram</option>
            <option value="vk">VK</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="post-source-url">{t("form.sourceUrl")}</Label>
          <Input
            id="post-source-url"
            name="sourceUrl"
            type="url"
            placeholder={t("form.sourceUrlPlaceholder")}
            defaultValue={initial?.sourceUrl ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-read-time">{t("form.readTime")}</Label>
        <Input
          id="post-read-time"
          name="readTime"
          type="number"
          min={1}
          max={1440}
          required
          className="w-32"
          defaultValue={initial?.readTime ?? 5}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-published-at">{t("form.publishedAt")}</Label>
        <Input
          id="post-published-at"
          name="publishedAt"
          type="datetime-local"
          defaultValue={initial?.publishedAt ? new Date(initial.publishedAt).toISOString().slice(0, 16) : ""}
        />
        <p className="text-xs text-muted-foreground">{t("form.publishedAtHelp")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-cover">{t("coverImageMain")}</Label>
        <Input
          id="post-cover"
          name="cover"
          type="file"
          accept={IMAGE_ACCEPT}
          required={mode === "create"}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setError(null);
            if (file && file.size > MAX_COVER_BYTES) {
              event.target.value = "";
              setCoverFile(null);
              setError(t("form.coverTooLarge"));
              return;
            }
            setCoverFile(file ?? null);
          }}
        />
        <CoverImageHelp kind="blog" file={coverFile} mode={mode} />
        {mode === "edit" && initial?.coverImage ? (
          <div className="relative mt-2 h-24 w-40 overflow-hidden rounded-lg border border-border bg-muted">
            <SafeImage
              src={initial.coverImage}
              alt={t("currentCover")}
              fill
              sizes="160px"
              className="object-cover"
            />
          </div>
        ) : null}
      </div>

      {/* Additional Images (Album) */}
      <div className="space-y-2 rounded-xl border border-border p-4 bg-muted/20">
        <div>
          <Label className="text-base font-semibold">{t("form.album")}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("form.albumHelp")}
          </p>
        </div>
        <ImageAlbumUploader initialImages={initialAlbumImages} />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex items-center gap-3">
          <Switch id="post-featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
          <Label htmlFor="post-featured" className="inline-flex cursor-pointer items-center gap-1.5">
            {/* Icon instead of an emoji: every glyph stays inside the bundled
                Latin/Cyrillic faces, in both locales. */}
            {isFeatured ? <Star aria-hidden="true" className="h-4 w-4" /> : null}
            {isFeatured ? t("form.featuredPost") : t("form.standardPost")}
          </Label>
        </div>

        <div className="flex items-center gap-3">
          <Switch id="post-published" checked={isPublished} onCheckedChange={setIsPublished} />
          <Label htmlFor="post-published" className="cursor-pointer">
            {isPublished ? t("published") : t("draft")}
          </Label>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tc("saving") : mode === "create" ? t("form.createPost") : t("form.saveChanges")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            router.push("/admin/blog");
            router.refresh();
          }}
        >
          {tc("cancel")}
        </Button>
      </div>
    </form>
  );
}
