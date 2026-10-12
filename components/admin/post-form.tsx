"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { createPost, updatePost } from "@/app/actions/posts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SafeImage } from "@/components/site/safe-image";
import { CoverImageHelp } from "@/components/admin/cover-image-help";
import { ImageAlbumUploader } from "@/components/admin/image-album-uploader";
import { IMAGE_ACCEPT, MAX_COVER_BYTES } from "@/lib/upload-policy";
import { parseJsonArray } from "@/lib/db-helpers";

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
    isPublished: boolean;
  };
}

/**
 * CRUD form for blog posts. Cover images are uploaded to
 * /public/uploads/blog/ (strictly) via the createPost/updatePost server
 * actions; album images are uploaded to /public/uploads/blog/albums/.
 */
export function PostForm({ mode, postId, initial }: PostFormProps) {
  const router = useRouter();
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
        setError(result.error ?? "Saving failed.");
        return;
      }

      router.push("/admin/blog");
      router.refresh();
    } catch {
      setError("Saving failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="post-title">Title</Label>
        <Input id="post-title" name="title" maxLength={160} required defaultValue={initial?.title} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-slug">Slug</Label>
        <Input
          id="post-slug"
          name="slug"
          maxLength={120}
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          title="Lowercase letters, numbers and dashes"
          defaultValue={initial?.slug}
        />
        <p className="text-xs text-muted-foreground">Used in the URL: /blog/&lt;slug&gt;</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-excerpt">Excerpt</Label>
        <Textarea id="post-excerpt" name="excerpt" maxLength={500} required rows={2} defaultValue={initial?.excerpt} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-content">Content (safe HTML formatting)</Label>
        <Textarea id="post-content" name="content" maxLength={100000} required rows={12} defaultValue={initial?.content} />
        <p className="text-xs text-muted-foreground">
          Scripts, embeds, images, and unsafe links are removed before publishing.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="post-source">Source</Label>
          <select
            id="post-source"
            name="source"
            defaultValue={initial?.source ?? "manual"}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="manual">Manual (Studio)</option>
            <option value="telegram">Telegram</option>
            <option value="vk">VK</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="post-source-url">Source URL (optional)</Label>
          <Input
            id="post-source-url"
            name="sourceUrl"
            type="url"
            placeholder="https://t.me/..., https://vk.com/..., etc."
            defaultValue={initial?.sourceUrl ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-read-time">Read time (minutes)</Label>
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
        <Label htmlFor="post-cover">Cover image (main)</Label>
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
              setError("Cover image must be 8 MB or smaller.");
              return;
            }
            setCoverFile(file ?? null);
          }}
        />
        <CoverImageHelp kind="blog" file={coverFile} mode={mode} />
        {mode === "edit" && initial?.coverImage ? (
          <div className="relative mt-2 h-24 w-40 overflow-hidden rounded-md border border-border bg-[#F0F0F0]">
            <SafeImage
              src={initial.coverImage}
              alt="Current cover"
              fill
              sizes="160px"
              className="object-contain"
            />
          </div>
        ) : null}
      </div>

      {/* Additional Images (Album) */}
      <div className="space-y-2 rounded-xl border border-border p-4 bg-muted/20">
        <div>
          <Label className="text-base font-semibold">Additional Images (Album)</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add multiple photos to create an image gallery on the post page.
          </p>
        </div>
        <ImageAlbumUploader initialImages={initialAlbumImages} />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex items-center gap-3">
          <Switch id="post-featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
          <Label htmlFor="post-featured" className="cursor-pointer">
            {isFeatured ? "Featured post ⭐" : "Standard post"}
          </Label>
        </div>

        <div className="flex items-center gap-3">
          <Switch id="post-published" checked={isPublished} onCheckedChange={setIsPublished} />
          <Label htmlFor="post-published" className="cursor-pointer">
            {isPublished ? "Published" : "Draft"}
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
          {pending ? "Saving…" : mode === "create" ? "Create post" : "Save changes"}
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
          Cancel
        </Button>
      </div>
    </form>
  );
}
