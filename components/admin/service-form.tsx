"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { createService, updateService } from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SafeImage } from "@/components/site/safe-image";
import { IMAGE_ACCEPT, MAX_COVER_BYTES } from "@/lib/upload-policy";

export interface ServiceFormProps {
  mode: "create" | "edit";
  serviceId?: string;
  initial?: {
    title: string;
    category: string;
    shortDesc: string;
    fullDesc: string;
    includes: string[];
    shapes: string[];
    resultText: string;
    coverImage: string;
    isPublished: boolean;
  };
}

/**
 * CRUD form for services. Cover images are uploaded to
 * /public/uploads/services/ (strictly) via the createService/updateService
 * server actions; the path is stored in the DB.
 */
export function ServiceForm({ mode, serviceId, initial }: ServiceFormProps) {
  const router = useRouter();
  const [category, setCategory] = useState(initial?.category ?? "small");
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false);
  const [coverName, setCoverName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    formData.set("category", category);
    formData.set("isPublished", String(isPublished));

    try {
      const result =
        mode === "create"
          ? await createService(formData)
          : await updateService(serviceId ?? "", formData);

      if (!result.ok) {
        setError(result.error ?? "Saving failed.");
        return;
      }

      router.push("/admin/services");
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
        <Label htmlFor="service-title">Title</Label>
        <Input id="service-title" name="title" maxLength={160} required defaultValue={initial?.title} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-category">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="service-category" className="w-full sm:w-56">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Small design</SelectItem>
            <SelectItem value="large">Large design</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-short-desc">Short description</Label>
        <Textarea id="service-short-desc" name="shortDesc" maxLength={500} required rows={2} defaultValue={initial?.shortDesc} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-full-desc">Full description</Label>
        <Textarea id="service-full-desc" name="fullDesc" maxLength={100000} required rows={6} defaultValue={initial?.fullDesc} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-includes">What&apos;s included (one item per line)</Label>
        <Textarea id="service-includes" name="includes" maxLength={10000} rows={4} defaultValue={initial?.includes.join("\n")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-shapes">Shapes (one item per line)</Label>
        <Textarea id="service-shapes" name="shapes" maxLength={10000} rows={4} defaultValue={initial?.shapes.join("\n")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-result">Result text</Label>
        <Textarea id="service-result" name="resultText" maxLength={10000} required rows={3} defaultValue={initial?.resultText} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-cover">Cover image</Label>
        <Input
          id="service-cover"
          name="cover"
          type="file"
          accept={IMAGE_ACCEPT}
          required={mode === "create"}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setError(null);
            if (file && file.size > MAX_COVER_BYTES) {
              event.target.value = "";
              setCoverName(null);
              setError("Cover image must be 8 MB or smaller.");
              return;
            }
            setCoverName(file?.name ?? null);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Up to 8 MB. Saved as WebP to /public/uploads/services/.{" "}
          {mode === "edit" ? "Leave empty to keep the current cover." : "Required."}
          {coverName ? ` Selected: ${coverName}` : ""}
        </p>
        {mode === "edit" && initial?.coverImage ? (
          <div className="relative mt-2 h-24 w-40 overflow-hidden rounded-md border border-border">
            <SafeImage
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
        <Switch id="service-published" checked={isPublished} onCheckedChange={setIsPublished} />
        <Label htmlFor="service-published" className="cursor-pointer">
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
          {pending ? "Saving…" : mode === "create" ? "Create service" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            router.push("/admin/services");
            router.refresh();
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
