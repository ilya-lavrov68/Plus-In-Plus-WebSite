#!/usr/bin/env node

/**
 * Локальные pixel-sprite листы для двух направлений бренда.
 *
 * Никаких сетевых генераций и случайных пикселей: исходная палитра и каждый
 * кадр воспроизводятся командой `node scripts/generate-direction-sprites.cjs`.
 * Сетка 80 × 40, 8 кадров, прозрачный фон, только nearest-neighbor при выводе.
 */

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const FRAME_WIDTH = 80;
const FRAME_HEIGHT = 40;
const FRAME_COUNT = 8;
const OUTPUT_DIRECTORY = path.resolve(__dirname, "../public/assets/pixels");

const PALETTE = Object.freeze({
  ink: Object.freeze([250, 250, 250, 255]),
  neutral: Object.freeze([163, 163, 163, 255]),
  dim: Object.freeze([82, 82, 82, 255]),
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

function drawAgentNode(frame, centerX, centerY, active) {
  frame.outline(centerX - 3, centerY - 3, 7, 7, active ? PALETTE.accent : PALETTE.dim);
  frame.rectangle(centerX - 1, centerY - 1, 2, 2, active ? PALETTE.accent : PALETTE.neutral);
}

function createAiFrame(index) {
  const frame = createFrame();

  // Код остаётся неподвижным: изменяются только пакет и активные узлы.
  frame.line(15, 10, 9, 20, PALETTE.ink, 2);
  frame.line(9, 20, 15, 30, PALETTE.ink, 2);
  frame.line(24, 10, 30, 20, PALETTE.ink, 2);
  frame.line(30, 20, 24, 30, PALETTE.ink, 2);
  frame.line(21, 14, 18, 26, PALETTE.neutral, 1);

  frame.line(31, 20, 43, 10, PALETTE.dim);
  frame.line(31, 20, 43, 30, PALETTE.dim);
  frame.line(47, 11, 47, 29, PALETTE.dim);
  frame.line(50, 10, 65, 20, PALETTE.dim);
  frame.line(50, 30, 65, 20, PALETTE.dim);

  drawAgentNode(frame, 46, 10, index === 2 || index === 3);
  drawAgentNode(frame, 46, 30, index === 4 || index === 5);
  drawAgentNode(frame, 68, 20, index >= 6);

  const packets = [
    [32, 19], [37, 14], [42, 10], [46, 16],
    [46, 24], [43, 29], [56, 25], [63, 21],
  ];
  if (index < 7) frame.rectangle(...packets[index], 2, 2, PALETTE.accent);

  if (index >= 6) {
    frame.line(65, 20, 67, 22, PALETTE.accent);
    frame.line(67, 22, 71, 17, PALETTE.accent);
  }

  return frame.data;
}

function drawPlusCell(frame, x, y, filled) {
  if (filled) frame.rectangle(x, y, 4, 4, PALETTE.accent);
  else frame.outline(x, y, 4, 4, PALETTE.dim);
}

function createDesignFrame(index) {
  const frame = createFrame();

  // Рабочая область и линейка не перерисовываются между кадрами.
  frame.outline(6, 4, 34, 32, PALETTE.dim);
  frame.rectangle(6, 4, 3, 1, PALETTE.neutral);
  frame.rectangle(6, 4, 1, 3, PALETTE.neutral);
  frame.rectangle(37, 35, 3, 1, PALETTE.neutral);
  frame.rectangle(39, 33, 1, 3, PALETTE.neutral);
  frame.line(54, 8, 54, 27, PALETTE.dim);
  for (let y = 8; y <= 27; y += 4) frame.rectangle(54, y, y % 8 === 0 ? 4 : 2, 1, PALETTE.dim);

  const cells = [
    [20, 10], [14, 16], [20, 16], [26, 16], [20, 22],
  ];
  cells.forEach(([x, y], cellIndex) => drawPlusCell(frame, x, y, cellIndex < index));

  const penPositions = [
    [41, 28], [25, 10], [13, 14], [20, 17], [29, 17], [21, 28], [41, 28], [45, 28],
  ];
  const [penX, penY] = penPositions[index];
  frame.line(penX, penY, penX + 6, penY - 6, PALETTE.ink, 2);
  frame.rectangle(penX - 1, penY, 3, 2, PALETTE.neutral);
  if (index > 0 && index < 6) frame.rectangle(penX - 1, penY + 2, 1, 1, PALETTE.accent);

  frame.rectangle(62, 28, 5, 6, PALETTE.neutral);
  frame.rectangle(70, 28, 5, 6, index >= 5 ? PALETTE.accent : PALETTE.dim);
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
