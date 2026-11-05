import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ProfileForm } from "@/components/site/profile-form";
import { findAccountById, listPasskeys, type PasskeyRecord } from "@/lib/accounts";
import { getRequestTranslations } from "@/lib/server-i18n";
import { localAvatarPath } from "@/lib/upload-policy";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getRequestTranslations("profile");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Чтение профиля не должно ронять страницу целиком.
 *
 * Раньше `Promise.all` превращал любую ошибку БД — устаревшую схему без таблицы
 * `webauthn_credentials`, недоступный файл базы — в аварию всего маршрута:
 * посетитель вместо формы видел экран ошибки. Теперь каждый запрос
 * разрешается отдельно: что прочиталось — показываем, что нет — подставляем
 * данные из сессии и пишем ошибку в лог сервера. Проверка блокировки остаётся
 * в силе всякий раз, когда строка аккаунта действительно прочитана.
 */
async function loadProfile(userId: string): Promise<{
  account: Awaited<ReturnType<typeof findAccountById>>;
  passkeys: PasskeyRecord[];
}> {
  const [accountResult, passkeysResult] = await Promise.allSettled([
    findAccountById(userId),
    listPasskeys(userId),
  ]);

  if (accountResult.status === "rejected") {
    console.error("Profile page: failed to read account:", accountResult.reason);
  }
  if (passkeysResult.status === "rejected") {
    console.error("Profile page: failed to read passkeys:", passkeysResult.reason);
  }

  return {
    account: accountResult.status === "fulfilled" ? accountResult.value : null,
    passkeys: passkeysResult.status === "fulfilled" ? passkeysResult.value : [],
  };
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { account: dbUser, passkeys: credentials } = await loadProfile(session.user.id);
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
