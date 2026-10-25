"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ExternalLink, History, Plus, Save, Trash2 } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";

import { updateStoryContent } from "@/app/actions/story";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  normalizeStoryContent,
  STORY_CONTENT_LIMITS,
  type StoryContent,
  type StoryEvent,
} from "@/lib/story-content";

function emptyEvent(id: string): StoryEvent {
  return { id, period: "", title: "", description: "" };
}

export function StoryForm({ initial }: { initial: StoryContent }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const router = useRouter();
  const formId = useId();
  const generatedId = useRef(0);
  const [heading, setHeading] = useState(initial.heading);
  const [description, setDescription] = useState(initial.description);
  const [events, setEvents] = useState<StoryEvent[]>(initial.events);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);

  function addEvent() {
    if (events.length >= STORY_CONTENT_LIMITS.events) return;
    const fallbackId = `moment-${Date.now().toString(36)}-${generatedId.current++}`;
    const id = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : fallbackId;
    setEvents((current) =>
      current.length >= STORY_CONTENT_LIMITS.events ? current : [...current, emptyEvent(id)],
    );
    setStatus(null);
  }

  function updateEvent(id: string, patch: Partial<Omit<StoryEvent, "id">>) {
    setEvents((current) => current.map((event) => (event.id === id ? { ...event, ...patch } : event)));
    setStatus(null);
  }

  function moveEvent(id: string, direction: -1 | 1) {
    setEvents((current) => {
      const index = current.findIndex((event) => event.id === id);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
    setStatus(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setStatus(null);

    const normalized = normalizeStoryContent({ heading, description, events });
    if (!normalized) {
      setStatus({ error: true, text: t("storyForm.invalid") });
      return;
    }

    setPending(true);
    try {
      const result = await updateStoryContent(normalized);
      if (!result.ok) {
        setStatus({ error: true, text: result.error ?? t("storyForm.saveFailed") });
        return;
      }
      setHeading(normalized.heading);
      setDescription(normalized.description);
      setEvents(normalized.events);
      setStatus({ error: false, text: t("storyForm.saved") });
      router.refresh();
    } catch {
      setStatus({ error: true, text: t("storyForm.saveFailed") });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-4xl space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold">{t("storyForm.introduction")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("storyForm.introductionHelp")}</p>
        <div className="mt-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-heading`}>{t("storyForm.heading")}</Label>
            <Input
              id={`${formId}-heading`}
              value={heading}
              maxLength={STORY_CONTENT_LIMITS.heading}
              placeholder={t("storyForm.headingPlaceholder")}
              onChange={(event) => {
                setHeading(event.target.value);
                setStatus(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-description`}>{t("storyForm.description")}</Label>
            <Textarea
              id={`${formId}-description`}
              value={description}
              rows={3}
              maxLength={STORY_CONTENT_LIMITS.description}
              placeholder={t("storyForm.descriptionPlaceholder")}
              onChange={(event) => {
                setDescription(event.target.value);
                setStatus(null);
              }}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("storyForm.moments")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("storyForm.eventCount", { count: events.length, max: STORY_CONTENT_LIMITS.events })}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="group"
            disabled={events.length >= STORY_CONTENT_LIMITS.events}
            onClick={addEvent}
          >
            <Plus aria-hidden="true" className="h-4 w-4 transition-transform duration-200 ease-out group-hover:rotate-90" />
            {t("storyForm.addMoment")}
          </Button>
        </div>

        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
            <History aria-hidden="true" className="mx-auto h-6 w-6 text-muted-foreground" />
            <h3 className="mt-3 font-medium">{t("storyForm.noMoments")}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("storyForm.noMomentsHelp")}</p>
          </div>
        ) : null}

        {events.map((item, index) => (
          <article key={item.id} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-medium">{t("storyForm.moment", { count: index + 1 })}</h3>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={index === 0}
                  aria-label={t("storyForm.moveUp")}
                  title={t("storyForm.moveUp")}
                  onClick={() => moveEvent(item.id, -1)}
                >
                  <ArrowUp aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={index === events.length - 1}
                  aria-label={t("storyForm.moveDown")}
                  title={t("storyForm.moveDown")}
                  onClick={() => moveEvent(item.id, 1)}
                >
                  <ArrowDown aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  aria-label={t("storyForm.removeMoment")}
                  title={t("storyForm.removeMoment")}
                  onClick={() => {
                    setEvents((current) => current.filter((event) => event.id !== item.id));
                    setStatus(null);
                  }}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]">
              <div className="space-y-2">
                <Label htmlFor={`${formId}-period-${item.id}`}>{t("storyForm.period")}</Label>
                <Input
                  id={`${formId}-period-${item.id}`}
                  required
                  maxLength={STORY_CONTENT_LIMITS.period}
                  value={item.period}
                  placeholder={t("storyForm.periodPlaceholder")}
                  onChange={(event) => updateEvent(item.id, { period: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${formId}-title-${item.id}`}>{t("storyForm.eventTitle")}</Label>
                <Input
                  id={`${formId}-title-${item.id}`}
                  required
                  maxLength={STORY_CONTENT_LIMITS.eventTitle}
                  value={item.title}
                  placeholder={t("storyForm.eventTitlePlaceholder")}
                  onChange={(event) => updateEvent(item.id, { title: event.target.value })}
                />
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <Label htmlFor={`${formId}-event-description-${item.id}`}>{t("storyForm.eventDescription")}</Label>
              <Textarea
                id={`${formId}-event-description-${item.id}`}
                required
                rows={4}
                maxLength={STORY_CONTENT_LIMITS.eventDescription}
                value={item.description}
                placeholder={t("storyForm.eventDescriptionPlaceholder")}
                onChange={(event) => updateEvent(item.id, { description: event.target.value })}
              />
            </div>
          </article>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Save aria-hidden="true" className="h-4 w-4" />
          {pending ? tc("saving") : t("storyForm.save")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/#story">
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            {t("storyForm.preview")}
          </Link>
        </Button>
      </div>
      {status ? (
        <p role={status.error ? "alert" : "status"} className={status.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {status.text}
        </p>
      ) : null}
    </form>
  );
}
