const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
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

const { CursorFillController } = require("../components/site/cursor-fill-controller.tsx");
const {
  buttonVariants,
  headerButtonVariants,
} = require("../components/ui/button-variants.ts");

test("white primary variants share cursor-fill while outline remains neutral", () => {
  for (const variant of ["default", "primary", "cta"]) {
    assert.match(buttonVariants({ variant }), /pip-cursor-fill/);
    assert.match(buttonVariants({ variant }), /bg-white/);
  }
  assert.match(headerButtonVariants({ variant: "primary" }), /pip-cursor-fill/);
  assert.doesNotMatch(buttonVariants({ variant: "outline" }), /pip-cursor-fill/);

  const css = fs.readFileSync("styles/globals.css", "utf8");
  assert.match(css, /\.pip-cursor-fill::before/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.pip-cursor-fill::before[\s\S]*transition: none/);
});

test("cursor-fill records the entry point once, including when children are hovered", () => {
  const previous = Object.fromEntries(
    ["window", "document", "Element", "HTMLElement", "Node"].map((name) => [name, global[name]])
  );
  const listeners = new Map();

  class ElementStub {}
  class HTMLElementStub extends ElementStub {}
  class NodeStub {}
  const style = new Map();
  const control = new HTMLElementStub();
  control.getBoundingClientRect = () => ({ left: 10, top: 5 });
  control.contains = (node) => node instanceof NodeStub;
  control.style = { setProperty: (name, value) => style.set(name, value) };
  const target = new ElementStub();
  target.closest = (selector) => {
    assert.equal(selector, ".pip-cursor-fill");
    return control;
  };

  global.Element = ElementStub;
  global.HTMLElement = HTMLElementStub;
  global.Node = NodeStub;
  global.window = { matchMedia: () => ({ matches: true }) };
  global.document = {
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name) => listeners.delete(name),
  };

  let view;
  let mounted = false;
  try {
    act(() => {
      view = create(React.createElement(CursorFillController));
      mounted = true;
    });
    const pointerOver = listeners.get("pointerover");
    assert.equal(typeof pointerOver, "function");
    pointerOver({ target, relatedTarget: null, clientX: 37, clientY: 19 });
    assert.equal(style.get("--cursor-fill-x"), "27px");
    assert.equal(style.get("--cursor-fill-y"), "14px");

    pointerOver({ target, relatedTarget: new NodeStub(), clientX: 99, clientY: 99 });
    assert.equal(style.get("--cursor-fill-x"), "27px", "child transitions must not reset origin");
    assert.equal(style.get("--cursor-fill-y"), "14px");

    act(() => view.unmount());
    mounted = false;
    assert.equal(listeners.has("pointerover"), false);
  } finally {
    if (mounted) view.unmount();
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete global[name];
      else global[name] = value;
    }
  }
});
