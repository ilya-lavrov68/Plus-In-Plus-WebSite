"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

import { AgentDiagram } from "@/components/ai/agent-diagram";
import { Button } from "@/components/ui/button";
import {
  AGENT_FRAGMENT_SHADER,
  AGENT_SHADER_DURATION_MS,
  AGENT_VERTEX_SHADER,
} from "@/lib/agent-shaders";
import { cn } from "@/lib/utils";

type PlaybackState = "idle" | "playing" | "paused" | "complete";

interface AgentShaderPlayerProps {
  agent: "lumi" | "kairo";
  labels: {
    play: string;
    pause: string;
    resume: string;
    replay: string;
  };
}

interface PlayerController {
  play: (restart?: boolean) => void;
  pause: () => void;
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, AGENT_VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, AGENT_FRAGMENT_SHADER);
  if (!vertex || !fragment) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

/** Конечная WebGL-визуализация с полноценным статичным fallback. */
export function AgentShaderPlayer({ agent, labels }: AgentShaderPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<PlayerController | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
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
    const canvas = canvasRef.current;
    const frameElement = frameRef.current;
    if (!canvas || !frameElement) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) return;
    const program = createProgram(gl);
    if (!program) return;

    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const timeUniform = gl.getUniformLocation(program, "u_time");
    const progressUniform = gl.getUniformLocation(program, "u_progress");
    const agentUniform = gl.getUniformLocation(program, "u_agent");
    gl.uniform1f(agentUniform, agent === "lumi" ? 0 : 1);

    let disposed = false;
    let contextLost = false;
    let animationFrame = 0;
    let previousFrame = 0;
    let elapsed = 0;
    let visible = false;
    let autoPlayed = false;
    let state: PlaybackState = "idle";

    const updateState = (next: PlaybackState) => {
      state = next;
      if (!disposed) setPlayback(next);
    };

    const draw = () => {
      if (disposed || contextLost) return;
      gl.uniform1f(timeUniform, elapsed / 1000);
      gl.uniform1f(progressUniform, Math.min(elapsed / AGENT_SHADER_DURATION_MS, 1));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const resize = () => {
      const rect = frameElement.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.min(960, Math.max(1, Math.round(rect.width * ratio)));
      const height = Math.min(600, Math.max(1, Math.round(rect.height * ratio)));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      draw();
    };

    const tick = (now: number) => {
      animationFrame = 0;
      if (disposed || contextLost || state !== "playing" || !visible || document.hidden) {
        previousFrame = 0;
        return;
      }
      if (previousFrame) elapsed += Math.min(now - previousFrame, 64);
      previousFrame = now;
      draw();
      if (elapsed >= AGENT_SHADER_DURATION_MS) {
        updateState("complete");
        previousFrame = 0;
        return;
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (!animationFrame && visible && !document.hidden && state === "playing") {
        previousFrame = 0;
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    const play = (restart = false) => {
      if (disposed || contextLost) return;
      if (restart || elapsed >= AGENT_SHADER_DURATION_MS) elapsed = 0;
      updateState("playing");
      draw();
      schedule();
    };

    const pause = () => {
      if (state === "playing") updateState("paused");
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      previousFrame = 0;
    };

    controllerRef.current = { play, pause };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(frameElement);
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) {
          if (animationFrame) window.cancelAnimationFrame(animationFrame);
          animationFrame = 0;
          previousFrame = 0;
          return;
        }
        if (!autoPlayed) {
          autoPlayed = true;
          if (state === "idle") play(true);
        }
        schedule();
      },
      { threshold: 0.35 }
    );
    intersectionObserver.observe(frameElement);

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        previousFrame = 0;
      } else {
        schedule();
      }
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      pause();
      if (!disposed) setReady(false);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    canvas.addEventListener("webglcontextlost", onContextLost);

    setPlayback("idle");
    setReady(true);
    resize();

    return () => {
      disposed = true;
      controllerRef.current = null;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [agent, reducedMotion]);

  const enhanced = ready && reducedMotion === false;
  const label =
    playback === "playing"
      ? labels.pause
      : playback === "paused"
        ? labels.resume
        : playback === "complete"
          ? labels.replay
          : labels.play;
  const Icon = playback === "playing" ? Pause : playback === "complete" ? RotateCcw : Play;

  return (
    <div ref={frameRef} className="relative size-full overflow-hidden bg-background">
      <div className={cn("absolute inset-0", enhanced && "hidden")}>
        <AgentDiagram agent={agent} />
      </div>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 size-full opacity-0",
          enhanced && "opacity-100"
        )}
      />
      {enhanced ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (playback === "playing") controllerRef.current?.pause();
            else controllerRef.current?.play(playback === "complete");
          }}
          className="absolute right-4 bottom-4 gap-2 border-border bg-background/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-card"
        >
          <Icon aria-hidden="true" className="size-3.5 text-primary" />
          {label}
        </Button>
      ) : null}
    </div>
  );
}
