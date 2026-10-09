"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { createPost, updatePost } from "@/app/actions/posts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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
  const [coverName, setCoverName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
        <Input id="post-title" name="title" required defaultValue={initial?.title} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-slug">Slug</Label>
        <Input
          id="post-slug"
          name="slug"
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          title="Lowercase letters, numbers and dashes"
          defaultValue={initial?.slug}
        />
        <p className="text-xs text-muted-foreground">Used in the URL: /blog/&lt;slug&gt;</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-excerpt">Excerpt</Label>
        <Textarea id="post-excerpt" name="excerpt" required rows={2} defaultValue={initial?.excerpt} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-content">Content (HTML allowed)</Label>
        <Textarea id="post-content" name="content" required rows={12} defaultValue={initial?.content} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-read-time">Read time (minutes)</Label>
        <Input
          id="post-read-time"
          name="readTime"
          type="number"
          min={1}
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
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          required={mode === "create"}
          onChange={(event) => setCoverName(event.target.files?.[0]?.name ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          Saved to /public/uploads/blog/.{" "}
          {mode === "edit" ? "Leave empty to keep the current cover." : "Required."}
          {coverName ? ` Selected: ${coverName}` : ""}
        </p>
        {mode === "edit" && initial?.coverImage ? (
          <div className="relative mt-2 h-24 w-40 overflow-hidden rounded-md border border-border">
            <Image
              src={initial.coverImage}
              alt="Current cover"
              fill
              sizes="160px"
              className="object-cover"
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
