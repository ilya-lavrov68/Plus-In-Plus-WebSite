import { redirect } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import {
  AdminChip,
  AdminPageHeader,
  AdminPanel,
  AdminStatus,
  adminFilledButtonClass,
  adminHintClass,
  adminInputClass,
  adminSelectClass,
  adminTonalButtonClass,
} from "@/components/admin/ui";
import { requireFounder } from "@/lib/admin-session";
import { listSiteSettings } from "@/lib/commerce-data";
import { getRequestLocale } from "@/lib/request-locale";
import {
  ROBOKASSA_HASH_ALGOS,
  isSecretSiteSettingKey,
} from "@/lib/site-settings";

import { saveSettings, testNotifications } from "./actions";

/** Поля-перечисления рисуются как `<select>`: произвольную строку туда не ввести. */
const SELECT_FIELDS = new Set(["robokassaTestMode", "robokassaHashAlgo"]);
const MULTILINE_FIELDS = new Set(["studioDescription", "metaDescription"]);

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    field?: string;
    saved?: string;
    test?: string;
  }>;
}) {
  // Настройки платёжных ключей — только основатель; guard продублирован здесь,
  // потому что layout проверяет лишь staff-уровень.
  const founder = await requireFounder();
  if (!founder) redirect("/admin");

  const [query, locale] = await Promise.all([searchParams, getRequestLocale()]);
  const t = adminLabels(locale);
  const settingsLabels = t.settings;

  const stored = await listSiteSettings(null);
  const savedCount = query.saved !== undefined ? Number(query.saved) : null;
  const errorCode = typeof query.error === "string" && query.error ? query.error : null;
  const errorField = typeof query.field === "string" && query.field ? query.field : null;
  const testResult = typeof query.test === "string" && query.test ? query.test : null;

  const label = (key: string) =>
    settingsLabels.labels[key as keyof typeof settingsLabels.labels] ?? key;

  const field = (key: string) => {
    const secret = isSecretSiteSettingKey(key);
    const current = stored[key] ?? "";
    const invalid = errorField === key;
    const describedBy: string[] = [];
    if (secret) describedBy.push(`${key}-hint`);
    if (invalid) describedBy.push(`${key}-error`);

    return (
      <div key={key} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={key} className="text-sm font-medium text-on-surface">
            {label(key)}
          </label>
          {secret ? (
            <AdminChip tone={current ? "primary" : "neutral"}>
              {current ? settingsLabels.secretStatusSet : settingsLabels.secretStatusEmpty}
            </AdminChip>
          ) : null}
        </div>

        {SELECT_FIELDS.has(key) ? (
          <select
            id={key}
            name={key}
            defaultValue={
              key === "robokassaTestMode"
                ? current === "1"
                  ? "1"
                  : "0"
                : current || "md5"
            }
            className={adminSelectClass}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy.join(" ") || undefined}
          >
            {key === "robokassaTestMode" ? (
              <>
                <option value="1">{locale === "ru" ? "Тестовый режим (1)" : "Test mode (1)"}</option>
                <option value="0">{locale === "ru" ? "Боевой режим (0)" : "Live mode (0)"}</option>
              </>
            ) : (
              ROBOKASSA_HASH_ALGOS.map((algo) => (
                <option key={algo} value={algo}>
                  {algo}
                </option>
              ))
            )}
          </select>
        ) : MULTILINE_FIELDS.has(key) ? (
          <textarea
            id={key}
            name={key}
            rows={3}
            defaultValue={current}
            placeholder={secret ? settingsLabels.secretEmpty : undefined}
            className={`${adminInputClass} h-auto min-h-24 py-2.5 leading-relaxed`}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy.join(" ") || undefined}
          />
        ) : (
          <input
            id={key}
            name={key}
            type={secret ? "password" : key === "contactEmail" || key === "notificationEmail" ? "email" : "text"}
            autoComplete="off"
            spellCheck={false}
            defaultValue={secret ? "" : current}
            placeholder={
              secret
                ? current
                  ? settingsLabels.secretSet
                  : settingsLabels.secretEmpty
                : undefined
            }
            className={adminInputClass}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy.join(" ") || undefined}
          />
        )}

        {secret ? (
          <div className="flex flex-col gap-2">
            <span id={`${key}-hint`} className={adminHintClass}>
              {settingsLabels.secretHint}
            </span>
            {current ? (
              <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                <input
                  type="checkbox"
                  name={`clear:${key}`}
                  value="1"
                  className="size-4 rounded border-outline bg-transparent accent-[var(--md-primary)]"
                />
                {settingsLabels.clearSecret}
              </label>
            ) : null}
          </div>
        ) : null}

        {invalid && errorCode ? (
          <span id={`${key}-error`} role="alert" className="text-xs font-medium text-error">
            {settingsLabels.errors[errorCode] ?? settingsLabels.errors.invalidValue}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow={t.brand}
        title={settingsLabels.title}
        description={settingsLabels.subtitle}
      />

      {savedCount !== null && savedCount > 0 ? (
        <AdminStatus tone="success">
          {settingsLabels.savedCount} {savedCount}. {settingsLabels.saveHint}
        </AdminStatus>
      ) : null}
      {savedCount === 0 ? <AdminStatus tone="info">{settingsLabels.nothingChanged}</AdminStatus> : null}
      {errorCode && !errorField ? (
        <AdminStatus tone="error">
          {settingsLabels.errorPrefix} {settingsLabels.errors[errorCode] ?? errorCode}
        </AdminStatus>
      ) : null}
      {testResult ? (
        <AdminStatus
          tone={testResult === "ok" ? "success" : testResult === "not_configured" ? "info" : "error"}
        >
          {settingsLabels.test[testResult as keyof typeof settingsLabels.test] ?? testResult}
        </AdminStatus>
      ) : null}

      <form action={saveSettings} className="flex flex-col gap-4">
        <AdminPanel
          title={settingsLabels.groups.public.title}
          description={settingsLabels.groups.public.hint}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            {settingsLabels.groups.public.keys.map(field)}
          </div>
        </AdminPanel>

        <AdminPanel
          title={settingsLabels.groups.payment.title}
          description={settingsLabels.groups.payment.hint}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            {settingsLabels.groups.payment.keys.map(field)}
          </div>
        </AdminPanel>

        <AdminPanel
          title={settingsLabels.groups.notification.title}
          description={settingsLabels.groups.notification.hint}
          actions={
            <button type="submit" formAction={testNotifications} formNoValidate className={adminTonalButtonClass}>
              {settingsLabels.test.button}
            </button>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2">
            {settingsLabels.groups.notification.keys.map(field)}
          </div>
          <p className={`mt-4 ${adminHintClass}`}>
            {settingsLabels.groups.notification.emailHint}
          </p>
        </AdminPanel>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-container px-5 py-4">
          <button type="submit" className={adminFilledButtonClass}>
            {t.table.save}
          </button>
          <p className={`${adminHintClass} min-w-0 flex-1`}>{settingsLabels.saveHint}</p>
        </div>
      </form>
    </div>
  );
}
