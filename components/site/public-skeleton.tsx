"use client";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export function PublicPageSkeleton() {
  const t = useTranslations("common");
  const label = t("loadingPage");
  return (
    <div role="status" aria-label={label} className="space-y-8 px-5 py-8 sm:px-8 lg:px-12">
      <span className="sr-only">{label}…</span>
      <Skeleton className="mx-auto h-[clamp(260px,32vw,560px)] w-full max-w-[1440px] rounded-2xl" />
      <div className="mx-auto grid w-full max-w-[1440px] gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-56 rounded-2xl" />)}
      </div>
    </div>
  );
}

export function ContentPageSkeleton() {
  const t = useTranslations("common");
  const label = t("loadingContent");
  return (
    <div role="status" aria-label={label} className="mx-auto w-full max-w-[1440px] space-y-8 px-5 py-10 sm:px-8 lg:px-12">
      <span className="sr-only">{label}…</span>
      <div className="space-y-3"><Skeleton className="h-12 w-3/4 max-w-2xl" /><Skeleton className="h-5 w-full max-w-xl" /></div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-64 rounded-2xl" />)}
      </div>
    </div>
  );
}
