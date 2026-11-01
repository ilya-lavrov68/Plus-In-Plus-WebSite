"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { AgentDiagram } from "@/components/ai/agent-diagram";
import { Button } from "@/components/ui/button";
import { AGENT_SHADER_CYCLE_SECONDS, type AgentKind, type AgentScene } from "@/lib/agent-shaders";
import { cn } from "@/lib/utils";

type PlaybackState = "idle" | "playing" | "paused";

interface AgentShaderPlayerProps {
  agent: AgentKind;
  scene?: AgentScene;
  labels: {
    play: string;
    pause: string;
    resume: string;
  };
}

/**
 * The original shader loops are pre-rendered from lib/agent-shaders.ts. Native
 * video avoids runtime shader compilation and software-GPU stalls while keeping
 * the same motion, pause/resume controls and a lightweight poster from the same frame.
 */
export function AgentShaderPlayer({ agent, scene, labels }: AgentShaderPlayerProps) {
  const resolvedScene = scene ?? agent;
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const userPausedRef = useRef(false);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [ready, setReady] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState>("idle");

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion !== false) return;
    const element = frameRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    let idleHandle: number | null = null;
    let quietTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let activated = false;
    const activate = () => {
      if (activated) return;
      activated = true;
      window.removeEventListener("scroll", schedule);
      const startLoading = () => setNearViewport(true);
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(startLoading);
      } else {
        fallbackTimer = setTimeout(startLoading, 120);
      }
    };
    const schedule = () => {
      if (quietTimer !== null) clearTimeout(quietTimer);
      quietTimer = setTimeout(activate, 220);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        schedule();
        window.addEventListener("scroll", schedule, { passive: true });
      },
      { rootMargin: "240px 0px", threshold: 0.01 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      if (idleHandle !== null) window.cancelIdleCallback(idleHandle);
      if (quietTimer !== null) clearTimeout(quietTimer);
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!nearViewport || reducedMotion !== false) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.load();
  }, [nearViewport, reducedMotion, resolvedScene]);

  useEffect(() => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame || !nearViewport) return;
    if (reducedMotion !== false) {
      video.pause();
      return;
    }

    let visible = false;
    const play = () => {
      if (userPausedRef.current || document.hidden || !visible) return;
      video.play().catch(() => {
        // Autoplay policy or decode failure leaves a usable manual control.
        setPlayback("paused");
      });
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) {
          video.pause();
          return;
        }
        play();
      },
      { threshold: 0.35 },
    );
    const onVisibilityChange = () => {
      if (document.hidden) video.pause();
      else play();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    observer.observe(frame);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      video.pause();
    };
  }, [nearViewport, reducedMotion, resolvedScene]);

  const enhanced = ready && playback !== "idle" && reducedMotion === false;
  const label = playback === "playing" ? labels.pause : playback === "paused" ? labels.resume : labels.play;
  const Icon = playback === "playing" ? Pause : Play;

  return (
    <div
      ref={frameRef}
      data-agent={agent}
      data-scene={resolvedScene}
      data-playback={playback}
      data-shader-loop={AGENT_SHADER_CYCLE_SECONDS}
      data-renderer="video"
      className="relative size-full overflow-hidden bg-background"
    >
      <video
        ref={videoRef}
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 size-full object-fill opacity-0", enhanced && "opacity-100")}
        loop
        muted
        playsInline
        preload="none"
        onCanPlay={() => setReady(true)}
        onPlaying={() => {
          setReady(true);
          setPlayback("playing");
        }}
        onPause={() => setPlayback("paused")}
        onError={() => {
          setReady(false);
          setPlayback("idle");
        }}
      >
        {nearViewport && reducedMotion === false ? (
          <>
            <source src={`/assets/agents/${resolvedScene}.mp4`} type="video/mp4" />
            <source src={`/assets/agents/${resolvedScene}.webm`} type="video/webm" />
          </>
        ) : null}
      </video>
      <div className="pointer-events-none absolute inset-0">
        <AgentDiagram agent={agent} scene={resolvedScene} enhanced={enhanced} />
      </div>
      {enhanced ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            if (playback === "playing") {
              userPausedRef.current = true;
              video.pause();
            } else {
              userPausedRef.current = false;
              video.play().catch(() => setPlayback("paused"));
            }
          }}
          aria-label={label}
          title={label}
          data-shader-control={resolvedScene}
          className="absolute right-3 bottom-3 size-8 border-border bg-background/90 text-foreground backdrop-blur-sm hover:bg-card [&_svg]:size-3.5"
        >
          <Icon aria-hidden="true" className="text-primary" />
        </Button>
      ) : null}
    </div>
  );
}
