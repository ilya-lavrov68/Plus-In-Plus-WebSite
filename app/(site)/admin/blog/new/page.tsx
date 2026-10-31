import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-session";

import { PostForm } from "@/components/admin/post-form";
import { getRequestTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const [admin, t] = await Promise.all([requireAdmin(), getRequestTranslations("admin")]);
  if (!admin) redirect("/");
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{t("newPost")}</h1>
      <p className="mt-2 text-muted-foreground">{t("form.newPostSubtitle")}</p>
      <div className="mt-8">
        <PostForm mode="create" />
      </div>
    </div>
  );
}
