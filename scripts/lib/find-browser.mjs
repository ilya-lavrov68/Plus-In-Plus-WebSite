// Поиск уже установленного Chromium-браузера.
//
// Порядок: CHROMIUM_PATH → системные Chrome/Chromium/Edge. Если ничего не
// найдено, scripts/visual-browser.mjs достаёт браузер из npm-реестра (см. ниже).
// Скрипт адаптирован из Line Launcher: там он решает ту же задачу — снять
// реальные скриншоты интерфейса без Playwright CDN.
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * @returns {{ path: string, via: string } | null}
 */
export function findBrowser(env = process.env, platform = process.platform) {
  if (env.CHROMIUM_PATH && existsSync(env.CHROMIUM_PATH)) {
    return { path: env.CHROMIUM_PATH, via: "CHROMIUM_PATH" };
  }

  const candidates = [];
  if (platform === "win32") {
    const pf = env.ProgramFiles || "C:\\Program Files";
    const pf86 = env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    for (const root of [pf86, pf]) {
      candidates.push({
        file: path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
        via: "Microsoft Edge",
      });
    }
    for (const root of [pf, pf86]) {
      candidates.push({
        file: path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
        via: "Google Chrome",
      });
    }
    if (env.LOCALAPPDATA) {
      candidates.push({
        file: path.join(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
        via: "Google Chrome (per-user)",
      });
    }
  } else if (platform === "darwin") {
    candidates.push(
      {
        file: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        via: "Google Chrome",
      },
      {
        file: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        via: "Microsoft Edge",
      },
      {
        file: "/Applications/Chromium.app/Contents/MacOS/Chromium",
        via: "Chromium",
      },
    );
  } else {
    for (const name of [
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/snap/bin/chromium",
      "/usr/bin/microsoft-edge",
    ]) {
      candidates.push({ file: name, via: path.basename(name) });
    }
  }

  const hit = candidates.find((candidate) => existsSync(candidate.file));
  return hit ? { path: hit.file, via: hit.via } : null;
}

export function browserHelp(platform = process.platform) {
  const lines = [
    "Не найден браузер для скриншотов. Любой из вариантов:",
    "  1) Указать уже установленный Chrome/Chromium:",
  ];
  if (platform === "win32") {
    lines.push('     $env:CHROMIUM_PATH="C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"');
  } else if (platform === "darwin") {
    lines.push('     export CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"');
  } else {
    lines.push("     export CHROMIUM_PATH=/usr/bin/chromium");
  }
  lines.push(
    "  2) Достать Chromium из npm-реестра (работает без Playwright CDN):",
    "     npm run browser:restore",
    "",
    "Затем поднимите dev-сервер на :3000 и запустите npm run screenshots.",
  );
  return lines.join("\n");
}
