const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { act, create } = require("react-test-renderer");

for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) =>
    module._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      filename
    );
}

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name.startsWith("@/")) {
    name = path.resolve(__dirname, "..", name.slice(2));
  }
  return originalLoad.call(this, name, parent, isMain);
};

const {
  DotLattice,
  PixelMosaic,
  SignalBlocks,
} = require("../components/site/brand-geometry.tsx");

const render = (element) => {
  let view;
  act(() => {
    view = create(element);
  });
  return view;
};

const markupOf = (view) => JSON.stringify(view.toJSON());

test("brand ornaments are deterministic and identical on every render", () => {
  const props = { cols: 12, rows: 10, seed: 7 };
  const first = markupOf(render(React.createElement(PixelMosaic, props)));
  const second = markupOf(render(React.createElement(PixelMosaic, props)));
  assert.equal(first, second, "PixelMosaic must not depend on Math.random");

  const latticeA = markupOf(render(React.createElement(DotLattice, { ...props, corner: "bottom-right" })));
  const latticeB = markupOf(render(React.createElement(DotLattice, { ...props, corner: "bottom-right" })));
  assert.equal(latticeA, latticeB, "DotLattice must stay deterministic");

  const mirrored = markupOf(render(React.createElement(PixelMosaic, { ...props, corner: "bottom-right" })));
  assert.notEqual(first, mirrored, "the corner prop must change the mosaic silhouette");
});

test("brand ornaments are decorative, sharp-edged and use brand tokens", () => {
  const mosaic = render(React.createElement(PixelMosaic));
  const lattice = render(React.createElement(DotLattice));
  const blocks = render(React.createElement(SignalBlocks, { count: 4 }));

  for (const view of [mosaic, lattice, blocks]) {
    const root = view.root.findAll((node) => typeof node.type === "string")[0];
    assert.equal(root.props["aria-hidden"], "true");
    assert.match(String(root.props.className), /pointer-events-none/);
  }

  const mosaicSource = fs.readFileSync(
    path.resolve(__dirname, "../components/site/brand-geometry.tsx"),
    "utf8"
  );
  const mosaicCode = mosaicSource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.match(mosaicSource, /shapeRendering="crispEdges"/);
  assert.doesNotMatch(mosaicCode, /Math\.random|rounded-(?:sm|md|lg|xl|2xl|3xl)/);
  assert.doesNotMatch(mosaicSource, /#FFFF01|#ffff01/i);
  // Жёлтый — главный сигнал, пурпур из референса — вторичный слой.
  assert.match(mosaicSource, /var\(--pip-signal\b/);
  assert.match(mosaicSource, /var\(--pip-signal-wash\)/);
  assert.match(mosaicSource, /var\(--pip-signal-deep\)/);
  assert.match(mosaicSource, /var\(--pip-violet\)/);

  const squares = mosaic.root.findAll((node) => node.type === "rect");
  assert.ok(squares.length > 0, "the mosaic renders square cells");
  for (const square of squares) {
    assert.equal(square.props.width, 1);
    assert.equal(square.props.height, 1);
  }

  const circles = lattice.root.findAll((node) => node.type === "circle");
  assert.ok(circles.length > 0, "the lattice renders circles");
  act(() => {
    mosaic.unmount();
    lattice.unmount();
    blocks.unmount();
  });
});

test("hero uses only brand geometry instead of glow, media frames or placeholders", () => {
  const hero = fs.readFileSync(
    path.resolve(__dirname, "../components/blocks/hero138.tsx"),
    "utf8"
  );
  assert.match(hero, /PixelMosaic/);
  assert.match(hero, /DotLattice/);
  assert.doesNotMatch(hero, /blur-3xl|radial-gradient|hero-pillar|MediaPlaceholder/);
  assert.match(hero, /overflow-hidden bg-background/);
  assert.match(hero, /headingAccent/);
  assert.match(hero, /GridField/);

  const globals = fs.readFileSync(path.resolve(__dirname, "../styles/globals.css"), "utf8");
  assert.match(globals, /--primary:\s*#FFFF01;/);
  assert.match(globals, /--radius-lg:\s*0;/);
  assert.match(globals, /--radius-2xl:\s*0;/);
  assert.match(globals, /\.pip-tech-grid\s*\{/);
  assert.match(globals, /\.pip-tech-grid--bold\s*\{/);
  assert.match(globals, /\.pip-eyebrow::before\s*\{/);
  assert.doesNotMatch(globals, /hero-media-frame|hero-pillar/);
  assert.doesNotMatch(globals, /--pip-accent/);
});

test("design system documentation records the rebrand contract", () => {
  const doc = fs.readFileSync(
    path.resolve(__dirname, "../docs/brand-rebrand.md"),
    "utf8"
  );
  for (const token of [
    "#FFFF01",
    "#8F9CFC",
    "#181819",
    "#EAEDFE",
    "PixelMosaic",
    "DotLattice",
    "GridField",
  ]) {
    assert.ok(doc.includes(token), `brand documentation must mention ${token}`);
  }
  assert.match(doc, /rounded-none/);
  assert.match(doc, /rounded-full/);
  assert.ok(
    fs.existsSync(path.resolve(__dirname, "../docs/brand/hero-preview.svg")),
    "the brand sheet must ship with the repository"
  );
});

test("public routes get distinct page geometry instead of one repeated block", () => {
  const pageGeometry = require("../components/site/page-geometry.tsx");
  const variants = [
    "ServicesGridBand",
    "ShopSideGrid",
    "BlogLatticeField",
    "ContactGridColumn",
    "AuthMosaicField",
    "LegalLineBand",
    "AiGridBand",
    "StorySignalRule",
  ];
  const signatures = new Map();

  for (const name of variants) {
    assert.equal(typeof pageGeometry[name], "function", `${name} must be exported`);
    const view = render(React.createElement(pageGeometry[name]));
    const tree = view.toJSON();
    assert.ok(tree, `${name} must render a decorative layer`);
    assert.equal(tree.props["aria-hidden"], "true");
    assert.match(String(tree.props.className), /pointer-events-none/);
    assert.doesNotMatch(JSON.stringify(tree), /rounded-(?:sm|md|lg|xl|2xl|3xl)/);
    signatures.set(name, JSON.stringify(tree));
    act(() => view.unmount());
  }
  assert.equal(
    new Set(signatures.values()).size,
    variants.length,
    "every route composition must look different"
  );

  // services/shop/blog уже переведены на блоки payloadcms.com — орнаментов там нет.
  const wiring = {
    "components/blocks/blog11.tsx": "BlogLatticeField",
    "components/blocks/contact29.tsx": "ContactGridColumn",
    "components/blocks/signup10.tsx": "AuthMosaicField",
    "app/(site)/privacy/page.tsx": "LegalLineBand",
    "app/(site)/terms/page.tsx": "LegalLineBand",
    "components/site/story-timeline.tsx": "StorySignalRule",
  };
  for (const [file, component] of Object.entries(wiring)) {
    const source = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
    assert.match(source, new RegExp(`\\b${component}\\b`), `${file} must mount ${component}`);
  }

  for (const file of ["components/blocks/hero138.tsx", "app/(site)/layout.tsx"]) {
    const source = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
    assert.doesNotMatch(source, /pip-hairline-grid/, `${file} must use .pip-tech-grid`);
  }
});
