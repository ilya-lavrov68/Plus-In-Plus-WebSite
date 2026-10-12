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
import { IMAGE_ACCEPT, MAX_COVER_BYTES } from "@/lib/upload-policy";

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
    isPublished: boolean;
  };
}

/**
 * CRUD form for blog posts. Cover images are uploaded to
 * /public/uploads/blog/ (strictly) via the createPost/updatePost server
 * actions; the path is stored in the DB.
 */
export function PostForm({ mode, postId, initial }: PostFormProps) {
  const router = useRouter();
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    formData.set("isPublished", String(isPublished));

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
        <Label htmlFor="post-cover">Cover image</Label>
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

      <div className="flex items-center gap-3">
        <Switch id="post-published" checked={isPublished} onCheckedChange={setIsPublished} />
        <Label htmlFor="post-published" className="cursor-pointer">
          {isPublished ? "Published" : "Draft"}
        </Label>
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
