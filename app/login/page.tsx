import type { Metadata } from "next";

import { Signup10 } from "@/components/blocks/signup10";
import { createPageMetadata } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return createPageMetadata({
    title: "Log in — Plus In Plus",
    description: "Sign in to your Plus In Plus account or staff dashboard.",
    path: "/login",
    locale,
  });
}

export default function LoginPage() {
  return <Signup10 defaultMode="login" />;
}
