export const AGENT_SHADER_DURATION_MS = 8400;

export const AGENT_VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

/**
 * Пиксельная one-shot визуализация процесса агента. Никаких текстур,
 * внешних запросов или случайных данных: только UV, время и прогресс.
 */
export const AGENT_FRAGMENT_SHADER = `
  precision mediump float;

  varying vec2 v_uv;
  uniform float u_time;
  uniform float u_progress;
  uniform float u_agent;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float cell(vec2 p, vec2 center) {
    vec2 d = abs(p - center);
    return 1.0 - step(0.1, max(d.x, d.y));
  }

  float box2(vec2 p, vec2 bounds) {
    vec2 d = abs(p) - bounds;
    return 1.0 - step(0.1, max(d.x, d.y));
  }

  vec3 drawNode(vec2 p, vec2 center, float active, float index, vec3 yellow) {
    vec2 q = p - center;
    float distanceToCenter = max(abs(q.x), abs(q.y));
    float outer = 1.0 - step(6.0, distanceToCenter);
    float inner = 1.0 - step(5.0, distanceToCenter);
    float border = max(outer - inner, 0.0);
    float fill = inner * active * 0.11;
    vec3 neutral = vec3(0.32);
    vec3 ink = mix(neutral, yellow, active);
    vec3 result = ink * border * 0.85 + yellow * fill;

    float corners = cell(q, vec2(-4.0, -4.0)) + cell(q, vec2(4.0, 4.0));
    result += yellow * corners * active;

    float glyph = 0.0;
    if (index < 0.5) {
      if (u_agent < 0.5) {
        glyph += box2(q - vec2(0.0, -2.0), vec2(3.0, 0.1));
        glyph += box2(q - vec2(-1.0, 0.0), vec2(2.0, 0.1));
        glyph += box2(q - vec2(0.0, 2.0), vec2(3.0, 0.1));
      } else {
        glyph += cell(q, vec2(0.0, -3.0));
        glyph += cell(q, vec2(1.0, -3.0));
        glyph += cell(q, vec2(2.0, -2.0));
        glyph += cell(q, vec2(2.0, -1.0));
        glyph += cell(q, vec2(1.0, 0.0));
        glyph += cell(q, vec2(0.0, 1.0));
        glyph += cell(q, vec2(0.0, 3.0));
      }
    } else if (index < 1.5) {
      if (u_agent < 0.5) {
        glyph += cell(q, vec2(-3.0, 0.0));
        glyph += cell(q, vec2(-2.0, -1.0));
        glyph += cell(q, vec2(-1.0, -2.0));
        glyph += cell(q, vec2(-2.0, 1.0));
        glyph += cell(q, vec2(-1.0, 2.0));
        glyph += cell(q, vec2(3.0, 0.0));
        glyph += cell(q, vec2(2.0, -1.0));
        glyph += cell(q, vec2(1.0, -2.0));
        glyph += cell(q, vec2(2.0, 1.0));
        glyph += cell(q, vec2(1.0, 2.0));
      } else {
        glyph += box2(q - vec2(-3.0, 0.0), vec2(0.1, 3.0));
        glyph += box2(q - vec2(0.0, 0.0), vec2(0.1, 3.0));
        glyph += box2(q - vec2(3.0, 0.0), vec2(0.1, 3.0));
        glyph += box2(q - vec2(0.0, -4.0), vec2(4.0, 0.1));
        glyph += box2(q - vec2(0.0, 4.0), vec2(4.0, 0.1));
      }
    } else {
      if (u_agent < 0.5) {
        glyph += cell(q, vec2(-3.0, 0.0));
        glyph += cell(q, vec2(-2.0, 1.0));
        glyph += cell(q, vec2(-1.0, 2.0));
        glyph += cell(q, vec2(0.0, 1.0));
        glyph += cell(q, vec2(1.0, 0.0));
        glyph += cell(q, vec2(2.0, -1.0));
        glyph += cell(q, vec2(3.0, -2.0));
      } else {
        glyph += cell(q, vec2(0.0, -3.0));
        glyph += box2(q - vec2(0.0, 1.0), vec2(0.1, 2.0));
      }
    }

    return result + ink * clamp(glyph, 0.0, 1.0) * (0.45 + active * 0.55);
  }

  void main() {
    vec2 grid = vec2(80.0, 50.0);
    vec2 p = floor(v_uv * grid);
    vec3 yellow = vec3(1.0, 1.0, 0.00392157);
    vec3 color = vec3(0.0392);

    float sparse = step(0.955, hash(p));
    float shimmer = 0.5 + 0.5 * sin(u_time * 1.4 + p.x * 0.17 + p.y * 0.11);
    color += yellow * sparse * (0.025 + shimmer * 0.035);

    float settling = 1.0 - smoothstep(0.78, 1.0, u_progress);
    if (u_agent < 0.5) {
      float column = floor(p.x / 4.0);
      float columnMask = step(0.72, hash(vec2(column, 2.0)));
      float streamY = mod(u_time * (3.0 + hash(vec2(column, 4.0)) * 4.0) + hash(vec2(column, 8.0)) * 50.0, 50.0);
      float stream = (1.0 - step(1.0, abs(p.y - streamY))) * (1.0 - step(0.1, mod(p.x, 4.0)));
      color += yellow * stream * columnMask * (0.025 + settling * 0.11);
    } else {
      float amplitude = 3.0 + settling * 7.0;
      float waveY = 25.0 + sin(p.x * 0.13 + u_time * 1.25) * amplitude;
      float mirrorY = 50.0 - waveY;
      float waves = (1.0 - step(0.6, abs(p.y - waveY))) + (1.0 - step(0.6, abs(p.y - mirrorY)));
      color += yellow * waves * step(0.45, hash(p)) * 0.075;
    }

    float row = 1.0 - step(0.1, abs(p.y - 25.0));
    float dash = 1.0 - step(2.0, mod(p.x, 4.0));
    float firstPath = step(20.0, p.x) * (1.0 - step(34.0, p.x));
    float secondPath = step(46.0, p.x) * (1.0 - step(60.0, p.x));
    float outputPath = step(72.0, p.x) * (1.0 - step(78.0, p.x));
    color += yellow * row * dash * (firstPath + secondPath + outputPath) * 0.24;

    float travelOne = smoothstep(0.06, 0.36, u_progress);
    float travelTwo = smoothstep(0.40, 0.70, u_progress);
    float travelOut = smoothstep(0.76, 0.96, u_progress);
    vec2 packetOne = vec2(mix(20.0, 34.0, travelOne), 25.0);
    vec2 packetTwo = vec2(mix(46.0, 60.0, travelTwo), 25.0);
    vec2 packetOut = vec2(mix(72.0, 78.0, travelOut), 25.0);
    float packet = box2(p - packetOne, vec2(1.0, 1.0)) * step(0.04, u_progress) * (1.0 - step(0.39, u_progress));
    packet += box2(p - packetTwo, vec2(1.0, 1.0)) * step(0.38, u_progress) * (1.0 - step(0.73, u_progress));
    packet += box2(p - packetOut, vec2(1.0, 1.0)) * step(0.74, u_progress);
    color += yellow * packet;

    float activeOne = smoothstep(0.0, 0.14, u_progress);
    float activeTwo = smoothstep(0.30, 0.52, u_progress);
    float activeThree = smoothstep(0.64, 0.86, u_progress);
    color += drawNode(p, vec2(14.0, 25.0), activeOne, 0.0, yellow);
    color += drawNode(p, vec2(40.0, 25.0), activeTwo, 1.0, yellow);
    color += drawNode(p, vec2(66.0, 25.0), activeThree, 2.0, yellow);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;
