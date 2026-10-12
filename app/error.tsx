"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

/**
 * Root error boundary. Every message comes from `messages/*.json` (`errors.*`),
 * so a Russian visitor sees the failure in Russian.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
      <h1 className="font-geist text-3xl font-semibold tracking-[-0.04em] text-[#052B42] sm:text-4xl">
        {t("serverError")}
      </h1>
      <p className="mt-4 max-w-xl font-body text-base font-normal leading-relaxed text-[#052B42]/80">
        {t("tryAgain")}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-[#052B42] px-8 font-body text-sm font-medium text-white transition-colors duration-200 ease-out hover:bg-[#0A4366] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-2"
      >
        {t("tryAgain")}
      </button>
    </section>
  );
}
