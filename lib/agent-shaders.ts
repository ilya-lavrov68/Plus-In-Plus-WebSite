import { RAG_ANSWER_FIELD, TOOL_CALLS_FIELD } from "./agent-fields";
import {
  KAIRO_BRIEF_FIELD,
  KAIRO_GRAPH_FIELD,
  KAIRO_VERIFICATION_FIELD,
  LUMI_PERMISSIONS_FIELD,
  LUMI_RUNTIME_FIELD,
  LUMI_SANDBOX_FIELD,
} from "./agent-mechanism-fields";

export type AgentKind = "lumi" | "kairo";
export type AgentMechanismScene =
  | "lumi-permissions"
  | "lumi-sandbox"
  | "lumi-runtime"
  | "kairo-graph"
  | "kairo-verification"
  | "kairo-brief";
export type AgentScene = AgentKind | AgentMechanismScene;

export const AGENT_SHADER_SCENE_NAMES: Record<AgentScene, string> = {
  lumi: "tool-calls",
  kairo: "rag-answer",
  "lumi-permissions": "permissions-tools",
  "lumi-sandbox": "repository-sandbox",
  "lumi-runtime": "runtime-fallback",
  "kairo-graph": "langgraph-flow",
  "kairo-verification": "deterministic-verification",
  "kairo-brief": "two-layer-answer",
};

/**
 * Оригинальные field-сцены бесплатных иллюстраций Illos.dev в существующем
 * two-pass renderer Plus In Plus: Lumi — Tool calls, Kairo — RAG answer.
 *
 * Sources: https://illos.dev/library/shader/tool-calls
 *          https://illos.dev/library/shader/rag
 * License: https://illos.dev/license (Illos free license)
 * Pro toolkit, Illos skill и ILLOS_KEY не используются.
 */

export const AGENT_SHADER_CYCLE_SECONDS = 4.5;
export const AGENT_SHADER_DURATION_MS = AGENT_SHADER_CYCLE_SECONDS * 1000;
export const AGENT_SHADER_WIDTH = 720;
export const AGENT_SHADER_HEIGHT = 460;
export const AGENT_SHADER_COLS = 103;
export const AGENT_SHADER_CELLS = 49;

export const AGENT_VERTEX_SHADER = `
  attribute vec2 a_position;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const PRELUDE = `
precision highp float;
uniform float uT;
const float TAU = 6.2831853;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float blob(vec2 p, vec2 c, float r, float k) {
  vec2 d = p - c;
  return k * exp(-dot(d, d) / (r * r));
}

float sm(float a, float b, float t) {
  return smoothstep(a, b, t);
}

float ease(float x) {
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

float seg(vec2 p, vec2 a, vec2 b, float w, float amp) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return amp * exp(-pow(length(pa - ba * h) / w, 2.0));
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
`;

const CELL = `
float cellValue(float col, float cell) {
  return field(vec2(4.0 + col * 7.0, cell * 9.4 + 3.5), uT) * (0.7 + 0.3 * hash(vec2(col, cell)));
}
`;

const FIELD_MAIN = `
void main() {
  float v = clamp(cellValue(floor(gl_FragCoord.x), floor(gl_FragCoord.y)) / 4.0, 0.0, 0.99999);
  gl_FragColor = vec4(floor(v * 255.0) / 255.0, fract(v * 255.0), 0.0, 1.0);
}
`;

function fieldShader(field: string): string {
  return `${PRELUDE}
const float T = ${AGENT_SHADER_CYCLE_SECONDS.toFixed(3)};
${field}
${CELL}
${FIELD_MAIN}`;
}

/** Первый проход вычисляет field каждой сцены в сетке 103 × 49. */
export const AGENT_FIELD_FRAGMENT_SHADERS: Record<AgentScene, string> = {
  lumi: fieldShader(TOOL_CALLS_FIELD),
  kairo: fieldShader(RAG_ANSWER_FIELD),
  "lumi-permissions": fieldShader(LUMI_PERMISSIONS_FIELD),
  "lumi-sandbox": fieldShader(LUMI_SANDBOX_FIELD),
  "lumi-runtime": fieldShader(LUMI_RUNTIME_FIELD),
  "kairo-graph": fieldShader(KAIRO_GRAPH_FIELD),
  "kairo-verification": fieldShader(KAIRO_VERIFICATION_FIELD),
  "kairo-brief": fieldShader(KAIRO_BRIEF_FIELD),
};

/**
 * Второй проход: оригинальные thin bars четырёх плотностей, grain, screen lines,
 * grid и spark-пиксели. Жёлтый занимает только самый сильный сигнал;
 * остальная рампа нейтральная, чтобы акцент не заполнял всю композицию.
 */
export const AGENT_BARS_FRAGMENT_SHADER = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uGrid;
uniform float uDpr;
uniform vec3 uGround;
uniform vec3 uInk;
uniform sampler2D uField;
uniform vec3 uR1;
uniform vec3 uR2;
uniform vec3 uR3;
uniform vec3 uR4;
uniform vec3 uSpark;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 paint(vec3 ground, vec2 px, float v, float col, float cx, float cell) {
  vec3 color = ground;
  float dark = step(0.5, uInk.g);

  if (mod(px.x, 96.0) < 1.0 || mod(px.y, 96.0) < 1.0) {
    color = mix(ground, uInk, mix(0.09, 0.06, dark));
  }

  float dx = abs(px.x - cx);
  color = mix(color, mix(ground, uR4, mix(0.18, 0.06, dark)), 1.0 - smoothstep(0.3, 0.7, dx));

  float w = 0.0;
  vec3 c = uR4;
  float a = 1.0;
  if (v >= 0.72) {
    w = 3.6;
    c = uR1;
  } else if (v >= 0.48) {
    w = 2.7;
    c = uR2;
  } else if (v >= 0.27) {
    w = 1.8;
    c = uR3;
  } else if (v >= 0.1) {
    w = 1.1;
    c = uR4;
    a = 0.55;
  }

  float bar = step(mod(px.y, 9.4), 7.0)
    * (1.0 - smoothstep(w * 0.5 - 0.35, w * 0.5 + 0.35, dx))
    * step(0.001, w);
  color = mix(color, c, bar * a);

  if (w > 3.5 && hash(vec2(col, cell * 1.3)) > 0.55 && abs(mod(px.y, 9.4) - 3.0) < 0.8 && dx < 0.7) {
    color = uSpark;
  }

  return color;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
  float col = floor((px.x - 4.0) / 7.0 + 0.5);
  float cx = 4.0 + col * 7.0;
  float cell = floor(px.y / 9.4);
  vec4 e = texture2D(uField, (vec2(col, cell) + 0.5) / uGrid);
  float v = (e.r + e.g / 255.0) * 4.0;
  if (col < 0.0 || col > uGrid.x - 1.0) v = 0.0;
  gl_FragColor = vec4(paint(uGround, px, v, col, cx, cell), 1.0);
}
`;
