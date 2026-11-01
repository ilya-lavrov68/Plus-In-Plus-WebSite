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
      filename,
    );
}

let reducedMotion = false;
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "motion/react") {
    return { useReducedMotion: () => reducedMotion };
  }
  if (name.startsWith("@/")) {
    name = path.resolve(__dirname, "..", name.slice(2));
  }
  return originalLoad.call(this, name, parent, isMain);
};

const { AnimatedIcon } = require("../components/ui/animated-icon.tsx");

function TestIcon({ controls }) {
  return React.forwardRef(function Icon(_props, ref) {
    React.useImperativeHandle(ref, () => ({
      startAnimation: () => {
        controls.starts += 1;
      },
      stopAnimation: () => {
        controls.stops += 1;
      },
    }));
    return React.createElement("svg", { "data-test-icon": true });
  });
}

function mountIcon({ reduced = false } = {}) {
  reducedMotion = reduced;
  const controls = { starts: 0, stops: 0 };
  const listeners = new Map();
  const trigger = {
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name) => listeners.delete(name),
  };
  const host = {
    closest: (selector) => {
      assert.equal(selector, "[data-pip-icon-trigger]");
      return trigger;
    },
    parentElement: trigger,
  };
  const Icon = TestIcon({ controls });
  let view;
  act(() => {
    view = create(React.createElement(AnimatedIcon, { icon: Icon, size: 18 }), {
      createNodeMock: (element) => (element.type === "span" ? host : {}),
    });
  });
  return {
    controls,
    listeners,
    view,
    emit: (name, event = {}) => listeners.get(name)?.(event),
  };
}

test("animated icon follows the whole control for hover, focus and touch", async () => {
  const mounted = mountIcon();
  assert.deepEqual(
    [...mounted.listeners.keys()].sort(),
    ["focusin", "focusout", "pointercancel", "pointerdown", "pointerenter", "pointerleave"].sort(),
  );

  mounted.emit("pointerenter");
  assert.equal(mounted.controls.starts, 1);
  mounted.emit("pointerleave");
  assert.equal(mounted.controls.stops, 1);
  mounted.emit("focusin");
  assert.equal(mounted.controls.starts, 2);
  mounted.emit("focusout");
  assert.equal(mounted.controls.stops, 2);

  mounted.emit("pointerdown", { pointerType: "touch" });
  assert.equal(mounted.controls.starts, 3);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 550));
  });
  assert.equal(mounted.controls.stops, 3, "tap animation settles instead of looping");

  act(() => mounted.view.unmount());
  assert.equal(mounted.listeners.size, 0, "all control listeners are removed");
});

test("reduced motion leaves the icon static and removes interaction listeners", () => {
  const mounted = mountIcon({ reduced: true });
  assert.equal(mounted.controls.starts, 0);
  assert.equal(mounted.controls.stops, 1, "the library is reset to its normal frame");
  assert.equal(mounted.listeners.size, 0);
  assert.equal(mounted.view.root.findByType("span").props["data-motion"], "reduced");
  act(() => mounted.view.unmount());
});
