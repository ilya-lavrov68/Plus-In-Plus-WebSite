import Link from "next/link";

import { getRequestTranslations } from "@/lib/server-i18n";

/**
 * 404 page. Copy lives in `messages/*.json` under `errors.*` and follows the
 * language of the request, like every other page: no hard-coded English here.
 */
export default async function NotFound() {
  const t = await getRequestTranslations("errors");

  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
      <p className="font-body text-sm font-medium uppercase tracking-[0.2em] text-[#052B42]/60">404</p>
      <h1 className="mt-4 font-geist text-3xl font-semibold tracking-[-0.04em] text-[#052B42] sm:text-4xl">
        {t("notFound")}
      </h1>
      <p className="mt-4 max-w-xl font-body text-base font-normal leading-relaxed text-[#052B42]/80">
        {t("notFoundDescription")}
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-[#052B42] px-8 font-body text-sm font-semibold text-white transition-colors duration-200 ease-out hover:bg-[#0A4366] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-2"
      >
        {t("backHome")}
      </Link>
    </section>
  );
}
