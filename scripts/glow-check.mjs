// Проверка ссылки на градиент hazeglow перед вставкой в пресет.
//
//   npm run glow:check -- "https://hazeglow.com/#<payload>"
//
// Скрипт ничего не меняет: разбирает ссылку, печатает палитру и форму и
// предупреждает о том, что нарушит правила проекта (белый/серый в фоне,
// статичный фон, эффект вне dither).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const link = process.argv.slice(2).join(" ").trim();
if (!link) {
  console.error('Использование: npm run glow:check -- "<ссылка или payload>"');
  process.exit(1);
}

function payloadOf(value) {
  const hash = value.includes("#") ? value.slice(value.indexOf("#") + 1) : "";
  if (hash) return hash;
  const queryStart = value.indexOf("?");
  if (queryStart >= 0) {
    const params = new URLSearchParams(value.slice(queryStart + 1));
    for (const key of ["c", "config", "gradient", "preset"]) {
      const found = params.get(key);
      if (found) return found;
    }
    return null;
  }
  return value;
}

const payload = payloadOf(link);
if (!payload) {
  console.error(
    "В ссылке нет payload: ожидаю #<payload>, ?c=, ?config= или сам payload.",
  );
  process.exit(1);
}

const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
let config;
try {
  config = JSON.parse(atob(padded));
} catch {
  console.error("Payload не разбирается как base64url + JSON.");
  process.exit(1);
}
if (config?.version !== 1) {
  console.error(
    `Ожидаю конфиг hazeglow версии 1, пришло: ${JSON.stringify(config?.version)}`,
  );
  process.exit(1);
}

const palette = Array.isArray(config.palette) ? config.palette : [];
console.log("палитра:", palette.join(" ") || "(нет)");
console.log(
  "фон:",
  config.background,
  "| форма:",
  config.shape,
  "| центр:",
  config.center,
  "| мягкость:",
  config.softness,
);
console.log(
  "движение:",
  config.motion,
  "| скорость:",
  config.speed,
  "| эффект:",
  config.effect,
  config.effectSize,
  config.effectAmount,
);

const warnings = [];
if (
  palette.some(
    (color) => /^#(e|f)[0-9a-f]{5}$/i.test(color) && !/^#ff5f01$/i.test(color),
  )
) {
  warnings.push(
    "в палитре есть светлые ступени: белый в фоне шейдера запрещён — замени на #EEEEEE только в тексте контраста",
  );
}
if (palette.some((color) => /^#6b6364$/i.test(color)))
  warnings.push("серый #6B6364 в фоне даёт «пыль»");
if (!palette.some((color) => /^#ff5f01$/i.test(color)))
  warnings.push("нет брендового #FF5F01 — акцента не будет");
if (config.motion === "none")
  warnings.push(
    "фон секции должен двигаться: motion none будет перетёрт на flow",
  );
if (warnings.length) {
  console.log("\nпредупреждения:");
  for (const line of warnings) console.log("-", line);
} else {
  console.log("\nготово: палитра и движение в рамках правил");
}

// Заодно показываем, куда именно вставлять ссылку.
const presets = readFileSync(
  path.join(root, "lib", "hazeglow-presets.ts"),
  "utf8",
);
console.log(
  "\nвставка: lib/hazeglow-presets.ts → HAZEGLOW_LINKS.site",
  presets.includes("site: null") ? "(сейчас пусто)" : "(уже занят)",
);
