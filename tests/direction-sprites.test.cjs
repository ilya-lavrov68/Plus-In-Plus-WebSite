const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const sharp = require("sharp");

const {
  FRAME_WIDTH,
  FRAME_HEIGHT,
  FRAME_COUNT,
  PALETTE,
  createSpriteSheet,
} = require("../scripts/generate-direction-sprites.cjs");

function frameAt(sheet, index) {
  const frame = Buffer.alloc(FRAME_WIDTH * FRAME_HEIGHT * 4);
  for (let row = 0; row < FRAME_HEIGHT; row += 1) {
    sheet.copy(
      frame,
      row * FRAME_WIDTH * 4,
      ((row * FRAME_WIDTH * FRAME_COUNT) + index * FRAME_WIDTH) * 4,
      ((row * FRAME_WIDTH * FRAME_COUNT) + (index + 1) * FRAME_WIDTH) * 4,
    );
  }
  return frame;
}

test("Direction sprite sheets are reproducible, distinct and limited to the approved palette", async () => {
  const transparent = "0:0:0:0";
  const allowed = new Set([
    transparent,
    ...Object.values(PALETTE).map((color) => color.join(":")),
  ]);

  for (const kind of ["design"]) {
    const expected = createSpriteSheet(kind);
    const filename = path.resolve(__dirname, `../public/assets/pixels/direction-${kind}.png`);
    const { data, info } = await sharp(filename).raw().toBuffer({ resolveWithObject: true });

    assert.equal(info.width, FRAME_WIDTH * FRAME_COUNT);
    assert.equal(info.height, FRAME_HEIGHT);
    assert.equal(info.channels, 4);
    assert.deepEqual(data, expected, `${kind}: committed PNG is stale; run npm run sprites:directions`);

    const hashes = new Set();
    for (let index = 0; index < FRAME_COUNT; index += 1) {
      const frame = frameAt(data, index);
      hashes.add(createHash("sha256").update(frame).digest("hex"));
      let accentPixels = 0;
      for (let offset = 0; offset < frame.length; offset += 4) {
        const key = `${frame[offset]}:${frame[offset + 1]}:${frame[offset + 2]}:${frame[offset + 3]}`;
        assert.ok(allowed.has(key), `${kind}: unexpected colour ${key}`);
        if (key === PALETTE.accent.join(":")) accentPixels += 1;
      }
      assert.ok(
        accentPixels / (FRAME_WIDTH * FRAME_HEIGHT) < 0.1,
        `${kind}: accent occupies too much of frame ${index}`,
      );
    }
    assert.equal(hashes.size, FRAME_COUNT, `${kind}: every animation frame must be distinct`);
  }
});

test("Direction sprites pause offscreen and keep a final reduced-motion frame", () => {
  const component = fs.readFileSync(
    path.resolve(__dirname, "../components/site/pixel-direction-sprite.tsx"),
    "utf8",
  );
  const styles = fs.readFileSync(path.resolve(__dirname, "../styles/globals.css"), "utf8");

  assert.match(component, /IntersectionObserver/);
  assert.match(component, /visibilitychange/);
  assert.match(component, /data-frame-count="24"/);
  assert.doesNotMatch(component, /setInterval|requestAnimationFrame/);
  assert.match(styles, /animation: pixel-direction-frames 2\.4s steps\(24, end\) infinite/);
  assert.match(styles, /image-rendering: pixelated/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?background-position: -1840px 0/);
});
