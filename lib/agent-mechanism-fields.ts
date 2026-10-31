/**
 * Производные field-сцены для технологических страниц Lumina.
 *
 * Визуальные примитивы намеренно повторяют уже используемые бесплатные
 * Illos Tool calls и RAG answer: agent/tool nodes, travelling blobs,
 * task cards, document pages, citation marks и построчную запись ответа.
 * Исходные сцены остаются в agent-fields.ts без изменений.
 *
 * Sources: https://illos.dev/library/shader/tool-calls
 *          https://illos.dev/library/shader/rag
 * License: https://illos.dev/license (модификация разрешена)
 */

/** Общие примитивы, извлечённые из двух оригинальных Illos field-сцен. */
const ILLOS_MECHANISM_PRIMITIVES = `
float page(vec2 p, vec2 c, float s, float lit, float hot, float ph) {
  vec2 q = p - c + vec2(17.5, 28.2);
  if (q.x < 0.0 || q.x >= 35.0 || q.y < 0.0 || q.y >= 56.4) return 0.0;
  float lc = floor(q.x / 7.0);
  float lk = floor(q.y / 9.4);
  float hs = hash(vec2(lc + s * 5.0, lk + s));
  float v = mix(0.13, 0.28, lit) + 0.05 * sin(ph + hs * 40.0);
  if (lk < 0.5) {
    if (lc < 2.0 + floor(2.0 * hash(vec2(s, 1.0)))) v = mix(0.45, 1.1, lit);
  } else if (lk > 1.5) {
    if (lc < 2.0 + floor(3.6 * hash(vec2(s, lk)))) v = mix(0.3, 0.72, lit) + 0.4 * hot;
  }
  return v;
}

float bubble(vec2 p, vec2 c, float k) {
  vec2 q = p - c + vec2(31.5, 18.8);
  if (q.x < 0.0 || q.x >= 63.0 || q.y < 0.0 || q.y >= 47.0) return 0.0;
  float lc = floor(q.x / 7.0);
  float lk = floor(q.y / 9.4);
  float side = (lc < 0.5 || lc > 7.5) ? 1.0 : 0.0;
  float v = 0.0;
  if (lk < 3.5) {
    if (lk < 0.5 || lk > 2.5) v = side > 0.5 ? 0.0 : 0.45;
    else if (side > 0.5) v = 0.45;
    else if (lk < 1.5 || lc < 5.5) v = 1.15;
  } else if (lc > 0.5 && lc < 2.5) v = 0.45;
  return v * k;
}

float taskCard(vec2 p, vec2 origin, float done) {
  vec2 q = p - origin;
  if (q.x < 0.0 || q.x >= 105.0 || q.y < 0.0 || q.y >= 131.6) return 0.0;
  float lc = floor(q.x / 7.0);
  float lk = floor(q.y / 9.4);
  float a = 0.0;
  if (lk < 0.5) a = lc > 12.5 ? mix(0.25, 1.15, done) : 0.7;
  else if (lc < 0.5 || lc > 13.5 || lk > 12.5) a = 0.25;
  else if (abs(lk - 2.0) < 0.5 || abs(lk - 3.0) < 0.5) {
    float len = abs(lk - 2.0) < 0.5 ? 9.0 : 6.0;
    if (lc > 1.5 && lc < 2.5 + len) a = 0.42 + 0.22 * done;
  }
  else if (abs(lk - 5.0) < 0.5 || abs(lk - 7.0) < 0.5 || abs(lk - 9.0) < 0.5) {
    if (abs(lc - 2.0) < 0.5) a = 1.05;
    else if (lc > 3.5 && lc < 11.5) a = 0.58;
  }
  else if (abs(lk - 11.0) < 0.5 && lc > 1.5 && lc < 12.5) a = 0.72;
  return a;
}

float agentNode(vec2 p, vec2 center, float awake, float ph) {
  vec2 d = p - center;
  float r = length(d);
  float an = atan(d.y, d.x);
  float churn = noise(d * 0.09 + vec2(3.0 * cos(ph), 3.0 * sin(ph)));
  float v = blob(p, center, 27.0, 1.25 + awake * 0.35 * (churn - 0.5));
  if (abs(r - 38.0) < 4.5 && abs(fract(an / TAU * 12.0 + awake) - 0.5) > 0.3) {
    v = max(v, mix(0.42, 0.72, awake));
  }
  if (r > 28.0 && r < 50.0 && hash(floor(p / vec2(7.0, 9.4))) > 0.8) v = max(v, 0.2);
  v = max(v, 0.42 * exp(-pow(r - 56.0, 2.0) / 14.0));
  return v;
}

float toolNode(vec2 p, vec2 center, float work) {
  float r = length(p - center);
  float v = 0.72 * exp(-pow(r - 26.0, 2.0) / 18.0);
  if (r < 21.0) v = max(v, 0.18 + 0.5 * work);
  return v;
}

float checkMark(vec2 p, vec2 center, float work) {
  float v = seg(p, center + vec2(-15.0, 0.0), center + vec2(-4.0, 11.0), 4.0, 0.95 * work);
  v = max(v, seg(p, center + vec2(-4.0, 11.0), center + vec2(17.0, -15.0), 4.0, 0.95 * work));
  return v;
}

float travel(vec2 p, vec2 a, vec2 b, float start, float duration, float t) {
  float u = clamp((t - start) / duration, 0.0, 1.0);
  if (u <= 0.0 || u >= 1.0) return 0.0;
  float k = sm(0.0, 0.1, u) * (1.0 - sm(0.85, 1.0, u));
  vec2 pos = mix(a, b, ease(u));
  return blob(p, pos, 8.0, 1.1 * k) + blob(p, pos - normalize(b - a) * 13.0, 5.5, 0.35 * k);
}

float link(vec2 p, vec2 a, vec2 b, float col) {
  if (mod(col, 2.0) >= 0.5) return 0.0;
  return seg(p, a, b, 5.0, 0.22);
}

float answerPanel(vec2 p, vec2 origin, float seed, float start, float t, float weight) {
  vec2 q = p - origin;
  if (q.x < 0.0 || q.x >= 105.0 || q.y < 0.0 || q.y >= 122.2) return 0.0;
  float lc = floor(q.x / 7.0);
  float lk = floor(q.y / 9.4);
  float a = 0.10 * weight + 0.025 * sin(hash(vec2(lc, lk + seed)) * 40.0);
  for (int j = 0; j < 6; j++) {
    float fj = float(j);
    float w = start + 0.16 * fj;
    float len = 7.0 + floor(6.0 * hash(vec2(seed + fj, 21.0)));
    if (abs(lk - 1.0 - 2.0 * fj) < 0.5) {
      float hc = min(len, 1.0 + floor(len * clamp((t - w) / 0.160, 0.0, 1.0)));
      float on = step(w, t) * step(lc, hc);
      if (lc >= 1.0 && lc < 1.0 + len) a = max(a, 0.72 * on * weight);
      if (t > w && t < w + 0.160 && abs(lc - hc) < 0.5) a = max(a, 1.2 * weight);
      if (mod(fj, 2.0) > 0.5 && abs(lc - len - 2.0) < 0.5) {
        a = max(a, 1.15 * sm(w + 0.160, w + 0.220, t) * weight);
      }
    }
  }
  return a;
}
`;

function mechanismScene(field: string): string {
  return `${ILLOS_MECHANISM_PRIMITIVES}\n${field}`;
}

/** Lumi: task → policy gate → read/write tools → confirmed result. */
export const LUMI_PERMISSIONS_FIELD = mechanismScene(`
float field(vec2 p, float t) {
  if (p.x < 24.0 || p.x > 696.0 || p.y < 24.0 || p.y > 436.0) return 0.0;
  float c = floor((p.x - 4.0) / 7.0 + 0.5);
  float ph = TAU * t / T;
  float v = taskCard(p, vec2(42.0, 164.0), sm(3.5, 3.8, t));
  float awake = sm(0.6, 0.8, t) * (1.0 - sm(4.1, 4.4, t));
  float approval = sm(2.15, 2.30, t) * (1.0 - sm(4.15, 4.40, t));
  float readWork = sm(1.30, 1.40, t) * (1.0 - sm(1.75, 1.90, t));
  float writeWork = sm(2.85, 2.95, t) * (1.0 - sm(3.25, 3.40, t));

  v = max(v, agentNode(p, vec2(230.0, 230.0), awake, ph));
  v = max(v, toolNode(p, vec2(370.0, 230.0), approval));
  v = max(v, toolNode(p, vec2(500.0, 125.0), readWork));
  v = max(v, toolNode(p, vec2(500.0, 335.0), writeWork));
  v = max(v, checkMark(p, vec2(370.0, 230.0), approval));
  v = max(v, seg(p, vec2(370.0, 164.0), vec2(370.0, 196.0), 4.0, 0.42));
  v = max(v, seg(p, vec2(370.0, 264.0), vec2(370.0, 296.0), 4.0, 0.42));

  v = max(v, link(p, vec2(147.0, 230.0), vec2(174.0, 230.0), c));
  v = max(v, link(p, vec2(286.0, 230.0), vec2(344.0, 230.0), c));
  v = max(v, link(p, vec2(390.0, 208.0), vec2(480.0, 140.0), c));
  v = max(v, link(p, vec2(390.0, 252.0), vec2(480.0, 320.0), c));
  v = max(v, link(p, vec2(526.0, 125.0), vec2(574.0, 190.0), c));
  v = max(v, link(p, vec2(526.0, 335.0), vec2(574.0, 270.0), c));

  v += travel(p, vec2(147.0, 230.0), vec2(174.0, 230.0), 0.30, 0.35, t);
  v += travel(p, vec2(286.0, 230.0), vec2(344.0, 230.0), 0.75, 0.35, t);
  v += travel(p, vec2(390.0, 208.0), vec2(480.0, 140.0), 1.05, 0.35, t);
  v += travel(p, vec2(480.0, 140.0), vec2(390.0, 208.0), 1.55, 0.35, t);
  v += travel(p, vec2(286.0, 230.0), vec2(344.0, 230.0), 1.90, 0.30, t);
  v += travel(p, vec2(390.0, 252.0), vec2(480.0, 320.0), 2.45, 0.35, t);
  v += travel(p, vec2(480.0, 320.0), vec2(390.0, 252.0), 3.05, 0.35, t);
  v = max(v, answerPanel(p, vec2(574.0, 169.0), 3.0, 3.35, t, 1.0));
  return v;
}
`);

/** Lumi: repository page → isolated branch → publish/discard → cleanup. */
export const LUMI_SANDBOX_FIELD = mechanismScene(`
float field(vec2 p, float t) {
  if (p.x < 24.0 || p.x > 696.0 || p.y < 24.0 || p.y > 436.0) return 0.0;
  float c = floor((p.x - 4.0) / 7.0 + 0.5);
  float ph = TAU * t / T;
  float v = page(p, vec2(120.0, 120.0), 4.0, 0.72, 0.0, ph);
  float branch = sm(0.85, 1.15, t) * (1.0 - sm(4.15, 4.40, t));
  float approval = sm(2.05, 2.25, t) * (1.0 - sm(4.15, 4.40, t));
  float published = sm(2.75, 3.00, t) * (1.0 - sm(4.20, 4.45, t));
  float copyLit = sm(0.30, 0.65, t) * (1.0 - sm(3.45, 3.95, t));
  vec2 copyCenter = mix(vec2(120.0, 120.0), vec2(270.0, 260.0), ease(clamp((t - 0.30) / 0.70, 0.0, 1.0)));

  v = max(v, page(p, copyCenter, 8.0, copyLit, 0.0, ph));
  v = max(v, page(p, vec2(535.0, 130.0), 11.0, 0.25 + 0.75 * published, 0.0, ph));
  v = max(v, page(p, vec2(535.0, 350.0), 12.0, 0.22, 0.0, ph));
  v = max(v, link(p, vec2(145.0, 120.0), vec2(500.0, 120.0), c));
  v = max(v, branch * link(p, vec2(145.0, 145.0), vec2(245.0, 235.0), c));
  v = max(v, branch * link(p, vec2(295.0, 260.0), vec2(500.0, 145.0), c));
  v = max(v, branch * link(p, vec2(295.0, 270.0), vec2(500.0, 340.0), c));

  for (int j = 0; j < 3; j++) {
    float on = sm(1.15 + 0.25 * float(j), 1.30 + 0.25 * float(j), t);
    vec2 commit = vec2(325.0 + 55.0 * float(j), 245.0 - 18.0 * float(j));
    v = max(v, on * blob(p, commit, 6.0, 1.05));
  }
  v = max(v, toolNode(p, vec2(385.0, 225.0), approval));
  v = max(v, checkMark(p, vec2(385.0, 225.0), approval));
  v += travel(p, vec2(145.0, 145.0), vec2(245.0, 235.0), 0.55, 0.55, t);
  v += travel(p, vec2(295.0, 260.0), vec2(500.0, 145.0), 2.35, 0.55, t);

  if (t > 3.35 && t < 4.05) {
    float u = (t - 3.35) / 0.70;
    float radius = 12.0 + 90.0 * ease(u);
    v += 0.55 * (1.0 - u) * exp(-pow(length(p - vec2(270.0, 260.0)) - radius, 2.0) / 70.0);
  }
  return v;
}
`);

/** Lumi: local/VPS/cloud endpoint scan → visible active runtime. */
export const LUMI_RUNTIME_FIELD = mechanismScene(`
float field(vec2 p, float t) {
  if (p.x < 24.0 || p.x > 696.0 || p.y < 24.0 || p.y > 436.0) return 0.0;
  float c = floor((p.x - 4.0) / 7.0 + 0.5);
  float ph = TAU * t / T;
  float awake = sm(0.35, 0.55, t) * (1.0 - sm(4.15, 4.40, t));
  float localWork = sm(0.95, 1.05, t) * (1.0 - sm(1.30, 1.45, t));
  float vpsWork = sm(1.70, 1.80, t) * (1.0 - sm(2.05, 2.20, t));
  float cloudWork = sm(2.45, 2.55, t) * (1.0 - sm(2.80, 2.95, t));
  float active = sm(3.05, 3.25, t) * (1.0 - sm(4.15, 4.40, t));
  float v = agentNode(p, vec2(175.0, 230.0), awake, ph);

  v = max(v, page(p, vec2(440.0, 105.0), 3.0, 0.35 + 0.45 * active + 0.20 * localWork, localWork, ph));
  v = max(v, page(p, vec2(440.0, 230.0), 5.0, 0.30 + 0.25 * vpsWork, vpsWork, ph));
  v = max(v, page(p, vec2(440.0, 355.0), 7.0, 0.30 + 0.25 * cloudWork, cloudWork, ph));
  v = max(v, link(p, vec2(230.0, 205.0), vec2(415.0, 115.0), c));
  v = max(v, link(p, vec2(231.0, 230.0), vec2(415.0, 230.0), c));
  v = max(v, link(p, vec2(230.0, 255.0), vec2(415.0, 345.0), c));
  v = max(v, link(p, vec2(465.0, 105.0), vec2(565.0, 190.0), c));
  v = max(v, link(p, vec2(465.0, 230.0), vec2(565.0, 230.0), c));
  v = max(v, link(p, vec2(465.0, 355.0), vec2(565.0, 270.0), c));

  v += travel(p, vec2(230.0, 205.0), vec2(415.0, 115.0), 0.60, 0.40, t);
  v += travel(p, vec2(415.0, 115.0), vec2(230.0, 205.0), 1.10, 0.40, t);
  v += travel(p, vec2(231.0, 230.0), vec2(415.0, 230.0), 1.35, 0.40, t);
  v += travel(p, vec2(415.0, 230.0), vec2(231.0, 230.0), 1.85, 0.40, t);
  v += travel(p, vec2(230.0, 255.0), vec2(415.0, 345.0), 2.10, 0.40, t);
  v += travel(p, vec2(415.0, 345.0), vec2(230.0, 255.0), 2.60, 0.40, t);
  v += travel(p, vec2(465.0, 105.0), vec2(565.0, 190.0), 3.05, 0.40, t);
  v = max(v, answerPanel(p, vec2(565.0, 169.0), 9.0, 3.35, t, 1.0));
  return v;
}
`);

/** Kairo: intake → planner → research/calculator → verification → answer. */
export const KAIRO_GRAPH_FIELD = mechanismScene(`
float field(vec2 p, float t) {
  if (p.x < 24.0 || p.x > 696.0 || p.y < 24.0 || p.y > 436.0) return 0.0;
  float c = floor((p.x - 4.0) / 7.0 + 0.5);
  float ph = TAU * t / T;
  float plan = sm(0.55, 0.75, t) * (1.0 - sm(4.15, 4.40, t));
  float research = sm(1.15, 1.30, t) * (1.0 - sm(1.65, 1.80, t));
  float calculate = sm(1.85, 2.00, t) * (1.0 - sm(2.30, 2.45, t));
  float verify = sm(2.60, 2.75, t) * (1.0 - sm(4.15, 4.40, t));
  float v = bubble(p, vec2(65.0, 230.0), 1.0 - sm(0.35, 0.55, t));
  v = max(v, bubble(p, mix(vec2(65.0, 230.0), vec2(135.0, 230.0), ease(clamp((t - 0.30) / 0.45, 0.0, 1.0))), sm(0.30, 0.45, t)));

  v = max(v, agentNode(p, vec2(205.0, 230.0), plan, ph));
  v = max(v, page(p, vec2(355.0, 120.0), 2.0, 0.35 + 0.55 * sm(1.05, 1.25, t), research, ph));
  v = max(v, toolNode(p, vec2(355.0, 340.0), calculate));
  v = max(v, toolNode(p, vec2(500.0, 230.0), verify));
  v = max(v, checkMark(p, vec2(500.0, 230.0), verify));
  v = max(v, link(p, vec2(98.0, 230.0), vec2(149.0, 230.0), c));
  v = max(v, link(p, vec2(245.0, 200.0), vec2(330.0, 135.0), c));
  v = max(v, link(p, vec2(355.0, 150.0), vec2(355.0, 310.0), c));
  v = max(v, link(p, vec2(380.0, 325.0), vec2(480.0, 250.0), c));
  v = max(v, link(p, vec2(526.0, 230.0), vec2(574.0, 230.0), c));

  v += travel(p, vec2(245.0, 200.0), vec2(330.0, 135.0), 0.85, 0.40, t);
  v += travel(p, vec2(355.0, 150.0), vec2(355.0, 310.0), 1.45, 0.45, t);
  v += travel(p, vec2(380.0, 325.0), vec2(480.0, 250.0), 2.15, 0.45, t);
  v += travel(p, vec2(526.0, 230.0), vec2(574.0, 230.0), 2.85, 0.35, t);
  v = max(v, answerPanel(p, vec2(574.0, 169.0), 13.0, 3.15, t, 1.0));
  return v;
}
`);

/** Kairo: retrieved sources → citation/amount/formula gates → verdict. */
export const KAIRO_VERIFICATION_FIELD = mechanismScene(`
float field(vec2 p, float t) {
  if (p.x < 24.0 || p.x > 696.0 || p.y < 24.0 || p.y > 436.0) return 0.0;
  float c = floor((p.x - 4.0) / 7.0 + 0.5);
  float ph = TAU * t / T;
  float v = 0.0;
  v = max(v, page(p, vec2(70.0, 80.0), 14.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(150.0, 60.0), 15.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(70.0, 235.0), 16.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(95.0, 385.0), 17.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(220.0, 400.0), 18.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(245.0, 65.0), 19.0, 0.0, 0.0, ph));

  for (int j = 0; j < 3; j++) {
    float fj = float(j);
    float start = 0.30 + 0.08 * fj;
    float gather = ease(clamp((t - start) / 0.65, 0.0, 1.0));
    vec2 initial = vec2(155.0 + 65.0 * fj, 140.0 + 115.0 * fj);
    vec2 gathered = vec2(245.0, 145.0 + 85.0 * fj);
    float lit = 1.0 - sm(1.15 + 0.10 * fj, 1.45 + 0.10 * fj, t);
    float hot = exp(-pow(t - 1.25 - 0.20 * fj, 2.0) / 0.008);
    v = max(v, page(p, mix(initial, gathered, gather), 2.0 + fj, lit, hot, ph));
  }

  float check0 = sm(1.65, 1.80, t) * (1.0 - sm(4.15, 4.40, t));
  float check1 = sm(2.25, 2.40, t) * (1.0 - sm(4.15, 4.40, t));
  float check2 = sm(2.85, 3.00, t) * (1.0 - sm(4.15, 4.40, t));
  v = max(v, toolNode(p, vec2(400.0, 125.0), check0));
  v = max(v, toolNode(p, vec2(400.0, 230.0), check1));
  v = max(v, toolNode(p, vec2(400.0, 335.0), check2));
  v = max(v, checkMark(p, vec2(400.0, 125.0), check0));
  v = max(v, checkMark(p, vec2(400.0, 230.0), check1));
  v = max(v, checkMark(p, vec2(400.0, 335.0), check2));
  v = max(v, link(p, vec2(275.0, 145.0), vec2(370.0, 125.0), c));
  v = max(v, link(p, vec2(275.0, 230.0), vec2(370.0, 230.0), c));
  v = max(v, link(p, vec2(275.0, 315.0), vec2(370.0, 335.0), c));
  v = max(v, link(p, vec2(426.0, 125.0), vec2(520.0, 190.0), c));
  v = max(v, link(p, vec2(426.0, 230.0), vec2(520.0, 230.0), c));
  v = max(v, link(p, vec2(426.0, 335.0), vec2(520.0, 270.0), c));

  v += travel(p, vec2(275.0, 145.0), vec2(370.0, 125.0), 1.30, 0.40, t);
  v += travel(p, vec2(275.0, 230.0), vec2(370.0, 230.0), 1.90, 0.40, t);
  v += travel(p, vec2(275.0, 315.0), vec2(370.0, 335.0), 2.50, 0.40, t);
  v += travel(p, vec2(426.0, 230.0), vec2(520.0, 230.0), 3.05, 0.35, t);
  v = max(v, answerPanel(p, vec2(520.0, 169.0), 22.0, 3.30, t, 1.0));
  return v;
}
`);

/** Kairo: detailed artefacts → short practical answer + detailed analysis. */
export const KAIRO_BRIEF_FIELD = mechanismScene(`
float field(vec2 p, float t) {
  if (p.x < 24.0 || p.x > 696.0 || p.y < 24.0 || p.y > 436.0) return 0.0;
  float c = floor((p.x - 4.0) / 7.0 + 0.5);
  float ph = TAU * t / T;
  float v = 0.0;
  v = max(v, page(p, vec2(75.0, 90.0), 24.0, 0.15, 0.0, ph));
  v = max(v, page(p, vec2(170.0, 65.0), 25.0, 0.15, 0.0, ph));
  v = max(v, page(p, vec2(80.0, 255.0), 26.0, 0.15, 0.0, ph));
  v = max(v, page(p, vec2(125.0, 390.0), 27.0, 0.15, 0.0, ph));
  v = max(v, page(p, vec2(250.0, 375.0), 28.0, 0.15, 0.0, ph));

  for (int j = 0; j < 3; j++) {
    float fj = float(j);
    float u = ease(clamp((t - 0.35 - 0.10 * fj) / 0.70, 0.0, 1.0));
    vec2 initial = vec2(175.0 + 65.0 * fj, 125.0 + 105.0 * fj);
    vec2 gathered = vec2(270.0, 190.0 + 40.0 * fj);
    float hot = exp(-pow(t - 1.25 - 0.18 * fj, 2.0) / 0.008);
    v = max(v, page(p, mix(initial, gathered, u), 30.0 + fj, 0.75, hot, ph));
  }

  float shortAnswer = sm(2.05, 2.25, t) * (1.0 - sm(4.15, 4.40, t));
  float detail = sm(2.85, 3.05, t) * (1.0 - sm(4.15, 4.40, t));
  v = max(v, toolNode(p, vec2(385.0, 230.0), shortAnswer + detail));
  v = max(v, link(p, vec2(295.0, 230.0), vec2(355.0, 230.0), c));
  v = max(v, link(p, vec2(405.0, 210.0), vec2(480.0, 130.0), c));
  v = max(v, link(p, vec2(405.0, 250.0), vec2(480.0, 330.0), c));
  v += travel(p, vec2(295.0, 230.0), vec2(355.0, 230.0), 1.65, 0.40, t);
  v += travel(p, vec2(405.0, 210.0), vec2(480.0, 130.0), 2.10, 0.45, t);
  v += travel(p, vec2(405.0, 250.0), vec2(480.0, 330.0), 2.75, 0.45, t);

  v = max(v, answerPanel(p, vec2(480.0, 69.0), 34.0, 2.45, t, 1.0));
  v = max(v, answerPanel(p, vec2(480.0, 269.0), 35.0, 3.20, t, 0.82));
  return v;
}
`);
