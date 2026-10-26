const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { act, create } = require("react-test-renderer");
const { NextIntlClientProvider } = require("next-intl");

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

const root = path.resolve(__dirname, "..");
const Select = () => null;
const selectPrimitive = () => null;
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/app/actions/services") {
    return {
      updateServicePrice: async () => { throw new Error("isolated update failure"); },
      updateServicePriceType: async () => ({ ok: false }),
    };
  }
  if (name === "@/app/actions/orders") {
    return {
      setOrderPrice: async () => ({ ok: false }),
      setOrderLocked: async () => ({ ok: false }),
    };
  }
  if (name === "@/components/ui/select") {
    return {
      Select,
      SelectContent: selectPrimitive,
      SelectItem: selectPrimitive,
      SelectTrigger: selectPrimitive,
      SelectValue: selectPrimitive,
    };
  }
  if (name.startsWith("@/")) name = path.resolve(root, name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { getClientMessages, messages } = require("../i18n-catalog.ts");
const { InlinePriceEditor } = require("../components/admin/inline-price-editor.tsx");
const { InlinePriceType } = require("../components/admin/inline-price-type.tsx");
const { OrderPriceForm } = require("../components/orders/order-price-form.tsx");

function render(component) {
  let renderer;
  act(() => {
    renderer = create(
      React.createElement(
        NextIntlClientProvider,
        { locale: "en", messages: getClientMessages("en"), timeZone: "UTC" },
        component,
      ),
    );
  });
  return renderer;
}

function textOf(node) {
  return JSON.stringify(node.children);
}

test("inline service price keeps the generic error without the actions namespace", async () => {
  const renderer = render(React.createElement(InlinePriceEditor, {
    serviceId: "service-1", serviceTitle: "Service", basePrice: 10000, emptyLabel: "None",
  }));
  const initialButton = renderer.root.findByProps({ type: "button" });
  act(() => initialButton.props.onClick());
  const input = renderer.root.findByProps({ inputMode: "decimal" });
  act(() => input.props.onChange({ target: { value: "200" } }));
  await act(async () => input.props.onKeyDown({ key: "Enter", preventDefault() {} }));

  assert.equal(textOf(renderer.root.findByProps({ role: "alert" })), JSON.stringify([messages.en.actions.genericError]));
  assert.equal(Object.hasOwn(getClientMessages("en"), "actions"), false);
  renderer.unmount();
});

test("inline price type keeps the update failure without the actions namespace", async () => {
  const renderer = render(React.createElement(InlinePriceType, {
    serviceId: "service-1", priceType: "quote", isOrderable: false,
  }));
  await act(async () => renderer.root.findByType(Select).props.onValueChange("fixed"));

  assert.equal(textOf(renderer.root.findByProps({ role: "alert" })), JSON.stringify([messages.en.actions.updateServiceFailed]));
  renderer.unmount();
});

test("order price validation keeps the invalid amount message without the actions namespace", async () => {
  const renderer = render(React.createElement(OrderPriceForm, {
    orderId: "order-1", estimatedAmount: 10000, currentTotal: 0, currency: "RUB",
  }));
  const input = renderer.root.findByProps({ id: "agreed-price" });
  act(() => input.props.onChange({ target: { value: "not-a-number" } }));
  await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));

  assert.equal(textOf(renderer.root.findByProps({ role: "alert" })), JSON.stringify([messages.en.actions.invalidAmount]));
  renderer.unmount();
});
