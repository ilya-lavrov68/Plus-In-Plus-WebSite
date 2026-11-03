"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { AgentDiagram } from "@/components/ai/agent-diagram";
import { Button } from "@/components/ui/button";
import {
  AGENT_BARS_FRAGMENT_SHADER,
  AGENT_FIELD_FRAGMENT_SHADERS,
  AGENT_SHADER_CELLS,
  AGENT_SHADER_COLS,
  AGENT_SHADER_CYCLE_SECONDS,
  AGENT_SHADER_DURATION_MS,
  AGENT_SHADER_HEIGHT,
  AGENT_SHADER_WIDTH,
  AGENT_VERTEX_SHADER,
  type AgentKind,
  type AgentScene,
} from "@/lib/agent-shaders";
import { cn } from "@/lib/utils";

type PlaybackState = "idle" | "playing" | "paused";
type RGB = [number, number, number];

interface AgentShaderPlayerProps {
  agent: AgentKind;
  scene?: AgentScene;
  labels: {
    play: string;
    pause: string;
    resume: string;
  };
}

interface PlayerController {
  play: () => void;
  pause: () => void;
}

const GROUND: RGB = [0.0392, 0.0392, 0.0392];
const INK: RGB = [0.8549, 0.8549, 0.8627];
const SPARK: RGB = [1, 1, 1];
const BAR_RAMP: RGB[] = [
  [1, 1, 0.00392157],
  [0.851, 0.851, 0.8627],
  [0.549, 0.549, 0.5569],
  [0.3216, 0.3216, 0.3294],
];

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

function createProgram(
  gl: WebGLRenderingContext,
  fragmentSource: string
): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, AGENT_VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
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
  gl.bindAttribLocation(program, 0, "a_position");
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

/** Зацикленный двухпроходный player с SVG-fallback для каждой Illos field-сцены. */
export function AgentShaderPlayer({ agent, scene, labels }: AgentShaderPlayerProps) {
  const resolvedScene = scene ?? agent;
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

    const fieldProgram = createProgram(gl, AGENT_FIELD_FRAGMENT_SHADERS[resolvedScene]);
    const barsProgram = createProgram(gl, AGENT_BARS_FRAGMENT_SHADER);
    if (!fieldProgram || !barsProgram) {
      if (fieldProgram) gl.deleteProgram(fieldProgram);
      if (barsProgram) gl.deleteProgram(barsProgram);
      return;
    }

    const buffer = gl.createBuffer();
    const cells = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!buffer || !cells || !framebuffer) {
      if (buffer) gl.deleteBuffer(buffer);
      if (cells) gl.deleteTexture(cells);
      if (framebuffer) gl.deleteFramebuffer(framebuffer);
      gl.deleteProgram(fieldProgram);
      gl.deleteProgram(barsProgram);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, cells);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      AGENT_SHADER_COLS,
      AGENT_SHADER_CELLS,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      cells,
      0
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(cells);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(fieldProgram);
      gl.deleteProgram(barsProgram);
      return;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const timeUniform = gl.getUniformLocation(fieldProgram, "uT");
    const resolutionUniform = gl.getUniformLocation(barsProgram, "uRes");
    const gridUniform = gl.getUniformLocation(barsProgram, "uGrid");
    const dprUniform = gl.getUniformLocation(barsProgram, "uDpr");
    const groundUniform = gl.getUniformLocation(barsProgram, "uGround");
    const inkUniform = gl.getUniformLocation(barsProgram, "uInk");
    const sparkUniform = gl.getUniformLocation(barsProgram, "uSpark");
    const fieldUniform = gl.getUniformLocation(barsProgram, "uField");
    const rampUniforms = [1, 2, 3, 4].map((index) =>
      gl.getUniformLocation(barsProgram, `uR${index}`)
    );

    gl.useProgram(barsProgram);
    gl.uniform2f(resolutionUniform, AGENT_SHADER_WIDTH, AGENT_SHADER_HEIGHT);
    gl.uniform2f(gridUniform, AGENT_SHADER_COLS, AGENT_SHADER_CELLS);
    gl.uniform3fv(groundUniform, GROUND);
    gl.uniform3fv(inkUniform, INK);
    gl.uniform3fv(sparkUniform, SPARK);
    rampUniforms.forEach((uniform, index) => {
      gl.uniform3fv(uniform, BAR_RAMP[index]);
    });
    gl.uniform1i(fieldUniform, 0);

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

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, AGENT_SHADER_COLS, AGENT_SHADER_CELLS);
      gl.useProgram(fieldProgram);
      gl.uniform1f(timeUniform, elapsed / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(barsProgram);
      gl.uniform1f(dprUniform, canvas.width / AGENT_SHADER_WIDTH);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cells);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const resize = () => {
      const rect = frameElement.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      draw();
    };

    const tick = (now: number) => {
      animationFrame = 0;
      if (disposed || contextLost || state !== "playing" || !visible || document.hidden) {
        previousFrame = 0;
        return;
      }
      if (previousFrame) {
        elapsed = (elapsed + Math.min(now - previousFrame, 64)) % AGENT_SHADER_DURATION_MS;
      }
      previousFrame = now;
      draw();
      animationFrame = window.requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (!animationFrame && visible && !document.hidden && state === "playing") {
        previousFrame = 0;
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    const play = () => {
      if (disposed || contextLost) return;
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
          if (state === "idle") play();
        }
        schedule();
      },
      { threshold: 0.35 }
    );

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
    resize();
    setReady(true);
    resizeObserver.observe(frameElement);
    intersectionObserver.observe(frameElement);

    return () => {
      disposed = true;
      controllerRef.current = null;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(cells);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(fieldProgram);
      gl.deleteProgram(barsProgram);
    };
  }, [resolvedScene, reducedMotion]);

  const enhanced = ready && reducedMotion === false;
  const label =
    playback === "playing" ? labels.pause : playback === "paused" ? labels.resume : labels.play;
  const Icon = playback === "playing" ? Pause : Play;

  return (
    <div
      ref={frameRef}
      data-agent={agent}
      data-scene={resolvedScene}
      data-playback={playback}
      data-shader-loop={AGENT_SHADER_CYCLE_SECONDS}
      className="relative size-full overflow-hidden bg-background"
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 size-full opacity-0",
          enhanced && "opacity-100"
        )}
      />
      <div className="pointer-events-none absolute inset-0">
        <AgentDiagram agent={agent} scene={resolvedScene} enhanced={enhanced} />
      </div>
      {enhanced ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            if (playback === "playing") controllerRef.current?.pause();
            else controllerRef.current?.play();
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
