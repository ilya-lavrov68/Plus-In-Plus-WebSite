// Реальные скриншоты сайта для дизайн-проверки.
//
//   npm run screenshots              # сам собирает прод-сборку и снимает её
//   npm run screenshots -- --base-url http://127.0.0.1:3000 --no-build
//   BASE_URL=http://127.0.0.1:3000 npm run screenshots   # снимать уже запущенный сервер
//
// Браузер берётся из scripts/visual-browser.mjs: системный Chromium, либо
// восстановленный из npm-реестра (см. `npm run browser:restore`).
//
// Снимаем именно прод-сборку: в dev-режиме Turbopack внутри песочницы отдаёт
// HTML, но клиентская гидрация не завершается, и половина сцены (Hazeglow,
// reveal-анимации, состояние баннера cookies) остаётся серверной разметкой.
// Прод-страница ведёт себя так же, как у посетителя, поэтому снимок честный.
//
// Снимки складываются в docs/redesign/screens/ и служат доказательством
// вёрстки, а не декорацией: скрипт падает, если на странице была ошибка JS
// или если гидрация так и не случилась.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer-core";

import { resolveBrowser } from "./visual-browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = process.env.PIP_NEXT_BIN ?? path.join(root, "node_modules", "next", "dist", "bin", "next");
const outputDir = path.join(root, "docs", "redesign", "screens");

const cli = parseArgs(process.argv.slice(2));
const baseUrl = cli.baseUrl ?? process.env.BASE_URL ?? null;

const DESKTOP = { name: "desktop", width: 1440, height: 900, deviceScaleFactor: 1 };
const MOBILE = {
  name: "mobile",
  width: 390,
  height: 844,
  // 1× достаточно: 2× на длинной странице не помещается в лимит кодировщика.
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
};

const ROUTES = [
  { name: "home-ru", path: "/ru" },
  { name: "home-en", path: "/" },
  { name: "line-launcher-ru", path: "/ru/line-launcher" },
  { name: "line-launcher-en", path: "/line-launcher" },
  { name: "services-ru", path: "/ru/services" },
  { name: "service-detail-ru", path: "/ru/services/sign-design" },
  { name: "blog-ru", path: "/ru/blog" },
  { name: "contact-ru", path: "/ru/contact" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--no-build") parsed.noBuild = true;
    else if (arg === "--base-url") parsed.baseUrl = argv[(index += 1)];
    else if (arg === "--only") parsed.only = argv[(index += 1)];
    else if (arg === "--port") parsed.port = Number(argv[(index += 1)]);
  }
  return parsed;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Сервер ещё поднимается — это не ошибка.
    }
    await sleep(400);
  }
  throw new Error(`сервер не ответил на ${url} за ${timeoutMs} мс`);
}

/** Прод-сервер на свободном порту: снимаем то, что реально получит посетитель. */
async function startPreview() {
  const buildId = path.join(root, ".next", "BUILD_ID");
  if (!cli.noBuild || !existsSync(buildId)) {
    console.log("[screenshots] сборка прод-версии…");
    const build = spawnSync(process.execPath, [nextBin, "build"], { cwd: root, stdio: "inherit" });
    if (build.status !== 0) throw new Error("next build завершился с ошибкой");
  }
  const port = cli.port ?? (await freePort());
  // Слушаем все интерфейсы: middleware переписывает запрос на собственный
  // origin через `localhost`, а привязка только к 127.0.0.1 оставляет IPv6
  // (::1) без слушателя и внутренний прокси получает socket hang up.
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", "0.0.0.0"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      // Без секрета сессии `/api/auth/*` отвечает 500, и каждая страница
      // логирует ошибку сервера. Для вёрстки секрет не нужен — подставляем
      // детерминированную заглушку, если в окружении его нет.
      AUTH_SECRET: process.env.AUTH_SECRET ?? "screenshots-only-not-a-real-secret",
    },
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));
  const url = `http://127.0.0.1:${port}`;
  await waitForServer(`${url}/ru`);
  return { url, stop: () => child.kill("SIGTERM") };
}

/**
 * Подготовка страницы до навигации.
 *
 * 1. Согласие на cookies: баннер перекрывает первый экран и мешает смотреть
 *    вёрстку. Аналитику выключаем — снимок не должен собирать статистику.
 * 2. Маска программного рендерера. Headless Chromium в песочнице рисует через
 *    SwiftShader, а Hazeglow намеренно отказывается от софтверного растеризатора
 *    (его кадры не укладываются в бюджет анимации) и показывает резервную сцену.
 *    Подменяем только строку GL_RENDERER: сами пиксели по-прежнему считает
 *    WebGL, и в кадре видно ту же графику, что у посетителя с видеокартой.
 */
async function prepare(page, origin = target) {
  // Прод-CSP содержит `upgrade-insecure-requests`, и Chromium поднимает
  // префетч-запросы к локальному http-серверу до https — а он https не умеет и
  // отвечает SSL-ошибкой. На реальном домене сайт уже https, так что правим
  // только локальный адрес стенда и только в этом месте.
  const localOrigin = new URL(origin);
  if (localOrigin.protocol === "http:" && /^(127\.0\.0\.1|localhost)$/.test(localOrigin.hostname)) {
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      if (url.startsWith(`https://${localOrigin.host}/`)) {
        void request.continue({ url: url.replace("https://", "http://") });
        return;
      }
      void request.continue();
    });
  }

  await page.evaluateOnNewDocument(() => {
    try {
      window.localStorage.setItem(
        "cookie-consent",
        JSON.stringify({
          necessary: true,
          analytics: false,
          marketing: false,
          functional: true,
          timestamp: new Date(0).toISOString(),
        }),
      );
    } catch {
      // Приватный режим: баннер просто попадёт в кадр, съёмка не падает.
    }

    const desktopRenderer = "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)";
    for (const proto of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype]) {
      if (!proto) continue;
      const original = proto.getParameter;
      proto.getParameter = function patched(parameter) {
        // GL_RENDERER и UNMASKED_RENDERER_WEBGL из WEBGL_debug_renderer_info.
        if (parameter === 0x1f01 || parameter === 0x9246) return desktopRenderer;
        return original.call(this, parameter);
      };
    }
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patchedContext(type, attributes) {
      if (attributes?.failIfMajorPerformanceCaveat) {
        attributes = { ...attributes, failIfMajorPerformanceCaveat: false };
      }
      return originalGetContext.call(this, type, attributes);
    };
  });
}

/** Ждём гидрацию: до неё на странице нет ни одного React-узла. */
async function waitForHydration(page, label) {
  try {
    await page.waitForFunction(
      () => {
        const probe = document.querySelector("main") ?? document.body;
        return Object.keys(probe).some((key) => key.startsWith("__react"));
      },
      { timeout: 30_000, polling: 250 },
    );
  } catch {
    throw new Error(`${label}: страница не гидрировалась за 30 с — клиентский JS не запустился`);
  }
}

/** Hazeglow раскрывает canvas после первого кадра; ждём, но не считаем это ошибкой. */
async function waitForStage(page, label) {
  const hasStage = await page.evaluate(() => Boolean(document.querySelector("[data-hazeglow]")));
  if (!hasStage) return;
  try {
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector('[data-hazeglow] canvas');
        if (!canvas) return true; // резервная сцена без WebGL — тоже валидный кадр
        return Number.parseFloat(getComputedStyle(canvas).opacity) > 0.99;
      },
      { timeout: 20_000, polling: 250 },
    );
  } catch {
    console.warn(`[screenshots] ${label}: сцена не раскрылась за 20 с, снимаем как есть`);
  }
}

/**
 * Прогреваем страницу прокруткой. Блоки с `data-reveal` появляются через
 * IntersectionObserver, поэтому без прохода по странице полный кадр показывает
 * пустые секции: на снимке это выглядело бы как дыры в вёрстке.
 */
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const step = Math.max(320, Math.round(window.innerHeight * 0.75));
    for (let pass = 0; pass < 2; pass += 1) {
      const height = document.documentElement.scrollHeight;
      for (let y = 0; y < height; y += step) {
        window.scrollTo(0, y);
        await pause(80);
      }
      await pause(150);
    }
    window.scrollTo(0, 0);
    await pause(200);
  });
  // Даём DecryptText и reveal-анимациям доиграть до конечного кадра.
  await sleep(900);
}

async function capture(browser, route, viewport) {
  const page = await browser.newPage();
  const label = `${route.name}/${viewport.name}`;
  const errors = [];
  // Подсказка React DevTools — шум инструментов, а не дефект страницы; всё
  // остальное считаем ошибкой и роняем съёмку.
  const noise = [/Download the React DevTools/];
  page.on("pageerror", (error) => errors.push(String(error)));
  // Без URL ошибка «Failed to load resource» ничего не говорит о причине.
  page.on("requestfailed", (request) => {
    errors.push(`${request.failure()?.errorText ?? "request failed"} ${request.url()}`);
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    errors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (noise.some((pattern) => pattern.test(text))) return;
    errors.push(text);
  });

  await prepare(page, target);
  await page.setViewport(viewport);
  await page.goto(`${target}${route.path}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await waitForHydration(page, label);
  await waitForStage(page, label);
  await settle(page);

  const file = path.join(outputDir, `${route.name}-${viewport.name}.webp`);
  await page.screenshot({ path: file, type: "webp", quality: 78, fullPage: true });
  const title = await page.title();
  await page.close();

  if (errors.length) {
    throw new Error(`${label}: ошибки на странице\n${errors.join("\n")}`);
  }
  return { file, title };
}

/** Отдельный кадр: как выглядит первый экран при reduced motion. */
async function captureReducedMotion(browser) {
  const page = await browser.newPage();
  const label = "home-ru/reduced-motion";
  await prepare(page, target);
  await page.setViewport(DESKTOP);
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(`${target}/ru`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await waitForHydration(page, label);
  await waitForStage(page, label);
  await settle(page);

  const file = path.join(outputDir, "home-ru-reduced-motion.webp");
  await page.screenshot({ path: file, type: "webp", quality: 78, fullPage: true });
  await page.close();
  return file;
}

const browser = await resolveBrowser();
console.log(`[screenshots] Chromium: ${browser.path} (${browser.version}; ${browser.source})`);

mkdirSync(outputDir, { recursive: true });

const preview = baseUrl ? null : await startPreview();
const target = baseUrl ?? preview.url;
if (preview) console.log(`[screenshots] снимаем ${target}`);

const routes = cli.only ? ROUTES.filter((route) => route.name.includes(cli.only)) : ROUTES;

const instance = await puppeteer.launch({
  executablePath: browser.path,
  env: browser.env,
  headless: true,
  args: [
    ...(browser.args ?? []),
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--force-color-profile=srgb",
    // Композитинг через SwiftShader в headless зависает на Page.captureScreenshot
    // (кадр ждёт готовности поверхности и не дожидается). Отключаем именно
    // композитор: WebGL-сцена при этом рисуется и попадает в кадр.
    "--disable-gpu-compositing",
  ],
  defaultViewport: null,
  // Длинная страница на софтверном WebGL кодируется медленно: дефолтных 30 с
  // протокола не хватает, и screenshot отваливается по таймауту.
  protocolTimeout: 180_000,
});

const manifest = [];
try {
  for (const route of routes) {
    for (const viewport of [DESKTOP, MOBILE]) {
      const shot = await capture(instance, route, viewport);
      manifest.push({
        route: route.path,
        viewport: viewport.name,
        width: viewport.width,
        title: shot.title,
        file: path.relative(root, shot.file).split(path.sep).join("/"),
      });
      console.log(`[screenshots] ${route.name}/${viewport.name} → ${path.relative(root, shot.file)}`);
    }
  }

  if (!cli.only) {
    const reduced = await captureReducedMotion(instance);
    manifest.push({
      route: "/ru",
      viewport: "desktop",
      width: DESKTOP.width,
      title: "reduced motion",
      file: path.relative(root, reduced).split(path.sep).join("/"),
    });
    console.log(`[screenshots] home-ru/reduced-motion → ${path.relative(root, reduced)}`);
  }
} finally {
  await instance.close();
  preview?.stop();
}

const previous = existsSync(path.join(outputDir, "manifest.json"))
  ? JSON.parse(readFileSync(path.join(outputDir, "manifest.json"), "utf8"))
  : null;
const shots = cli.only && previous ? mergeShots(previous.shots, manifest) : manifest;

writeFileSync(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify(
    { generatedAt: new Date().toISOString(), baseUrl: target, mode: "production", shots },
    null,
    2,
  )}\n`,
);

console.log(`[screenshots] готово: ${manifest.length} снимков в docs/redesign/screens/`);

/** Частичная съёмка (`--only`) не должна терять записи о прежних кадрах. */
function mergeShots(previousShots, fresh) {
  const key = (shot) => `${shot.route}|${shot.viewport}|${shot.title}`;
  const freshKeys = new Set(fresh.map(key));
  return [...previousShots.filter((shot) => !freshKeys.has(key(shot))), ...fresh];
}
