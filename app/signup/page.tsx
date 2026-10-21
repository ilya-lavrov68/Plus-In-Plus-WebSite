import type { Metadata } from "next";

import { Signup10 } from "@/components/blocks/signup10";
import { createPageMetadata } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return createPageMetadata({
    title: "Register — Plus In Plus",
    description: "Create a free Plus In Plus account to place and track orders.",
    path: "/signup",
    locale,
  });
}

export default function SignupPage() {
  return <Signup10 defaultMode="register" />;
}
