import { redirect } from "next/navigation";

import { adminLabels } from "@/components/admin/labels";
import { requireStaff } from "@/lib/admin-session";
import { getRequestLocale } from "@/lib/request-locale";
import { STORY_CONTENT_LIMITS } from "@/lib/story-content";
import { getStoryContent } from "@/lib/story";

import { saveStoryAction } from "./actions";

const inputClass =
  "h-10 w-full border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal";
const labelClass = "flex flex-col gap-2 text-sm font-medium";

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
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">{t.story.title}</h1>
        <p className="text-sm text-muted-foreground">{t.story.subtitle}</p>
      </header>

      {error ? (
        <p role="alert" className="border border-destructive px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="border border-brand-signal px-4 py-3 text-sm">
          {t.story.saved}
        </p>
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
            <p className="text-xs text-muted-foreground">
              {t.story.eventsHint.replace("{count}", String(STORY_CONTENT_LIMITS.events))}
            </p>
          </div>

          {rows.map((event, index) => (
            <fieldset key={`${event.id || "new"}-${index}`} className="flex flex-col gap-3 border border-border p-4">
              <legend className="px-2 text-xs text-muted-foreground">
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
          className="h-10 w-fit border border-brand-signal bg-brand-signal px-4 text-sm font-medium text-[#12131B] transition-colors hover:bg-brand-signal-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-signal"
        >
          {t.table.save}
        </button>
      </form>
    </div>
  );
}
