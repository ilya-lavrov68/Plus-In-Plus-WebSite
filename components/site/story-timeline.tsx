"use client";

import { History } from "lucide-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef } from "react";

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

interface StoryMomentProps {
  event: StoryEvent;
  index: number;
  total: number;
  progress: MotionValue<number>;
  reducedMotion: boolean;
}

function StoryMoment({ event, index, total, progress, reducedMotion }: StoryMomentProps) {
  const threshold = total <= 1 ? 0 : index / (total - 1);
  const activationStart = Math.max(0, threshold - 0.06);
  const activationEnd = Math.min(1, threshold + 0.02);
  const dotOpacity = useTransform(progress, [activationStart, activationEnd], [0.35, 1]);
  const dotScale = useTransform(progress, [activationStart, activationEnd], [0.7, 1]);

  return (
    <li className="relative grid pl-12 md:grid-cols-2 md:gap-24 md:pl-0">
      <span
        aria-hidden="true"
        className="absolute left-0 top-5 z-10 flex size-6 items-center justify-center rounded-full bg-secondary md:left-1/2 md:-translate-x-1/2"
      >
        <motion.span
          data-story-dot={index}
          className="story-timeline-dot size-2.5 rounded-full bg-primary"
          style={{
            opacity: reducedMotion ? 1 : dotOpacity,
            scale: reducedMotion ? 1 : dotScale,
          }}
        />
      </span>

      <article
        data-reveal=""
        data-reveal-delay={Math.min(index, 5) * 60}
        aria-labelledby={`story-event-${event.id}`}
        className={cn(
          "glass-surface rounded-[1.5rem] bg-white/[0.045] p-6 sm:p-7",
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
    </li>
  );
}

export function StoryTimeline({ heading, description, events, labels }: StoryTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion() === true;
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 80%", "end 45%"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    mass: 0.35,
  });

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

        <div ref={timelineRef}>
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
              className="relative mt-14 space-y-6 md:mt-20 md:space-y-10"
            >
              <span
                aria-hidden="true"
                className="absolute bottom-8 left-[11px] top-8 w-0.5 rounded-full bg-foreground/10 md:left-[calc(50%-1px)]"
              />
              <motion.span
                aria-hidden="true"
                data-story-progress=""
                className="story-timeline-progress absolute bottom-8 left-[11px] top-8 w-0.5 origin-top rounded-full bg-foreground/70 md:left-[calc(50%-1px)]"
                style={{ scaleY: reducedMotion ? 1 : progress }}
              />
              {events.map((event, index) => (
                <StoryMoment
                  key={event.id}
                  event={event}
                  index={index}
                  total={events.length}
                  progress={progress}
                  reducedMotion={reducedMotion}
                />
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
