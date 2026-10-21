"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

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
import { toast } from "@/components/ui/use-toast";
import { SafeImage } from "@/components/site/safe-image";
import { CoverImageHelp } from "@/components/admin/cover-image-help";
import { IMAGE_ACCEPT, MAX_COVER_BYTES } from "@/lib/upload-policy";

export interface ServiceFormProps {
  mode: "create" | "edit";
  serviceId?: string;
  initial?: {
    title: string;
    slug: string;
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
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const router = useRouter();
  const [category, setCategory] = useState(initial?.category ?? "small");
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
    formData.set("category", category);
    formData.set("isPublished", String(isPublished));

    try {
      const result =
        mode === "create"
          ? await createService(formData)
          : await updateService(serviceId ?? "", formData);

      if (!result.ok) {
        const message = result.error ?? t("form.saveFailed");
        setError(message);
        toast({ title: t("form.couldNotSaveService"), description: message, variant: "destructive" });
        return;
      }

      toast({ title: mode === "create" ? t("form.serviceCreated") : t("form.serviceUpdated"), description: t("form.serviceListRefreshed") });
      router.push("/admin/services");
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
        <Label htmlFor="service-title">{tc("title")}</Label>
        <Input id="service-title" name="title" maxLength={160} required defaultValue={initial?.title} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-slug">{t("form.urlSlug")}</Label>
        <Input
          id="service-slug"
          name="slug"
          maxLength={120}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="sign-design"
          defaultValue={initial?.slug}
        />
        <p className="text-xs text-muted-foreground">
          {t("form.slugHelp")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-category">{tc("category")}</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="service-category" className="w-full sm:w-56">
            <SelectValue placeholder={t("form.selectCategory")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">{t("form.smallDesign")}</SelectItem>
            <SelectItem value="large">{t("form.largeDesign")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-short-desc">{t("form.shortDescription")}</Label>
        <Textarea id="service-short-desc" name="shortDesc" maxLength={500} required rows={2} defaultValue={initial?.shortDesc} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-full-desc">{t("form.fullDescription")}</Label>
        <Textarea id="service-full-desc" name="fullDesc" maxLength={100000} required rows={6} defaultValue={initial?.fullDesc} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-includes">{t("form.whatsIncluded")}</Label>
        <Textarea id="service-includes" name="includes" maxLength={10000} required rows={4} defaultValue={initial?.includes.join("\n")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-shapes">{t("form.shapes")}</Label>
        <Textarea id="service-shapes" name="shapes" maxLength={10000} required rows={4} defaultValue={initial?.shapes.join("\n")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-result">{t("form.resultText")}</Label>
        <Textarea id="service-result" name="resultText" maxLength={10000} required rows={3} defaultValue={initial?.resultText} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service-cover">{t("form.coverImage")}</Label>
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
              setCoverFile(null);
              setError(t("form.coverTooLarge"));
              return;
            }
            setCoverFile(file ?? null);
          }}
        />
        <CoverImageHelp kind="services" file={coverFile} mode={mode} />
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

      <div className="flex items-center gap-3">
        <Switch id="service-published" checked={isPublished} onCheckedChange={setIsPublished} />
        <Label htmlFor="service-published" className="cursor-pointer">
          {isPublished ? t("published") : t("draft")}
        </Label>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tc("saving") : mode === "create" ? t("form.createService") : t("form.saveChanges")}
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
          {tc("cancel")}
        </Button>
      </div>
    </form>
  );
}
