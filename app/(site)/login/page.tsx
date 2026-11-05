import type { Metadata } from "next";

import { Signup10 } from "@/components/blocks/signup10";
import { MotionPreference } from "@/components/site/motion/motion-preference";
import { createPageMetadata } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getRequestLocale(),
    getRequestTranslations("metadata"),
  ]);
  return createPageMetadata({
    title: t("login"),
    description: t("loginDescription"),
    path: "/login",
    locale,
  });
}

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const mode = Array.isArray(query.mode) ? query.mode[0] : query.mode;
  const rawCallback = Array.isArray(query.callbackUrl) ? query.callbackUrl[0] : query.callbackUrl;
  const callbackUrl = rawCallback?.startsWith("/") && !rawCallback.startsWith("//") && !rawCallback.includes("\\")
    ? rawCallback
    : undefined;
  return (
    <MotionPreference>
      <Signup10 defaultMode="login" defaultAdminMode={mode === "admin"} callbackUrl={callbackUrl} />
    </MotionPreference>
  );
}
