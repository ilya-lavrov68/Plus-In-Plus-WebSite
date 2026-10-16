"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Animated dithered-shader hero backdrop — light-theme adaptation of the
 * "Dithered Shader CTA" (cta-03) backdrop by Mohammad Shehadeh (Hirael, MIT,
 * https://21st.dev/@mohammadshehadeh/components/cta-03).
 *
 * The original composes two shader layers from the `shaders` package:
 *   <Swirl colorA colorB speed={0.2 → 0.6 on hover} detail={1.6} />
 *   <Dither colorMode="custom" pattern="bayer4" pixelSize={3} />
 * That package is a ~29 MB WebGPU runtime, so the same composition is
 * re-implemented here as a single dependency-free WebGL pass: a slowly
 * swirling fbm field, quantised through a 4×4 Bayer ordered dither at a
 * 3 px pixel size.
 *
 * Light-theme palette: the neutral greys of the original are swapped for the
 * brand's light blues (#F7FAFF → #DCE8FF → #AECBFA → #7FA6EB), so the navy
 * #052B42 hero type stays fully readable on top.
 * The swirl also eases from its idle speed to the faster hover speed while
 * the pointer is over the hero, exactly like the source component.
 *
 * Performance / accessibility guards:
 * - renders one static frame when `prefers-reduced-motion` is set;
 * - pauses while off-screen (IntersectionObserver) or the tab is hidden;
 * - caps device-pixel-ratio at 1.5 and falls back to the CSS gradient
 *   underneath the canvas when WebGL is unavailable.
 */
export interface DitheredShaderBackdropProps {
  className?: string;
}

const VERT = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_pixel_size;

// Light brand palette, white -> deepest soft blue.
const vec3 C0 = vec3(0.969, 0.980, 1.000); // #F7FAFF
const vec3 C1 = vec3(0.863, 0.910, 1.000); // #DCE8FF
const vec3 C2 = vec3(0.682, 0.796, 0.980); // #AECBFA
const vec3 C3 = vec3(0.498, 0.651, 0.922); // #7FA6EB

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = rot * p * 2.02;
    amplitude *= 0.5;
  }
  return value;
}

// Compact recursive 4x4 Bayer matrix (ordered-dither threshold, 0..1).
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) {
  a = mod(a, 4.0);
  return bayer2(a * 0.5) * 0.25 + bayer2(a);
}

vec2 rotate(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c) * p;
}

vec3 palette(float x) {
  vec3 color = mix(C0, C1, smoothstep(0.00, 0.38, x));
  color = mix(color, C2, smoothstep(0.38, 0.72, x));
  color = mix(color, C3, smoothstep(0.72, 1.00, x));
  return color;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time;

  // Swirl layer (detail 1.6 in the source): twist the domain around the
  // centre, then flow two fbm octaves through each other.
  float radius = length(uv);
  float twist = 2.4 * exp(-radius * 1.20) + t * 0.030;
  vec2 p = rotate(uv, twist) * 1.6;
  float warp = fbm(p + vec2(t * 0.070, -t * 0.052));
  float field = fbm(p + 1.9 * vec2(warp) + vec2(-t * 0.058, t * 0.043));
  float v = smoothstep(0.18, 0.92, field);

  // Keep the middle of the hero — where the headline sits — the lightest.
  v *= 1.0 - 0.15 * exp(-radius * radius * 2.6);

  // Dither layer: Bayer4 ordered dithering at a 3px pixel size quantises
  // the smooth swirl into halftone bands.
  float threshold = bayer4(floor(gl_FragCoord.xy / u_pixel_size));
  float steps = 6.0;
  float quantized = clamp(floor(v * steps + threshold) / steps, 0.0, 1.0);

  vec3 color = palette(quantized);
  // Faint halftone grain on top, like the source's second Dither pass.
  color = mix(color, C3, (threshold - 0.5) * 0.05);

  gl_FragColor = vec4(color, 1.0);
}
`;

/** Idle / hover swirl speeds, mirroring the source component (0.2 → 0.6). */
const IDLE_SPEED = 0.2;
const ACTIVE_SPEED = 0.6;

export function DitheredShaderBackdrop({ className }: DitheredShaderBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.getContext !== "function") return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
      }) as WebGLRenderingContext | null;
    } catch {
      gl = null;
    }
    if (!gl) return; // CSS gradient fallback underneath stays visible.

    const compile = (type: number, source: string) => {
      const shader = gl!.createShader(type);
      if (!shader) return null;
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        gl!.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertex = compile(gl.VERTEX_SHADER, VERT);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vertex || !fragment) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uPixelSize = gl.getUniformLocation(program, "u_pixel_size");

    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl!.viewport(0, 0, canvas.width, canvas.height);
      gl!.uniform2f(uResolution, canvas.width, canvas.height);
      gl!.uniform1f(uPixelSize, 3 * dpr);
    };

    // Hover over the hero eases the swirl up to the active speed.
    let speed = IDLE_SPEED;
    let targetSpeed = IDLE_SPEED;
    const hero = canvas.closest("section");
    const onEnter = () => {
      targetSpeed = ACTIVE_SPEED;
    };
    const onLeave = () => {
      targetSpeed = IDLE_SPEED;
    };
    hero?.addEventListener("mouseenter", onEnter);
    hero?.addEventListener("mouseleave", onLeave);

    let raf = 0;
    let running = false;
    let inView = true;
    let last = performance.now();
    let time = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      speed += (targetSpeed - speed) * Math.min(delta * 3, 1);
      time += delta * speed;
      resize();
      gl!.uniform1f(uTime, time);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    };

    const start = () => {
      if (running || reducedMotion) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const syncPlayback = () => {
      if (inView && !document.hidden) start();
      else stop();
    };

    resize();
    // Static first frame (also the only frame under reduced motion).
    gl.uniform1f(uTime, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        resize();
        if (reducedMotion) {
          gl!.uniform1f(uTime, 0);
          gl!.drawArrays(gl!.TRIANGLES, 0, 3);
        }
      });
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener("resize", resize);
    }

    let intersectionObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          inView = entries[0]?.isIntersecting ?? true;
          syncPlayback();
        },
        { threshold: 0 },
      );
      intersectionObserver.observe(canvas);
    }
    document.addEventListener("visibilitychange", syncPlayback);
    syncPlayback();

    return () => {
      stop();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", syncPlayback);
      hero?.removeEventListener("mouseenter", onEnter);
      hero?.removeEventListener("mouseleave", onLeave);
      gl!.getExtension("WEBGL_lose_context")?.loseContext();
      gl!.deleteBuffer(buffer);
      gl!.deleteProgram(program);
      gl!.deleteShader(vertex);
      gl!.deleteShader(fragment);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{
        // Painted before (and instead of, if WebGL fails) the shader canvas.
        background:
          "linear-gradient(128deg, #FFFFFF 0%, #E8F0FF 38%, #CFE0FF 68%, #B9D0F8 100%)",
      }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
