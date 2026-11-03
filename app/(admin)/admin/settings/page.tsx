import { redirect } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import { requireFounder } from "@/lib/admin-session";
import { listSiteSettings } from "@/lib/commerce-data";
import { getRequestLocale } from "@/lib/request-locale";
import { isSecretSiteSettingKey } from "@/lib/site-settings";

import { saveSettings } from "./actions";

const inputClass =
  "h-10 w-full border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal";
const labelClass = "flex flex-col gap-2 text-sm font-medium";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  // Настройки платёжных ключей — только основатель; guard продублирован здесь,
  // потому что layout проверяет лишь staff-уровень.
  const founder = await requireFounder();
  if (!founder) redirect("/admin");

  const [query, locale] = await Promise.all([searchParams, getRequestLocale()]);
  const t = adminLabels(locale);

  const stored = await listSiteSettings(null);
  const error = typeof query.error === "string" && query.error ? query.error : null;
  const saved = query.saved === "1";

  const publicKeys = t.settings.groups.public.keys;
  const paymentKeys = t.settings.groups.payment.keys;
  const notificationKeys = t.settings.groups.notification.keys;

  const field = (key: string) => {
    const secret = isSecretSiteSettingKey(key);
    const current = stored[key] ?? "";
    return (
      <label key={key} className={labelClass}>
        {t.settings.labels[key as keyof typeof t.settings.labels] ?? key}
        <input
          name={key}
          type={secret ? "password" : "text"}
          autoComplete="off"
          defaultValue={secret ? "" : current}
          placeholder={secret ? (current ? t.settings.secretSet : t.settings.secretEmpty) : ""}
          className={inputClass}
        />
        {secret ? <span className="text-xs font-normal text-muted-foreground">{t.settings.secretHint}</span> : null}
      </label>
    );
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">{t.settings.title}</h1>
        <p className="text-sm text-muted-foreground">{t.settings.subtitle}</p>
      </header>

      {error ? (
        <p role="alert" className="border border-destructive px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="border border-brand-signal px-4 py-3 text-sm">
          {t.settings.saved}
        </p>
      ) : null}

      <form action={saveSettings} className="flex flex-col gap-8">
        <fieldset className="flex flex-col gap-4 border border-border p-4">
          <legend className="px-2 text-sm font-semibold">{t.settings.groups.public.title}</legend>
          {publicKeys.map(field)}
        </fieldset>

        <fieldset className="flex flex-col gap-4 border border-border p-4">
          <legend className="px-2 text-sm font-semibold">{t.settings.groups.payment.title}</legend>
          <p className="text-xs text-muted-foreground">{t.settings.groups.payment.hint}</p>
          {paymentKeys.map(field)}
        </fieldset>

        <fieldset className="flex flex-col gap-4 border border-border p-4">
          <legend className="px-2 text-sm font-semibold">{t.settings.groups.notification.title}</legend>
          {notificationKeys.map(field)}
        </fieldset>

        <button
          type="submit"
          className="h-10 w-fit border border-brand-signal bg-brand-signal px-4 text-sm font-medium text-[#12131B] transition-colors hover:bg-brand-signal-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
        >
          {t.table.save}
        </button>
      </form>
    </div>
  );
}
