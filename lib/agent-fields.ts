/**
 * Бесплатные Shader-иллюстрации Illos.dev, выбранные по смыслу агентов.
 * Tool calls: https://illos.dev/library/shader/tool-calls
 * RAG answer: https://illos.dev/library/shader/rag
 * License: https://illos.dev/license
 */

/** Lumi Q1: задача → агент → search/code/calendar → результат. Цикл 4,5 с. */
export const TOOL_CALLS_FIELD = `
float field(vec2 p, float t) {
  if (p.x < 24.0 || p.x > 696.0 || p.y < 24.0 || p.y > 436.0) return 0.0;
  float ph = TAU * t / T;
  float v = 0.0;
  float c = floor((p.x - 4.0) / 7.0 + 0.5);
  float k = floor(p.y / 9.4);
  float clear = 1.0 - sm(0.300, 0.500, t);

  if (c > 4.500 && c < 19.500 && k > 16.500 && k < 30.500) {
    float a = 0.0;
    float done = max(clear, sm(4.0, 4.060, t));
    if (k < 17.500) a = abs(c - 18.0) < 0.5 ? mix(0.25, 1.15, done) : 0.7;
    else if (c < 5.500 || c > 18.500 || k > 29.500) a = 0.25;
    else if (abs(k - 19.0) < 0.5 || abs(k - 20.0) < 0.5) {
      float len = abs(k - 19.0) < 0.5 ? 9.0 : 6.0;
      if (c > 6.5 && c < 7.5 + len) a = 0.42 + 0.6 * exp(-pow(t - 0.380 - 0.03 * (c - 7.0), 2.0) / 0.003);
    }
    else if (abs(k - 22.0) < 0.5) {
      float on = max(clear, sm(1.750, 1.810, t));
      if (abs(c - 7.0) < 0.5) a = mix(0.25, 1.1, on);
      else if (c > 8.5 && c < 16.500) a = mix(0.25, 0.72, on);
    }
    else if (abs(k - 24.0) < 0.5) {
      float on = max(clear, sm(2.700, 2.760, t));
      if (abs(c - 7.0) < 0.5) a = mix(0.25, 1.1, on);
      else if (c > 8.5 && c < 14.500) a = mix(0.25, 0.72, on);
    }
    else if (abs(k - 26.0) < 0.5) {
      float on = max(clear, sm(3.650, 3.710, t));
      if (abs(c - 7.0) < 0.5) a = mix(0.25, 1.1, on);
      else if (c > 8.5 && c < 15.500) a = mix(0.25, 0.72, on);
    }
    else if (abs(k - 28.0) < 0.5 && c > 6.5 && c < 17.500) {
      float tw = 3.700 + 0.012 * (c - 7.0);
      a = 0.72 * max(clear, step(tw, t));
      if (t > tw && t < tw + 0.06) a = 1.15;
    }
    else if (abs(k - 29.0) < 0.5 && c > 6.5 && c < 13.500) {
      float tw = 3.850 + 0.012 * (c - 7.0);
      a = 0.72 * max(clear, step(tw, t));
      if (t > tw && t < tw + 0.06) a = 1.15;
    }
    v = max(v, a);
  }

  float awake = sm(0.700, 0.800, t) * (1.0 - sm(4.0, 4.300, t));
  {
    vec2 d = p - vec2(282.0, 229.100);
    float r = length(d);
    float an = atan(d.y, d.x);
    float churn = noise(d * 0.09 + vec2(3.0 * cos(ph), 3.0 * sin(ph)));
    v = max(v, blob(p, vec2(282.0, 229.100), 27.0, 1.35 + awake * 0.35 * (churn - 0.5)));
    if (abs(r - 38.0) < 4.5 && abs(fract(an / TAU * 12.0 + sm(0.750, 4.300, t)) - 0.5) > 0.3) v = max(v, mix(0.42, 0.72, awake));
    if (r > 28.0 && r < 50.0 && hash(floor(p / vec2(7.0, 9.4))) > 0.8) v = max(v, 0.2);
    v = max(v, 0.42 * exp(-pow(r - 56.0, 2.0) / 14.0));
  }

  v = max(v, blob(p, vec2(226.0, 229.100), 6.0, 1.05));
  v = max(v, blob(p, vec2(326.577, 195.204), 6.0, 1.05));
  v = max(v, blob(p, vec2(338.0, 229.100), 6.0, 1.05));
  v = max(v, blob(p, vec2(324.343, 265.748), 6.0, 1.05));
  if (mod(c, 2.0) < 0.5) {
    float ln = seg(p, vec2(147.0, 229.100), vec2(216.0, 229.100), 4.0, 0.22);
    ln = max(ln, seg(p, vec2(326.577, 195.204), vec2(436.0, 112.0), 5.0, 0.22));
    ln = max(ln, seg(p, vec2(338.0, 229.100), vec2(424.0, 229.100), 5.0, 0.22));
    ln = max(ln, seg(p, vec2(324.343, 265.748), vec2(424.0, 352.0), 5.0, 0.22));
    v = max(v, ln);
  }

  {
    float u = clamp((t - 0.450) / 0.300, 0.0, 1.0);
    if (u > 0.0 && u < 1.0) v += blob(p, mix(vec2(147.0, 229.100), vec2(226.0, 229.100), ease(u)), 8.0, 1.1 * sm(0.0, 0.1, u) * (1.0 - sm(0.85, 1.0, u)));
  }
  {
    float uo = clamp((t - 0.800) / 0.330, 0.0, 1.0);
    float ub = clamp((t - 1.420) / 0.330, 0.0, 1.0);
    if (uo > 0.0 && uo < 1.0) v += blob(p, mix(vec2(326.577, 195.204), vec2(436.0, 112.0), ease(uo)), 8.0, 1.1 * sm(0.0, 0.1, uo) * (1.0 - sm(0.85, 1.0, uo)));
    if (ub > 0.0 && ub < 1.0) v += blob(p, mix(vec2(436.0, 112.0), vec2(326.577, 195.204), ease(ub)), 9.5, 1.15 * sm(0.0, 0.1, ub) * (1.0 - sm(0.85, 1.0, ub)));
  }
  {
    float uo = clamp((t - 1.750) / 0.330, 0.0, 1.0);
    float ub = clamp((t - 2.370) / 0.330, 0.0, 1.0);
    if (uo > 0.0 && uo < 1.0) v += blob(p, mix(vec2(338.0, 229.100), vec2(424.0, 229.100), ease(uo)), 8.0, 1.1 * sm(0.0, 0.1, uo) * (1.0 - sm(0.85, 1.0, uo)));
    if (ub > 0.0 && ub < 1.0) v += blob(p, mix(vec2(424.0, 229.100), vec2(338.0, 229.100), ease(ub)), 9.5, 1.15 * sm(0.0, 0.1, ub) * (1.0 - sm(0.85, 1.0, ub)));
  }
  {
    float uo = clamp((t - 2.700) / 0.330, 0.0, 1.0);
    float ub = clamp((t - 3.320) / 0.330, 0.0, 1.0);
    if (uo > 0.0 && uo < 1.0) v += blob(p, mix(vec2(324.343, 265.748), vec2(424.0, 352.0), ease(uo)), 8.0, 1.1 * sm(0.0, 0.1, uo) * (1.0 - sm(0.85, 1.0, uo)));
    if (ub > 0.0 && ub < 1.0) v += blob(p, mix(vec2(424.0, 352.0), vec2(324.343, 265.748), ease(ub)), 9.5, 1.15 * sm(0.0, 0.1, ub) * (1.0 - sm(0.85, 1.0, ub)));
  }

  float work0 = sm(1.130, 1.180, t) * (1.0 - sm(1.420, 1.540, t));
  float work1 = sm(2.080, 2.130, t) * (1.0 - sm(2.370, 2.490, t));
  float work2 = sm(3.030, 3.080, t) * (1.0 - sm(3.320, 3.440, t));
  float tw0 = 1.130;
  float tw1 = 2.080;
  float tw2 = 3.030;

  {
    float r = length(p - vec2(466.0, 104.0));
    v = max(v, 0.72 * exp(-pow(r - 26.0, 2.0) / 18.0));
    if (r < 21.0) v = max(v, 0.18 + 0.5 * work0);
    v = max(v, seg(p, vec2(486.0, 124.0), vec2(506.0, 144.0), 5.0, 0.8));
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      float kk = 8.0 + 2.0 * fj;
      float len = fj < 0.5 ? 9.0 : fj < 1.5 ? 7.0 : 8.0;
      if (abs(k - kk) < 0.5 && c > 73.5 && c < 74.5 + len) v = max(v, 0.25 + 0.5 * work0 * sm(tw0 + 0.06 * fj, tw0 + 0.06 * fj + 0.05, t));
    }
  }

  if (c > 60.5 && c < 84.5 && k > 19.5 && k < 28.5 && mod(k, 2.0) < 0.5) {
    float j = (k - 20.0) / 2.0;
    float ind = j < 0.5 ? 0.0 : j < 1.5 ? 2.0 : j < 3.5 ? 4.0 : 2.0;
    float len = 6.0 + floor(9.0 * hash(vec2(j, 21.0)));
    float run = work1 * exp(-pow(t - tw1 - 0.05 - 0.05 * j, 2.0) / 0.004);
    if (c < 61.5) v = max(v, 0.42);
    else if (c > 62.5 + ind && c < 63.5 + ind + len) v = max(v, 0.42 + 0.3 * work1 + 0.4 * run);
  }

  {
    if (k > 31.5 && k < 32.5 && c > 60.5 && c < 81.5) v = max(v, 0.7);
    if (k > 30.5 && k < 31.5 && (abs(c - 64.0) < 0.5 || abs(c - 78.0) < 0.5)) v = max(v, 1.05);
    if (k > 33.5 && k < 39.5 && mod(k, 2.0) < 0.5 && c > 60.5 && c < 81.5 && mod(c - 61.0, 3.0) < 1.5) {
      bool slot = abs(k - 36.0) < 0.5 && c > 69.5 && c < 71.5;
      v = max(v, slot ? 0.42 + 0.7 * work2 * sm(tw2 + 0.08, tw2 + 0.14, t) : 0.42 + 0.2 * work2);
    }
  }

  return v;
}
`;

/** Kairo: вопрос → три ближайшие страницы → ответ с citations. Цикл 4,5 с. */
export const RAG_ANSWER_FIELD = `
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

float field(vec2 p, float t) {
  if (p.x < 24.0 || p.x > 696.0 || p.y < 24.0 || p.y > 436.0) return 0.0;
  float ph = TAU * t / T;
  float v = 0.0;

  v = max(v, page(p, vec2(70.0, 78.0), 4.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(150.0, 58.0), 5.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(250.0, 60.0), 6.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(390.0, 64.0), 7.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(452.0, 108.0), 8.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(90.0, 162.0), 9.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(404.0, 182.0), 10.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(62.0, 310.0), 11.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(134.0, 360.0), 12.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(204.0, 404.0), 13.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(392.0, 330.0), 14.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(352.0, 404.0), 15.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(450.0, 380.0), 16.0, 0.0, 0.0, ph));
  v = max(v, page(p, vec2(66.0, 400.0), 17.0, 0.0, 0.0, ph));

  {
    float g = t < 1.5 ? 1.0 - ease((t - 0.3) / 0.6) : ease((t - 1.850) / 0.65);
    float lit = t < 1.0 ? 1.0 - sm(0.3, 0.75, t) : sm(1.379, 1.499, t);
    float hot = exp(-pow(t - 2.590, 2.0) / 0.006);
    v = max(v, page(p, mix(vec2(165.0, 175.0), vec2(220.0, 182.0), g), 1.0, lit, hot, ph));
  }
  {
    float g = t < 1.5 ? 1.0 - ease((t - 0.3) / 0.6) : ease((t - 1.910) / 0.65);
    float lit = t < 1.0 ? 1.0 - sm(0.3, 0.75, t) : sm(1.459, 1.579, t);
    float hot = exp(-pow(t - 2.840, 2.0) / 0.006);
    v = max(v, page(p, mix(vec2(300.0, 350.0), vec2(262.0, 302.0), g), 2.0, lit, hot, ph));
  }
  {
    float g = t < 1.5 ? 1.0 - ease((t - 0.3) / 0.6) : ease((t - 1.970) / 0.65);
    float lit = t < 1.0 ? 1.0 - sm(0.3, 0.75, t) : sm(1.587, 1.707, t);
    float hot = exp(-pow(t - 3.090, 2.0) / 0.006);
    v = max(v, page(p, mix(vec2(335.0, 125.0), vec2(282.0, 180.0), g), 3.0, lit, hot, ph));
  }

  v = max(v, bubble(p, vec2(250.0, 238.0), 1.0 - sm(0.3, 0.5, t)));
  v = max(v, bubble(p, mix(vec2(40.0, 238.0), vec2(250.0, 238.0), ease((t - 0.3) / 0.8)), sm(0.3, 0.45, t)));
  {
    float u = clamp((t - 0.3) / 0.8, 0.0, 1.0);
    float sp = (u > 0.0 && u < 1.0) ? sin(3.14159 * u) : 0.0;
    vec2 b = mix(vec2(40.0, 238.0), vec2(250.0, 238.0), ease(u));
    for (int s = 1; s <= 3; s++) v += blob(p, b - vec2(32.0 + 13.0 * float(s), 0.0), 9.0 - 1.5 * float(s), sp * (0.5 - 0.12 * float(s)));
  }

  if (t > 1.100 && t < 1.750) {
    float u = (t - 1.100) / 0.650;
    float R = 14.0 + 136.0 * (1.0 - (1.0 - u) * (1.0 - u));
    v += 0.5 * (1.0 - u) * exp(-pow(length((p - vec2(250.0, 238.0)) * vec2(1.0, 1.0)) - R, 2.0) / 90.0);
  }

  if (abs(p.y - 238.500) < 1.0 && p.x > 290.0 && p.x < 535.0 && mod(floor((p.x - 4.0) / 7.0 + 0.5), 2.0) < 0.5) v = max(v, 0.3);
  {
    float u = clamp((t - 2.650) / 0.4, 0.0, 1.0);
    if (u > 0.0 && u < 1.0) {
      float x = mix(304.0, 520.0, ease(u));
      float k = sm(0.0, 0.1, u) * (1.0 - sm(0.85, 1.0, u));
      v += blob(p, vec2(x, 238.500), 9.0, 1.2 * k) + blob(p, vec2(x - 14.0, 238.500), 6.0, 0.45 * k);
    }
  }
  {
    float u = clamp((t - 2.900) / 0.4, 0.0, 1.0);
    if (u > 0.0 && u < 1.0) {
      float x = mix(304.0, 520.0, ease(u));
      float k = sm(0.0, 0.1, u) * (1.0 - sm(0.85, 1.0, u));
      v += blob(p, vec2(x, 238.500), 9.0, 1.2 * k) + blob(p, vec2(x - 14.0, 238.500), 6.0, 0.45 * k);
    }
  }
  {
    float u = clamp((t - 3.150) / 0.4, 0.0, 1.0);
    if (u > 0.0 && u < 1.0) {
      float x = mix(304.0, 520.0, ease(u));
      float k = sm(0.0, 0.1, u) * (1.0 - sm(0.85, 1.0, u));
      v += blob(p, vec2(x, 238.500), 9.0, 1.2 * k) + blob(p, vec2(x - 14.0, 238.500), 6.0, 0.45 * k);
    }
  }

  {
    vec2 q = p - vec2(556.0, 177.0);
    if (q.x >= 0.0 && q.x < 105.0 && q.y >= 0.0 && q.y < 122.2) {
      float lc = floor(q.x / 7.0);
      float lk = floor(q.y / 9.4);
      float a = 0.15 + 0.04 * sin(ph + hash(vec2(lc, lk)) * 40.0);
      float clear = 1.0 - sm(0.3, 0.6, t);
      for (int j = 0; j < 6; j++) {
        float fj = float(j);
        float w = fj < 0.5 ? 3.050 : fj < 1.5 ? 3.210 : fj < 2.5 ? 3.370 : fj < 3.5 ? 3.530 : fj < 4.5 ? 3.690 : 3.850;
        float len = fj < 0.5 ? 13.0 : fj < 1.5 ? 11.0 : fj < 2.5 ? 12.0 : fj < 3.5 ? 9.0 : fj < 4.5 ? 12.0 : 7.0;
        if (abs(lk - 1.0 - 2.0 * fj) < 0.5) {
          float hc = min(len, 1.0 + floor(len * clamp((t - w) / 0.160, 0.0, 1.0)));
          float on = t < 1.0 ? clear : step(w, t) * step(lc, hc);
          if (lc >= 1.0 && lc < 1.0 + len) a = max(a, 0.72 * on);
          if (t > w && t < w + 0.160 && abs(lc - hc) < 0.5) a = max(a, 1.2);
          if (mod(fj, 2.0) > 0.5 && abs(lc - len - 2.0) < 0.5) a = max(a, 1.15 * (t < 1.0 ? clear : sm(w + 0.160, w + 0.220, t)));
        }
      }
      v = max(v, a);
    }
  }

  return v;
}
`;
