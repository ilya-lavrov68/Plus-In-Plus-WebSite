import type { Metadata } from "next";

import { Signup10 } from "@/components/blocks/signup10";
import { createPageMetadata } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getRequestLocale(),
    getRequestTranslations("metadata"),
  ]);
  return createPageMetadata({
    title: t("register"),
    description: t("registerDescription"),
    path: "/register",
    locale,
  });
}

export default function RegisterPage() {
  return <Signup10 defaultMode="register" />;
}
