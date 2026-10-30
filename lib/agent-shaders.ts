/**
 * Streaming tokens: field и two-pass bar renderer из бесплатной иллюстрации
 * Illos.dev, адаптированные к жёлтой палитре Plus In Plus и нашему player lifecycle.
 *
 * Source: https://illos.dev/library/shader/streaming-tokens
 * Registry: https://illos.dev/r/shader/streaming-tokens.json
 * License: https://illos.dev/license (Illos free license)
 * Pro toolkit, Illos skill и ILLOS_KEY не используются.
 */

export const AGENT_SHADER_CYCLE_SECONDS = 4.2;
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
`;

/** Оригинальный field Streaming tokens: MODEL → ribbon → четыре строки RESPONSE. */
const STREAMING_TOKENS_FIELD = `
float field(vec2 p, float t) {
  float ph = TAU * t / T;
  float v = blob(p, vec2(88.0, 230.0), 30.0, 1.05);

  // Лента: бегущая волна и шесть импульсов за цикл.
  if (p.x > 116.0 && p.x < 356.0) {
    float env = sin(3.14159 * (p.x - 116.0) / 240.0);
    float y = 230.0 + 30.0 * env * sin(p.x * 0.035 - ph * 2.0);
    float pulse = pow(0.5 + 0.5 * sin(p.x * 0.08 - ph * 6.0), 4.0);
    v += exp(-pow(p.y - y, 2.0) / 64.0) * (0.3 + 0.75 * pulse);
  }

  // RESPONSE: курсор пишет четвёртую строку, затем текст сдвигается вверх.
  if (p.x > 376.0 && p.x < 654.0 && p.y > 130.0 && p.y < 322.0) {
    float yy = p.y + 46.0 * sm(3.2, 3.8, t);
    float idx = floor((yy - 160.0 + 23.0) / 46.0);
    float ly = 160.0 + 46.0 * idx;
    float on = step(0.32, hash(vec2(floor(p.x / 7.0), 1.0)));
    float front = t < 0.3 ? 380.0 : t < 3.0 ? mix(380.0, 650.0, (t - 0.3) / 2.7) : 650.0;
    float filled = idx < 3.0 ? 1.0 : idx < 4.0 ? (t > 3.0 ? 1.0 : 1.0 - sm(front - 6.0, front + 4.0, p.x)) : 0.0;
    float band = exp(-pow(yy - ly, 2.0) / 49.0);
    v += band * (on * (0.55 + 0.35 * hash(vec2(floor(p.x / 7.0), 2.0))) * filled + 0.13 * (1.0 - filled) * on);
    float cx = t < 3.0 ? front : 380.0;
    float cyy = t < 3.0 ? 298.0 : 298.0 - 46.0 * sm(3.2, 3.8, t) + 46.0 * step(3.8, t);
    v += blob(p, vec2(cx + 3.0, cyy), 8.0, 1.2 * (t < 3.0 || t > 3.8 ? 1.0 : 0.0));
  }

  return v;
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

/** Первый проход вычисляет field только для сетки 103 × 49, а не для каждого пикселя. */
export const AGENT_FIELD_FRAGMENT_SHADER = `${PRELUDE}
const float T = ${AGENT_SHADER_CYCLE_SECONDS.toFixed(3)};
${STREAMING_TOKENS_FIELD}
${CELL}
${FIELD_MAIN}`;

/**
 * Второй проход: оригинальные thin bars четырёх плотностей, grain, screen lines,
 * grid и spark-пиксели. Рампы передаются uniform-ами и используют фирменный жёлтый.
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
