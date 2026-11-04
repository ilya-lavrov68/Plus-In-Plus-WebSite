import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ProfileForm } from "@/components/site/profile-form";
import { findAccountById, listPasskeys } from "@/lib/accounts";
import { getRequestTranslations } from "@/lib/server-i18n";
import { localAvatarPath } from "@/lib/upload-policy";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("profile");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [dbUser, credentials] = await Promise.all([
    findAccountById(session.user.id),
    listPasskeys(session.user.id),
  ]);
  if (dbUser?.isBlocked) redirect("/login");

  return (
    <ProfileForm
      sessionRole={session.user.role ?? "USER"}
      security={{
        required: ["FOUNDER", "ADMIN", "MANAGER"].includes(dbUser?.role ?? ""),
        initialTotpEnabled: Boolean(dbUser?.mfaSecret),
        initialPasskeys: credentials.map((credential) => ({
          id: credential.id,
          name: credential.name,
        })),
      }}
      initialUser={{
        email: dbUser?.email ?? session.user.email ?? "",
        firstName: dbUser?.firstName ?? session.user.firstName ?? "",
        lastName: dbUser?.lastName ?? session.user.lastName ?? "",
        avatar: localAvatarPath(dbUser?.avatar ?? session.user.avatar),
        role: dbUser?.role ?? session.user.role ?? "USER",
      }}
    />
  );
}
