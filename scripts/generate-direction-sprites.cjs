#!/usr/bin/env node

/**
 * Локальные pixel-sprite листы для двух направлений бренда.
 *
 * Никаких сетевых генераций и случайных пикселей: исходная палитра и каждый
 * кадр воспроизводятся командой `node scripts/generate-direction-sprites.cjs`.
 * Сетка 80 × 40, 24 кадра, прозрачный фон, только nearest-neighbor при выводе.
 */

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const FRAME_WIDTH = 80;
const FRAME_HEIGHT = 40;
const FRAME_COUNT = 24;
const OUTPUT_DIRECTORY = path.resolve(__dirname, "../public/assets/pixels");

const PALETTE = Object.freeze({
  ink: Object.freeze([244, 244, 242, 255]),
  neutral: Object.freeze([166, 166, 174, 255]),
  dim: Object.freeze([96, 96, 104, 255]),
  accent: Object.freeze([255, 255, 1, 255]),
});

function createFrame() {
  const data = Buffer.alloc(FRAME_WIDTH * FRAME_HEIGHT * 4);

  function rectangle(x, y, width, height, color) {
    for (let py = Math.max(0, y); py < Math.min(FRAME_HEIGHT, y + height); py += 1) {
      for (let px = Math.max(0, x); px < Math.min(FRAME_WIDTH, x + width); px += 1) {
        const offset = (py * FRAME_WIDTH + px) * 4;
        data[offset] = color[0];
        data[offset + 1] = color[1];
        data[offset + 2] = color[2];
        data[offset + 3] = color[3];
      }
    }
  }

  function outline(x, y, width, height, color) {
    rectangle(x, y, width, 1, color);
    rectangle(x, y + height - 1, width, 1, color);
    rectangle(x, y, 1, height, color);
    rectangle(x + width - 1, y, 1, height, color);
  }

  function line(x0, y0, x1, y1, color, thickness = 1) {
    let x = x0;
    let y = y0;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;

    while (true) {
      rectangle(x, y, thickness, thickness, color);
      if (x === x1 && y === y1) break;
      const doubled = 2 * error;
      if (doubled >= dy) {
        error += dy;
        x += sx;
      }
      if (doubled <= dx) {
        error += dx;
        y += sy;
      }
    }
  }

  return { data, rectangle, outline, line };
}

/** Дискретизирует непрерывный маршрут без пропусков и повторных точек. */
function rasterizePath(vertices) {
  const points = [];
  for (let index = 0; index < vertices.length - 1; index += 1) {
    const [x0, y0] = vertices[index];
    const [x1, y1] = vertices[index + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let step = 0; step <= steps; step += 1) {
      if (index > 0 && step === 0) continue;
      const progress = steps === 0 ? 0 : step / steps;
      points.push([
        Math.round(x0 + (x1 - x0) * progress),
        Math.round(y0 + (y1 - y0) * progress),
      ]);
    }
  }
  return points;
}

function drawPath(frame, points, color, count = points.length) {
  for (const [x, y] of points.slice(0, count)) frame.rectangle(x, y, 1, 1, color);
}

const AI_CHECK_POINTS = rasterizePath([[62, 20], [65, 23], [71, 17]]);
const DESIGN_PLUS_POINTS = rasterizePath([
  [36, 12], [40, 12], [40, 18], [46, 18], [46, 22], [40, 22], [40, 28],
  [36, 28], [36, 22], [30, 22], [30, 18], [36, 18], [36, 12],
]);

function drawAgentCore(frame, processingIndex) {
  const active = processingIndex >= 0;
  frame.outline(36, 15, 11, 11, active ? PALETTE.neutral : PALETTE.dim);
  frame.rectangle(40, 13, 3, 1, PALETTE.dim);
  frame.rectangle(40, 27, 3, 1, PALETTE.dim);
  frame.rectangle(41, 20, 1, 1, PALETTE.neutral);

  if (active) {
    const positions = [[41, 18], [43, 20], [41, 22], [39, 20]];
    const [x, y] = positions[processingIndex];
    frame.rectangle(x, y, 2, 2, PALETTE.accent);
  }
}

function createAiFrame(index) {
  const frame = createFrame();

  // Три стабильные зоны: редактор, agent core и проверяемый результат.
  frame.outline(4, 8, 25, 24, PALETTE.dim);
  frame.rectangle(7, 10, 2, 1, PALETTE.neutral);
  frame.rectangle(11, 10, 5, 1, PALETTE.dim);
  frame.rectangle(4, 13, 25, 1, PALETTE.dim);
  frame.line(8, 18, 10, 20, PALETTE.neutral);
  frame.line(10, 20, 8, 22, PALETTE.neutral);
  frame.rectangle(13, 18, 9, 1, PALETTE.neutral);
  frame.rectangle(13, 22, 6, 1, PALETTE.dim);

  frame.outline(57, 8, 19, 24, PALETTE.dim);
  frame.rectangle(60, 10, 3, 1, PALETTE.neutral);
  frame.rectangle(57, 13, 19, 1, PALETTE.dim);
  frame.rectangle(29, 20, 7, 1, PALETTE.dim);
  frame.rectangle(47, 20, 10, 1, PALETTE.dim);
  drawPath(frame, AI_CHECK_POINTS, PALETTE.dim);

  // 0–3: короткая строка кода появляется слева направо, без прыжка курсора.
  const codeLength = index < 4 ? [2, 4, 6, 9][index] : 9;
  frame.rectangle(13, 26, codeLength, 1, PALETTE.ink);
  if (index < 4) frame.rectangle(14 + codeLength, 25, 1, 3, PALETTE.neutral);

  let processingIndex = -1;
  if (index >= 9 && index <= 12) processingIndex = index - 9;
  drawAgentCore(frame, processingIndex);

  // 4–8 и 13–19: один пакет проходит последовательно через agent workflow.
  if (index >= 4 && index <= 8) {
    const x = [29, 30, 31, 32, 33][index - 4];
    frame.rectangle(x, 19, 2, 2, PALETTE.accent);
  } else if (index >= 13 && index <= 19) {
    const x = [47, 48, 49, 50, 51, 52, 54][index - 13];
    frame.rectangle(x, 19, 2, 2, PALETTE.accent);
  }

  // 20–23: результат подтверждается одним непрерывным штрихом.
  if (index >= 20) {
    const count = Math.round(((index - 19) / 4) * AI_CHECK_POINTS.length);
    drawPath(frame, AI_CHECK_POINTS, PALETTE.accent, count);
  }

  return frame.data;
}

function isDesignPlusInterior(x, y) {
  const vertical = x >= 37 && x <= 39 && y >= 13 && y <= 27;
  const horizontal = x >= 31 && x <= 45 && y >= 19 && y <= 21;
  return vertical || horizontal;
}

function drawDesignPlus(frame, outlineCount, fillThroughRow) {
  drawPath(frame, DESIGN_PLUS_POINTS, PALETTE.dim);
  drawPath(frame, DESIGN_PLUS_POINTS, PALETTE.accent, outlineCount);

  if (fillThroughRow === null) return;
  for (let y = 13; y <= fillThroughRow; y += 1) {
    for (let x = 31; x <= 45; x += 1) {
      if (isDesignPlusInterior(x, y)) frame.rectangle(x, y, 1, 1, PALETTE.accent);
    }
  }
}

function drawPen(frame, nibX, nibY) {
  // Один и тот же узкий силуэт пера перемещается за точкой контакта.
  frame.line(nibX, nibY, nibX + 6, nibY - 6, PALETTE.ink);
  frame.line(nibX + 1, nibY, nibX + 7, nibY - 6, PALETTE.dim);
  frame.rectangle(nibX + 6, nibY - 7, 2, 1, PALETTE.neutral);
  frame.rectangle(nibX, nibY, 1, 1, PALETTE.neutral);
}

function createDesignFrame(index) {
  const frame = createFrame();

  // Центрированный артборд не меняет размер и положение между кадрами.
  frame.outline(14, 4, 48, 32, PALETTE.dim);
  frame.rectangle(14, 4, 3, 1, PALETTE.neutral);
  frame.rectangle(14, 4, 1, 3, PALETTE.neutral);
  frame.rectangle(59, 35, 3, 1, PALETTE.neutral);
  frame.rectangle(61, 33, 1, 3, PALETTE.neutral);
  frame.rectangle(64, 34, 11, 1, PALETTE.dim);

  let nibX;
  let nibY;

  if (index <= 15) {
    // 0–15: перо обходит контур плюса без телепорта между его углами.
    const count = Math.max(1, Math.round(((index + 1) / 16) * DESIGN_PLUS_POINTS.length));
    drawDesignPlus(frame, count, null);
    [nibX, nibY] = DESIGN_PLUS_POINTS[count - 1];
  } else if (index <= 20) {
    // 16–20: заливка продвигается сверху вниз, сохраняя уже готовый контур.
    const fillRows = [14, 17, 20, 23, 27];
    const stage = index - 16;
    nibY = fillRows[stage];
    drawDesignPlus(frame, DESIGN_PLUS_POINTS.length, nibY);
    const horizontal = nibY >= 19 && nibY <= 21;
    nibX = stage % 2 === 0 ? (horizontal ? 45 : 39) : (horizontal ? 31 : 37);
  } else {
    // 21–23: законченный знак остаётся на месте, перо плавно уходит на подставку.
    drawDesignPlus(frame, DESIGN_PLUS_POINTS.length, 27);
    [nibX, nibY] = [[47, 28], [56, 30], [66, 31]][index - 21];
  }

  drawPen(frame, nibX, nibY);
  return frame.data;
}

function joinFrames(frames) {
  const sheet = Buffer.alloc(FRAME_WIDTH * FRAME_COUNT * FRAME_HEIGHT * 4);
  frames.forEach((frame, index) => {
    for (let row = 0; row < FRAME_HEIGHT; row += 1) {
      frame.copy(
        sheet,
        ((row * FRAME_WIDTH * FRAME_COUNT) + index * FRAME_WIDTH) * 4,
        row * FRAME_WIDTH * 4,
        (row + 1) * FRAME_WIDTH * 4,
      );
    }
  });
  return sheet;
}

function createSpriteSheet(kind) {
  if (kind !== "ai" && kind !== "design") throw new Error(`Unknown direction sprite: ${kind}`);
  const frames = Array.from({ length: FRAME_COUNT }, (_, index) =>
    kind === "ai" ? createAiFrame(index) : createDesignFrame(index));
  return joinFrames(frames);
}

async function writeSpriteSheet(kind) {
  const output = path.join(OUTPUT_DIRECTORY, `direction-${kind}.png`);
  const data = createSpriteSheet(kind);
  await sharp(data, {
    raw: { width: FRAME_WIDTH * FRAME_COUNT, height: FRAME_HEIGHT, channels: 4 },
  }).png({ compressionLevel: 9 }).toFile(output);
  return output;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const outputs = await Promise.all([writeSpriteSheet("ai"), writeSpriteSheet("design")]);
  for (const output of outputs) console.log(path.relative(process.cwd(), output));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  FRAME_WIDTH,
  FRAME_HEIGHT,
  FRAME_COUNT,
  PALETTE,
  createSpriteSheet,
};
