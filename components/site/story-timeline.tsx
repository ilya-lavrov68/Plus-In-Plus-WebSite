import { History } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StoryEvent } from "@/lib/story-content";

export interface StoryTimelineLabels {
  eyebrow: string;
  timelineLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}

interface StoryTimelineProps {
  heading: string;
  description: string;
  events: StoryEvent[];
  labels: StoryTimelineLabels;
}

function StoryMoment({ event, index }: { event: StoryEvent; index: number }) {
  return (
    <li className="relative grid pl-12 md:grid-cols-2 md:gap-24 md:pl-0">
      <article
        data-reveal=""
        data-reveal-delay={Math.min(index, 5) * 60}
        aria-labelledby={`story-event-${event.id}`}
        className={cn(
          "story-card rounded-[1.5rem] bg-white/[0.045] p-6 sm:p-7",
          index % 2 === 0 ? "md:col-start-1" : "md:col-start-2",
        )}
      >
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {event.period}
        </p>
        <h3 id={`story-event-${event.id}`} className="mt-3 text-2xl font-medium tracking-tight">
          {event.title}
        </h3>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground sm:text-base">
          {event.description}
        </p>
      </article>

      <span
        aria-hidden="true"
        className="story-timeline-marker absolute left-0 top-5 z-10 flex size-6 items-center justify-center rounded-full bg-secondary md:left-1/2 md:-translate-x-1/2"
      >
        <span
          data-story-dot={index}
          className="story-timeline-dot size-2.5 rounded-full bg-primary"
        />
      </span>
    </li>
  );
}

/**
 * Server-rendered content with one progressive CSS scroll-timeline for the
 * line. Markers use the existing one-shot reveal observer instead of keeping
 * a separate scroll timeline alive for every moment. Unsupported browsers
 * simply show the complete line and active markers without hiding content.
 */
export function StoryTimeline({ heading, description, events, labels }: StoryTimelineProps) {
  return (
    <section id="story" aria-labelledby="story-heading" className="motion-section bg-background py-24 md:py-32">
      <div className="container">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-7">
            <p data-reveal="" className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span aria-hidden="true" className="h-px w-8 bg-foreground/40" />
              {labels.eyebrow}
            </p>
            <h2
              id="story-heading"
              data-reveal=""
              data-reveal-delay={60}
              className="mt-5 max-w-3xl text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl"
            >
              {heading}
            </h2>
          </div>
          <p
            data-reveal=""
            data-reveal-delay={110}
            className="max-w-xl text-base leading-relaxed text-muted-foreground lg:col-span-5 lg:justify-self-end"
          >
            {description}
          </p>
        </div>

        <div>
          {events.length === 0 ? (
            <div
              data-reveal=""
              className="glass-surface mt-14 flex max-w-3xl flex-col items-start gap-5 rounded-[1.5rem] bg-white/[0.04] p-7 sm:flex-row sm:items-center md:mt-20 md:p-8"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <History aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h3 className="text-xl font-medium">{labels.emptyTitle}</h3>
                <p className="mt-2 text-sm text-muted-foreground sm:text-base">{labels.emptyDescription}</p>
              </div>
            </div>
          ) : (
            <ol
              aria-label={labels.timelineLabel}
              className="story-timeline-track relative mt-14 space-y-6 md:mt-20 md:space-y-10"
            >
              <span
                aria-hidden="true"
                className="absolute bottom-8 left-[11px] top-8 w-0.5 rounded-full bg-foreground/10 md:left-[calc(50%-1px)]"
              />
              <span
                aria-hidden="true"
                data-story-progress=""
                className="story-timeline-progress absolute bottom-8 left-[11px] top-8 w-0.5 origin-top rounded-full bg-foreground/70 md:left-[calc(50%-1px)]"
              />
              {events.map((event, index) => (
                <StoryMoment key={event.id} event={event} index={index} />
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
