import { redirect } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import {
  AdminPageHeader,
  AdminStatus,
  adminFilledButtonClass,
  adminInputClass,
  adminLabelClass,
} from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";
import { STORY_CONTENT_LIMITS } from "@/lib/story-content";
import { getStoryContent } from "@/lib/story";

import { saveStoryAction } from "./actions";

const inputClass = adminInputClass;
const labelClass = adminLabelClass;

export default async function AdminStoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff?.isAdmin) redirect("/admin");

  const [query, locale] = await Promise.all([searchParams, getRequestLocale()]);
  const t = adminLabels(locale);
  const content = await getStoryContent();
  const error = typeof query.error === "string" && query.error ? query.error : null;
  const saved = query.saved === "1";

  // Пустые строки нужны, чтобы было куда дописать веху: сохраняется только
  // заполненное, поэтому лишние поля ничего не ломают.
  const blank = { id: "", period: "", title: "", description: "" };
  const rows = [...content.events, blank, blank];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <AdminPageHeader title={t.story.title} description={t.story.subtitle} />

      {error ? (
        <AdminStatus tone="error">{error}</AdminStatus>
      ) : null}
      {saved ? (
        <AdminStatus tone="success">{t.story.saved}</AdminStatus>
      ) : null}

      <form action={saveStoryAction} className="flex flex-col gap-6">
        <label className={labelClass}>
          {t.story.heading}
          <input name="heading" defaultValue={content.heading} maxLength={STORY_CONTENT_LIMITS.heading} className={inputClass} />
        </label>

        <label className={labelClass}>
          {t.story.description}
          <textarea
            name="description"
            defaultValue={content.description}
            rows={4}
            maxLength={STORY_CONTENT_LIMITS.description}
            className={`${inputClass} h-auto py-2`}
          />
        </label>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold">{t.story.events}</h2>
            <p className="text-xs text-on-surface-variant">
              {t.story.eventsHint.replace("{count}", String(STORY_CONTENT_LIMITS.events))}
            </p>
          </div>

          {rows.map((event, index) => (
            <fieldset key={`${event.id || "new"}-${index}`} className="flex flex-col gap-3 border border-outline-variant p-4">
              <legend className="px-2 text-xs text-on-surface-variant">
                {t.story.event} {index + 1}
              </legend>
              {event.id ? <input type="hidden" name={`event-${index}-id`} value={event.id} /> : null}

              <div className="grid gap-3 sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)]">
                <label className={labelClass}>
                  {t.story.period}
                  <input
                    name={`event-${index}-period`}
                    defaultValue={event.period}
                    maxLength={STORY_CONTENT_LIMITS.period}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  {t.story.eventTitle}
                  <input
                    name={`event-${index}-title`}
                    defaultValue={event.title}
                    maxLength={STORY_CONTENT_LIMITS.eventTitle}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className={labelClass}>
                {t.story.eventDescription}
                <textarea
                  name={`event-${index}-description`}
                  defaultValue={event.description}
                  rows={2}
                  maxLength={STORY_CONTENT_LIMITS.eventDescription}
                  className={`${inputClass} h-auto py-2`}
                />
              </label>
            </fieldset>
          ))}
        </section>

        <button
          type="submit"
          className={adminFilledButtonClass}
        >
          {t.table.save}
        </button>
      </form>
    </div>
  );
}
